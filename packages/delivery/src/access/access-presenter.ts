import type { AccessView } from "@matchmaker/use-cases";

/** Flow 8: banner from day 5, paywall on login from day 8 with the match counts still visible behind it. */
export type AccessViewModel = { readonly banner: string | null; readonly paywall: boolean };
export function presentAccess(view: AccessView): AccessViewModel {
  if (view.state === "paywalled") return { banner: null, paywall: true };
  if (view.state === "trial" && view.showBanner) {
    return { banner: `${view.daysRemaining} ${view.daysRemaining === 1 ? "day" : "days"} left in your free trial`, paywall: false };
  }
  return { banner: null, paywall: false };
}
