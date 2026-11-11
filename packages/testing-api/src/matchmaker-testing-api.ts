import { presentResults, type ResultsViewModel } from "@matchmaker/delivery";
import { InMemoryStore, InMemoryUsageLedger, TemplateNarrator } from "@matchmaker/adapters";
import { composeMatchmaker, type Matchmaker } from "@matchmaker/main";
import {
  postingIdentityKey, type JobPosting, type MatchJudgments, type ProfileVersion, type SourceTier,
} from "@matchmaker/rules";
import type { FoundPosting, JobSource, ListResultsResponse, RunJobSearchResponse, ScoredJobNotice } from "@matchmaker/use-cases";
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
    this.app = composeMatchmaker({
      storage: this.store,
      operatorConsole: Object.assign(this.store, { recent: async () => [] }),
      usage: new InMemoryUsageLedger(),
      clock: { now: () => new Date(self.nowIso) },
      ids: { next: (prefix) => `${prefix}-${++self.idCounter}` },
      judge: {
        judge: async (_profile, posting) => {
          self.judgeCalls.push(posting.id);
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
  sourceReturns(name: string, tier: SourceTier, postings: readonly Partial<FoundPosting>[]): this {
    const result = postings.map((p, i) => ({
      sourceName: name, tier, url: `https://${name}.example/${i}`, employer: "Acme", title: "Engineer", location: "Berlin",
      description: "Build things.", postedAt: this.nowIso, fetchedAt: this.nowIso, ...p,
    }));
    this.sources.push({ descriptor: { name, tier }, search: async () => result });
    return this;
  }
  sourceFails(name: string, tier: SourceTier): this {
    this.sources.push({ descriptor: { name, tier }, search: async () => { throw new Error(`${name} is down`); } });
    return this;
  }

  // ---------- what the UI and the scheduler can do ----------
  async scorePostings(userId: string, postingIds: readonly string[]) {
    return this.app.useCases.scoreJobs.execute({ userId, postingIds, cutAtPrefilter: [] });
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
  async access(userId: string) {
    return this.app.useCases.viewAccess.execute({ userId });
  }
  async backgroundWorkSettled(): Promise<void> {
    await this.app.work.drain();
  }
}
