import type { Account } from "@matchmaker/rules";
import { UseCaseError } from "../shared/errors.ts";
import type { Accounts, Checkout } from "./ports.ts";

/** Flow 8 step 3. The billing provider's webhook listener (a humble object) translates into RecordSubscriptionChange. */
export interface StartCheckout {
  execute(request: { userId: string }): Promise<{ redirectTo: string }>;
}
/**
 * A subscription change as the billing provider's listener reports it (ADR 0013). `eventId` is the provider's
 * event id, opaque here; the listener namespaces it so ids from two providers can never collide. `at` is
 * when the provider says the change happened (the lapse date for "lapsed").
 */
export type SubscriptionChange = {
  readonly eventId: string;
  readonly userId: string;
  readonly status: "active" | "lapsed";
  readonly at: string;
};
export type RecordSubscriptionChangeResponse = { readonly outcome: "applied" | "duplicate" };
export interface RecordSubscriptionChange {
  execute(change: SubscriptionChange): Promise<RecordSubscriptionChangeResponse>;
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
/** AB-3: active lifts the paywall; lapsed paywalls from the lapse date; the same provider event twice changes nothing. */
export class RecordSubscriptionChangeInteractor implements RecordSubscriptionChange {
  private readonly accounts: Accounts;
  constructor(accounts: Accounts) {
    this.accounts = accounts;
  }
  async execute(change: SubscriptionChange): Promise<RecordSubscriptionChangeResponse> {
    if (change.eventId.trim() === "") throw new UseCaseError("invalid-input", "subscription change without a provider event id");
    if ((await this.accounts.accountOf(change.userId)) === null) throw new UseCaseError("not-found", change.userId);
    const subscription: Account["subscription"] =
      change.status === "active" ? { status: "active", lapsedAt: null } : { status: "lapsed", lapsedAt: change.at };
    // HAND-OFF (P6-T02, with D7): out-of-order delivery. See ADR 0013 and watch item W12.
    return { outcome: await this.accounts.applySubscriptionEvent(change.eventId, change.userId, subscription) };
  }
}
