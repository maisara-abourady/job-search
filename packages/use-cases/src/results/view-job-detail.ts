import { notYetBuilt } from "@matchmaker/rules";
import type { ResultsReadModel } from "./ports.ts";

/** Flow 3, MR-5, MR-8: verdict, three points with evidence, gaps (closable or not), breakdown on expand. */
export type ViewJobDetailRequest = { readonly userId: string; readonly postingId: string };
export type ViewJobDetailResponse = {
  readonly verdict: "apply" | "stretch" | "not-a-fit";
  readonly reason: string;
  readonly pointsToCapitalize: readonly { readonly point: string; readonly evidenceText: string }[];
  readonly gaps: readonly { readonly requirement: string; readonly closable: boolean }[];
  readonly breakdown: {
    readonly fitPoints: Readonly<Record<string, number>> | null;
    readonly confidence: "high" | "medium" | "low" | null;
    readonly jobQuality: number | null;
    readonly requirementTable: readonly { readonly requirement: string; readonly kind: "must-have" | "nice-to-have"; readonly judgment: "met" | "partial" | "missing"; readonly evidenceText: string | null }[];
  };
  readonly postingUrl: string;
};
export interface ViewJobDetail {
  execute(request: ViewJobDetailRequest): Promise<ViewJobDetailResponse>;
}
export class ViewJobDetailInteractor implements ViewJobDetail {
  private readonly results: ResultsReadModel;
  constructor(results: ResultsReadModel) {
    this.results = results;
  }
  async execute(_request: ViewJobDetailRequest): Promise<ViewJobDetailResponse> {
    void this.results;
    return notYetBuilt("MR-5, MR-8: job detail (needs evidence text lookup by id)");
  }
}
