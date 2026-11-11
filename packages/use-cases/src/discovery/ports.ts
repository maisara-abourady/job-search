import type { JobPosting, ProfileVersion, ScoringProfile, SourceTier } from "@matchmaker/rules";

// ---------- Job sources: one port, every tier (ADR 0004) ----------
/** Tier is data the source declares; the use case never branches on a source's name (LSP, §3.4). */
export type SourceDescriptor = { readonly name: string; readonly tier: SourceTier };
export type SearchQuery = {
  readonly titles: readonly string[];
  readonly keywords: readonly string[];
  readonly locations: readonly string[];
  readonly includeRemote: boolean;
};
/** A posting in the common schema before enrichment (DS-3). Adapters normalize; nothing source-specific crosses. */
export type FoundPosting = {
  readonly sourceName: string;
  readonly tier: SourceTier;
  readonly url: string;
  readonly employer: string;
  readonly title: string;
  readonly location: string;
  readonly description: string;
  readonly postedAt: string;
  readonly fetchedAt: string;
};
export interface JobSource {
  readonly descriptor: SourceDescriptor;
  /** Rate limits, proxies, retries and timeouts are the adapter's business. Throwing means the source failed this run. */
  search(queries: readonly SearchQuery[], timeoutMs: number): Promise<readonly FoundPosting[]>;
}
/** Kill switch per source, readable without a deploy (Scraping safeguards 1). */
export interface SourceSwitchboard {
  isEnabled(sourceName: string): Promise<boolean>;
}

// ---------- Judgment-backed steps (ADR 0003: a model behind a port, never an orchestrator) ----------
export type SearchPlan = { readonly queries: readonly SearchQuery[]; readonly adjacentTitlesUsed: readonly string[] };
export interface SearchPlanner {
  plan(profile: ScoringProfile, widenToAdjacentTitles: boolean): Promise<SearchPlan>;
}
/** DS-6: what a small model extracts from a description. */
export type Enrichment = Pick<
  JobPosting,
  "requirements" | "seniority" | "seniorityText" | "authorization" | "salary" | "workMode" | "country" | "language" | "completeness" | "legitimacy"
>;
export interface PostingEnricher {
  enrich(posting: FoundPosting): Promise<Enrichment>;
}
/** Prefilter (pipeline step 7): returns posting ids, most relevant first. Embeddings, pgvector or anything else behind it. */
export interface RelevanceRanker {
  rank(profile: ScoringProfile, postings: readonly JobPosting[]): Promise<readonly string[]>;
}

// ---------- Storage needs of discovery ----------
export interface ProfilesForSearch {
  activeProfileVersion(userId: string): Promise<ProfileVersion | null>;
}
export interface PostingCatalog {
  findByIdentityKey(identityKey: string): Promise<JobPosting | null>;
  save(posting: JobPosting, identityKey: string): Promise<void>;
  openPostings(): Promise<readonly JobPosting[]>;
  markClosed(postingId: string): Promise<void>;
}
export interface PostingLiveness {
  isLive(url: string): Promise<boolean>;
}
export type SearchRunRecord = {
  readonly runId: string;
  readonly userId: string;
  readonly trigger: "onboarding" | "manual" | "scheduled";
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly fetched: number;
  readonly duplicatesMerged: number;
  readonly expiredDropped: number;
  readonly failedSources: readonly string[];
  readonly widenedTo: readonly string[];
  /** PRD SearchRun "cost": spend charged to this run (sources, enrichment, ranking, and scoring awaited by the run), ADR 0010. */
  readonly costMicros: number;
};
export interface SearchRuns {
  record(run: SearchRunRecord): Promise<void>;
}

/** Tier 1 company registry growth: a Tier 2 to 4 result that links to an ATS-hosted posting adds the employer. */
export type AtsCompany = { readonly ats: string; readonly companyId: string };
export interface AtsLinkRecognizer {
  recognize(url: string): AtsCompany | null;
}
export interface CompanyRegistry {
  register(company: AtsCompany): Promise<void>;
}

/** Discovery hands scoring to the matching area through a port it owns; Main wires it. */
export interface ScoringRequests {
  /** `runId` lets scoring spend be charged to the search run that asked for it (ADR 0010). */
  score(request: { userId: string; runId: string | null; postingIds: readonly string[]; cutAtPrefilter: readonly string[] }): Promise<void>;
}
