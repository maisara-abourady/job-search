import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

// X-5: the evaluation harness, exercised with the keyless sample evaluation.
const runner = join(dirname(fileURLToPath(import.meta.url)), "..", "eval", "run-eval.ts");
const resultsDir = mkdtempSync(join(tmpdir(), "eval-results-"));
after(() => rmSync(resultsDir, { recursive: true, force: true }));

const runEval = (...args: string[]) =>
  spawnSync(process.execPath, [runner, ...args], { encoding: "utf8", timeout: 30_000, env: { ...process.env, EVAL_RESULTS_DIR: resultsDir } });
const latestReport = (): { dir: string; md: string; json: { results: { id: string; passed: boolean }[] } } => {
  const dir = join(resultsDir, readdirSync(resultsDir).sort().at(-1) ?? "");
  return { dir, md: readFileSync(join(dir, "report.md"), "utf8"), json: JSON.parse(readFileSync(join(dir, "results.json"), "utf8")) };
};

test("the sample evaluation passes and writes report.md and results.json", () => {
  const r = runEval("sample");
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /sample: PASSED - 3\/3/);
  const { md, json } = latestReport();
  assert.match(md, /Result: PASSED/);
  assert.equal(json.results.length, 3);
});

test("a failing threshold exits 1 and the report names the failed case", () => {
  const r = runEval("sample", "--break=uncited-requirement");
  assert.equal(r.status, 1, r.stderr);
  const { md, json } = latestReport();
  assert.match(md, /Result: FAILED/);
  assert.match(md, /## Failed cases\n\n- \*\*uncited-requirement\*\*/);
  assert.deepEqual(json.results.filter((c) => !c.passed).map((c) => c.id), ["uncited-requirement"]);
});

test("an unknown evaluation exits 2 and lists the known ones", () => {
  const r = runEval("no-such-eval");
  assert.equal(r.status, 2);
  assert.match(r.stderr, /unknown evaluation: no-such-eval\. Known: .*sample/);
});
