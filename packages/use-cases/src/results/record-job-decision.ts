import type { ResultsReadModel } from "./ports.ts";

/** MR-7: mark a job applied or dismiss it. */
export type RecordJobDecisionRequest = { readonly personId: string; readonly postingId: string; readonly decision: "applied" | "dismissed" };
export interface RecordJobDecision {
  execute(request: RecordJobDecisionRequest): Promise<void>;
}
export class RecordJobDecisionInteractor implements RecordJobDecision {
  private readonly results: ResultsReadModel;
  constructor(results: ResultsReadModel) {
    this.results = results;
  }
  async execute(r: RecordJobDecisionRequest): Promise<void> {
    await this.results.setUserState(r.personId, r.postingId, r.decision);
  }
}
