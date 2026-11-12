/**
 * Output schemas and fixed system prompts for the resume analyst (ADR 0009 decision 4: structured output and fixed
 * prompts). Every prompt receives the resume as numbered lines and cites line numbers, never copied text, so the
 * four calls can run at the same time and evidence is always the resume's own words (P1-T13). Changing a prompt
 * changes what the analyst says: bump ANALYST_PROMPT_VERSION so evaluation reports show it.
 */
export const ANALYST_PROMPT_VERSION = "analyst-5";

const SENIORITY = ["intern", "entry", "mid", "senior", "lead-or-staff", "manager", "director", "vp", "executive"];
const str = { type: "string" } as const;
const strs = { type: "array", items: str } as const;
const int = { type: "integer" } as const;
const month = { type: "string", pattern: "^\\d{4}-(0[1-9]|1[0-2])$" } as const;
const ratio = { type: "number", minimum: 0, maximum: 1 } as const;
const obj = (properties: Record<string, object>) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});
const range = obj({ from: int, to: int });
const ranges = { type: "array", items: range } as const;

const NUMBERED =
  'The resume is given as numbered lines ("12| text"). Take facts only from it; never invent, infer or embellish. Never copy text: cite line numbers.';

export const ROLES_SCHEMA = obj({
  name: { type: ["string", "null"] },
  roles: {
    type: "array",
    items: obj({ employer: str, title: str, start: month, end: { anyOf: [month, { type: "null" }] }, lines: ranges }),
  },
  summaryLines: ranges,
  credentials: {
    type: "array",
    items: obj({ kind: { enum: ["degree", "certification"] }, name: str, issuer: str, year: { type: ["string", "null"] } }),
  },
  languages: strs,
  inferredSeniority: { anyOf: [{ enum: SENIORITY }, { type: "null" }] },
});
export const ROLES_PROMPT = [
  NUMBERED,
  "roles: every job held, most recent first. employer and title exactly as written. start and end are YYYY-MM; when only a year is given use YYYY-01 for a start and YYYY-12 for an end; end is null for a current role. lines: the line range of each achievement or responsibility of that role (a bullet wrapped over several lines is one range from its first to its last line). A section repeated later in the resume is the same role, not a new one.",
  "summaryLines: line ranges of summary or profile claims.",
  "credentials: degrees and certifications as written; year null when not given.",
  "languages: spoken languages the resume states, as ISO 639-1 codes; the resume's own language when none are stated.",
  "inferredSeniority: the level of the most recent role on this ladder: intern, entry, mid, senior, lead-or-staff, manager, director, vp, executive. null when there is no work history.",
  "name: the person's name if written, else null. Contact details, date of birth, age, gender, nationality, marital status and photos are never cited.",
].join("\n");

export const SKILLS_SCHEMA = obj({ skills: { type: "array", items: obj({ name: str, line: int }) } });
export const SKILLS_PROMPT = [
  NUMBERED,
  "skills: every skill the resume names, once each, as written, with the number of the first line that names it. A skill is an ability a job posting could ask for: a tool, technology, programming language, method or professional discipline.",
  "Not skills: names of products, features, projects or systems the person built or worked on; industries or business areas an employer serves; metrics and results; job titles; generic nouns (testing, networking) unless listed as skills.",
].join("\n");

export const CANDIDATES_SCHEMA = obj({
  candidates: {
    type: "array",
    items: obj({
      statement: str,
      line: int,
      quantified: { type: "boolean" },
      withinLastThreeYears: { type: "boolean" },
      uncommonForRole: { type: "boolean" },
    }),
  },
});
export function candidatesPrompt(todayMonth: string): string {
  return [
    NUMBERED,
    "Find the strongest selling points, the way a career coach would. Propose 6 to 10 candidates. Each is one short statement about the resume's work (never about the person's character) with the number of a line that proves it; each candidate cites a different line.",
    `Answer three tests per candidate, strictly from the cited line: quantified (it states a number, size or measurable result); withinLastThreeYears (the line belongs to a role that ended within three years of ${todayMonth}, or is current); uncommonForRole (most people in that role could not claim it).`,
  ].join("\n");
}

export const STRENGTH_SCHEMA = obj({
  impactEvidence: ratio,
  skillsDepth: ratio,
  clarityAndStructure: ratio,
  careerTrajectory: ratio,
  atsReadability: ratio,
  topFixes: { type: "array", items: str, minItems: 3, maxItems: 3 },
});
export const STRENGTH_PROMPT = [
  "You rate a resume with a fixed rubric. Each ratio is 0 to 1. Line numbers are only for reference.",
  "impactEvidence: share of achievement lines that show a measurable result.",
  "skillsDepth: how well the skills are backed by lines that use them, not just listed.",
  "clarityAndStructure: clear sections, consistent dates, concise lines.",
  "careerTrajectory: how clearly the roles show growth in scope or level.",
  "atsReadability: plain text a parser can read: standard headings, no tables or columns, dates beside each role.",
  "topFixes: the three edits to this resume that would raise the score most, most valuable first, each one sentence about the resume (never about the person).",
].join("\n");
