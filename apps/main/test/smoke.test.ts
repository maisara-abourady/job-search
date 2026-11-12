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
  assert.deepEqual(results.tabs.map((t) => [t.label, t.countLabel]), [["Apply", "0"], ["Within reach", "0"], ["Not a fit", "0"]]);
  assert.ok(results.emptyApplyHeading);
});

test("an unknown command exits 2", () => {
  const r = spawnSync(process.execPath, [devMain, "nonsense"], { encoding: "utf8", timeout: 20_000 });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /unknown command: nonsense/);
});
