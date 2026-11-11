import type { JobPosting, SourceTier } from "../jobs/job-posting.ts";
import type { Preferences } from "../profile/profile.ts";
import { ratio } from "../shared/vocabulary.ts";
import type { GateResults } from "./gates.ts";
import { JUDGMENT_CREDIT, type RequirementJudgment } from "./judgments.ts";

// ---------- Fit (PRD: Fit) ----------
export const FIT_WEIGHTS = { mustHave: 35, experience: 25, skillsAndTools: 15, scope: 10, preferences: 10, niceToHave: 5 } as const;
export type FitComponent = keyof typeof FIT_WEIGHTS;
export type FitBreakdown = {
  readonly total: number; // 0..100, rounded
  readonly mustHaveCoverage: number; // 0..1
  readonly points: { readonly [K in FitComponent]: number };
};

/** Average credit; an empty list covers fully (nothing required is missing; thinness is Confidence's job). */
export function coverage(judgments: readonly RequirementJudgment[]): number {
  if (judgments.length === 0) return 1;
  return judgments.reduce((sum, j) => sum + JUDGMENT_CREDIT[j.judgment], 0) / judgments.length;
}

export function fit(input: {
  mustHave: readonly RequirementJudgment[];
  niceToHave: readonly RequirementJudgment[];
  experienceRelevance: number;
  skillsAndTools: number;
  scopeAlignment: number;
  preferencesFit: number;
}): FitBreakdown {
  const mustHaveCoverage = coverage(input.mustHave);
  const points = {
    mustHave: FIT_WEIGHTS.mustHave * mustHaveCoverage,
    experience: FIT_WEIGHTS.experience * ratio(input.experienceRelevance),
    skillsAndTools: FIT_WEIGHTS.skillsAndTools * ratio(input.skillsAndTools),
    scope: FIT_WEIGHTS.scope * ratio(input.scopeAlignment),
    preferences: FIT_WEIGHTS.preferences * ratio(input.preferencesFit),
    niceToHave: FIT_WEIGHTS.niceToHave * coverage(input.niceToHave),
  };
  const total = Math.round(Object.values(points).reduce((a, b) => a + b, 0));
  return { total, mustHaveCoverage, points };
}

/** Soft preferences (PF-1, PF-4): share of the applicable checks the job satisfies. */
export function preferencesFit(job: JobPosting, prefs: Preferences): number {
  const checks: boolean[] = [];
  if (prefs.workModes.length > 0 && job.workMode !== null) checks.push(prefs.workModes.includes(job.workMode));
  if (prefs.locations.length > 0 && job.workMode !== "remote") {
    checks.push(prefs.locations.some((l) => job.location.toLowerCase().includes(l.toLowerCase())));
  }
  if (prefs.salaryFloor !== null && job.salary !== null && job.salary.currency === prefs.salaryFloor.currency) {
    checks.push(job.salary.amount >= prefs.salaryFloor.amount);
  }
  return checks.length === 0 ? 1 : checks.filter(Boolean).length / checks.length;
}

// ---------- Confidence (PRD: Confidence) ----------
export type Confidence = "high" | "medium" | "low";

export function confidence(job: Pick<JobPosting, "requirements">, gates: GateResults): Confidence {
  const stated = job.requirements.length;
  const unknownGates = [gates.authorization, gates.seniority].filter((g) => g.outcome === "unknown").length;
  if (stated < 3 || unknownGates === 2) return "low";
  if (stated >= 5 && unknownGates === 0) return "high";
  return "medium";
}

// ---------- Job Quality (PRD: Job Quality) ----------
export const JOB_QUALITY_WEIGHTS = { freshness: 40, completeness: 25, sourceReliability: 20, legitimacy: 15 } as const;
export type JobQualityBreakdown = { readonly total: number; readonly points: { readonly [K in keyof typeof JOB_QUALITY_WEIGHTS]: number } };

/** ASSUMPTION: the PRD orders tiers but gives no values; these ratios are a placeholder to confirm. */
export const SOURCE_RELIABILITY: Readonly<Record<SourceTier, number>> = { 1: 1, 2: 0.75, 3: 0.5, 4: 0.25 };

const DAY_MS = 86_400_000;

export function jobQuality(job: JobPosting, now: Date): JobQualityBreakdown {
  const ageDays = (now.getTime() - new Date(job.postedAt).getTime()) / DAY_MS;
  const freshness = ageDays <= 7 ? 1 : ratio((45 - ageDays) / (45 - 7));
  const c = job.completeness;
  const completeness = [c.responsibilities, c.requirements, c.location, c.employerName].filter(Boolean).length / 4;
  const bestTier = Math.min(...job.sources.map((s) => s.tier), 4) as SourceTier;
  const l = job.legitimacy;
  const legitimacy = [l.identifiableEmployer, !l.asksForPayment, !l.matchesScamPattern].filter(Boolean).length / 3;
  const points = {
    freshness: JOB_QUALITY_WEIGHTS.freshness * freshness,
    completeness: JOB_QUALITY_WEIGHTS.completeness * completeness,
    sourceReliability: JOB_QUALITY_WEIGHTS.sourceReliability * SOURCE_RELIABILITY[bestTier],
    legitimacy: JOB_QUALITY_WEIGHTS.legitimacy * legitimacy,
  };
  return { total: Math.round(Object.values(points).reduce((a, b) => a + b, 0)), points };
}

// ---------- Ranking (PRD: Ranking and cost control) ----------
export function priority(fitTotal: number, qualityTotal: number): number {
  return 0.8 * fitTotal + 0.2 * qualityTotal;
}
