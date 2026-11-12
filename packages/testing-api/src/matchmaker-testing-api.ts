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
  InMemoryResumeFiles,
  InMemorySpendLedger,
  InMemoryStore,
  InMemoryUsageLedger,
  JsonArchiveVault,
  TemplateNarrator,
} from "@matchmaker/adapters";
import { composeMatchmaker, type Matchmaker } from "@matchmaker/main";
import { postingIdentityKey, type JobPosting, type MatchJudgments, type ProfileVersion, type SourceTier } from "@matchmaker/rules";
import type {
  CorrectProfileResponse,
  CreatePersonResponse,
  IntakeResumeResponse,
  ProfileCorrection,
  ReadDocumentResult,
  ResumeUpload,
  StructuredResume,
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
import {
  aCandidate,
  aJobPosting,
  aProfile,
  aStrengthAnswer,
  aStructuredResume,
  enrichmentOf,
  type SellingPointCandidate,
  type StrengthAnswer,
} from "./builders.ts";

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
  private readonly resumeFiles = new InMemoryResumeFiles(() => new Date(this.nowIso));
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
  private readonly requestedRescores: string[] = [];
  /** Scripted reader: what it returns per file name; unscripted files read as their own text, in English. */
  private readonly readerScripts = new Map<string, ReadDocumentResult>();
  private analystScript: { structured: StructuredResume; candidates: readonly SellingPointCandidate[]; strength: StrengthAnswer } = {
    structured: aStructuredResume(),
    candidates: [aCandidate("ev-1", 3), aCandidate("ev-2", 2), aCandidate("ev-3", 2), aCandidate("ev-1", 1), aCandidate("ev-2", 1)],
    strength: aStrengthAnswer(),
  };
  private analystSpendMicros = 0;
  /** Every text the scripted analyst was asked to structure, in order. */
  readonly analystReceived: string[] = [];
  readonly feed: ScoredJobNotice[] = [];
  private readonly app: Matchmaker;

  constructor() {
    const clock = { now: () => new Date(this.nowIso) };
    this.meter = new AsyncSpendMeter(this.spendLedger, clock);
    this.app = composeMatchmaker({
      storage: this.store,
      // Its own object: the store keeps exactly the methods its class gives it.
      operatorConsole: {
        setEnabled: (sourceName, enabled, reason) => this.store.setEnabled(sourceName, enabled, reason),
        states: () => this.store.states(),
        recent: async () => [],
      },
      usage: this.usage,
      spendLedger: this.spendLedger,
      spendAttribution: this.meter,
      personData: new JsonArchiveVault([
        { section: "profile", vault: this.store },
        { section: "resumeFiles", vault: this.resumeFiles },
        { section: "dailyUsage", vault: this.usage },
        { section: "spend", vault: this.spendLedger },
        { section: "productEvents", vault: this.events },
      ]),
      productEvents: this.events,
      clock,
      ids: { next: (prefix) => `${prefix}-${++this.idCounter}` },
      resumeFiles: this.resumeFiles,
      reader: {
        read: async (upload) => {
          const scripted = this.readerScripts.get(upload.fileName);
          if (scripted !== undefined) return scripted;
          const text = upload.text ?? new TextDecoder().decode(upload.bytes ?? new Uint8Array());
          return { outcome: "read", text, language: "en" };
        },
      },
      analyst: {
        structure: async (text) => {
          this.analystReceived.push(text);
          if (this.analystSpendMicros > 0)
            await this.meter.record({ category: "model", provider: "scripted-analyst", amountMicros: this.analystSpendMicros });
          return this.analystScript.structured;
        },
        sellingPointCandidates: async () => this.analystScript.candidates,
        strengthRatios: async () => this.analystScript.strength,
      },
      judge: {
        judge: async (_profile, posting) => {
          this.judgeCalls.push(posting.id);
          if (this.judgeSpendMicros > 0)
            await this.meter.record({ category: "model", provider: "scripted-judge", amountMicros: this.judgeSpendMicros });
          return this.judgments.get(posting.id) ?? MODEST_JUDGMENT;
        },
      },
      narrator: new TemplateNarrator(),
      planner: {
        plan: async (_p, widen) => {
          if (this.plannerError) throw this.plannerError;
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
      feed: { jobScored: (n) => this.feed.push(n) },
      onBackgroundError: (task, e) => {
        this.backgroundErrors.push(`background task ${task} failed: ${String(e)}`);
      },
    });
    // Observe the search request port Main wired (monitoring and onboarding reach discovery through it).
    const searchRequests = this.app.requests.searchRequests;
    const requestSearch = searchRequests.requestSearch;
    searchRequests.requestSearch = async (personId, trigger) => {
      this.requestedSearches.push({ personId, trigger });
      return requestSearch(personId, trigger);
    };
    const rescoreRequests = this.app.requests.rescoreRequests;
    const rescoreAll = rescoreRequests.rescoreAll;
    rescoreRequests.rescoreAll = async (personId) => {
      this.requestedRescores.push(personId);
      return rescoreAll(personId);
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
  /** The document reader's answer for an upload with this file name (unreadable, another language, given text). */
  documentWillRead(fileName: string, result: ReadDocumentResult): this {
    this.readerScripts.set(fileName, result);
    return this;
  }
  /** What the resume analyst answers from now on; parts not given keep their current script. */
  analystWillSay(o: { structured?: StructuredResume; candidates?: readonly SellingPointCandidate[]; strength?: StrengthAnswer }): this {
    this.analystScript = { ...this.analystScript, ...o };
    return this;
  }
  /** Every resume the analyst structures from now on costs this much model spend. */
  analystCosts(micros: number): this {
    this.analystSpendMicros = micros;
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

  /** The open profile uploads a resume (or pasted text). */
  async intake(personId: string, upload: ResumeUpload, options: { overBudgetConfirmed?: boolean } = {}): Promise<IntakeResumeResponse> {
    return this.app.useCases.intakeResume.execute({ personId, upload, ...options });
  }
  /** A correction from the selling-points card or a preferences screen. */
  async correct(personId: string, correction: ProfileCorrection): Promise<CorrectProfileResponse> {
    return this.app.useCases.correctProfile.execute({ personId, correction });
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
  /** Every re-score requested through Main's request port (corrections), in order. */
  rescoresRequested(): readonly string[] {
    return this.requestedRescores;
  }
  /** Every saved profile version of the person, oldest first; the last is active. */
  profileVersions(personId: string): readonly ProfileVersion[] {
    return this.store.versionsOf(personId);
  }
  /** The selling points saved with the active version. */
  async sellingPoints(personId: string) {
    return this.store.sellingPoints(personId);
  }
  /** Metadata of every original resume kept for the person (RP-8). */
  async storedResumes(personId: string): Promise<readonly { resumeId: string; version: number; fileName: string }[]> {
    const exported = JSON.parse(new TextDecoder().decode(await this.resumeFiles.exportAll(personId))) as {
      resumes: { resumeId: string; version: number; fileName: string }[];
    };
    return exported.resumes;
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
