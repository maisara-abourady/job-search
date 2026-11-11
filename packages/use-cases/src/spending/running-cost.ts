import { budgetStatus, monthContaining, validMonthlyBudget } from "@matchmaker/rules";
import { UseCaseError } from "../shared/errors.ts";
import type { SpendLedger } from "../shared/metering.ts";
import type { Clock } from "../shared/ports.ts";
import type { MonthlyBudgetControl, PeopleForRunningCost } from "./ports.ts";

/** AB-3, Flow 8 step 3: model and aggregator spend per profile for a month, against the owner's optional budget. */
export type ViewRunningCostRequest = { readonly monthOf?: string };
export type ViewRunningCostResponse = {
  readonly fromIso: string;
  readonly toIso: string;
  readonly perPerson: readonly { readonly personId: string; readonly displayName: string; readonly spentMicros: number }[];
  /** Spend no current profile carries: deleted profiles and anything unattributed. */
  readonly otherMicros: number;
  readonly totalMicros: number;
  readonly budgetMicros: number | null;
  readonly budget: "no-budget" | "within" | "reached";
  /** True when the budget is reached: scheduled monitoring is paused and on-demand actions ask first. */
  readonly monitoringPaused: boolean;
};
export interface ViewRunningCost {
  execute(request: ViewRunningCostRequest): Promise<ViewRunningCostResponse>;
}
export type SetMonthlyBudgetRequest = { readonly limitMicros: number | null };
export interface SetMonthlyBudget {
  execute(request: SetMonthlyBudgetRequest): Promise<void>;
}

export class ViewRunningCostInteractor implements ViewRunningCost {
  private readonly d: { people: PeopleForRunningCost; spend: Pick<SpendLedger, "spentBy" | "totalSpent">; budget: MonthlyBudgetControl; clock: Clock };
  constructor(dependencies: ViewRunningCostInteractor["d"]) {
    this.d = dependencies;
  }
  async execute(request: ViewRunningCostRequest): Promise<ViewRunningCostResponse> {
    const { fromIso, toIso } = monthContaining(request.monthOf === undefined ? this.d.clock.now() : new Date(request.monthOf));
    const people = await this.d.people.all();
    const perPerson = await Promise.all(
      people.map(async (p) => ({ personId: p.personId, displayName: p.displayName, spentMicros: await this.d.spend.spentBy(p.personId, fromIso, toIso) })),
    );
    const totalMicros = await this.d.spend.totalSpent(fromIso, toIso);
    const budget = await this.d.budget.monthlyBudget();
    // The panel judges the month it shows; the guard always judges the current month.
    const status = budgetStatus(budget, totalMicros).kind;
    return {
      fromIso, toIso, perPerson, otherMicros: totalMicros - perPerson.reduce((t, p) => t + p.spentMicros, 0), totalMicros,
      budgetMicros: budget?.limitMicros ?? null, budget: status, monitoringPaused: status === "reached",
    };
  }
}

export class SetMonthlyBudgetInteractor implements SetMonthlyBudget {
  private readonly budget: MonthlyBudgetControl;
  constructor(budget: MonthlyBudgetControl) {
    this.budget = budget;
  }
  async execute(request: SetMonthlyBudgetRequest): Promise<void> {
    const budget = validMonthlyBudget(request.limitMicros);
    if (budget === undefined) throw new UseCaseError("invalid-input", "a monthly budget is a positive amount, or none");
    await this.budget.setMonthlyBudget(budget);
  }
}
