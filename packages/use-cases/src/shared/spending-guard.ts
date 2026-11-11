import { budgetStatus, monthContaining, type BudgetStatus, type MonthlyBudget } from "@matchmaker/rules";
import { UseCaseError } from "./errors.ts";
import type { SpendLedger } from "./metering.ts";
import type { Clock } from "./ports.ts";

/**
 * PRD "Running cost": daily caps per profile, "to stop runaway spend" (ASSUMPTION in the PRD). Application
 * cost policy, like the prefilter cap, so it lives here and not in the rules.
 */
export const DAILY_CAPS = { onDemandSearches: 3, tailoredResumes: 10 } as const;
export type CappedAction = keyof typeof DAILY_CAPS;

/** Gateways owned by the guard: only what it needs. */
export interface PeopleForSpending {
  exists(personId: string): Promise<boolean>;
}
export interface UsageLedger {
  usedToday(personId: string, action: CappedAction, now: Date): Promise<number>;
  record(personId: string, action: CappedAction, at: Date): Promise<void>;
}
export interface MonthlyBudgetSetting {
  monthlyBudget(): Promise<MonthlyBudget>;
}

/**
 * The owner's spending limits, applied inside every use case that spends model or aggregator money, so no
 * delivery mechanism can forget them (ADR 0015). Two questions:
 * - on demand (a person's own action): within today's cap, and either within the budget or confirmed by the owner;
 * - in the background (monitoring): only while the monthly budget is not reached.
 */
export class SpendingGuard {
  private readonly people: PeopleForSpending;
  private readonly usage: UsageLedger;
  private readonly budget: MonthlyBudgetSetting;
  private readonly spend: Pick<SpendLedger, "totalSpent">;
  private readonly clock: Clock;
  constructor(d: { people: PeopleForSpending; usage: UsageLedger; budget: MonthlyBudgetSetting; spend: Pick<SpendLedger, "totalSpent">; clock: Clock }) {
    this.people = d.people;
    this.usage = d.usage;
    this.budget = d.budget;
    this.spend = d.spend;
    this.clock = d.clock;
  }

  /** Throws "not-found", "daily-cap-reached" or "monthly-budget-reached"; otherwise counts the action against today's cap. */
  async beforeOnDemand(personId: string, capped: CappedAction | null, overBudgetConfirmed: boolean): Promise<void> {
    if (!(await this.people.exists(personId))) throw new UseCaseError("not-found", `no profile ${personId}`);
    const now = this.clock.now();
    if (capped !== null && (await this.usage.usedToday(personId, capped, now)) >= DAILY_CAPS[capped]) {
      throw new UseCaseError("daily-cap-reached", capped);
    }
    if (!overBudgetConfirmed && (await this.status()).kind === "reached") {
      throw new UseCaseError("monthly-budget-reached", "the monthly budget is spent; ask the owner before spending more");
    }
    if (capped !== null) await this.usage.record(personId, capped, now);
  }

  /** Throws "not-found" or "monthly-budget-reached": background work never asks, it pauses. */
  async beforeBackground(personId: string): Promise<void> {
    if (!(await this.people.exists(personId))) throw new UseCaseError("not-found", `no profile ${personId}`);
    if (await this.monthlyBudgetReached()) throw new UseCaseError("monthly-budget-reached", "monitoring is paused until next month or a higher budget");
  }

  async monthlyBudgetReached(): Promise<boolean> {
    return (await this.status()).kind === "reached";
  }

  async status(): Promise<BudgetStatus> {
    const month = monthContaining(this.clock.now());
    return budgetStatus(await this.budget.monthlyBudget(), await this.spend.totalSpent(month.fromIso, month.toIso));
  }
}
