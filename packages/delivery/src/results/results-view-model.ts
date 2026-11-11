/** Everything the results screen shows, as strings, booleans and enums. The view only moves it to the screen. */
export type ResultCardViewModel = {
  readonly postingId: string;
  readonly title: string;
  readonly subtitle: string; // "Employer · Location"
  readonly verdictLabel: "Apply" | "Within reach" | "Not a fit";
  readonly verdictTone: "positive" | "encouraging" | "neutral";
  readonly reason: string;
  readonly distanceLine: string | null; // "6 points from Apply: confirm your SQL experience"
  readonly badges: readonly string[];
  readonly showChangedFlag: boolean;
};
export type ResultsTabViewModel = { readonly id: "apply" | "within-reach" | "not-a-fit"; readonly label: string; readonly countLabel: string; readonly selected: boolean };
export type ResultsViewModel = {
  readonly tabs: readonly ResultsTabViewModel[];
  readonly applyCards: readonly ResultCardViewModel[];
  readonly withinReachCards: readonly ResultCardViewModel[];
  /** Shape of encouragement 3: an empty Apply tab never appears blank. */
  readonly emptyApplyHeading: string | null;
  readonly closestCards: readonly ResultCardViewModel[];
};
