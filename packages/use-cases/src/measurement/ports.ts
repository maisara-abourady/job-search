/**
 * Product analytics (ADR 0011), owned by the measurement area. Events are facts in the product's own
 * language, one per PRD metric. They carry ids, counts and times only: never resume text, profile facts,
 * personal details or job content, so no destination (own store or vendor) ever receives a person's data. The destination is a store on the owner's machine (ADR 0016).
 */
type At = { readonly personId: string; readonly at: string };
export type ProductEvent =
  /** North star start ("minutes from creating a profile", ADR 0014) and every per-profile denominator. */
  | (At & { readonly name: "profile-created" })
  /** North star end: a results screen was served with at least one Apply verdict. The metric uses the first per profile. */
  | (At & { readonly name: "apply-verdict-shown"; readonly applyCount: number })
  /** Applied rate. */
  | (At & { readonly name: "job-marked-applied"; readonly postingId: string })
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
