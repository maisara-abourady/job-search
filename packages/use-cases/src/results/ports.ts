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
export interface ResultsReadModel {
  /** Matches for the user's active profile version. */
  currentResults(userId: string): Promise<readonly ResultRow[]>;
  setUserState(userId: string, postingId: string, state: "applied" | "dismissed"): Promise<void>;
}
