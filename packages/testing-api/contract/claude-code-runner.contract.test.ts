/**
 * The Claude Code runner and start check (ADR 0009 decisions 3, 5 and 7), driven by a fake process launcher: the
 * privacy flags of every call, spend once per envelope, failures, the concurrency bound, and the start check.
 */
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { describe, test } from "node:test";
import {
  CLAUDE_CODE_DEFAULTS,
  checkClaudeCodeReady,
  HeadlessRunner,
  type ClaudeCodeRuntimeConfig,
  type ProcessLauncher,
  type ProcessResult,
} from "@matchmaker/model-runtime-claude-code";

const config: ClaudeCodeRuntimeConfig = { ...CLAUDE_CODE_DEFAULTS, modelTrainingOffConfirmed: "2026-11-12" };
const aCall = {
  port: "resumeAnalyst",
  systemPrompt: "Fictional system prompt",
  schema: { type: "object" },
  prompt: "Fictional resume text",
} as const;
const envelope = (o: object) => ({
  exitCode: 0,
  stdout: JSON.stringify({ type: "result", is_error: false, ...o }),
  stderr: "",
  timedOut: false,
});

type Seen = { command: string; args: readonly string[]; cwd: string; env: NodeJS.ProcessEnv; stdin: string };
function launcher(answer: (seen: Seen) => ProcessResult | Promise<ProcessResult>): ProcessLauncher & { seen: Seen[] } {
  const seen: Seen[] = [];
  return {
    seen,
    run: async (command, args, o) => {
      const s = { command, args, cwd: o.cwd, env: o.env, stdin: o.stdin };
      seen.push(s);
      return answer(s);
    },
  };
}
function runnerWith(l: ProcessLauncher, c: ClaudeCodeRuntimeConfig = config) {
  const spends: number[] = [];
  return { runner: new HeadlessRunner(c, { record: async (s) => void spends.push(s.amountMicros) }, l), spends };
}

describe("HeadlessRunner", () => {
  test("every call runs with no tools, MCP, session, user settings or slash commands, the tier's alias, and the prompt on stdin", async () => {
    const l = launcher(() => envelope({ total_cost_usd: 0.01, structured_output: { ok: true } }));
    const { runner } = runnerWith(l);
    assert.deepEqual(await runner.call(aCall), { ok: true });
    const [seen] = l.seen;
    assert.ok(seen);
    const args = seen.args.join(" ");
    for (const flag of [
      "-p",
      "--output-format json",
      "--tools ",
      "--strict-mcp-config",
      "--no-session-persistence",
      "--setting-sources=",
      "--disable-slash-commands",
    ])
      assert.ok(args.includes(flag), flag);
    assert.equal(seen.args[seen.args.indexOf("--model") + 1], "sonnet");
    assert.ok(!seen.args.includes("Fictional resume text"), "the prompt is never an argument");
    assert.equal(seen.stdin, "Fictional resume text");
    assert.deepEqual(readdirSync(seen.cwd), [], "an empty working directory");
  });

  test("a port's configured effort is passed; a port without one uses the CLI's default", async () => {
    const l = launcher(() => envelope({ structured_output: {} }));
    const { runner } = runnerWith(l, { ...config, portEffort: { resumeAnalyst: "low" } });
    await runner.call(aCall);
    await runner.call({ ...aCall, port: "matchJudge" });
    assert.equal(l.seen[0]?.args[l.seen[0].args.indexOf("--effort") + 1], "low");
    assert.ok(!l.seen[1]?.args.includes("--effort"));
  });

  test("the child environment carries no API key or provider switch", async () => {
    const l = launcher(() => envelope({ structured_output: {} }));
    process.env["ANTHROPIC_API_KEY"] = "fictional-key";
    process.env["CLAUDE_CODE_USE_BEDROCK"] = "1";
    try {
      await runnerWith(l).runner.call(aCall);
    } finally {
      delete process.env["ANTHROPIC_API_KEY"];
      delete process.env["CLAUDE_CODE_USE_BEDROCK"];
    }
    const env = l.seen[0]?.env ?? {};
    assert.equal(env["ANTHROPIC_API_KEY"], undefined);
    assert.equal(env["CLAUDE_CODE_USE_BEDROCK"], undefined);
    assert.ok(env["PATH"] !== undefined, "the rest of the environment is kept");
  });

  test("spend is recorded once per envelope, before the output is checked, so failed calls count", async () => {
    const ok = runnerWith(launcher(() => envelope({ total_cost_usd: 0.0301664, structured_output: {} })));
    await ok.runner.call(aCall);
    assert.deepEqual(ok.spends, [30_166]);

    const failed = runnerWith(launcher(() => envelope({ is_error: true, total_cost_usd: 0.002, result: "schema not met" })));
    await assert.rejects(failed.runner.call(aCall), /resumeAnalyst failed: schema not met/);
    assert.deepEqual(failed.spends, [2_000]);
  });

  test("no envelope records nothing; a signed-out CLI says how to sign in", async () => {
    const r = runnerWith(launcher(() => ({ exitCode: 1, stdout: "", stderr: "Not logged in · Please run /login", timedOut: false })));
    await assert.rejects(r.runner.call(aCall), /not signed in with the subscription/);
    assert.deepEqual(r.spends, []);
  });

  test("a call past the timeout fails", async () => {
    const r = runnerWith(launcher(() => ({ exitCode: null, stdout: "", stderr: "", timedOut: true })));
    await assert.rejects(r.runner.call(aCall), /no answer within 60 s/);
  });

  test("no more than maxConcurrentCalls processes run at once", async () => {
    let running = 0;
    let most = 0;
    const l = launcher(async () => {
      most = Math.max(most, ++running);
      await new Promise((resolve) => setTimeout(resolve, 5));
      running--;
      return envelope({ structured_output: {} });
    });
    const { runner } = runnerWith(l, { ...config, maxConcurrentCalls: 2 });
    await Promise.all(Array.from({ length: 7 }, () => runner.call(aCall)));
    assert.equal(most, 2);
    assert.equal(l.seen.length, 7);
  });
});

describe("checkClaudeCodeReady", () => {
  const cli = (version: string, status: object) =>
    launcher((s) =>
      s.args[0] === "--version"
        ? { exitCode: 0, stdout: `${version} (Claude Code)\n`, stderr: "", timedOut: false }
        : { exitCode: 0, stdout: JSON.stringify(status), stderr: "", timedOut: false },
    );
  const signedIn = { loggedIn: true, authMethod: "oauth_token", apiProvider: "firstParty" };

  test("ready: installed, new enough, signed in with the subscription, training off confirmed", async () => {
    const l = cli("2.1.322", signedIn);
    assert.deepEqual(await checkClaudeCodeReady(config, l), []);
    assert.deepEqual(l.seen[1]?.args, ["auth", "status", "--json"], "the sign-in check makes no model call");
  });
  test("each failed item is listed with its fix", async () => {
    const problems = await checkClaudeCodeReady({ ...config, modelTrainingOffConfirmed: null }, cli("2.0.1", { loggedIn: false }));
    assert.equal(problems.length, 3);
    assert.match(problems.join("\n"), /MATCHMAKER_MODEL_TRAINING_OFF_CONFIRMED/);
    assert.match(problems.join("\n"), /older than 2\.1\.322/);
    assert.match(problems.join("\n"), /not signed in/);
  });
  test("an API key or a cloud provider is not the subscription", async () => {
    assert.match((await checkClaudeCodeReady(config, cli("2.1.322", { ...signedIn, authMethod: "api_key" }))).join(), /API key/);
    assert.match((await checkClaudeCodeReady(config, cli("2.1.322", { ...signedIn, apiProvider: "bedrock" }))).join(), /bedrock/);
  });
  test("a missing CLI is named", async () => {
    const missing = launcher(() => ({ exitCode: null, stdout: "", stderr: "spawn claude ENOENT", timedOut: false }));
    assert.match((await checkClaudeCodeReady(config, missing)).join(), /was not found/);
  });
});
