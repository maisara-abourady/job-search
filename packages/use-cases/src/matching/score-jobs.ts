import {
  assessCutAtPrefilter, assessMatch, evaluateGates, needsJudgment, profileVersionKey, toScoringProfile,
  type MatchAssessment,
} from "@matchmaker/rules";
import { UseCaseError } from "../shared/errors.ts";
import type { SpendAttribution } from "../shared/metering.ts";
import type { Clock } from "../shared/ports.ts";
import type { MatchJudge, MatchNarrator, MatchRecords, Narration, PostingsForScoring, ProfilesForScoring, ResultsFeed } from "./ports.ts";

// ---- Input port and models (MR-1..MR-6, NF-5 re-score, NF-6 full analysis, MN-2 only new) ----
export type ScoreJobsRequest = {
  readonly userId: string;
  /** The search run that asked for this scoring, if any: its judge and narrator spend is charged to that run (ADR 0010). */
  readonly runId: string | null;
  readonly postingIds: readonly string[];
  /** Postings cut at the relevance prefilter: recorded as Not a fit / Low relevance without a model call. */
  readonly cutAtPrefilter: readonly string[];
};
export type ScoreJobsResponse = { readonly scored: number; readonly reused: number; readonly verdictChanges: number };
export interface ScoreJobs {
  execute(request: ScoreJobsRequest): Promise<ScoreJobsResponse>;
}

export type ScoreJobsDependencies = {
  readonly profiles: ProfilesForScoring;
  readonly postings: PostingsForScoring;
  readonly matches: MatchRecords;
  readonly judge: MatchJudge;
  readonly narrator: MatchNarrator;
  readonly feed: ResultsFeed;
  readonly spend: SpendAttribution;
  readonly clock: Clock;
};

const CUT_NARRATION: Narration = { reason: "This role was outside the closest matches to your profile in this search.", pointsToCapitalize: [] };

/** Application rules of scoring: cache per (profile version, posting revision), cheap gates first, then judge, then the rules decide. */
export class ScoreJobsInteractor implements ScoreJobs {
  private readonly d: ScoreJobsDependencies;
  constructor(dependencies: ScoreJobsDependencies) {
    this.d = dependencies;
  }

  async execute(request: ScoreJobsRequest): Promise<ScoreJobsResponse> {
    return this.d.spend.charge({ userId: request.userId, runId: request.runId, purpose: "scoring" }, () => this.score(request));
  }

  private async score(request: ScoreJobsRequest): Promise<ScoreJobsResponse> {
    const profile = await this.d.profiles.activeProfileVersion(request.userId);
    if (profile === null) throw new UseCaseError("not-found", `no profile for ${request.userId}`);
    const key = profileVersionKey(profile);
    const scoringProfile = toScoringProfile(profile);
    const cut = new Set(request.cutAtPrefilter);
    const postings = await this.d.postings.postingsByIds([...request.postingIds, ...request.cutAtPrefilter]);
    let scored = 0, reused = 0, verdictChanges = 0;

    for (const posting of postings) {
      if (await this.d.matches.findMatch(key, posting.id, posting.revision)) {
        reused++;
        continue;
      }
      let assessment: MatchAssessment;
      let narration: Narration;
      if (cut.has(posting.id)) {
        assessment = assessCutAtPrefilter();
        narration = CUT_NARRATION;
      } else {
        const gates = evaluateGates(posting, profile.preferences);
        const judgments = needsJudgment(posting, gates) ? await this.d.judge.judge(scoringProfile, posting) : null;
        assessment = assessMatch({ job: posting, profile: scoringProfile, preferences: profile.preferences, gates, judgments, now: this.d.clock.now() });
        narration = await this.d.narrator.narrate({ profile: scoringProfile, posting, assessment });
      }
      const previous = await this.d.matches.latestVerdictBefore(request.userId, posting.id, key);
      const changed = previous !== null && previous !== assessment.verdict;
      await this.d.matches.saveMatch({
        userId: request.userId, profileVersionKey: key, postingId: posting.id, postingRevision: posting.revision,
        assessment, narration, verdictChangedFrom: changed ? previous : null, userState: "new",
        scoredAt: this.d.clock.now().toISOString(),
      });
      this.d.feed.jobScored({ userId: request.userId, postingId: posting.id, verdict: assessment.verdict, verdictChanged: changed });
      scored++;
      if (changed) verdictChanges++;
    }
    return { scored, reused, verdictChanges };
  }
}
