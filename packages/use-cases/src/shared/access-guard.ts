import { accessStatus, withinFairUse, type Account, type FairUseAction } from "@matchmaker/rules";
import { UseCaseError } from "./errors.ts";
import type { Clock } from "./ports.ts";

/** Gateway owned by the guard: only what the guard needs. */
export interface AccountsForAccess {
  accountOf(userId: string): Promise<Account | null>;
}
export interface UsageLedger {
  usedToday(userId: string, action: FairUseAction, now: Date): Promise<number>;
  record(userId: string, action: FairUseAction, at: Date): Promise<void>;
}

/**
 * Cross-cutting rule (paywall and fair-use caps) applied inside every use case that spends model,
 * aggregator or proxy money, so no delivery mechanism can forget it.
 */
export class AccessGuard {
  private readonly accounts: AccountsForAccess;
  private readonly usage: UsageLedger;
  private readonly clock: Clock;
  constructor(accounts: AccountsForAccess, usage: UsageLedger, clock: Clock) {
    this.accounts = accounts;
    this.usage = usage;
    this.clock = clock;
  }
  async requireAccess(userId: string, spend?: FairUseAction): Promise<void> {
    const account = await this.accounts.accountOf(userId);
    if (account === null) throw new UseCaseError("not-found", `no account for ${userId}`);
    const now = this.clock.now();
    if (accessStatus(account, now).kind === "paywalled") throw new UseCaseError("access-denied", "trial ended");
    if (spend !== undefined) {
      if (!withinFairUse(spend, await this.usage.usedToday(userId, spend, now))) throw new UseCaseError("fair-use-exceeded", spend);
      await this.usage.record(userId, spend, now);
    }
  }
}
