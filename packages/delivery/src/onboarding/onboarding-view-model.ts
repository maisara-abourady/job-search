/**
 * Flow 1 step 2: what the onboarding screens show. Strings, booleans and enums only; the view moves them to the
 * screen. Copy describes the resume, never the person (shape of encouragement, principles 3 and 6).
 */
export type TierLabel = "Signature" | "Strong" | "Supporting";

export type SellingPointLineViewModel = {
  /** Sent back unchanged when the person corrects this line. */
  readonly lineId: string;
  readonly tierLabel: TierLabel;
  readonly statement: string;
  readonly proof: string;
};

export type SellingPointsCardViewModel = {
  readonly kind: "card";
  readonly heading: string;
  readonly points: readonly SellingPointLineViewModel[];
  /** Set when fewer than five points qualified: the card says so rather than padding. */
  readonly fewPointsNote: string | null;
  readonly strengthLabel: string;
  readonly strengthScore: string;
  readonly fixesHeading: string;
  readonly fixes: readonly string[];
  readonly suggestedLevel: string;
};

export type OnboardingViewModel =
  | SellingPointsCardViewModel
  | { readonly kind: "paste-text"; readonly heading: string; readonly prompt: string }
  | { readonly kind: "unsupported-language"; readonly heading: string; readonly message: string }
  /** ADR 0015 §5: the monthly budget is spent. If the owner agrees, the view resends with `overBudgetConfirmed`. */
  | { readonly kind: "ask-first"; readonly question: string; readonly confirmLabel: string; readonly resendWithOverBudgetConfirmed: true };

/** What a correction shows: the card's lines as the new version has them. */
export type CorrectedPointsViewModel = {
  readonly kind: "corrected";
  readonly notice: string;
  readonly points: readonly SellingPointLineViewModel[];
};
