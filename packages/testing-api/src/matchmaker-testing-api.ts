import { presentResults, type ResultsViewModel } from "@matchmaker/delivery";
import { AsyncSpendMeter, InMemoryProductEventLog, InMemorySpendLedger, InMemoryStore, InMemoryUsageLedger, TemplateNarrator } from "@matchmaker/adapters";
import { composeMatchmaker, type Matchmaker } from "@matchmaker/main";
import {
  postingIdentityKey, type JobPosting, type MatchJudgments, type ProfileVersion, type SourceTier,
} from "@matchmaker/rules";
import type {
  FoundPosting, JobSource, ListResultsResponse, ProductEvent, RecordSubscriptionChangeResponse, RunJobSearchResponse, ScoredJobNotice,
  SearchRunRecord, SubscriptionChange, ViewJobDetailResponse,
} from "@matchmaker/use-cases";
import { aJobPosting, aProfile, enrichmentOf } from "./builders.ts";

/** What the judge says about a posting a test did not script: a middling, evidence-free judgment. */
const MODEST_JUDGMENT: MatchJudgments = { requirements: [], experienceRelevance: 0.5, skillsAndTools: 0.5, scopeAlignment: 0.5 };

/**
 * The testing API (§10.3): a superset of what the UI uses, with superpowers. Forces states (accounts,
 * profiles, postings, time), bypasses expensive resources (models, sources, storage), and hides the
 * application's structure so tests and production code can be refactored independently.
 * Tests talk to this class only; never to interactors, adapters or file paths.
 */
export class MatchmakerTestingApi {
  private readonly store = new InMemoryStore();
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
  readonly judgeCalls: string[] = [];
  readonly feed: ScoredJobNotice[] = [];
  private readonly app: Matchmaker;

  constructor() {
    const self = this;
    const clock = { now: () => new Date(self.nowIso) };
    this.meter = new AsyncSpendMeter(this.spendLedger, clock);
    this.app = composeMatchmaker({
      storage: this.store,
      operatorConsole: Object.assign(this.store, { recent: async () => [] }),
      usage: new InMemoryUsageLedger(),
      spendLedger: this.spendLedger,
      spendAttribution: this.meter,
      productEvents: this.events,
      clock,
      ids: { next: (prefix) => `${prefix}-${++self.idCounter}` },
      judge: {
        judge: async (_profile, posting) => {
          self.judgeCalls.push(posting.id);
          if (self.judgeSpendMicros > 0) await self.meter.record({ category: "model", provider: "scripted-judge", amountMicros: self.judgeSpendMicros });
          return self.judgments.get(posting.id) ?? MODEST_JUDGMENT;
        },
      },
      narrator: new TemplateNarrator(),
      planner: { plan: async (_p, widen) => ({ queries: [{ titles: ["engineer"], keywords: [], locations: [], includeRemote: true }], adjacentTitlesUsed: widen ? ["adjacent role"] : [] }) },
      enricher: { enrich: async (found) => enrichmentOf(found) },
      ranker: { rank: async (_p, postings) => postings.map((p) => p.id) },
      sources: this.sources,
      liveness: { isLive: async () => true },
      atsLinks: { recognize: () => null },
      feed: { jobScored: (n) => self.feed.push(n) },
      onBackgroundError: (task, e) => {
        throw new Error(`background task ${task} failed: ${String(e)}`);
      },
    });
  }

  // ---------- superpowers: force state ----------
  atTime(iso: string): this {
    this.nowIso = iso;
    return this;
  }
  async givenSignedUpUser(userId: string, onIso?: string): Promise<this> {
    const previous = this.nowIso;
    if (onIso) this.nowIso = onIso;
    await this.app.useCases.signUp.execute({ userId });
    this.nowIso = previous;
    return this;
  }
  async givenProfile(userId: string, overrides: Partial<ProfileVersion> = {}): Promise<ProfileVersion> {
    const current = await this.store.activeProfileVersion(userId);
    const profile = aProfile({ userId, version: (current?.version ?? 0) + 1, ...overrides });
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
  /** `costPerCallMicros` makes the source a paid one: each call reports that spend (aggregator, or proxy for Tier 4). */
  sourceReturns(name: string, tier: SourceTier, postings: readonly Partial<FoundPosting>[], costPerCallMicros = 0): this {
    const result = postings.map((p, i) => ({
      sourceName: name, tier, url: `https://${name}.example/${i}`, employer: "Acme", title: "Engineer", location: "Berlin",
      description: "Build things.", postedAt: this.nowIso, fetchedAt: this.nowIso, ...p,
    }));
    const meter = this.meter;
    this.sources.push({
      descriptor: { name, tier },
      search: async () => {
        if (costPerCallMicros > 0) await meter.record({ category: tier === 4 ? "proxy" : "aggregator", provider: name, amountMicros: costPerCallMicros });
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
  sourceFails(name: string, tier: SourceTier): this {
    this.sources.push({ descriptor: { name, tier }, search: async () => { throw new Error(`${name} is down`); } });
    return this;
  }

  // ---------- what the UI and the scheduler can do ----------
  async scorePostings(userId: string, postingIds: readonly string[]) {
    return this.app.useCases.scoreJobs.execute({ userId, runId: null, postingIds, cutAtPrefilter: [] });
  }
  async searchNow(userId: string): Promise<RunJobSearchResponse> {
    return this.app.useCases.runJobSearch.execute({ userId, trigger: "manual" });
  }
  async results(userId: string): Promise<ListResultsResponse> {
    return this.app.useCases.listResults.execute({ userId });
  }
  async resultsScreen(userId: string): Promise<ResultsViewModel> {
    return presentResults(await this.results(userId));
  }
  async jobDetail(userId: string, postingId: string): Promise<ViewJobDetailResponse> {
    return this.app.useCases.viewJobDetail.execute({ userId, postingId });
  }
  async markApplied(userId: string, postingId: string): Promise<void> {
    await this.app.useCases.recordJobDecision.execute({ userId, postingId, decision: "applied" });
  }
  async access(userId: string) {
    return this.app.useCases.viewAccess.execute({ userId });
  }
  /** What the billing provider's webhook listener will do (D7): hand over one provider event. */
  async billingProviderSends(change: SubscriptionChange): Promise<RecordSubscriptionChangeResponse> {
    return this.app.useCases.recordSubscriptionChange.execute(change);
  }

  // ---------- observe ----------
  lastSearchRun(): SearchRunRecord | undefined {
    return this.store.recordedRuns().at(-1);
  }
  /** Spend charged to the user over all time, in micros. */
  async spentBy(userId: string): Promise<number> {
    return this.spendLedger.spentBy(userId, "0000", "9999");
  }
  /** Spend no use case charged: a cost-incurring use case forgot to open a charge (watch item W8). */
  unattributedSpendMicros(): number {
    return this.spendLedger.recorded().filter((r) => r.userId === null).reduce((t, r) => t + r.amountMicros, 0);
  }
  productEvents(userId: string): readonly ProductEvent[] {
    return this.events.recorded().filter((e) => e.userId === userId);
  }
  async backgroundWorkSettled(): Promise<void> {
    await this.app.work.drain();
  }
}
