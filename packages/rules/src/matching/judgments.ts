import type { ScoringProfile } from "../profile/scoring-profile.ts";

export type Judgment = "met" | "partial" | "missing";
export const JUDGMENT_CREDIT: Readonly<Record<Judgment, number>> = { met: 1, partial: 0.5, missing: 0 };

/**
 * One requirement judged against the profile. Produced by a judge (a model) outside the rules;
 * the rules decide what the judgment is worth.
 */
export type RequirementJudgment = {
  readonly requirementId: string;
  readonly judgment: Judgment;
  readonly evidenceIds: readonly string[];
  /** Could the user close this gap (confirm, learn, reframe)? Used for levers and "what would change this verdict". */
  readonly closableByUser: boolean;
};

/** Everything a judge contributes to one profile/posting pair. All ratios are 0..1. */
export type MatchJudgments = {
  readonly requirements: readonly RequirementJudgment[];
  readonly experienceRelevance: number;
  readonly skillsAndTools: number;
  readonly scopeAlignment: number;
};

/**
 * PRD: "Every Met or Partial judgment must cite the resume line or interview answer that supports it.
 * A judgment without evidence counts as Missing." Citations to evidence the profile does not hold are dropped.
 */
export function enforceEvidence(j: RequirementJudgment, profile: Pick<ScoringProfile, "evidence">): RequirementJudgment {
  const cited = j.evidenceIds.filter((id) => profile.evidence.some((e) => e.id === id));
  if (j.judgment !== "missing" && cited.length === 0) return { ...j, judgment: "missing", evidenceIds: [] };
  return { ...j, evidenceIds: cited };
}
