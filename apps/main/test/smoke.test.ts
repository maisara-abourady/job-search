import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

// D-10: the walking skeleton. One request crosses Main, delivery, use cases, rules and adapters.
const devMain = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "main.dev.ts");

test("the smoke command prints the running cost and an empty three-tab results screen", () => {
  const r = spawnSync(process.execPath, [devMain, "smoke"], { encoding: "utf8", timeout: 20_000 });
  assert.equal(r.status, 0, r.stderr);
  const { runningCost, results } = JSON.parse(r.stdout) as {
    runningCost: { rows: { name: string; amount: string }[]; budgetLine: string; budgetReached: boolean };
    results: { tabs: { label: string; countLabel: string }[]; emptyApplyHeading: string | null };
  };
  assert.deepEqual(runningCost.rows, [{ name: "Smoke", amount: "$0.00" }]);
  assert.equal(runningCost.budgetLine, "No monthly budget set");
  assert.equal(runningCost.budgetReached, false);
  assert.deepEqual(
    results.tabs.map((t) => [t.label, t.countLabel]),
    [
      ["Apply", "0"],
      ["Within reach", "0"],
      ["Not a fit", "0"],
    ],
  );
  assert.ok(results.emptyApplyHeading);
});

test("an unknown command exits 2", () => {
  const r = spawnSync(process.execPath, [devMain, "nonsense"], { encoding: "utf8", timeout: 20_000 });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /unknown command: nonsense/);
});

/** The environment of a start, without any of the owner's settings, plus `extra`. */
function startEnvironment(extra: Record<string, string>): NodeJS.ProcessEnv {
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("MATCHMAKER_")));
  return { ...env, MATCHMAKER_CONFIG: join(dirname(devMain), "no-such-config.json"), ...extra };
}

test("starting without the owner's configuration lists the missing settings and exits 1", () => {
  const r = spawnSync(process.execPath, [devMain], { encoding: "utf8", timeout: 20_000, env: startEnvironment({}) });
  assert.equal(r.status, 1, r.stderr);
  assert.match(r.stderr, /MATCHMAKER_MODEL_TRAINING_OFF_CONFIRMED/);
});

test("starting with the configuration but no Claude Code says so and exits 1", () => {
  const env = startEnvironment({ MATCHMAKER_MODEL_TRAINING_OFF_CONFIRMED: "2026-11-12", MATCHMAKER_CLAUDE_COMMAND: "/nonexistent/claude" });
  const r = spawnSync(process.execPath, [devMain], { encoding: "utf8", timeout: 20_000, env });
  assert.equal(r.status, 1, r.stderr);
  assert.match(r.stderr, /Claude Code was not found/);
});
