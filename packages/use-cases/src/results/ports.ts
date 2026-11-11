import type { JobRequirement, MatchAssessment, Verdict } from "@matchmaker/rules";

/**
 * What the results screens need from storage. Deliberately not the matching area's StoredMatch:
 * results and scoring change for different reasons (accidental similarity, §5.5).
 */
export type ResultRow = {
  readonly postingId: string;
  readonly title: string;
  readonly employer: string;
  readonly location: string;
  readonly postingUrl: string;
  readonly requirements: readonly JobRequirement[];
  readonly assessment: MatchAssessment;
  readonly reason: string;
  readonly pointsToCapitalize: readonly { readonly point: string; readonly evidenceId: string }[];
  readonly verdictChangedFrom: Verdict | null;
  readonly userState: "new" | "applied" | "dismissed";
  readonly postingOpen: boolean;
  readonly scoredAt: string;
};
/** Evidence as the job detail shows it (MR-5): the text the user wrote or confirmed, by its id. */
export type EvidenceText = { readonly id: string; readonly text: string };
/**
 * One job's detail (Flow 3; ADR 0012): the row plus the evidence of the profile version this match was judged
 * against. Evidence text can differ between versions for the same id (Fix a fact), so it is resolved by the read
 * model from the match's own version, never looked up against "the latest profile" by the use case.
 */
export type JobDetailRow = ResultRow & { readonly evidence: readonly EvidenceText[] };
export interface ResultsReadModel {
  /** Matches for the user's active profile version. */
  currentResults(personId: string): Promise<readonly ResultRow[]>;
  /** The active-version match for one posting, with its evidence texts; null if there is none. */
  jobDetail(personId: string, postingId: string): Promise<JobDetailRow | null>;
  setUserState(personId: string, postingId: string, state: "applied" | "dismissed"): Promise<void>;
}
