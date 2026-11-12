import { postingIdentityKey, mergeSourceLinks, toScoringProfile, type JobPosting, type SourceTier } from "@matchmaker/rules";
import type { SpendingGuard } from "../shared/spending-guard.ts";
import { UseCaseError } from "../shared/errors.ts";
import type { SpendAttribution, SpendLedger } from "../shared/metering.ts";
import type { Clock, IdGenerator } from "../shared/ports.ts";
import type {
  AtsLinkRecognizer,
  CompanyRegistry,
  FoundPosting,
  JobSource,
  PostingCatalog,
  PostingEnricher,
  PostingLiveness,
  ProfilesForSearch,
  RelevanceRanker,
  ScoringRequests,
  SearchPlanner,
  SearchQuery,
  SearchRuns,
  SourceSwitchboard,
} from "./ports.ts";

// ---- Input port and models (DS-1..DS-7; Flow 1 step 3, Flow 6) ----
export type RunJobSearchRequest = {
  readonly personId: string;
  readonly trigger: "onboarding" | "manual" | "scheduled";
  /** The owner agreed to spend past the monthly budget (the UI asked first). Ignored for scheduled runs, which pause. */
  readonly overBudgetConfirmed?: boolean;
};
export type RunJobSearchResponse = {
  readonly runId: string;
  readonly fetched: number;
  readonly duplicatesMerged: number;
  readonly failedSources: readonly string[];
  readonly widenedTo: readonly string[];
  readonly sentToScoring: number;
  readonly cutAtPrefilter: number;
  readonly costMicros: number;
};
export interface RunJobSearch {
  execute(request: RunJobSearchRequest): Promise<RunJobSearchResponse>;
}

/** ASSUMPTIONS from the PRD, kept here because they are application cost policy, not business rules. */
export const SEARCH_POLICY = { prefilterCap: 150, widenBelow: 20, sourceTimeoutMs: 30_000 } as const;

/**
 * Scraping safeguards 1, Terms of service: a source the owner never switched is on, except Tier 4, which is off until
 * the owner turns that board on after reading its terms. Tier is data; no source is named here (§3.4, ADR 0016).
 */
export const SOURCE_POLICY = { offUntilSwitchedOn: [4] as readonly SourceTier[] } as const;
function enabledByDefault(tier: SourceTier): boolean {
  return !SOURCE_POLICY.offUntilSwitchedOn.includes(tier);
}

export type RunJobSearchDependencies = {
  readonly sources: readonly JobSource[];
  readonly switchboard: SourceSwitchboard;
  readonly planner: SearchPlanner;
  readonly enricher: PostingEnricher;
  readonly ranker: RelevanceRanker;
  readonly profiles: ProfilesForSearch;
  readonly catalog: PostingCatalog;
  readonly liveness: PostingLiveness;
  readonly runs: SearchRuns;
  readonly atsLinks: AtsLinkRecognizer;
  readonly registry: CompanyRegistry;
  readonly scoring: ScoringRequests;
  readonly spending: SpendingGuard;
  readonly spend: SpendAttribution;
  readonly spendLedger: Pick<SpendLedger, "spentOnRun">;
  readonly clock: Clock;
  readonly ids: IdGenerator;
};

/**
 * The pipeline (plan, fetch, normalize, deduplicate, validate, enrich, prefilter, score) is
 * deterministic application policy. Models are consulted at named steps; they do not orchestrate.
 */
export class RunJobSearchInteractor implements RunJobSearch {
  private readonly d: RunJobSearchDependencies;
  constructor(dependencies: RunJobSearchDependencies) {
    this.d = dependencies;
  }

  async execute(request: RunJobSearchRequest): Promise<RunJobSearchResponse> {
    // Running cost (ADR 0015): manual searches count against the daily cap; scheduled ones pause at the budget.
    if (request.trigger === "scheduled") await this.d.spending.beforeBackground(request.personId);
    else
      await this.d.spending.beforeOnDemand(
        request.personId,
        request.trigger === "manual" ? "onDemandSearches" : null,
        request.overBudgetConfirmed === true,
      );
    const runId = this.d.ids.next("run");
    // Every source call, model call and awaited scoring call made by this run is charged to it (ADR 0010).
    return this.d.spend.charge({ personId: request.personId, runId, purpose: "search" }, () => this.run(runId, request));
  }

  private async run(runId: string, request: RunJobSearchRequest): Promise<RunJobSearchResponse> {
    const startedAt = this.d.clock.now().toISOString();
    const profile = await this.d.profiles.activeProfileVersion(request.personId);
    if (profile === null) throw new UseCaseError("not-found", `no profile for ${request.personId}`);
    const scoringProfile = toScoringProfile(profile);

    let plan = await this.d.planner.plan(scoringProfile, false);
    let fetched = await this.fetchAll(plan.queries);
    let widenedTo: readonly string[] = [];
    if (uniqueByIdentity(fetched.found).size < SEARCH_POLICY.widenBelow) {
      plan = await this.d.planner.plan(scoringProfile, true);
      const more = await this.fetchAll(plan.queries);
      fetched = { found: [...fetched.found, ...more.found], failed: [...new Set([...fetched.failed, ...more.failed])] };
      widenedTo = plan.adjacentTitlesUsed;
    }

    const groups = uniqueByIdentity(fetched.found);
    const runPostings: JobPosting[] = [];
    let expiredDropped = 0;
    for (const [identityKey, group] of groups) {
      for (const f of group) {
        const company = this.d.atsLinks.recognize(f.url);
        if (company !== null) await this.d.registry.register(company);
      }
      const links = group.map((f) => ({ sourceName: f.sourceName, tier: f.tier, url: f.url, fetchedAt: f.fetchedAt }));
      const existing = await this.d.catalog.findByIdentityKey(identityKey);
      if (existing !== null) {
        // HAND-OFF (DS-4 second stage, DS-5 revisions): description-similarity merge; bump revision when the text changed.
        const merged: JobPosting = { ...existing, sources: mergeSourceLinks(existing.sources, links) };
        await this.d.catalog.save(merged, identityKey);
        if (merged.status === "open") runPostings.push(merged);
        continue;
      }
      const first = group[0]!;
      if (!(await this.d.liveness.isLive(first.url))) {
        expiredDropped++;
        continue;
      }
      const enrichment = await this.d.enricher.enrich(first);
      const posting: JobPosting = {
        id: this.d.ids.next("job"),
        revision: 1,
        employer: first.employer,
        title: first.title,
        location: first.location,
        description: first.description,
        postedAt: first.postedAt,
        status: "open",
        sources: links,
        ...enrichment,
      };
      await this.d.catalog.save(posting, identityKey);
      runPostings.push(posting);
    }

    const ranked = await this.d.ranker.rank(scoringProfile, runPostings);
    const toScore = ranked.slice(0, SEARCH_POLICY.prefilterCap);
    const cut = ranked.slice(SEARCH_POLICY.prefilterCap);
    await this.d.scoring.score({ personId: request.personId, runId, postingIds: toScore, cutAtPrefilter: cut });

    const duplicatesMerged = fetched.found.length - groups.size;
    const costMicros = await this.d.spendLedger.spentOnRun(runId);
    await this.d.runs.record({
      runId,
      personId: request.personId,
      trigger: request.trigger,
      startedAt,
      finishedAt: this.d.clock.now().toISOString(),
      fetched: fetched.found.length,
      duplicatesMerged,
      expiredDropped,
      failedSources: fetched.failed,
      widenedTo,
      costMicros,
    });
    return {
      runId,
      fetched: fetched.found.length,
      duplicatesMerged,
      failedSources: fetched.failed,
      widenedTo,
      sentToScoring: toScore.length,
      cutAtPrefilter: cut.length,
      costMicros,
    };
  }

  /**
   * DS-2: all enabled sources in parallel; a failed source never fails the run.
   * Scraping safeguard 2: paid Tier 3 aggregators are queried only to cover Tier 4 sources that
   * failed, are switched off, or do not exist (INTERPRETATION recorded in docs/architecture/README.md).
   */
  private async fetchAll(queries: readonly SearchQuery[]): Promise<{ found: FoundPosting[]; failed: string[] }> {
    const enabled: JobSource[] = [];
    for (const s of this.d.sources) {
      if ((await this.d.switchboard.switchedOn(s.descriptor.name)) ?? enabledByDefault(s.descriptor.tier)) enabled.push(s);
    }
    const primary = enabled.filter((s) => s.descriptor.tier !== 3);
    const first = await this.query(primary, queries);
    const tier4Configured = this.d.sources.filter((s) => s.descriptor.tier === 4).length;
    const tier4Healthy = primary.filter((s) => s.descriptor.tier === 4 && !first.failed.includes(s.descriptor.name)).length;
    if (tier4Healthy === tier4Configured && tier4Configured > 0) return first;
    const fallback = await this.query(
      enabled.filter((s) => s.descriptor.tier === 3),
      queries,
    );
    return { found: [...first.found, ...fallback.found], failed: [...first.failed, ...fallback.failed] };
  }

  private async query(sources: readonly JobSource[], queries: readonly SearchQuery[]) {
    const settled = await Promise.allSettled(sources.map((s) => s.search(queries, SEARCH_POLICY.sourceTimeoutMs)));
    const found: FoundPosting[] = [];
    const failed: string[] = [];
    settled.forEach((r, i) => (r.status === "fulfilled" ? found.push(...r.value) : failed.push(sources[i]!.descriptor.name)));
    return { found, failed };
  }
}

function uniqueByIdentity(found: readonly FoundPosting[]): Map<string, FoundPosting[]> {
  const groups = new Map<string, FoundPosting[]>();
  for (const f of found) {
    const key = postingIdentityKey(f);
    groups.set(key, [...(groups.get(key) ?? []), f]);
  }
  return groups;
}
