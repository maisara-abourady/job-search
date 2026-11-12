import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { composeMatchmaker } from "../src/compose-matchmaker.ts";
import type { CaseResult, EvalOptions, Evaluation, ThresholdResult } from "./evaluation.ts";

/**
 * `node apps/main/eval/run-eval.ts <name> [--key=value ...]`: composes the app from the evaluation's details, runs
 * its cases, writes results.json and report.md to apps/main/eval/results/<name>-<timestamp>/ (or $EVAL_RESULTS_DIR),
 * prints a summary and exits 0 (threshold met), 1 (threshold failed) or 2 (unknown evaluation or bad arguments).
 */
const evalDir = dirname(fileURLToPath(import.meta.url));

function knownEvaluations(): string[] {
  return readdirSync(evalDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && readdirSync(join(evalDir, d.name)).includes(`${d.name}.eval.ts`))
    .map((d) => d.name)
    .sort();
}

function parseOptions(args: readonly string[]): EvalOptions | string {
  const options: Record<string, string> = {};
  for (const a of args) {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
    if (!m?.[1]) return `unexpected argument: ${a}`;
    options[m[1]] = m[2] ?? "true";
  }
  return options;
}

function report(e: Evaluation, results: readonly CaseResult[], verdict: ThresholdResult, startedAt: string): string {
  const failed = results.filter((r) => !r.passed);
  return [
    `# Evaluation: ${e.name}`,
    "",
    e.description,
    "",
    `- Started: ${startedAt}`,
    `- Result: ${verdict.passed ? "PASSED" : "FAILED"}`,
    `- ${verdict.summary}`,
    "",
    ...(failed.length > 0 ? ["## Failed cases", "", ...failed.map((r) => `- **${r.id}**: ${r.detail}`), ""] : []),
    "## All cases",
    "",
    "| Case | Passed | Detail |",
    "|------|--------|--------|",
    ...results.map((r) => `| ${r.id} | ${r.passed ? "yes" : "no"} | ${r.detail} |`),
    "",
  ].join("\n");
}

async function main(argv: readonly string[]): Promise<number> {
  const [name, ...rest] = argv;
  const known = knownEvaluations();
  if (name === undefined || !known.includes(name)) {
    console.error(`${name === undefined ? "no evaluation named" : `unknown evaluation: ${name}`}. Known: ${known.join(", ")}`);
    return 2;
  }
  const options = parseOptions(rest);
  if (typeof options === "string") {
    console.error(options);
    return 2;
  }
  const evaluation = ((await import(pathToFileURL(join(evalDir, name, `${name}.eval.ts`)).href)) as { default: Evaluation }).default;
  const startedAt = new Date().toISOString();
  let configured: ReturnType<Evaluation["configure"]>;
  try {
    configured = evaluation.configure(options);
  } catch (e) {
    // A configuration the owner must complete (for example the training-off confirmation): say what, not where.
    console.error(e instanceof Error ? e.message : String(e));
    return 2;
  }
  const app = composeMatchmaker(configured.details);
  const results = await configured.run(app);
  await app.work.drain();
  const verdict = evaluation.threshold(results);

  const outDir = join(process.env["EVAL_RESULTS_DIR"] ?? join(evalDir, "results"), `${name}-${startedAt.replace(/[:.]/g, "-")}`);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "results.json"), JSON.stringify({ name, startedAt, options, threshold: verdict, results }, null, 2));
  writeFileSync(join(outDir, "report.md"), report(evaluation, results, verdict, startedAt));

  console.log(`${name}: ${verdict.passed ? "PASSED" : "FAILED"} - ${verdict.summary}`);
  for (const r of results.filter((x) => !x.passed)) console.log(`  failed ${r.id}: ${r.detail}`);
  console.log(`report: ${relative(process.cwd(), join(outDir, "report.md"))}`);
  return verdict.passed ? 0 : 1;
}

process.exitCode = await main(process.argv.slice(2));
