import type { JobPosting, MatchAssessment, MatchJudgments, ProfileVersion, ScoringProfile, Verdict } from "@matchmaker/rules";

/** What matching needs from storage, named for the need (gateways; implementations hold the SQL). */
export interface ProfilesForScoring {
  activeProfileVersion(personId: string): Promise<ProfileVersion | null>;
}
export interface PostingsForScoring {
  postingsByIds(ids: readonly string[]): Promise<readonly JobPosting[]>;
}

/** A judged match as stored. Keyed by profile version and posting revision (ADR 0005), so a score never changes unless one of them does. */
export type StoredMatch = {
  readonly personId: string;
  readonly profileVersionKey: string;
  readonly postingId: string;
  readonly postingRevision: number;
  readonly assessment: MatchAssessment;
  readonly narration: Narration;
  readonly verdictChangedFrom: Verdict | null;
  readonly userState: "new" | "applied" | "dismissed";
  readonly scoredAt: string;
};
export interface MatchRecords {
  findMatch(profileVersionKey: string, postingId: string, postingRevision: number): Promise<StoredMatch | null>;
  latestVerdictBefore(personId: string, postingId: string, profileVersionKey: string): Promise<Verdict | null>;
  saveMatch(match: StoredMatch): Promise<void>;
  postingIdsScoredFor(personId: string): Promise<readonly string[]>;
}

/**
 * The judgment a model contributes (ADR 0002). Receives only a ScoringProfile, so personal details
 * cannot reach it. Implementations: a model behind any runtime (ADR 0003), or a scripted double in tests.
 */
export interface MatchJudge {
  judge(profile: ScoringProfile, posting: JobPosting): Promise<MatchJudgments>;
}

/** Plain-language copy for a decided verdict. Never decides anything; describes the match, never the person. */
export type Narration = { readonly reason: string; readonly pointsToCapitalize: readonly { readonly point: string; readonly evidenceId: string }[] };
export interface MatchNarrator {
  narrate(input: { profile: ScoringProfile; posting: JobPosting; assessment: MatchAssessment }): Promise<Narration>;
}

/** Output port for MR-6 (results stream). Delivery implements it (SSE, polling, anything). */
export type ScoredJobNotice = {
  readonly personId: string;
  readonly postingId: string;
  readonly verdict: "apply" | "stretch" | "not-a-fit";
  readonly verdictChanged: boolean;
};
export interface ResultsFeed {
  jobScored(notice: ScoredJobNotice): void;
}
