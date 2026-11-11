import { ratio } from "../shared/vocabulary.ts";

/** PRD: Resume Strength weights. Component ratios (0..1) are judged outside; the weighting is the rule. */
export const RESUME_STRENGTH_WEIGHTS = {
  impactEvidence: 30,
  skillsDepth: 20,
  clarityAndStructure: 20,
  careerTrajectory: 15,
  atsReadability: 15,
} as const;
export type ResumeStrengthComponent = keyof typeof RESUME_STRENGTH_WEIGHTS;
export type ResumeStrengthRatios = { readonly [K in ResumeStrengthComponent]: number };

export function resumeStrength(ratios: ResumeStrengthRatios): { total: number; points: ResumeStrengthRatios } {
  const keys = Object.keys(RESUME_STRENGTH_WEIGHTS) as ResumeStrengthComponent[];
  const points = Object.fromEntries(keys.map((k) => [k, RESUME_STRENGTH_WEIGHTS[k] * ratio(ratios[k])])) as ResumeStrengthRatios;
  return { total: Math.round(keys.reduce((sum, k) => sum + points[k], 0)), points };
}
