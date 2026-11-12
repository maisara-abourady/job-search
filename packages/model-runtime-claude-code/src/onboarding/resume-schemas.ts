/**
 * Output schemas and fixed system prompts for the resume analyst (ADR 0009 decision 4: structured output and fixed
 * prompts). Changing a prompt changes what the analyst says: bump ANALYST_PROMPT_VERSION so evaluation reports show it.
 */
export const ANALYST_PROMPT_VERSION = "analyst-2";

const SENIORITY = ["intern", "entry", "mid", "senior", "lead-or-staff", "manager", "director", "vp", "executive"];
const str = { type: "string" } as const;
const strs = { type: "array", items: str } as const;
const month = { type: "string", pattern: "^\\d{4}-(0[1-9]|1[0-2])$" } as const;
const ratio = { type: "number", minimum: 0, maximum: 1 } as const;
const obj = (properties: Record<string, object>) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});

export const STRUCTURE_SCHEMA = obj({
  name: { type: ["string", "null"] },
  evidence: { type: "array", items: obj({ id: str, text: str }) },
  roles: {
    type: "array",
    items: obj({ employer: str, title: str, start: month, end: { anyOf: [month, { type: "null" }] }, achievementEvidenceIds: strs }),
  },
  skills: { type: "array", items: obj({ name: str, evidenceIds: strs }) },
  credentials: {
    type: "array",
    items: obj({ kind: { enum: ["degree", "certification"] }, name: str, issuer: str, year: { type: ["string", "null"] } }),
  },
  languages: strs,
  inferredSeniority: { anyOf: [{ enum: SENIORITY }, { type: "null" }] },
});

export const STRUCTURE_PROMPT = [
  "You turn resume text into structured facts. Copy facts only from the resume; never invent, infer or embellish.",
  "evidence: every achievement or responsibility line, every summary claim, and every line that lists skills becomes one item, its text copied exactly as written. Ids are e1, e2, ... in reading order.",
  "roles: every job held, most recent first. employer and title exactly as written. start and end are YYYY-MM; when only a year is given use YYYY-01 for a start and YYYY-12 for an end; end is null for a current role. achievementEvidenceIds are the evidence ids of that role's lines.",
  "skills: every tool, technology, method or domain skill the resume names, once each, with the evidence ids where it appears (a usage line, or the skills line that lists it). A skill with no line naming it is not a skill.",
  "credentials: degrees and certifications as written; year null when not given.",
  "languages: spoken languages the resume states, as ISO 639-1 codes; the resume's own language when none are stated.",
  "inferredSeniority: the level of the most recent role on this ladder: intern, entry, mid, senior, lead-or-staff, manager, director, vp, executive. null when there is no work history.",
  "name: the person's name if written, else null. Contact details, date of birth, age, gender, nationality, marital status and photos are never copied into evidence, roles or skills.",
].join("\n");

export const CANDIDATES_SCHEMA = obj({
  candidates: {
    type: "array",
    items: obj({
      statement: str,
      evidenceId: str,
      quantified: { type: "boolean" },
      withinLastThreeYears: { type: "boolean" },
      uncommonForRole: { type: "boolean" },
    }),
  },
});

export const CANDIDATES_PROMPT = [
  "You find the strongest selling points in a structured resume, the way a career coach would.",
  "Propose 6 to 10 candidates. Each is one short statement about the resume's work (never about the person's character), citing exactly one evidence id that proves it. Each candidate cites a different evidence id.",
  "Answer three tests per candidate, strictly from the cited evidence: quantified (it states a number, size or measurable result); withinLastThreeYears (the cited line belongs to a role that ended within three years of today, or is current); uncommonForRole (most people in that role could not claim it).",
  "Cite only evidence ids that exist in the input.",
].join("\n");

export const STRENGTH_SCHEMA = obj({
  impactEvidence: ratio,
  skillsDepth: ratio,
  clarityAndStructure: ratio,
  careerTrajectory: ratio,
  atsReadability: ratio,
  topFixes: { type: "array", items: str, minItems: 3, maxItems: 3 },
});

export const STRENGTH_PROMPT = [
  "You rate a resume with a fixed rubric. Each ratio is 0 to 1.",
  "impactEvidence: share of achievement lines that show a measurable result.",
  "skillsDepth: how well the skills are backed by lines that use them, not just listed.",
  "clarityAndStructure: clear sections, consistent dates, concise lines.",
  "careerTrajectory: how clearly the roles show growth in scope or level.",
  "atsReadability: plain text a parser can read: standard headings, no tables or columns, dates beside each role.",
  "topFixes: the three edits to this resume that would raise the score most, most valuable first, each one sentence about the resume (never about the person).",
].join("\n");
