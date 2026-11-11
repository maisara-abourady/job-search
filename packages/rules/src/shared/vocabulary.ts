/** One seniority ladder for profiles and postings (PRD: Hard gates). Ordered low to high. */
export const SENIORITY_LADDER = [
  "intern", "entry", "mid", "senior", "lead-or-staff", "manager", "director", "vp", "executive",
] as const;
export type SeniorityLevel = (typeof SENIORITY_LADDER)[number];
/** One or more adjacent levels (PF-3). */
export type SeniorityBand = readonly SeniorityLevel[];

export type WorkMode = "on-site" | "hybrid" | "remote";

export type Money = { readonly amount: number; readonly currency: string };

/** Clamp to [0, 1]. Every judged sub-score in the rules is a ratio in that range. */
export function ratio(value: number): number {
  return Math.min(1, Math.max(0, value));
}
