import type { MonthlyBudget, Person } from "@matchmaker/rules";
import type { MonthlyBudgetSetting } from "../shared/spending-guard.ts";

/** The owner's own setting (AB-3). One value for the whole installation, not per profile (ADR 0015). */
export interface MonthlyBudgetControl extends MonthlyBudgetSetting {
  setMonthlyBudget(budget: MonthlyBudget): Promise<void>;
}
/** The running-cost panel lists every profile by name. */
export interface PeopleForRunningCost {
  all(): Promise<readonly Person[]>;
}
