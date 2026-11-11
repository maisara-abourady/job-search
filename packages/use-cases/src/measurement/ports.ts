/**
 * Product analytics (ADR 0011), owned by the measurement area. Events are facts in the product's own
 * language, one per PRD metric. They carry ids, counts and times only: never resume text, profile facts,
 * personal details or job content, so no destination (own store or vendor) ever receives user data.
 */
type At = { readonly userId: string; readonly at: string };
export type ProductEvent =
  /** North star start and every signup-based denominator. `at` is the trial start, so a repeated sign-up call reports the same time. */
  | (At & { readonly name: "signed-up" })
  /** North star end: a results screen was served with at least one Apply verdict. The metric uses the first per user. */
  | (At & { readonly name: "apply-verdict-shown"; readonly applyCount: number })
  /** Applied rate. */
  | (At & { readonly name: "job-marked-applied"; readonly postingId: string })
  /** Trial-to-paid conversion. */
  | (At & { readonly name: "subscription-activated" })
  // Emitted by decorators added when their use cases are wired (hand-off list in ADR 0011):
  /** Onboarding completion (PF screens saved through CorrectProfile). */
  | (At & { readonly name: "preferences-saved" })
  /** Fix-a-fact rate. */
  | (At & { readonly name: "fact-fixed" })
  /** Interview completion (the metric counts answered >= 3). */
  | (At & { readonly name: "interview-finished"; readonly answered: number })
  /** Tailoring rate. */
  | (At & { readonly name: "tailored-resume-generated"; readonly postingId: string });
export type ProductEventName = ProductEvent["name"];

/**
 * Where product events go. Fire-and-forget: implementations must not throw and must not block the user's
 * action (buffer, then deliver). Measurement never changes what a use case does.
 */
export interface ProductEvents {
  record(event: ProductEvent): void;
}
