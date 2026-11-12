import type { ResultRow, ResultsReadModel } from "./ports.ts";

// ---- Input port and models (Flow 2; MR-3, MR-4, MR-6; shape of encouragement 2 and 3) ----
export type ListResultsRequest = { readonly personId: string };
export type ResultCard = {
  readonly postingId: string;
  readonly title: string;
  readonly employer: string;
  readonly location: string;
  readonly verdict: "apply" | "stretch" | "not-a-fit";
  readonly reason: string;
  readonly pointsToApply: number | null;
  readonly leverRequirement: string | null;
  readonly verdictChanged: boolean;
  readonly flags: readonly ("authorization-unknown" | "seniority-unknown" | "thin-posting")[];
};
export type ListResultsResponse = {
  readonly apply: readonly ResultCard[];
  readonly stretch: readonly ResultCard[];
  readonly notAFitCount: number;
  /** When Apply is empty: the three closest jobs and what would move each (never a blank tab). */
  readonly closestToApply: readonly ResultCard[];
};
export interface ListResults {
  execute(request: ListResultsRequest): Promise<ListResultsResponse>;
}

export class ListResultsInteractor implements ListResults {
  private readonly results: ResultsReadModel;
  constructor(results: ResultsReadModel) {
    this.results = results;
  }

  async execute(request: ListResultsRequest): Promise<ListResultsResponse> {
    const rows = (await this.results.currentResults(request.personId))
      .filter((r) => r.postingOpen && r.userState !== "dismissed")
      .sort((a, b) => b.assessment.priority - a.assessment.priority);
    const apply = rows.filter((r) => r.assessment.verdict === "apply").map(toCard);
    const stretch = rows.filter((r) => r.assessment.verdict === "stretch").map(toCard);
    const notAFit = rows.filter((r) => r.assessment.verdict === "not-a-fit");
    const closestToApply =
      apply.length > 0
        ? []
        : [...rows]
            .filter((r) => r.assessment.fit !== null)
            .sort((a, b) => (a.assessment.pointsToApply ?? Infinity) - (b.assessment.pointsToApply ?? Infinity))
            .slice(0, 3)
            .map(toCard);
    return { apply, stretch, notAFitCount: notAFit.length, closestToApply };
  }
}

function toCard(r: ResultRow): ResultCard {
  const a = r.assessment;
  const flags: ResultCard["flags"][number][] = [];
  if (a.gates?.authorization.outcome === "unknown") flags.push("authorization-unknown");
  if (a.gates?.seniority.outcome === "unknown") flags.push("seniority-unknown");
  if (a.confidence === "low") flags.push("thin-posting");
  const lever = a.lever === null ? null : (r.requirements.find((q) => q.id === a.lever?.requirementId)?.text ?? null);
  return {
    postingId: r.postingId,
    title: r.title,
    employer: r.employer,
    location: r.location,
    verdict: a.verdict,
    reason: r.reason,
    pointsToApply: a.pointsToApply,
    leverRequirement: lever,
    verdictChanged: r.verdictChangedFrom !== null,
    flags,
  };
}
