import { notYetBuilt } from "@matchmaker/rules";
import type { ResultsReadModel } from "./ports.ts";

/** Flow 5, NF-1..NF-4: counts by primary reason, gap insight, grouped jobs, seven-part report per job. */
export type ReviewNotAFitRequest = { readonly personId: string };
export type ReviewNotAFitResponse = {
  readonly total: number;
  readonly byReason: readonly { readonly reason: string; readonly count: number; readonly postingIds: readonly string[] }[];
  /** NF-4: the five requirements most often Missing across rejected jobs, and how many jobs each blocks. */
  readonly gapInsight: readonly { readonly requirement: string; readonly jobsBlocked: number }[];
};
export interface ReviewNotAFit {
  execute(request: ReviewNotAFitRequest): Promise<ReviewNotAFitResponse>;
}
export class ReviewNotAFitInteractor implements ReviewNotAFit {
  private readonly results: ResultsReadModel;
  constructor(results: ResultsReadModel) {
    this.results = results;
  }
  async execute(_request: ReviewNotAFitRequest): Promise<ReviewNotAFitResponse> {
    void this.results;
    return notYetBuilt("NF-1..NF-4: Not a fit review and gap insight");
  }
}
