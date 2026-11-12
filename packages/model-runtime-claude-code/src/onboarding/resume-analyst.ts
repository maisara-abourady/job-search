import { SENIORITY_LADDER, type Evidence, type SellingPointCandidate, type SeniorityLevel } from "@matchmaker/rules";
import type { ResumeAnalyst, StructuredResume } from "@matchmaker/use-cases";
import type { HeadlessRunner } from "../headless/runner.ts";
import {
  CANDIDATES_SCHEMA,
  candidatesPrompt,
  ROLES_PROMPT,
  ROLES_SCHEMA,
  SKILLS_PROMPT,
  SKILLS_SCHEMA,
  STRENGTH_PROMPT,
  STRENGTH_SCHEMA,
} from "./resume-schemas.ts";

type StrengthAnswer = Awaited<ReturnType<ResumeAnalyst["strengthRatios"]>>;
type Range = { readonly from: number; readonly to: number };
/** What `structure` started for one resume: where each evidence item sits, and the calls already under way. */
type Analysis = {
  readonly evidenceRanges: ReadonlyMap<string, Range>;
  readonly candidates: Promise<readonly SellingPointCandidate[]>;
  readonly strength: Promise<StrengthAnswer>;
};

/**
 * ResumeAnalyst on Claude Code headless (ADR 0009, large tier). For the 20 s card (P1-T13), `structure` starts all
 * four calls at once on the resume's numbered lines: roles, skills, selling-point candidates and strength. Every
 * call cites line numbers, never copied text, so the adapter takes evidence text from the resume itself (always
 * verbatim) and `sellingPointCandidates` and `strengthRatios` return answers already under way.
 *
 * Checked and mapped here before anything crosses inward: evidence gets stable ids (ev-1, ev-2, ... in reading
 * order); each skill is backed by the line that names it; every cited line must exist (uncited claims are dropped,
 * never kept); months are YYYY-MM; ratios are clamped to 0..1; only the name is kept of personal details.
 */
export class ClaudeCodeResumeAnalyst implements ResumeAnalyst {
  private readonly runner: HeadlessRunner;
  private readonly today: () => Date;
  private readonly analyses = new WeakMap<StructuredResume, Analysis>();

  constructor(runner: HeadlessRunner, today: () => Date = () => new Date()) {
    this.runner = runner;
    this.today = today;
  }

  async structure(text: string): Promise<StructuredResume> {
    const lines = text.split("\n");
    const prompt = numbered(lines);
    const candidates = this.ask<RawCandidates>(candidatesPrompt(this.todayMonth()), CANDIDATES_SCHEMA, prompt);
    const strength = this.ask<RawStrength>(STRENGTH_PROMPT, STRENGTH_SCHEMA, prompt);
    // Neither may become an unhandled rejection if structuring fails first; the methods that read them rethrow.
    candidates.catch(() => {});
    strength.catch(() => {});
    const [roles, skills] = await Promise.all([
      this.ask<RawRoles>(ROLES_PROMPT, ROLES_SCHEMA, prompt),
      this.ask<RawSkills>(SKILLS_PROMPT, SKILLS_SCHEMA, prompt),
    ]);
    const { resume, evidenceRanges } = toStructuredResume(roles, skills, lines);
    this.analyses.set(resume, {
      evidenceRanges,
      candidates: candidates.then((out) => toCandidates(out, evidenceRanges)),
      strength: strength.then(toStrength),
    });
    return resume;
  }

  async sellingPointCandidates(resume: StructuredResume): Promise<readonly SellingPointCandidate[]> {
    const started = this.analyses.get(resume);
    if (started !== undefined) return started.candidates;
    // A resume this adapter did not structure: its evidence items become the numbered lines.
    const ranges = new Map(resume.evidence.map((e, i) => [e.id, { from: i + 1, to: i + 1 }]));
    const out = await this.ask<RawCandidates>(
      candidatesPrompt(this.todayMonth()),
      CANDIDATES_SCHEMA,
      numbered(resume.evidence.map((e) => e.text)),
    );
    return toCandidates(out, ranges);
  }

  async strengthRatios(resume: StructuredResume): Promise<StrengthAnswer> {
    const started = this.analyses.get(resume);
    if (started !== undefined) return started.strength;
    return toStrength(await this.ask<RawStrength>(STRENGTH_PROMPT, STRENGTH_SCHEMA, numbered(resume.evidence.map((e) => e.text))));
  }

  private ask<T>(systemPrompt: string, schema: object, prompt: string): Promise<T> {
    return this.runner.call({ port: "resumeAnalyst", systemPrompt, schema, prompt }) as Promise<T>;
  }
  private todayMonth(): string {
    return this.today().toISOString().slice(0, 7);
  }
}

type RawRoles = {
  name: string | null;
  roles: { employer: string; title: string; start: string; end: string | null; lines: Range[] }[];
  summaryLines: Range[];
  credentials: { kind: "degree" | "certification"; name: string; issuer: string; year: string | null }[];
  languages: string[];
  inferredSeniority: string | null;
};
type RawSkills = { skills: { name: string; line: number }[] };
type RawCandidates = {
  candidates: { statement: string; line: number; quantified: boolean; withinLastThreeYears: boolean; uncommonForRole: boolean }[];
};
type RawStrength = Record<"impactEvidence" | "skillsDepth" | "clarityAndStructure" | "careerTrajectory" | "atsReadability", number> & {
  topFixes: string[];
};

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

function numbered(lines: readonly string[]): string {
  return lines.map((line, i) => `${i + 1}| ${line}`).join("\n");
}

function toStructuredResume(
  out: RawRoles,
  skillsOut: RawSkills,
  lines: readonly string[],
): { resume: StructuredResume; evidenceRanges: Map<string, Range> } {
  const valid = (r: Range) => Number.isInteger(r.from) && Number.isInteger(r.to) && r.from >= 1 && r.to >= r.from && r.from <= lines.length;
  // Every cited range, plus the line each skill is named on when no range covers it; then ids in reading order.
  const cited: Range[] = [...out.roles.flatMap((r) => r.lines), ...out.summaryLines].filter(valid);
  const covering = (line: number) => cited.find((r) => r.from <= line && line <= r.to);
  // A header line naming the person never becomes evidence (personal details stay in `personal`).
  const name = out.name?.trim().toLowerCase() ?? "";
  const namesPerson = (line: number) => name !== "" && (lines[line - 1] ?? "").toLowerCase().includes(name);
  for (const s of skillsOut.skills) {
    const ok = Number.isInteger(s.line) && s.line >= 1 && s.line <= lines.length;
    if (ok && covering(s.line) === undefined && !namesPerson(s.line)) cited.push({ from: s.line, to: s.line });
  }
  const unique = [...new Map(cited.map((r) => [`${r.from}-${r.to}`, r])).values()].sort((a, b) => a.from - b.from || a.to - b.to);
  const evidence: Evidence[] = [];
  const evidenceRanges = new Map<string, Range>();
  const idByRange = new Map<string, string>();
  for (const r of unique) {
    const text = textOfLines(lines, r.from, r.to);
    if (text === "") continue;
    const id = `ev-${evidence.length + 1}`;
    evidence.push({ id, source: "resume-line", text });
    evidenceRanges.set(id, r);
    idByRange.set(`${r.from}-${r.to}`, id);
  }
  const idOfRange = (r: Range) => idByRange.get(`${r.from}-${r.to}`) ?? [];
  const idCovering = (line: number) => [...evidenceRanges].find(([, r]) => r.from <= line && line <= r.to)?.[0];

  const roles = out.roles.map((r) => {
    if (!MONTH.test(r.start) || (r.end !== null && !MONTH.test(r.end))) throw new Error(`role "${r.title}" has a date that is not YYYY-MM`);
    return {
      employer: r.employer.trim(),
      title: r.title.trim(),
      start: r.start,
      end: r.end,
      achievementEvidenceIds: [...new Set(r.lines.filter(valid).flatMap(idOfRange))],
    };
  });
  const skills = [
    ...new Map(
      skillsOut.skills.flatMap((s) => {
        const id = idCovering(s.line);
        const name = s.name.trim();
        return id === undefined || name === "" ? [] : [[name.toLowerCase(), { name, evidenceIds: [id] }] as const];
      }),
    ).values(),
  ];
  const level = SENIORITY_LADDER.includes(out.inferredSeniority as SeniorityLevel) ? (out.inferredSeniority as SeniorityLevel) : null;
  return {
    resume: {
      roles,
      skills,
      credentials: out.credentials.map((c) => ({ kind: c.kind, name: c.name.trim(), issuer: c.issuer.trim(), year: c.year })),
      languages: [...new Set(out.languages.map((l) => l.trim().toLowerCase()).filter((l) => /^[a-z]{2,3}$/.test(l)))],
      evidence,
      inferredSeniority: level,
      personal: { name: out.name?.trim() || null, photoRef: null, age: null, gender: null, nationality: null, maritalStatus: null },
    },
    evidenceRanges,
  };
}

/** Each candidate is tied to the evidence item holding the line it cites; a candidate whose line is not evidence is dropped. */
function toCandidates(out: RawCandidates, ranges: ReadonlyMap<string, Range>): SellingPointCandidate[] {
  return out.candidates.flatMap((c) => {
    const evidenceId = [...ranges].find(([, r]) => r.from <= c.line && c.line <= r.to)?.[0];
    const statement = c.statement.trim();
    if (evidenceId === undefined || statement === "") return [];
    return [
      {
        statement,
        evidenceId,
        quantified: c.quantified === true,
        withinLastThreeYears: c.withinLastThreeYears === true,
        uncommonForRole: c.uncommonForRole === true,
      },
    ];
  });
}

function toStrength(out: RawStrength): StrengthAnswer {
  return {
    ratios: {
      impactEvidence: clamp(out.impactEvidence),
      skillsDepth: clamp(out.skillsDepth),
      clarityAndStructure: clamp(out.clarityAndStructure),
      careerTrajectory: clamp(out.careerTrajectory),
      atsReadability: clamp(out.atsReadability),
    },
    topFixes: out.topFixes
      .map((f) => f.trim())
      .filter((f) => f !== "")
      .slice(0, 3),
  };
}

/** Lines from..to (1-based), joined into one sentence, without bullet glyphs. */
function textOfLines(lines: readonly string[], from: number, to: number): string {
  return lines
    .slice(from - 1, Math.min(to, lines.length))
    .map((l) => l.trim().replace(/^[•●▪◦‣∙·*–-]\s*/u, ""))
    .filter((l) => l !== "")
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function clamp(n: number): number {
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
}
