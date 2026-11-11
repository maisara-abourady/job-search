import { profileVersionKey, type Account, type FairUseAction, type JobPosting, type ProfileVersion, type SellingPoint, type Verdict } from "@matchmaker/rules";
import type {
  Accounts, AccountsForAccess, AtsCompany, CompanyRegistry, JobDetailRow, MatchRecords, PostingCatalog, PostingsForScoring, ProfileVersions,
  ProfilesForScoring, ProfilesForSearch, ResultRow, ResultsReadModel, SearchRunRecord, SearchRuns, SourceSwitchControl,
  SourceSwitchboard, StoredMatch, UsageLedger,
} from "@matchmaker/use-cases";

/**
 * Storage for development and tests: every gateway the use cases own, in RAM. The first real database
 * implements the same interfaces (ADR 0006); nothing inside the boundary changes.
 */
export class InMemoryStore
  implements
    ProfilesForScoring, ProfilesForSearch, ProfileVersions, PostingsForScoring, PostingCatalog, MatchRecords, ResultsReadModel,
    SearchRuns, Accounts, AccountsForAccess, CompanyRegistry, SourceSwitchboard, SourceSwitchControl
{
  private readonly profiles = new Map<string, ProfileVersion[]>(); // userId -> versions, last is active
  private readonly sellingPointsByUser = new Map<string, readonly SellingPoint[]>();
  private readonly postings = new Map<string, JobPosting>();
  private readonly postingIdByIdentity = new Map<string, string>();
  private readonly matches: StoredMatch[] = [];
  private readonly runs: SearchRunRecord[] = [];
  private readonly accounts = new Map<string, Account>();
  private readonly appliedSubscriptionEvents = new Set<string>();
  private readonly companies = new Map<string, AtsCompany>();
  private readonly switches = new Map<string, { enabled: boolean; reason: string | null; tier: 1 | 2 | 3 | 4 }>();

  // ---- profiles ----
  async activeProfileVersion(userId: string) {
    return this.profiles.get(userId)?.at(-1) ?? null;
  }
  async active(userId: string) {
    return this.activeProfileVersion(userId);
  }
  async saveNewVersion(profile: ProfileVersion, sellingPoints: readonly SellingPoint[]) {
    this.profiles.set(profile.userId, [...(this.profiles.get(profile.userId) ?? []), profile]);
    this.sellingPointsByUser.set(profile.userId, sellingPoints);
  }
  async sellingPoints(userId: string) {
    return this.sellingPointsByUser.get(userId) ?? [];
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
  async latestVerdictBefore(userId: string, postingId: string, key: string): Promise<Verdict | null> {
    const earlier = this.matches.filter((m) => m.userId === userId && m.postingId === postingId && m.profileVersionKey !== key);
    return earlier.at(-1)?.assessment.verdict ?? null;
  }
  async saveMatch(match: StoredMatch) {
    this.matches.push(match);
  }
  async postingIdsScoredFor(userId: string) {
    return [...new Set(this.matches.filter((m) => m.userId === userId).map((m) => m.postingId))];
  }

  // ---- results read model ----
  async currentResults(userId: string): Promise<readonly ResultRow[]> {
    const profile = await this.activeProfileVersion(userId);
    if (profile === null) return [];
    const key = profileVersionKey(profile);
    return this.matches.filter((m) => m.userId === userId && m.profileVersionKey === key).flatMap((m) => this.rowOf(m));
  }
  async jobDetail(userId: string, postingId: string): Promise<JobDetailRow | null> {
    const profile = await this.activeProfileVersion(userId);
    if (profile === null) return null;
    const key = profileVersionKey(profile);
    const match = this.matches.findLast((m) => m.userId === userId && m.profileVersionKey === key && m.postingId === postingId);
    const row = match === undefined ? undefined : this.rowOf(match)[0];
    if (row === undefined) return null;
    // Evidence of the version the match was judged against (results read only the active version's matches).
    const judgedAgainst = (this.profiles.get(userId) ?? []).find((v) => profileVersionKey(v) === match!.profileVersionKey);
    return { ...row, evidence: (judgedAgainst?.evidence ?? []).map((e) => ({ id: e.id, text: e.text })) };
  }
  private rowOf(m: StoredMatch): ResultRow[] {
    const p = this.postings.get(m.postingId);
    if (!p) return [];
    return [{
      postingId: p.id, title: p.title, employer: p.employer, location: p.location, postingUrl: p.sources[0]?.url ?? "",
      requirements: p.requirements, assessment: m.assessment, reason: m.narration.reason,
      pointsToCapitalize: m.narration.pointsToCapitalize, verdictChangedFrom: m.verdictChangedFrom, userState: m.userState,
      postingOpen: p.status === "open", scoredAt: m.scoredAt,
    }];
  }
  async setUserState(userId: string, postingId: string, state: "applied" | "dismissed") {
    this.matches.forEach((m, i) => {
      if (m.userId === userId && m.postingId === postingId) this.matches[i] = { ...m, userState: state };
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
  async isEnabled(sourceName: string) {
    return this.switches.get(sourceName)?.enabled ?? true;
  }
  async setEnabled(sourceName: string, enabled: boolean, reason: string) {
    this.switches.set(sourceName, { enabled, reason, tier: this.switches.get(sourceName)?.tier ?? 1 });
  }
  async states() {
    return [...this.switches.entries()].map(([sourceName, s]) => ({ sourceName, tier: s.tier, enabled: s.enabled, reason: s.reason }));
  }

  // ---- accounts and usage ----
  async accountOf(userId: string) {
    return this.accounts.get(userId) ?? null;
  }
  async create(account: Account) {
    this.accounts.set(account.userId, account);
  }
  async updateSubscription(userId: string, subscription: Account["subscription"]) {
    const a = this.accounts.get(userId);
    if (a) this.accounts.set(userId, { ...a, subscription });
  }
  async applySubscriptionEvent(eventId: string, userId: string, subscription: Account["subscription"]): Promise<"applied" | "duplicate"> {
    // One synchronous step, so it is atomic in this single-threaded store; Postgres uses a unique key and a transaction.
    if (this.appliedSubscriptionEvents.has(eventId)) return "duplicate";
    this.appliedSubscriptionEvents.add(eventId);
    const a = this.accounts.get(userId);
    if (a) this.accounts.set(userId, { ...a, subscription });
    return "applied";
  }
  async paywalledBefore(_cutoffIso: string): Promise<readonly string[]> {
    return []; // HAND-OFF: compute with accessStatus() once retention is built
  }
}

/** Fair-use counts (a separate humble store: its "record" would collide with SearchRuns.record). */
export class InMemoryUsageLedger implements UsageLedger {
  private readonly usage: { userId: string; action: FairUseAction; at: Date }[] = [];
  async usedToday(userId: string, action: FairUseAction, now: Date) {
    const day = now.toISOString().slice(0, 10);
    return this.usage.filter((u) => u.userId === userId && u.action === action && u.at.toISOString().slice(0, 10) === day).length;
  }
  async record(userId: string, action: FairUseAction, at: Date) {
    this.usage.push({ userId, action, at });
  }
}
