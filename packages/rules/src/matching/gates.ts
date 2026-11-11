import type { JobPosting } from "../jobs/job-posting.ts";
import type { Preferences } from "../profile/profile.ts";

export type GateOutcome = "pass" | "fail" | "unknown";
/** decidingText is the posting text that decided the gate (Not a fit report, part 2). */
export type GateResult = { readonly outcome: GateOutcome; readonly decidingText: string | null };
export type GateResults = { readonly authorization: GateResult; readonly seniority: GateResult };

/** PRD: Hard gates, Work authorization. Authorization is used only as the user stated it. */
export function authorizationGate(job: JobPosting, prefs: Preferences): GateResult {
  const text = job.authorization.postingText;
  if (job.country !== null && prefs.authorizedCountries.includes(job.country)) return { outcome: "pass", decidingText: text ?? job.location };
  if (job.authorization.kind === "sponsorship-offered" && prefs.acceptsSponsorship) return { outcome: "pass", decidingText: text };
  if (job.authorization.kind === "silent") return { outcome: "unknown", decidingText: null };
  return { outcome: "fail", decidingText: text };
}

/** PRD: Hard gates, Seniority. */
export function seniorityGate(job: JobPosting, prefs: Preferences): GateResult {
  if (job.seniority === null) return { outcome: "unknown", decidingText: null };
  const inBand = prefs.targetSeniority.includes(job.seniority);
  return { outcome: inBand ? "pass" : "fail", decidingText: job.seniorityText };
}

export function evaluateGates(job: JobPosting, prefs: Preferences): GateResults {
  return { authorization: authorizationGate(job, prefs), seniority: seniorityGate(job, prefs) };
}

export function anyGateFails(g: GateResults): boolean {
  return g.authorization.outcome === "fail" || g.seniority.outcome === "fail";
}
