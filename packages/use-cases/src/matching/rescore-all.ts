import type { MatchRecords } from "./ports.ts";
import type { ScoreJobs } from "./score-jobs.ts";

/** Flow 7 and NF-5: after any profile change, every stored job is re-scored against the new version; changed verdicts are flagged. */
export interface RescoreAll {
  execute(request: { personId: string }): Promise<{ scored: number; verdictChanges: number }>;
}
export class RescoreAllInteractor implements RescoreAll {
  private readonly matches: MatchRecords;
  private readonly scoreJobs: ScoreJobs;
  constructor(matches: MatchRecords, scoreJobs: ScoreJobs) {
    this.matches = matches;
    this.scoreJobs = scoreJobs;
  }
  async execute(request: { personId: string }): Promise<{ scored: number; verdictChanges: number }> {
    const postingIds = await this.matches.postingIdsScoredFor(request.personId);
    // HAND-OFF (cost): reuse requirement judgments whose requirement and cited evidence are unchanged.
    const r = await this.scoreJobs.execute({ personId: request.personId, runId: null, postingIds, cutAtPrefilter: [] });
    return { scored: r.scored, verdictChanges: r.verdictChanges };
  }
}
