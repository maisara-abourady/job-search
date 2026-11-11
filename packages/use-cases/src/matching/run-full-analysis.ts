import type { ScoreJobs } from "./score-jobs.ts";

/** NF-6: full analysis on demand for a job cut at the prefilter. */
export type RunFullAnalysisRequest = { readonly userId: string; readonly postingId: string };
export interface RunFullAnalysis {
  execute(request: RunFullAnalysisRequest): Promise<void>;
}
export class RunFullAnalysisInteractor implements RunFullAnalysis {
  private readonly scoreJobs: ScoreJobs;
  constructor(scoreJobs: ScoreJobs) {
    this.scoreJobs = scoreJobs;
  }
  async execute(request: RunFullAnalysisRequest): Promise<void> {
    // HAND-OFF (NF-6): the stored Low-relevance match for this pair must be superseded, not reused from cache.
    await this.scoreJobs.execute({ userId: request.userId, postingIds: [request.postingId], cutAtPrefilter: [] });
  }
}
