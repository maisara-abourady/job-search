import type { JobPosting, SourceLink } from "./job-posting.ts";

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** First-stage duplicate identity (PRD pipeline step 4): employer, title and location. */
export function postingIdentityKey(p: Pick<JobPosting, "employer" | "title" | "location">): string {
  return [p.employer, p.title, p.location].map(normalize).join("|");
}

/** DS-4: merged records keep every source link. */
export function mergeSourceLinks(a: readonly SourceLink[], b: readonly SourceLink[]): SourceLink[] {
  const byUrl = new Map<string, SourceLink>();
  for (const link of [...a, ...b]) byUrl.set(link.url, link);
  return [...byUrl.values()];
}
