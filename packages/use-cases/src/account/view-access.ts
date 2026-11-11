import { accessStatus } from "@matchmaker/rules";
import { UseCaseError } from "../shared/errors.ts";
import type { Clock } from "../shared/ports.ts";
import type { Accounts } from "./ports.ts";

/** Flow 8, AB-3: trial banner from day 5, paywall from day 8. */
export type AccessView =
  | { readonly state: "trial"; readonly daysRemaining: number; readonly showBanner: boolean }
  | { readonly state: "subscribed" }
  | { readonly state: "paywalled" };
export interface ViewAccess {
  execute(request: { userId: string }): Promise<AccessView>;
}
export class ViewAccessInteractor implements ViewAccess {
  private readonly accounts: Accounts;
  private readonly clock: Clock;
  constructor(accounts: Accounts, clock: Clock) {
    this.accounts = accounts;
    this.clock = clock;
  }
  async execute(request: { userId: string }): Promise<AccessView> {
    const account = await this.accounts.accountOf(request.userId);
    if (account === null) throw new UseCaseError("not-found", request.userId);
    const s = accessStatus(account, this.clock.now());
    if (s.kind === "trial") return { state: "trial", daysRemaining: s.daysRemaining, showBanner: s.showBanner };
    return { state: s.kind };
  }
}
