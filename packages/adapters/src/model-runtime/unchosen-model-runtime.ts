import { notYetBuilt, type JobPosting, type ScoringProfile } from "@matchmaker/rules";
import type {
  Enrichment,
  FoundPosting,
  MatchJudge,
  PostingEnricher,
  RelevanceRanker,
  ResumeAnalyst,
  SearchPlan,
  SearchPlanner,
  StructuredResume,
} from "@matchmaker/use-cases";

/**
 * Placeholder for the model runtime, which is a deferred decision (ADR 0003, docs/architecture/deferred.md):
 * Claude Code headless, the Claude Agent SDK, or a direct model API. Each judgment-backed port gets its
 * own adapter class when chosen; model tiering (small for enrichment, large for judging) is configured in Main.
 */
export class UnchosenModelRuntime implements MatchJudge, SearchPlanner, PostingEnricher, RelevanceRanker, ResumeAnalyst {
  async structure(_text: string): Promise<StructuredResume> {
    return notYetBuilt("ADR 0009: ResumeAnalyst adapter (P1-T10)");
  }
  async sellingPointCandidates(_resume: StructuredResume): ReturnType<ResumeAnalyst["sellingPointCandidates"]> {
    return notYetBuilt("ADR 0009: ResumeAnalyst adapter (P1-T10)");
  }
  async strengthRatios(_resume: StructuredResume): ReturnType<ResumeAnalyst["strengthRatios"]> {
    return notYetBuilt("ADR 0009: ResumeAnalyst adapter (P1-T10)");
  }
  async judge(_profile: ScoringProfile, _posting: JobPosting): ReturnType<MatchJudge["judge"]> {
    return notYetBuilt("ADR 0003: MatchJudge adapter (temperature 0, fixed rubric, structured output)");
  }
  async plan(_profile: ScoringProfile, _widen: boolean): Promise<SearchPlan> {
    return notYetBuilt("ADR 0003: SearchPlanner adapter");
  }
  async enrich(_posting: FoundPosting): Promise<Enrichment> {
    return notYetBuilt("ADR 0003: PostingEnricher adapter (small model)");
  }
  async rank(_profile: ScoringProfile, _postings: readonly JobPosting[]): Promise<readonly string[]> {
    return notYetBuilt("ADR 0003: RelevanceRanker adapter (embeddings)");
  }
}
