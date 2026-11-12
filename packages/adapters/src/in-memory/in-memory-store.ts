import {
  profileVersionKey,
  type JobPosting,
  type MonthlyBudget,
  type Person,
  type ProfileVersion,
  type SellingPoint,
  type Verdict,
} from "@matchmaker/rules";
import type {
  AtsCompany,
  CappedAction,
  CompanyRegistry,
  JobDetailRow,
  MatchRecords,
  MonitoredPerson,
  MonitoringRoster,
  MonthlyBudgetControl,
  People,
  PersonDataVault,
  PostingCatalog,
  PostingsForScoring,
  ProfileVersions,
  ProfilesForScoring,
  ProfilesForSearch,
  ResultRow,
  ResultsReadModel,
  SearchRunRecord,
  SearchRuns,
  SourceSwitchControl,
  SourceSwitchboard,
  StoredMatch,
  UsageLedger,
} from "@matchmaker/use-cases";

/**
 * Storage for development and tests: every gateway the use cases own, in RAM. The first local database (D2)
 * implements the same interfaces (ADR 0006); nothing inside the boundary changes.
 */
export class InMemoryStore
  implements
    ProfilesForScoring,
    ProfilesForSearch,
    ProfileVersions,
    PostingsForScoring,
    PostingCatalog,
    MatchRecords,
    ResultsReadModel,
    SearchRuns,
    People,
    MonitoringRoster,
    MonthlyBudgetControl,
    PersonDataVault,
    CompanyRegistry,
    SourceSwitchboard,
    SourceSwitchControl
{
  private readonly profiles = new Map<string, ProfileVersion[]>(); // personId -> versions, last is active
  private readonly sellingPointsByPerson = new Map<string, readonly SellingPoint[]>();
  private readonly postings = new Map<string, JobPosting>();
  private readonly postingIdByIdentity = new Map<string, string>();
  private matches: StoredMatch[] = [];
  private runs: SearchRunRecord[] = [];
  private readonly people = new Map<string, Person & { lastOpenedAt: string | null }>();
  private budget: MonthlyBudget = null;
  private readonly companies = new Map<string, AtsCompany>();
  private readonly switches = new Map<string, { enabled: boolean; reason: string | null; tier: 1 | 2 | 3 | 4 }>();

  // ---- profiles ----
  async activeProfileVersion(personId: string) {
    return this.profiles.get(personId)?.at(-1) ?? null;
  }
  async active(personId: string) {
    return this.activeProfileVersion(personId);
  }
  async saveNewVersion(profile: ProfileVersion, sellingPoints: readonly SellingPoint[]) {
    this.profiles.set(profile.personId, [...(this.profiles.get(profile.personId) ?? []), profile]);
    this.sellingPointsByPerson.set(profile.personId, sellingPoints);
  }
  async sellingPoints(personId: string) {
    return this.sellingPointsByPerson.get(personId) ?? [];
  }
  /** Every saved version, oldest first (observation for tests; not a port method). */
  versionsOf(personId: string): readonly ProfileVersion[] {
    return this.profiles.get(personId) ?? [];
  }

  // ---- postings ----
  async postingsByIds(ids: readonly string[]) {
    return ids.flatMap((id) => this.postings.get(id) ?? []);
  }
  async findByIdentityKey(identityKey: string) {
    const id = this.postingIdByIdentity.get(identityKey);
    return id === undefined ? null : (this.postings.get(id) ?? null);
  }
  async save(posting: JobPosting, identityKey: string) {
    this.postings.set(posting.id, posting);
    this.postingIdByIdentity.set(identityKey, posting.id);
  }
  async openPostings() {
    return [...this.postings.values()].filter((p) => p.status === "open");
  }
  async markClosed(postingId: string) {
    const p = this.postings.get(postingId);
    if (p) this.postings.set(postingId, { ...p, status: "closed" });
  }

  // ---- matches ----
  async findMatch(key: string, postingId: string, revision: number) {
    return this.matches.find((m) => m.profileVersionKey === key && m.postingId === postingId && m.postingRevision === revision) ?? null;
  }
  async latestVerdictBefore(personId: string, postingId: string, key: string): Promise<Verdict | null> {
    const earlier = this.matches.filter((m) => m.personId === personId && m.postingId === postingId && m.profileVersionKey !== key);
    return earlier.at(-1)?.assessment.verdict ?? null;
  }
  async saveMatch(match: StoredMatch) {
    this.matches.push(match);
  }
  async postingIdsScoredFor(personId: string) {
    return [...new Set(this.matches.filter((m) => m.personId === personId).map((m) => m.postingId))];
  }

  // ---- results read model ----
  async currentResults(personId: string): Promise<readonly ResultRow[]> {
    const profile = await this.activeProfileVersion(personId);
    if (profile === null) return [];
    const key = profileVersionKey(profile);
    return this.matches.filter((m) => m.personId === personId && m.profileVersionKey === key).flatMap((m) => this.rowOf(m));
  }
  async jobDetail(personId: string, postingId: string): Promise<JobDetailRow | null> {
    const profile = await this.activeProfileVersion(personId);
    if (profile === null) return null;
    const key = profileVersionKey(profile);
    const match = this.matches.findLast((m) => m.personId === personId && m.profileVersionKey === key && m.postingId === postingId);
    const row = match === undefined ? undefined : this.rowOf(match)[0];
    if (row === undefined) return null;
    // Evidence of the version the match was judged against (results read only the active version's matches).
    const judgedAgainst = (this.profiles.get(personId) ?? []).find((v) => profileVersionKey(v) === match!.profileVersionKey);
    return { ...row, evidence: (judgedAgainst?.evidence ?? []).map((e) => ({ id: e.id, text: e.text })) };
  }
  private rowOf(m: StoredMatch): ResultRow[] {
    const p = this.postings.get(m.postingId);
    if (!p) return [];
    return [
      {
        postingId: p.id,
        title: p.title,
        employer: p.employer,
        location: p.location,
        postingUrl: p.sources[0]?.url ?? "",
        requirements: p.requirements,
        assessment: m.assessment,
        reason: m.narration.reason,
        pointsToCapitalize: m.narration.pointsToCapitalize,
        verdictChangedFrom: m.verdictChangedFrom,
        userState: m.userState,
        postingOpen: p.status === "open",
        scoredAt: m.scoredAt,
      },
    ];
  }
  async setUserState(personId: string, postingId: string, state: "applied" | "dismissed") {
    this.matches.forEach((m, i) => {
      if (m.personId === personId && m.postingId === postingId) this.matches[i] = { ...m, userState: state };
    });
  }

  // ---- runs, registry, switches ----
  async record(run: SearchRunRecord) {
    this.runs.push(run);
  }
  recordedRuns(): readonly SearchRunRecord[] {
    return this.runs;
  }
  async register(company: AtsCompany) {
    this.companies.set(`${company.ats}:${company.companyId}`, company);
  }
  async switchedOn(sourceName: string) {
    return this.switches.get(sourceName)?.enabled ?? null;
  }
  async setEnabled(sourceName: string, enabled: boolean, reason: string) {
    this.switches.set(sourceName, { enabled, reason, tier: this.switches.get(sourceName)?.tier ?? 1 });
  }
  async states() {
    return [...this.switches.entries()].map(([sourceName, s]) => ({ sourceName, tier: s.tier, enabled: s.enabled, reason: s.reason }));
  }

  // ---- people (AB-1) ----
  async add(person: Person) {
    this.people.set(person.personId, { ...person, lastOpenedAt: null });
  }
  async exists(personId: string) {
    return this.people.has(personId);
  }
  async personOf(personId: string): Promise<Person | null> {
    const p = this.people.get(personId);
    return p === undefined ? null : { personId: p.personId, displayName: p.displayName, createdAt: p.createdAt };
  }
  async all(): Promise<readonly Person[]> {
    return [...this.people.values()].map(({ personId, displayName, createdAt }) => ({ personId, displayName, createdAt }));
  }
  async rename(personId: string, displayName: string) {
    const p = this.people.get(personId);
    if (p) this.people.set(personId, { ...p, displayName });
  }
  async recordOpened(personId: string, at: string) {
    const p = this.people.get(personId);
    if (p) this.people.set(personId, { ...p, lastOpenedAt: at });
  }

  // ---- monitoring roster: on once a profile's first search has run (Flow 6 step 1) ----
  async peopleWithMonitoringOn(): Promise<readonly MonitoredPerson[]> {
    return [...this.people.values()].flatMap((p) => {
      const last = this.runs.filter((r) => r.personId === p.personId).at(-1);
      return last === undefined
        ? []
        : [{ personId: p.personId, lastSearchAt: last.startedAt, lastOpenedAt: p.lastOpenedAt ?? p.createdAt }];
    });
  }

  // ---- the owner's monthly budget (AB-3) ----
  async monthlyBudget() {
    return this.budget;
  }
  async setMonthlyBudget(budget: MonthlyBudget) {
    this.budget = budget;
  }

  // ---- export and delete one person's data (AB-4) ----
  async exportAll(personId: string): Promise<Uint8Array> {
    const archive = {
      person: await this.personOf(personId),
      profileVersions: this.profiles.get(personId) ?? [],
      sellingPoints: this.sellingPointsByPerson.get(personId) ?? [],
      results: this.matches.filter((m) => m.personId === personId).flatMap((m) => this.rowOf(m)),
      searchRuns: this.runs.filter((r) => r.personId === personId),
    };
    return new TextEncoder().encode(JSON.stringify(archive));
  }
  async eraseAll(personId: string) {
    this.people.delete(personId);
    this.profiles.delete(personId);
    this.sellingPointsByPerson.delete(personId);
    this.matches = this.matches.filter((m) => m.personId !== personId);
    this.runs = this.runs.filter((r) => r.personId !== personId);
    // Postings and the company registry are shared job data, not the person's: they stay.
  }
}

/** Daily-cap counts (a separate humble store: its "record" would collide with SearchRuns.record). Days are UTC days (D13). */
export class InMemoryUsageLedger implements UsageLedger, PersonDataVault {
  private usage: { personId: string; action: CappedAction; at: Date }[] = [];
  async usedToday(personId: string, action: CappedAction, now: Date) {
    const day = now.toISOString().slice(0, 10);
    return this.usage.filter((u) => u.personId === personId && u.action === action && u.at.toISOString().slice(0, 10) === day).length;
  }
  async record(personId: string, action: CappedAction, at: Date) {
    this.usage.push({ personId, action, at });
  }
  async exportAll(personId: string): Promise<Uint8Array> {
    return new TextEncoder().encode(JSON.stringify(this.usage.filter((u) => u.personId === personId)));
  }
  async eraseAll(personId: string) {
    this.usage = this.usage.filter((u) => u.personId !== personId);
  }
}
