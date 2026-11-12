import { SENIORITY_LADDER, type Evidence, type SellingPointCandidate, type SeniorityLevel } from "@matchmaker/rules";
import type { ResumeAnalyst, StructuredResume } from "@matchmaker/use-cases";
import type { HeadlessRunner } from "../headless/runner.ts";
import {
  CANDIDATES_PROMPT,
  CANDIDATES_SCHEMA,
  STRENGTH_PROMPT,
  STRENGTH_SCHEMA,
  STRUCTURE_PROMPT,
  STRUCTURE_SCHEMA,
} from "./resume-schemas.ts";

/**
 * ResumeAnalyst on Claude Code headless (ADR 0009, large tier). Each method is one structured call. The model's
 * output is checked and mapped here before it crosses inward: evidence gets stable ids (ev-1, ev-2, ... in
 * reading order), every cited id must exist (uncited claims are dropped, never kept), months are YYYY-MM, ratios
 * are clamped to 0..1, and personal details other than the name are never taken.
 */
export class ClaudeCodeResumeAnalyst implements ResumeAnalyst {
  private readonly runner: HeadlessRunner;
  private readonly today: () => Date;
  /** The text each structured resume came from, so the strength rubric can judge layout and wording. */
  private readonly sourceText = new WeakMap<StructuredResume, string>();

  constructor(runner: HeadlessRunner, today: () => Date = () => new Date()) {
    this.runner = runner;
    this.today = today;
  }

  async structure(text: string): Promise<StructuredResume> {
    const out = (await this.runner.call({
      port: "resumeAnalyst",
      systemPrompt: STRUCTURE_PROMPT,
      schema: STRUCTURE_SCHEMA,
      prompt: text,
    })) as RawResume;
    const resume = toStructuredResume(out);
    this.sourceText.set(resume, text);
    return resume;
  }

  async sellingPointCandidates(resume: StructuredResume): Promise<readonly SellingPointCandidate[]> {
    const input = {
      today: this.today().toISOString().slice(0, 7),
      roles: resume.roles,
      evidence: resume.evidence.map((e) => ({ id: e.id, text: e.text })),
    };
    const out = (await this.runner.call({
      port: "resumeAnalyst",
      systemPrompt: CANDIDATES_PROMPT,
      schema: CANDIDATES_SCHEMA,
      prompt: JSON.stringify(input),
    })) as { candidates: SellingPointCandidate[] };
    const known = new Set(resume.evidence.map((e) => e.id));
    return out.candidates
      .filter((c) => known.has(c.evidenceId) && c.statement.trim() !== "")
      .map((c) => ({
        statement: c.statement.trim(),
        evidenceId: c.evidenceId,
        quantified: c.quantified === true,
        withinLastThreeYears: c.withinLastThreeYears === true,
        uncommonForRole: c.uncommonForRole === true,
      }));
  }

  async strengthRatios(resume: StructuredResume): ReturnType<ResumeAnalyst["strengthRatios"]> {
    const { personal: _personal, ...facts } = resume;
    const prompt = this.sourceText.get(resume) ?? JSON.stringify(facts);
    const out = (await this.runner.call({
      port: "resumeAnalyst",
      systemPrompt: STRENGTH_PROMPT,
      schema: STRENGTH_SCHEMA,
      prompt,
    })) as RawStrength;
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
}

type RawResume = {
  name: string | null;
  evidence: { id: string; text: string }[];
  roles: { employer: string; title: string; start: string; end: string | null; achievementEvidenceIds: string[] }[];
  skills: { name: string; evidenceIds: string[] }[];
  credentials: { kind: "degree" | "certification"; name: string; issuer: string; year: string | null }[];
  languages: string[];
  inferredSeniority: string | null;
};
type RawStrength = Record<"impactEvidence" | "skillsDepth" | "clarityAndStructure" | "careerTrajectory" | "atsReadability", number> & {
  topFixes: string[];
};

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

function toStructuredResume(out: RawResume): StructuredResume {
  // Stable ids in reading order; the model's own ids only link its references.
  const idOf = new Map<string, string>();
  const evidence: Evidence[] = [];
  for (const e of out.evidence) {
    const text = e.text.trim();
    if (text === "" || idOf.has(e.id)) continue;
    const id = `ev-${evidence.length + 1}`;
    idOf.set(e.id, id);
    evidence.push({ id, source: "resume-line", text });
  }
  const cited = (ids: readonly string[]) => [...new Set(ids.flatMap((i) => idOf.get(i) ?? []))];
  const roles = out.roles.flatMap((r) => {
    if (!MONTH.test(r.start) || (r.end !== null && !MONTH.test(r.end))) throw new Error(`role "${r.title}" has a date that is not YYYY-MM`);
    return [
      {
        employer: r.employer.trim(),
        title: r.title.trim(),
        start: r.start,
        end: r.end,
        achievementEvidenceIds: cited(r.achievementEvidenceIds),
      },
    ];
  });
  const skills = out.skills.flatMap((s) => {
    const evidenceIds = cited(s.evidenceIds);
    return evidenceIds.length === 0 || s.name.trim() === "" ? [] : [{ name: s.name.trim(), evidenceIds }];
  });
  const level = SENIORITY_LADDER.includes(out.inferredSeniority as SeniorityLevel) ? (out.inferredSeniority as SeniorityLevel) : null;
  return {
    roles,
    skills,
    credentials: out.credentials.map((c) => ({ kind: c.kind, name: c.name.trim(), issuer: c.issuer.trim(), year: c.year })),
    languages: [...new Set(out.languages.map((l) => l.trim().toLowerCase()).filter((l) => /^[a-z]{2,3}$/.test(l)))],
    evidence,
    inferredSeniority: level,
    personal: { name: out.name?.trim() || null, photoRef: null, age: null, gender: null, nationality: null, maritalStatus: null },
  };
}

function clamp(n: number): number {
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
}
