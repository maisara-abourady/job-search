// Regression tests for the architecture check (ADR 0001 §5): each case copies the clean fixture workspace,
// injects exactly one violation and asserts that check.mjs fails, naming the offending file.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const checker = join(here, "..", "check.mjs");
const fixture = join(here, "fixtures", "clean");
const repoRoot = join(here, "..", "..", "..");
const scratch = mkdtempSync(join(tmpdir(), "arch-check-"));
after(() => rmSync(scratch, { recursive: true, force: true }));

let n = 0;
/** A fresh copy of the clean fixture with `files` written over it (path relative to the workspace root). */
function workspace(files = {}) {
  const dir = join(scratch, `ws-${n++}`);
  cpSync(fixture, dir, { recursive: true });
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), typeof content === "function" ? content(readFileSync(join(dir, path), "utf8")) : content);
  }
  return dir;
}

function check(root) {
  const r = spawnSync(process.execPath, [checker, "--root", root], { encoding: "utf8" });
  return { status: r.status, out: r.stdout + r.stderr };
}

function assertViolation(files, file, message) {
  const { status, out } = check(workspace(files));
  assert.equal(status, 1, `expected exit 1, got ${status}:\n${out}`);
  if (file) assert.match(out, new RegExp(`architecture violation: ${file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`), out);
  assert.match(out, message, out);
}

test("the clean fixture passes", () => {
  const { status, out } = check(workspace());
  assert.equal(status, 0, out);
  assert.match(out, /architecture ok: 4 components/);
});

test("an outward arrow fails: use-cases importing adapters", () =>
  assertViolation(
    {
      "packages/use-cases/src/alpha/outward.ts":
        'import { MemoryStore } from "@matchmaker/adapters";\nexport const s = new MemoryStore();\n',
    },
    "packages/use-cases/src/alpha/outward.ts",
    /@matchmaker\/use-cases may not depend on @matchmaker\/adapters \(Dependency Rule\)/,
  ));

test("node:fs in rules fails", () =>
  assertViolation(
    { "packages/rules/src/disk.ts": 'import { readFileSync } from "node:fs";\nexport const read = readFileSync;\n' },
    "packages/rules/src/disk.ts",
    /may not use the platform \(node:fs\)/,
  ));

test("a library import in rules fails", () =>
  assertViolation(
    { "packages/rules/src/lib.ts": 'import { z } from "zod";\nexport const schema = z.string();\n' },
    "packages/rules/src/lib.ts",
    /may not import a library or framework \(zod\)/,
  ));

test("a cross-area import in use-cases fails", () =>
  assertViolation(
    { "packages/use-cases/src/alpha/cross.ts": 'import { beta } from "../beta/beta.ts";\nexport const b = beta();\n' },
    "packages/use-cases/src/alpha/cross.ts",
    /area "alpha" may not import area "beta"/,
  ));

test("@matchmaker/use-cases/wiring imported outside Main fails", () =>
  assertViolation(
    {
      "packages/adapters/src/storage/wired.ts":
        'import { wiredScore } from "@matchmaker/use-cases/wiring";\nexport const w = wiredScore;\n',
    },
    "packages/adapters/src/storage/wired.ts",
    /@matchmaker\/use-cases\/wiring is not published to @matchmaker\/adapters/,
  ));

test("a relative import leaving its package fails", () =>
  assertViolation(
    {
      "packages/adapters/src/storage/escape.ts":
        'import { score } from "../../../use-cases/src/alpha/score.ts";\nexport const s = score;\n',
    },
    "packages/adapters/src/storage/escape.ts",
    /relative import leaves the component/,
  ));

test("a manifest declaring a forbidden dependency fails", () =>
  assertViolation(
    {
      "packages/rules/package.json": (json) => {
        const m = JSON.parse(json);
        m.dependencies = { "@matchmaker/use-cases": "workspace:*" };
        return JSON.stringify(m);
      },
    },
    "packages/rules/package.json",
    /declares @matchmaker\/use-cases, which @matchmaker\/rules may not depend on/,
  ));

test("a package cycle fails", () =>
  assertViolation(
    { "packages/rules/src/back.ts": 'import type { Clock } from "@matchmaker/use-cases";\nexport type C = Clock;\n' },
    "packages/rules/src/back.ts",
    /component cycle: .*@matchmaker\/rules -> @matchmaker\/use-cases -> @matchmaker\/rules|component cycle: .*@matchmaker\/use-cases -> @matchmaker\/rules -> @matchmaker\/use-cases/,
  ));

test("an adapter subfolder importing another fails", () =>
  assertViolation(
    {
      "packages/adapters/src/storage/timed.ts":
        'import { SystemClock } from "../clock/system-clock.ts";\nexport const c = new SystemClock();\n',
    },
    "packages/adapters/src/storage/timed.ts",
    /area "storage" may not import area "clock"/,
  ));

test("a violation inside a contract/ directory fails", () =>
  assertViolation(
    {
      "packages/use-cases/contract/store.contract.test.ts":
        'import { MemoryStore } from "@matchmaker/adapters";\nexport const s = new MemoryStore();\n',
    },
    "packages/use-cases/contract/store.contract.test.ts",
    /@matchmaker\/use-cases may not depend on @matchmaker\/adapters/,
  ));

test("a violation inside an eval/ directory fails", () =>
  assertViolation(
    {
      "apps/main/eval/reach-in.ts":
        'import { MemoryStore } from "../../../packages/adapters/src/storage/memory-store.ts";\nexport const s = new MemoryStore();\n',
    },
    "apps/main/eval/reach-in.ts",
    /relative import leaves the component/,
  ));

test("the real repository still passes", () => {
  const r = spawnSync(process.execPath, [checker], { encoding: "utf8", cwd: repoRoot });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /architecture ok/);
});
