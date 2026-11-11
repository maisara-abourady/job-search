import type { Clock } from "../shared/ports.ts";
import type { Accounts } from "./ports.ts";

/**
 * AB-1, AB-2. Authentication (email or Google) happens in delivery; the use case receives an
 * already-authenticated user id and starts the 7-day trial.
 */
export type SignUpRequest = { readonly userId: string };
export interface SignUp {
  execute(request: SignUpRequest): Promise<{ readonly trialStartedAt: string }>;
}
export class SignUpInteractor implements SignUp {
  private readonly accounts: Accounts;
  private readonly clock: Clock;
  constructor(accounts: Accounts, clock: Clock) {
    this.accounts = accounts;
    this.clock = clock;
  }
  async execute(request: SignUpRequest): Promise<{ readonly trialStartedAt: string }> {
    const existing = await this.accounts.accountOf(request.userId);
    if (existing !== null) return { trialStartedAt: existing.trialStartedAt };
    const trialStartedAt = this.clock.now().toISOString();
    await this.accounts.create({ userId: request.userId, trialStartedAt, subscription: { status: "none", lapsedAt: null } });
    return { trialStartedAt };
  }
}
