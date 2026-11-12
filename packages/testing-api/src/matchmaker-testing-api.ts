import {
  acceptsLocalRequest,
  presentResults,
  presentRunningCost,
  type ResultsViewModel,
  type RunningCostViewModel,
} from "@matchmaker/delivery";
import {
  AsyncSpendMeter,
  InMemoryProductEventLog,
  InMemorySpendLedger,
  InMemoryStore,
  InMemoryUsageLedger,
  JsonArchiveVault,
  TemplateNarrator,
} from "@matchmaker/adapters";
import { composeMatchmaker, type Matchmaker } from "@matchmaker/main";
import { postingIdentityKey, type JobPosting, type MatchJudgments, type ProfileVersion, type SourceTier } from "@matchmaker/rules";
import type {
  CreatePersonResponse,
  FoundPosting,
  JobSource,
  ListResultsResponse,
  PersonSummary,
  ProductEvent,
  RunDueMonitoringResponse,
  RunJobSearchResponse,
  ScoredJobNotice,
  SearchRunRecord,
  ViewJobDetailResponse,
  ViewRunningCostResponse,
} from "@matchmaker/use-cases";
import { aJobPosting, aProfile, enrichmentOf } from "./builders.ts";

/** What the judge says about a posting a test did not script: a middling, evidence-free judgment. */
const MODEST_JUDGMENT: MatchJudgments = { requirements: [], experienceRelevance: 0.5, skillsAndTools: 0.5, scopeAlignment: 0.5 };

/**
 * The testing API (§10.3): a superset of what the UI uses, with superpowers. Forces states (people, profiles,
 * postings, time), bypasses expensive resources (models, sources, storage), and hides the application's
 * structure so tests and production code can be refactored independently.
 * Tests talk to this class only; never to interactors, adapters or file paths.
 *
 * Rule for every new slice: each port a slice adds to `MatchmakerDetails` gets a scripted double here, wired in
 * the constructor, plus the superpowers its tests need to force that port's answers (as `judgeWillSay` does for
 * `MatchJudge`). A test must never need a real model, source, file or clock.
 */
export class MatchmakerTestingApi {
  private readonly store = new InMemoryStore();
  private readonly usage = new InMemoryUsageLedger();
  private readonly spendLedger = new InMemorySpendLedger();
  private readonly events = new InMemoryProductEventLog();
  /** The meter scripted details report spend to, exactly as real adapters will (ADR 0010). */
  private readonly meter: AsyncSpendMeter;
  private judgeSpendMicros = 0;
  private nowIso = "2026-11-11T09:00:00.000Z";
  private idCounter = 0;
  private readonly judgments = new Map<string, MatchJudgments>();
  /** Live list handed to Main: scripting a source later adds it to the running app. */
  private readonly sources: JobSource[] = [];
  private readonly queriedSources: string[] = [];
  readonly judgeCalls: string[] = [];
  /** Background failures, collected so `backgroundWorkSettled()` can fail the test that caused them. */
  private readonly backgroundErrors: string[] = [];
  private plannerError: Error | null = null;
  private readonly requestedSearches: { personId: string; trigger: "onboarding" | "manual" | "scheduled" }[] = [];
  readonly feed: ScoredJobNotice[] = [];
  private readonly app: Matchmaker;

  constructor() {
    const self = this;
    const clock = { now: () => new Date(self.nowIso) };
    this.meter = new AsyncSpendMeter(this.spendLedger, clock);
    this.app = composeMatchmaker({
      storage: this.store,
      // Its own object: the store keeps exactly the methods its class gives it.
      operatorConsole: {
        setEnabled: (sourceName, enabled, reason) => self.store.setEnabled(sourceName, enabled, reason),
        states: () => self.store.states(),
        recent: async () => [],
      },
      usage: this.usage,
      spendLedger: this.spendLedger,
      spendAttribution: this.meter,
      personData: new JsonArchiveVault([
        { section: "profile", vault: this.store },
        { section: "dailyUsage", vault: this.usage },
        { section: "spend", vault: this.spendLedger },
        { section: "productEvents", vault: this.events },
      ]),
      productEvents: this.events,
      clock,
      ids: { next: (prefix) => `${prefix}-${++self.idCounter}` },
      judge: {
        judge: async (_profile, posting) => {
          self.judgeCalls.push(posting.id);
          if (self.judgeSpendMicros > 0)
            await self.meter.record({ category: "model", provider: "scripted-judge", amountMicros: self.judgeSpendMicros });
          return self.judgments.get(posting.id) ?? MODEST_JUDGMENT;
        },
      },
      narrator: new TemplateNarrator(),
      planner: {
        plan: async (_p, widen) => {
          if (self.plannerError) throw self.plannerError;
          return {
            queries: [{ titles: ["engineer"], keywords: [], locations: [], includeRemote: true }],
            adjacentTitlesUsed: widen ? ["adjacent role"] : [],
          };
        },
      },
      enricher: { enrich: async (found) => enrichmentOf(found) },
      ranker: { rank: async (_p, postings) => postings.map((p) => p.id) },
      sources: this.sources,
      liveness: { isLive: async () => true },
      atsLinks: { recognize: () => null },
      feed: { jobScored: (n) => self.feed.push(n) },
      onBackgroundError: (task, e) => {
        self.backgroundErrors.push(`background task ${task} failed: ${String(e)}`);
      },
    });
    // Observe the search request port Main wired (monitoring and onboarding reach discovery through it).
    const searchRequests = this.app.requests.searchRequests;
    const requestSearch = searchRequests.requestSearch;
    searchRequests.requestSearch = async (personId, trigger) => {
      self.requestedSearches.push({ personId, trigger });
      return requestSearch(personId, trigger);
    };
  }

  // ---------- superpowers: force state ----------
  atTime(iso: string): this {
    this.nowIso = iso;
    return this;
  }
  /** A person profile the owner created (through the real use case, so the north-star start is recorded). Returns its id. */
  async givenPerson(displayName: string, onIso?: string): Promise<string> {
    const previous = this.nowIso;
    if (onIso) this.nowIso = onIso;
    const { personId } = await this.app.useCases.createPerson.execute({ displayName });
    this.nowIso = previous;
    return personId;
  }
  async givenProfile(personId: string, overrides: Partial<ProfileVersion> = {}): Promise<ProfileVersion> {
    const current = await this.store.activeProfileVersion(personId);
    const profile = aProfile({ personId, version: (current?.version ?? 0) + 1, ...overrides });
    await this.store.saveNewVersion(profile, []);
    return profile;
  }
  async givenPosting(overrides: Partial<JobPosting> = {}): Promise<JobPosting> {
    const posting = aJobPosting({ id: `job-${++this.idCounter}`, postedAt: this.nowIso, ...overrides });
    await this.store.save(posting, postingIdentityKey(posting));
    return posting;
  }
  judgeWillSay(postingId: string, judgments: MatchJudgments): this {
    this.judgments.set(postingId, judgments);
    return this;
  }
  /** `costPerCallMicros` makes the source a paid one: each call reports that much aggregator spend. */
  sourceReturns(name: string, tier: SourceTier, postings: readonly Partial<FoundPosting>[], costPerCallMicros = 0): this {
    const result = postings.map((p, i) => ({
      sourceName: name,
      tier,
      url: `https://${name}.example/${i}`,
      employer: "Acme",
      title: "Engineer",
      location: "Berlin",
      description: "Build things.",
      postedAt: this.nowIso,
      fetchedAt: this.nowIso,
      ...p,
    }));
    const meter = this.meter;
    const queried = this.queriedSources;
    this.sources.push({
      descriptor: { name, tier },
      search: async () => {
        queried.push(name);
        if (costPerCallMicros > 0) await meter.record({ category: "aggregator", provider: name, amountMicros: costPerCallMicros });
        return result;
      },
    });
    return this;
  }
  /** Every judgment from now on costs this much model spend. */
  judgeCosts(micros: number): this {
    this.judgeSpendMicros = micros;
    return this;
  }
  /** From now on the search planner throws, so every search fails before any source is asked. */
  searchPlannerFails(reason: string): this {
    this.plannerError = new Error(reason);
    return this;
  }
  sourceFails(name: string, tier: SourceTier): this {
    const queried = this.queriedSources;
    this.sources.push({
      descriptor: { name, tier },
      search: async () => {
        queried.push(name);
        throw new Error(`${name} is down`);
      },
    });
    return this;
  }

  // ---------- what the owner does (profiles, spending, sources) ----------
  async createProfile(displayName: string): Promise<CreatePersonResponse> {
    return this.app.useCases.createPerson.execute({ displayName });
  }
  async renameProfile(personId: string, displayName: string): Promise<void> {
    await this.app.useCases.renamePerson.execute({ personId, displayName });
  }
  async profiles(): Promise<readonly PersonSummary[]> {
    return (await this.app.useCases.listPeople.execute()).people;
  }
  async openProfile(personId: string): Promise<PersonSummary> {
    return this.app.useCases.openPerson.execute({ personId });
  }
  /** The export archive, parsed (its format is the adapter's; tests read only what they assert). */
  async exportProfile(personId: string): Promise<Record<string, unknown>> {
    const { archive } = await this.app.useCases.exportPersonData.execute({ personId });
    return JSON.parse(new TextDecoder().decode(archive)) as Record<string, unknown>;
  }
  async deleteProfile(personId: string): Promise<void> {
    await this.app.useCases.deletePerson.execute({ personId });
  }
  async setMonthlyBudget(limitMicros: number | null): Promise<void> {
    await this.app.useCases.setMonthlyBudget.execute({ limitMicros });
  }
  async runningCost(monthOf?: string): Promise<ViewRunningCostResponse> {
    return this.app.useCases.viewRunningCost.execute(monthOf === undefined ? {} : { monthOf });
  }
  async runningCostScreen(): Promise<RunningCostViewModel> {
    return presentRunningCost(await this.runningCost());
  }
  async switchSource(sourceName: string, enabled: boolean, reason = "owner's choice"): Promise<void> {
    await this.app.useCases.operateSources.switchSource({ sourceName, enabled, reason });
  }
  /** What every configuration does when the app starts (and on each timer tick): the catch-up monitoring run. */
  async appStarts(): Promise<RunDueMonitoringResponse> {
    const response = await this.app.useCases.runDueMonitoring.execute();
    await this.backgroundWorkSettled();
    return response;
  }
  /** AB-5: would the web Main's route handlers serve a request with these headers? */
  localRequestAccepted(headers: { host: string | null; origin: string | null }): boolean {
    return acceptsLocalRequest(headers);
  }

  // ---------- what the UI and the scheduler can do for the open profile ----------
  async scorePostings(personId: string, postingIds: readonly string[]) {
    return this.app.useCases.scoreJobs.execute({ personId, runId: null, postingIds, cutAtPrefilter: [] });
  }
  async searchNow(personId: string, options: { overBudgetConfirmed?: boolean } = {}): Promise<RunJobSearchResponse> {
    return this.app.useCases.runJobSearch.execute({ personId, trigger: "manual", ...options });
  }
  async results(personId: string): Promise<ListResultsResponse> {
    return this.app.useCases.listResults.execute({ personId });
  }
  async resultsScreen(personId: string): Promise<ResultsViewModel> {
    return presentResults(await this.results(personId));
  }
  async jobDetail(personId: string, postingId: string): Promise<ViewJobDetailResponse> {
    return this.app.useCases.viewJobDetail.execute({ personId, postingId });
  }
  async markApplied(personId: string, postingId: string): Promise<void> {
    await this.app.useCases.recordJobDecision.execute({ personId, postingId, decision: "applied" });
  }

  /** What intake does once a profile is saved: request the first search in the background (P-1, onboarding trigger). */
  async onboardingSearch(personId: string): Promise<void> {
    await this.app.requests.searchRequests.requestSearch(personId, "onboarding");
  }

  // ---------- observe ----------
  /** Every search requested through Main's request port (onboarding and monitoring), in order. */
  searchesRequested(): readonly { personId: string; trigger: "onboarding" | "manual" | "scheduled" }[] {
    return this.requestedSearches;
  }
  lastSearchRun(): SearchRunRecord | undefined {
    return this.store.recordedRuns().at(-1);
  }
  /** Names of the sources asked, in order, since the test began. */
  sourcesQueried(): readonly string[] {
    return this.queriedSources;
  }
  /** Spend charged to the profile over all time, in micros. */
  async spentBy(personId: string): Promise<number> {
    return this.spendLedger.spentBy(personId, "0000", "9999");
  }
  /** Spend no use case charged: a cost-incurring use case forgot to open a charge (watch item W8). */
  unattributedSpendMicros(): number {
    return this.spendLedger
      .recorded()
      .filter((r) => r.personId === null && r.purpose === "unattributed")
      .reduce((t, r) => t + r.amountMicros, 0);
  }
  productEvents(personId: string): readonly ProductEvent[] {
    return this.events.recorded().filter((e) => e.personId === personId);
  }
  /** Waits for background work; rejects, naming each failed task, if any failed since the last call. */
  async backgroundWorkSettled(): Promise<void> {
    await this.app.work.drain();
    if (this.backgroundErrors.length > 0) {
      const failures = this.backgroundErrors.splice(0);
      throw new Error(failures.join("\n"));
    }
  }
}
