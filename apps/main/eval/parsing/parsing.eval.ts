import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { LibraryDocumentReader } from "@matchmaker/documents";
import {
  ANALYST_PROMPT_VERSION,
  checkClaudeCodeReady,
  ClaudeCodeResumeAnalyst,
  HeadlessRunner,
} from "@matchmaker/model-runtime-claude-code";
import type { Matchmaker } from "../../src/compose-matchmaker.ts";
import { loadModelRuntimeConfig } from "../../src/config.ts";
import type { CaseResult, Evaluation } from "../evaluation.ts";
import { inMemoryDetails } from "../in-memory-details.ts";
import { compareResume, type ExpectedResume, H4_THRESHOLDS } from "./compare.ts";

/**
 * The Phase 1 exit test (P1-T11, X-5): every resume in fixtures/private/resumes (gitignored, consented, H-3) goes
 * through IntakeResume with the real reader and the real analyst; the saved profile is compared with its
 * hand-written <id>.expected.json. Calls the owner's Claude Code, so it refuses to start without the training-off
 * confirmation (ADR 0009 decision 7). `--only=<id>` runs one resume.
 */
const here = dirname(fileURLToPath(import.meta.url));
const RESUMES = join(here, "..", "fixtures", "private", "resumes");
const ROOT = join(here, "..", "..", "..", "..");
/** NFR: the selling-points card within 20 seconds of upload. Reported, not part of the verdict (H-4 covers parsing). */
const CARD_SECONDS = 20;

const evaluation: Evaluation = {
  name: "parsing",
  description: `Real reader and analyst on the private resume set; roles exact, skills recall and precision at least ${H4_THRESHOLDS.skillRecall} (H-4). Analyst prompts ${ANALYST_PROMPT_VERSION}.`,
  configure(options) {
    const config = loadModelRuntimeConfig({ env: process.env, root: ROOT });
    const { details, store, meter } = inMemoryDetails({
      reader: new LibraryDocumentReader(),
      // Intake requests the onboarding search, which fails until the search planner arrives (Phase 2); not measured here.
      onBackgroundError: () => {},
    });
    // The analyst reports its spend to the same meter intake charges through (ADR 0010).
    const analyst = new ClaudeCodeResumeAnalyst(new HeadlessRunner(config, meter));
    return {
      details: { ...details, analyst },
      async run(matchmaker: Matchmaker): Promise<readonly CaseResult[]> {
        const problems = await checkClaudeCodeReady(config);
        if (problems.length > 0) throw new Error(`Claude Code is not ready:\n${problems.join("\n")}`);
        console.error(`Model training off: confirmed by the owner on ${config.modelTrainingOffConfirmed}.`);
        const files = resumeFiles().filter((f) => options["only"] === undefined || idOf(f) === options["only"]);
        if (files.length === 0) throw new Error(`no resumes in ${RESUMES} (see apps/main/eval/parsing/README.md)`);
        const results: CaseResult[] = [];
        for (const file of files) results.push(await parseOne(matchmaker, store, file));
        return results;
      },
    };
  },
  threshold(results) {
    const seconds = results
      .map((r) => r.metrics?.["secondsToCard"] ?? Number.NaN)
      .filter(Number.isFinite)
      .sort((a, b) => a - b);
    const median =
      seconds.length === 0
        ? Number.NaN
        : (seconds[Math.floor((seconds.length - 1) / 2)]! + seconds[Math.ceil((seconds.length - 1) / 2)]!) / 2;
    const max = seconds.at(-1) ?? Number.NaN;
    const passed = results.filter((r) => r.passed).length;
    return {
      passed: results.length > 0 && passed === results.length,
      summary: `${passed}/${results.length} resumes meet the H-4 thresholds. Seconds to card: median ${median.toFixed(1)}, max ${max.toFixed(1)} (target under ${CARD_SECONDS}).`,
    };
  },
};
export default evaluation;

function resumeFiles(): string[] {
  if (!existsSync(RESUMES)) return [];
  return readdirSync(RESUMES)
    .filter((f) => f.toLowerCase().endsWith(".pdf"))
    .sort()
    .map((f) => join(RESUMES, f));
}
function idOf(file: string): string {
  return basename(file).replace(/\.pdf$/i, "");
}

async function parseOne(matchmaker: Matchmaker, store: ReturnType<typeof inMemoryDetails>["store"], file: string): Promise<CaseResult> {
  const id = idOf(file);
  const expectedPath = join(RESUMES, `${id}.expected.json`);
  if (!existsSync(expectedPath)) return { id, passed: false, detail: `no ${id}.expected.json` };
  const expected = JSON.parse(readFileSync(expectedPath, "utf8")) as ExpectedResume;
  const { personId } = await matchmaker.useCases.createPerson.execute({ displayName: id });
  const upload = { kind: "pdf", fileName: basename(file), bytes: new Uint8Array(readFileSync(file)), text: null } as const;

  const started = performance.now();
  let outcome: string;
  try {
    outcome = (await matchmaker.useCases.intakeResume.execute({ personId, upload })).outcome;
  } catch (e) {
    return { id, passed: false, detail: `intake failed: ${String(e).slice(0, 300)}` };
  }
  const secondsToCard = Math.round((performance.now() - started) / 100) / 10;
  const profile = store.versionsOf(personId).at(-1);
  if (outcome !== "parsed" || profile === undefined) return { id, passed: false, detail: `outcome ${outcome}`, metrics: { secondsToCard } };

  const c = compareResume(
    expected,
    profile.roles,
    profile.skills.map((s) => s.name),
  );
  const parts = [
    c.rolesExact ? `roles exact (${profile.roles.length})` : `roles: ${c.roleMismatches.join("; ")}`,
    `skills recall ${c.skillRecall.toFixed(2)}${c.missedSkills.length > 0 ? ` (missed: ${c.missedSkills.join(", ")})` : ""}`,
    `precision ${c.skillPrecision.toFixed(2)}${c.unexpectedSkills.length > 0 ? ` (unexpected: ${c.unexpectedSkills.join(", ")})` : ""}`,
    `${secondsToCard} s to card`,
  ];
  return {
    id,
    passed: c.passed,
    detail: parts.join(" | "),
    metrics: { secondsToCard, skillRecall: c.skillRecall, skillPrecision: c.skillPrecision, roleMismatches: c.roleMismatches.length },
  };
}
