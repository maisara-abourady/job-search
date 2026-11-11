/** PRD: ATS Keyword Coverage. Must-have keywords weigh 2, others 1; exact phrase full credit, synonym half. */
export type KeywordPresence = "exact" | "synonym" | "absent";
export type KeywordCheck = { readonly keyword: string; readonly mustHave: boolean; readonly presence: KeywordPresence };

const CREDIT: Readonly<Record<KeywordPresence, number>> = { exact: 1, synonym: 0.5, absent: 0 };
export const COVERAGE_TARGET = 0.85;

export function keywordCoverage(checks: readonly KeywordCheck[]): number {
  const weight = (c: KeywordCheck) => (c.mustHave ? 2 : 1);
  const total = checks.reduce((s, c) => s + weight(c), 0);
  if (total === 0) return 1;
  return checks.reduce((s, c) => s + weight(c) * CREDIT[c.presence], 0) / total;
}

/** Exact-phrase presence is decidable here; synonym presence needs a judge and is supplied from outside. */
export function hasExactPhrase(resumeText: string, keyword: string): boolean {
  return resumeText.toLowerCase().includes(keyword.toLowerCase());
}
