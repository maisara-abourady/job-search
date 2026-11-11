/** PRD: Pricing and trial. Business policy that would exist for any subscription business, automated or not. */
export const TRIAL_DAYS = 7;
export const TRIAL_BANNER_FROM_DAY = 5;
export const DATA_RETENTION_DAYS_AFTER_EXPIRY = 30; // ASSUMPTION in the PRD
export const FAIR_USE_PER_DAY = { onDemandSearches: 3, tailoredResumes: 10 } as const; // ASSUMPTION in the PRD

export type Subscription = { readonly status: "none" | "active" | "lapsed"; readonly lapsedAt: string | null };
export type Account = { readonly userId: string; readonly trialStartedAt: string; readonly subscription: Subscription };

export type AccessStatus =
  | { readonly kind: "trial"; readonly day: number; readonly daysRemaining: number; readonly showBanner: boolean }
  | { readonly kind: "subscribed" }
  | { readonly kind: "paywalled"; readonly since: string; readonly deleteDataAfter: string };

const DAY_MS = 86_400_000;

export function accessStatus(account: Account, now: Date): AccessStatus {
  if (account.subscription.status === "active") return { kind: "subscribed" };
  const start = new Date(account.trialStartedAt).getTime();
  const day = Math.floor((now.getTime() - start) / DAY_MS) + 1; // signup day is day 1
  if (day <= TRIAL_DAYS) {
    return { kind: "trial", day, daysRemaining: TRIAL_DAYS - day + 1, showBanner: day >= TRIAL_BANNER_FROM_DAY };
  }
  const trialEnd = start + TRIAL_DAYS * DAY_MS;
  const lapsed = account.subscription.lapsedAt !== null ? Math.max(new Date(account.subscription.lapsedAt).getTime(), trialEnd) : trialEnd;
  return {
    kind: "paywalled",
    since: new Date(lapsed).toISOString(),
    deleteDataAfter: new Date(lapsed + DATA_RETENTION_DAYS_AFTER_EXPIRY * DAY_MS).toISOString(),
  };
}

export type FairUseAction = keyof typeof FAIR_USE_PER_DAY;
export function withinFairUse(action: FairUseAction, usedToday: number): boolean {
  return usedToday < FAIR_USE_PER_DAY[action];
}
