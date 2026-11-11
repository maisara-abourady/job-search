/**
 * PRD "Running cost", AB-3. The owner pays every model and aggregator bill, so the owner may set one monthly
 * budget for all the spending the app does on everyone's behalf. It would exist for anyone paying for a job
 * search out of pocket, automated or not. Money is integer micro-units of the accounting currency (D13).
 *
 * INTERPRETATION (ADR 0015): one owner-wide budget over the total spend of all profiles in the calendar month
 * (UTC), not one budget per profile. Spend is still shown per profile.
 */
export type MonthlyBudget = { readonly limitMicros: number } | null;

export type BudgetStatus =
  | { readonly kind: "no-budget" }
  | { readonly kind: "within"; readonly remainingMicros: number }
  | { readonly kind: "reached"; readonly overByMicros: number };

export function budgetStatus(budget: MonthlyBudget, spentThisMonthMicros: number): BudgetStatus {
  if (budget === null) return { kind: "no-budget" };
  const remaining = budget.limitMicros - spentThisMonthMicros;
  return remaining > 0 ? { kind: "within", remainingMicros: remaining } : { kind: "reached", overByMicros: -remaining };
}

/** A budget the owner can set: a positive whole number of micros, or none at all. */
export function validMonthlyBudget(limitMicros: number | null): MonthlyBudget | undefined {
  if (limitMicros === null) return null;
  return Number.isSafeInteger(limitMicros) && limitMicros > 0 ? { limitMicros } : undefined;
}

/** The calendar month (UTC) that contains `now`, as [from, to) ISO bounds. */
export function monthContaining(now: Date): { readonly fromIso: string; readonly toIso: string } {
  const from = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  const to = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
  return { fromIso: new Date(from).toISOString(), toIso: new Date(to).toISOString() };
}
