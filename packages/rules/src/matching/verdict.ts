import type { JobPosting } from "../jobs/job-posting.ts";
import type { Preferences } from "../profile/profile.ts";
import type { ScoringProfile } from "../profile/scoring-profile.ts";
import { anyGateFails, type GateResults } from "./gates.ts";
import { enforceEvidence, type MatchJudgments, type RequirementJudgment } from "./judgments.ts";
import {
  FIT_WEIGHTS, confidence, fit, jobQuality, preferencesFit, priority,
  type Confidence, type FitBreakdown, type JobQualityBreakdown,
} from "./scores.ts";

export type Verdict = "apply" | "stretch" | "not-a-fit";
export type NotAFitReason =
  | "work-authorization" | "seniority-mismatch" | "missing-must-haves" | "low-overall-fit"
  | "low-relevance" | "poor-posting" | "unsupported-language";

/** The single change that would move a job up, e.g. "6 points from Apply: confirm your SQL experience". */
export type Lever = { readonly requirementId: string; readonly pointsGained: number };

export type MatchAssessment = {
  readonly gates: GateResults | null; // null when cut before gates (prefilter, language)
  readonly fit: FitBreakdown | null; // null when a gate failed or the job was cut
  readonly confidence: Confidence | null;
  readonly quality: JobQualityBreakdown | null;
  readonly judgments: readonly RequirementJudgment[];
  readonly verdict: Verdict;
  readonly primaryReason: NotAFitReason | null;
  readonly priority: number;
  readonly pointsToApply: number | null;
  readonly lever: Lever | null;
};

export const APPLY_FIT = 80;
export const STRETCH_FIT = 65;
export const MIN_JOB_QUALITY = 40;
export const MIN_MUST_HAVE_COVERAGE = 0.5;
export const SUPPORTED_LANGUAGE = "en";

/** Does this pair need a judge (a model call)? Cheap rules run first so failed gates cost nothing (MR-1). */
export function needsJudgment(job: JobPosting, gates: GateResults): boolean {
  return job.language === SUPPORTED_LANGUAGE && !anyGateFails(gates);
}

/** Jobs cut at the relevance prefilter get a verdict without gates or scores (PRD: Ranking and cost control). */
export function assessCutAtPrefilter(): MatchAssessment {
  return notAFit("low-relevance", null, null, null, null, []);
}

/**
 * The verdict policy (PRD: Verdicts). Pure: same inputs, same verdict, which is what makes
 * "re-scoring the same pair lands within 3 points" achievable whatever the judge does.
 */
export function assessMatch(input: {
  job: JobPosting;
  profile: ScoringProfile;
  preferences: Preferences;
  gates: GateResults;
  judgments: MatchJudgments | null; // null only when needsJudgment() was false
  now: Date;
}): MatchAssessment {
  const { job, gates } = input;
  const quality = jobQuality(job, input.now);
  if (job.language !== SUPPORTED_LANGUAGE) return notAFit("unsupported-language", gates, null, null, quality, []);
  if (gates.authorization.outcome === "fail") return notAFit("work-authorization", gates, null, null, quality, []);
  if (gates.seniority.outcome === "fail") return notAFit("seniority-mismatch", gates, null, null, quality, []);
  if (input.judgments === null) throw new Error("assessMatch: judgments are required when no gate fails");

  const judged = input.judgments.requirements.map((j) => enforceEvidence(j, input.profile));
  const kindOf = new Map(job.requirements.map((r) => [r.id, r.kind]));
  const mustHave = judged.filter((j) => kindOf.get(j.requirementId) === "must-have");
  const niceToHave = judged.filter((j) => kindOf.get(j.requirementId) === "nice-to-have");
  const fitBreakdown = fit({
    mustHave, niceToHave,
    experienceRelevance: input.judgments.experienceRelevance,
    skillsAndTools: input.judgments.skillsAndTools,
    scopeAlignment: input.judgments.scopeAlignment,
    preferencesFit: preferencesFit(job, input.preferences),
  });
  const conf = confidence(job, gates);
  const missingMustHaves = mustHave.filter((j) => j.judgment === "missing").length;
  const lever = biggestLever(mustHave, niceToHave);

  // ASSUMPTION (precedence of primary reasons when several Not a fit triggers hold): posting, coverage, fit.
  if (quality.total < MIN_JOB_QUALITY) return notAFit("poor-posting", gates, fitBreakdown, conf, quality, judged, lever);
  if (fitBreakdown.mustHaveCoverage < MIN_MUST_HAVE_COVERAGE) return notAFit("missing-must-haves", gates, fitBreakdown, conf, quality, judged, lever);
  if (fitBreakdown.total < STRETCH_FIT) return notAFit("low-overall-fit", gates, fitBreakdown, conf, quality, judged, lever);

  const isApply = fitBreakdown.total >= APPLY_FIT && missingMustHaves === 0 && conf !== "low";
  // ASSUMPTION: Fit >= 80 with two or more Missing must-haves (coverage still >= 50%) is Stretch, like one Missing.
  return {
    gates, fit: fitBreakdown, confidence: conf, quality, judgments: judged,
    verdict: isApply ? "apply" : "stretch",
    primaryReason: null,
    priority: priority(fitBreakdown.total, quality.total),
    pointsToApply: isApply ? null : Math.max(0, APPLY_FIT - fitBreakdown.total),
    lever: isApply ? null : lever,
  };
}

/** The closable requirement whose closing would gain the most Fit points. */
export function biggestLever(mustHave: readonly RequirementJudgment[], niceToHave: readonly RequirementJudgment[]): Lever | null {
  const candidates = [
    ...mustHave.map((j) => ({ j, weight: FIT_WEIGHTS.mustHave / mustHave.length })),
    ...niceToHave.map((j) => ({ j, weight: FIT_WEIGHTS.niceToHave / niceToHave.length })),
  ]
    .filter(({ j }) => j.closableByUser && j.judgment !== "met")
    .map(({ j, weight }) => ({ requirementId: j.requirementId, pointsGained: weight * (j.judgment === "partial" ? 0.5 : 1) }))
    .sort((a, b) => b.pointsGained - a.pointsGained);
  return candidates[0] ?? null;
}

function notAFit(
  reason: NotAFitReason, gates: GateResults | null, fitB: FitBreakdown | null, conf: Confidence | null,
  quality: JobQualityBreakdown | null, judgments: readonly RequirementJudgment[], lever: Lever | null = null,
): MatchAssessment {
  return {
    gates, fit: fitB, confidence: conf, quality, judgments,
    verdict: "not-a-fit", primaryReason: reason,
    priority: fitB !== null && quality !== null ? priority(fitB.total, quality.total) : 0,
    pointsToApply: fitB !== null ? Math.max(0, APPLY_FIT - fitB.total) : null,
    lever,
  };
}
