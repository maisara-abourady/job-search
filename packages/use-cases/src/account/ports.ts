import type { Account } from "@matchmaker/rules";

export interface Accounts {
  accountOf(userId: string): Promise<Account | null>;
  create(account: Account): Promise<void>;
  updateSubscription(userId: string, subscription: Account["subscription"]): Promise<void>;
  paywalledBefore(cutoffIso: string): Promise<readonly string[]>;
}
/** Merchant-of-record provider, whichever it turns out to be (deferred). Returns where the user goes to pay. */
export interface Checkout {
  startCheckout(userId: string): Promise<{ redirectTo: string }>;
}
/** AB-4, Privacy 2: every store that holds user data takes part. */
export interface UserDataVault {
  exportAll(userId: string): Promise<Uint8Array>;
  eraseAll(userId: string): Promise<void>;
}
