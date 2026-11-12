import type { RoleHeld } from "@matchmaker/rules";

/**
 * Comparing a parsed profile with a hand-written expected file (P1-T11). Pure functions, so the rules of the
 * comparison are easy to read and to review. See README.md for the expected-file schema.
 */
export type ExpectedRole = {
  /** Accepted spellings of the employer; the first is the one written on the resume. */
  readonly employers: readonly string[];
  /** Accepted titles (a resume that lists a promotion path in one heading may be parsed as any of them). */
  readonly titles: readonly string[];
  /** "YYYY-MM", or "YYYY" when the resume gives only the year (any month of that year matches). */
  readonly start: string;
  /** As start; null for a current role. */
  readonly end: string | null;
  /** A role the parser may include or leave out (an extracurricular post, for example). */
  readonly optional?: boolean;
};
export type ExpectedResume = {
  readonly id: string;
  readonly roles: readonly ExpectedRole[];
  readonly skills: {
    /** Skills the resume clearly names; recall is measured on these. Alternatives are separated by "|". */
    readonly required: readonly string[];
    /** Further names a careful reader could reasonably extract; they count as correct but are not required. */
    readonly optional: readonly string[];
  };
};
export type ParsingThresholds = { readonly skillRecall: number; readonly skillPrecision: number };
/** H-4 default, accepted by the owner: every role exact; skills precision and recall at least 0.9 per resume. */
export const H4_THRESHOLDS: ParsingThresholds = { skillRecall: 0.9, skillPrecision: 0.9 };

export type Comparison = {
  readonly rolesExact: boolean;
  readonly roleMismatches: readonly string[];
  readonly skillRecall: number;
  readonly skillPrecision: number;
  readonly missedSkills: readonly string[];
  readonly unexpectedSkills: readonly string[];
  readonly passed: boolean;
};

export function compareResume(
  expected: ExpectedResume,
  roles: readonly RoleHeld[],
  skills: readonly string[],
  t = H4_THRESHOLDS,
): Comparison {
  const roleMismatches = compareRoles(expected.roles, roles);
  const required = expected.skills.required.map(alternatives);
  const accepted = [...required, ...expected.skills.optional.map(alternatives)];
  const missedSkills = required.filter((alts) => !skills.some((s) => alts.some((a) => sameSkill(a, s)))).map((alts) => alts[0] ?? "");
  const unexpectedSkills = skills.filter((s) => !accepted.some((alts) => alts.some((a) => sameSkill(a, s))));
  const skillRecall = required.length === 0 ? 1 : (required.length - missedSkills.length) / required.length;
  const skillPrecision = skills.length === 0 ? (required.length === 0 ? 1 : 0) : (skills.length - unexpectedSkills.length) / skills.length;
  const rolesExact = roleMismatches.length === 0;
  return {
    rolesExact,
    roleMismatches,
    skillRecall,
    skillPrecision,
    missedSkills,
    unexpectedSkills,
    passed: rolesExact && skillRecall >= t.skillRecall && skillPrecision >= t.skillPrecision,
  };
}

/** Every expected role found exactly once (employer, title, start, end); no parsed role left over. */
export function compareRoles(expected: readonly ExpectedRole[], parsed: readonly RoleHeld[]): string[] {
  const left = [...parsed];
  const mismatches: string[] = [];
  for (const e of expected) {
    const i = left.findIndex((p) => roleMatches(e, p));
    if (i >= 0) {
      left.splice(i, 1);
      continue;
    }
    if (e.optional === true) continue;
    const near = left.find((p) => e.employers.some((x) => sameEmployer(x, p.employer)));
    mismatches.push(
      near === undefined
        ? `missing role: ${describe(e)}`
        : `role differs: expected ${describe(e)}, parsed ${near.title} at ${near.employer} ${near.start} to ${near.end ?? "present"}`,
    );
  }
  for (const p of left) mismatches.push(`unexpected role: ${p.title} at ${p.employer} ${p.start} to ${p.end ?? "present"}`);
  return mismatches;
}

function roleMatches(e: ExpectedRole, p: RoleHeld): boolean {
  return (
    e.employers.some((x) => sameEmployer(x, p.employer)) &&
    e.titles.some((t) => normalize(t) === normalize(p.title)) &&
    sameMonth(e.start, p.start) &&
    (e.end === null ? p.end === null : p.end !== null && sameMonth(e.end, p.end))
  );
}

function describe(e: ExpectedRole): string {
  return `${e.titles[0]} at ${e.employers[0]} ${e.start} to ${e.end ?? "present"}`;
}

/** Case, whitespace, punctuation and "&"/"and" do not matter. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[→>]/g, " ")
    .replace(/[^\p{L}\p{N}+#]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Months as YYYY-MM; an expected bare year matches any month of it. */
export function sameMonth(expected: string, parsed: string): boolean {
  const m = /^(\d{4})(?:-(\d{1,2}))?$/.exec(expected.trim());
  const p = /^(\d{4})-(\d{1,2})$/.exec(parsed.trim());
  if (m === null || p === null) return false;
  if (m[2] === undefined) return m[1] === p[1];
  return m[1] === p[1] && Number(m[2]) === Number(p[2]);
}

const LEGAL_SUFFIXES = /\b(company|co|inc|llc|ltd|gmbh|organization|organisation|corp|corporation)\b/g;
function sameEmployer(expected: string, parsed: string): boolean {
  const a = normalize(expected).replace(LEGAL_SUFFIXES, "").trim().replace(/\s+/g, " ");
  const b = normalize(parsed).replace(LEGAL_SUFFIXES, "").trim().replace(/\s+/g, " ");
  return a === b;
}

function alternatives(entry: string): string[] {
  return entry
    .split("|")
    .map((a) => a.trim())
    .filter((a) => a !== "");
}

/**
 * Skill names match when their compact forms are equal ("Node.js" and "NodeJS"), ignoring a plural "s". A parsed
 * "Name (Abbreviation)" matches either part ("Retail Media Networks (RMN)" matches "RMN").
 */
export function sameSkill(expected: string, parsed: string): boolean {
  const compact = (s: string) => normalize(s).replace(/ /g, "").replace(/s$/, "");
  const forms = [parsed, ...(/^(.+?)\s*\(([^()]+)\)\s*$/.exec(parsed)?.slice(1) ?? [])];
  return forms.some((f) => compact(expected) === compact(f));
}
