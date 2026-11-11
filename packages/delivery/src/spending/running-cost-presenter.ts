import type { ViewRunningCostResponse } from "@matchmaker/use-cases";

/** Flow 8 step 3, AB-3: the running-cost panel. Strings and flags only; the view just moves them to the screen. */
export type RunningCostViewModel = {
  readonly monthLabel: string;
  readonly rows: readonly { readonly name: string; readonly amount: string }[];
  readonly otherLine: string | null;
  readonly totalLine: string;
  readonly budgetLine: string;
  readonly budgetReached: boolean;
  readonly pausedNotice: string | null;
};

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Micros of the accounting currency (ASSUMPTION: USD, deferred.md D13) as a display amount. */
export function formatMicros(micros: number): string {
  return `$${(micros / 1_000_000).toFixed(2)}`;
}

export function presentRunningCost(r: ViewRunningCostResponse): RunningCostViewModel {
  const from = new Date(r.fromIso);
  return {
    monthLabel: `${MONTHS[from.getUTCMonth()]} ${from.getUTCFullYear()}`,
    rows: r.perPerson.map((p) => ({ name: p.displayName, amount: formatMicros(p.spentMicros) })),
    otherLine: r.otherMicros > 0 ? `Deleted profiles and other: ${formatMicros(r.otherMicros)}` : null,
    totalLine: `Total: ${formatMicros(r.totalMicros)}`,
    budgetLine: r.budgetMicros === null ? "No monthly budget set" : `Monthly budget: ${formatMicros(r.budgetMicros)}`,
    budgetReached: r.budget === "reached",
    pausedNotice: r.monitoringPaused ? "Budget reached: monitoring is paused, and searches and tailoring ask before spending" : null,
  };
}
