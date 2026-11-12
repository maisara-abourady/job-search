import { UseCaseError } from "../shared/errors.ts";
import type { JobDetailRow, ResultsReadModel } from "./ports.ts";

/** Flow 3, MR-5, MR-8: verdict, three points with evidence, gaps (closable or not), breakdown on expand. */
export type ViewJobDetailRequest = { readonly personId: string; readonly postingId: string };
export type ViewJobDetailResponse = {
  readonly verdict: "apply" | "stretch" | "not-a-fit";
  readonly reason: string;
  readonly pointsToCapitalize: readonly { readonly point: string; readonly evidenceText: string }[];
  readonly gaps: readonly { readonly requirement: string; readonly closable: boolean }[];
  readonly breakdown: {
    readonly fitPoints: Readonly<Record<string, number>> | null;
    readonly confidence: "high" | "medium" | "low" | null;
    readonly jobQuality: number | null;
    readonly requirementTable: readonly {
      readonly requirement: string;
      readonly kind: "must-have" | "nice-to-have";
      readonly judgment: "met" | "partial" | "missing";
      readonly evidenceText: string | null;
    }[];
  };
  readonly postingUrl: string;
};
export interface ViewJobDetail {
  execute(request: ViewJobDetailRequest): Promise<ViewJobDetailResponse>;
}

/**
 * Builds the detail from the read model's JobDetailRow (ADR 0012). Evidence text always comes from the
 * evidence of the version the match was judged against; a citation the row cannot resolve is not shown.
 */
export class ViewJobDetailInteractor implements ViewJobDetail {
  private readonly results: ResultsReadModel;
  constructor(results: ResultsReadModel) {
    this.results = results;
  }
  async execute(request: ViewJobDetailRequest): Promise<ViewJobDetailResponse> {
    const row = await this.results.jobDetail(request.personId, request.postingId);
    if (row === null) throw new UseCaseError("not-found", `no result for ${request.postingId}`);
    const textOf = evidenceLookup(row);
    const requirementText = new Map(row.requirements.map((r) => [r.id, r]));
    const a = row.assessment;
    return {
      verdict: a.verdict,
      reason: row.reason,
      pointsToCapitalize: row.pointsToCapitalize.flatMap((p) => {
        const evidenceText = textOf(p.evidenceId);
        return evidenceText === null ? [] : [{ point: p.point, evidenceText }];
      }),
      gaps: a.judgments
        .filter((j) => j.judgment !== "met")
        .map((j) => ({ requirement: requirementText.get(j.requirementId)?.text ?? j.requirementId, closable: j.closableByUser })),
      breakdown: {
        fitPoints: a.fit === null ? null : { ...a.fit.points },
        confidence: a.confidence,
        jobQuality: a.quality?.total ?? null,
        requirementTable: a.judgments.flatMap((j) => {
          const r = requirementText.get(j.requirementId);
          if (r === undefined) return [];
          const cited = j.evidenceIds.map(textOf).find((t) => t !== null) ?? null;
          return [{ requirement: r.text, kind: r.kind, judgment: j.judgment, evidenceText: cited }];
        }),
      },
      postingUrl: row.postingUrl,
    };
  }
}

function evidenceLookup(row: JobDetailRow): (evidenceId: string) => string | null {
  const byId = new Map(row.evidence.map((e) => [e.id, e.text]));
  return (id) => byId.get(id) ?? null;
}
