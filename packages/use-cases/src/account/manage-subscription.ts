import { notYetBuilt } from "@matchmaker/rules";
import type { Accounts, Checkout } from "./ports.ts";

/** Flow 8 step 3. The billing provider's webhook listener (a humble object) translates into RecordSubscriptionChange. */
export interface StartCheckout {
  execute(request: { userId: string }): Promise<{ redirectTo: string }>;
}
export type SubscriptionChange = { readonly userId: string; readonly status: "active" | "lapsed"; readonly at: string };
export interface RecordSubscriptionChange {
  execute(change: SubscriptionChange): Promise<void>;
}
export class StartCheckoutInteractor implements StartCheckout {
  private readonly checkout: Checkout;
  constructor(checkout: Checkout) {
    this.checkout = checkout;
  }
  async execute(request: { userId: string }): Promise<{ redirectTo: string }> {
    return this.checkout.startCheckout(request.userId);
  }
}
export class RecordSubscriptionChangeInteractor implements RecordSubscriptionChange {
  private readonly accounts: Accounts;
  constructor(accounts: Accounts) {
    this.accounts = accounts;
  }
  async execute(change: SubscriptionChange): Promise<void> {
    void this.accounts;
    void change;
    return notYetBuilt("AB-3: record subscription change (idempotent per provider event id)");
  }
}
