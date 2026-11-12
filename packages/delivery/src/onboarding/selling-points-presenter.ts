import type { CorrectProfileResponse, IntakeResumeResponse, SellingPointLine, SellingPointsCard } from "@matchmaker/use-cases";
import type { CorrectedPointsViewModel, OnboardingViewModel, SellingPointLineViewModel, TierLabel } from "./onboarding-view-model.ts";

const TIER_LABELS: Record<SellingPointLine["tier"], TierLabel> = { signature: "Signature", strong: "Strong", supporting: "Supporting" };
const FEWEST_POINTS_ON_CARD = 5;

/** The levels of the seniority ladder, in words. An unknown level is shown as given. */
const LEVEL_WORDS: Record<string, string> = {
  intern: "Intern",
  entry: "Entry level",
  mid: "Mid level",
  senior: "Senior",
  "lead-or-staff": "Lead or staff",
  manager: "Manager",
  director: "Director",
  vp: "Vice president",
  executive: "Executive",
};

export function presentIntake(response: IntakeResumeResponse): OnboardingViewModel {
  switch (response.outcome) {
    case "parsed":
      return presentCard(response.card);
    case "needs-pasted-text":
      return {
        kind: "paste-text",
        heading: "This file could not be read",
        prompt: "Paste the resume's text below and it will be read from that instead.",
      };
    case "unsupported-language":
      return {
        kind: "unsupported-language",
        heading: "This resume is not in English",
        message: "English is the only language in v1. An English version of the resume can be uploaded instead.",
      };
  }
}

export function presentCard(card: SellingPointsCard): OnboardingViewModel {
  return {
    kind: "card",
    heading: "Here is what you are selling",
    points: card.points.map(presentLine),
    fewPointsNote:
      card.points.length < FEWEST_POINTS_ON_CARD
        ? `This resume shows ${card.points.length} clear selling ${card.points.length === 1 ? "point" : "points"}; adding numbers and recent results would show more.`
        : null,
    strengthLabel: "Resume Strength",
    strengthScore: `${card.resumeStrength} / 100`,
    fixesHeading: "Fixes that would raise the score most",
    fixes: card.topFixes,
    suggestedLevel:
      card.suggestedSeniority === null
        ? "Suggested level: Entry level (the resume lists no work history)"
        : `Suggested level: ${LEVEL_WORDS[card.suggestedSeniority] ?? card.suggestedSeniority}, from the roles on this resume`,
  };
}

/** ADR 0015 §5: the question the view asks the owner before resending. */
export function presentAskFirst(): OnboardingViewModel {
  return {
    kind: "ask-first",
    question: "This month's budget is spent. Reading this resume costs a little more. Go ahead?",
    confirmLabel: "Go ahead",
    resendWithOverBudgetConfirmed: true,
  };
}

export function presentCorrection(response: CorrectProfileResponse): CorrectedPointsViewModel {
  return {
    kind: "corrected",
    notice: "Saved. Results will be re-checked against the corrected resume.",
    points: response.points.map(presentLine),
  };
}

function presentLine(line: SellingPointLine): SellingPointLineViewModel {
  return { lineId: line.evidenceId, tierLabel: TIER_LABELS[line.tier], statement: line.statement, proof: line.proof };
}
