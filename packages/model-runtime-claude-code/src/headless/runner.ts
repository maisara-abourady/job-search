import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SpendMeter } from "@matchmaker/use-cases";
import type { ClaudeCodeRuntimeConfig, ModelPort } from "./config.ts";
import { ChildProcessLauncher, childEnvironment, type ProcessLauncher } from "./process.ts";

/** One structured call: the port asking, its fixed system prompt, its output schema, and the text on stdin. */
export type HeadlessCall = {
  readonly port: ModelPort;
  readonly systemPrompt: string;
  readonly schema: object;
  readonly prompt: string;
};

/** Thrown for any failed call. Spend, when the CLI reported any, is already recorded. */
export class ClaudeCodeCallFailed extends Error {
  constructor(port: ModelPort, reason: string) {
    super(`Claude Code call for ${port} failed: ${reason}`);
  }
}

const SIGNED_OUT = /not logged in|please run \/login|invalid api key|authentication|unauthorized|oauth/i;
export const SIGN_IN_FIX = "Claude Code is not signed in with the subscription: run `claude` once and sign in, then start the app again.";

/**
 * The humble runner around `claude -p` (ADR 0009 decisions 3 and 5). Every call: structured output against the
 * port's schema, the tier's model alias, the port's system prompt, no tools, no MCP servers, no saved session, no
 * user or project settings (so no user CLAUDE.md, hooks or plugins), an empty working directory, the prompt on
 * stdin, and a child environment without API keys or provider switches. Spend is recorded once per envelope,
 * before the output is checked.
 */
export class HeadlessRunner {
  private readonly config: ClaudeCodeRuntimeConfig;
  private readonly meter: SpendMeter;
  private readonly launcher: ProcessLauncher;
  private readonly cwd: string;
  private running = 0;
  private readonly waiting: (() => void)[] = [];

  constructor(config: ClaudeCodeRuntimeConfig, meter: SpendMeter, launcher: ProcessLauncher = new ChildProcessLauncher()) {
    this.config = config;
    this.meter = meter;
    this.launcher = launcher;
    this.cwd = mkdtempSync(join(tmpdir(), "matchmaker-model-"));
  }

  /** Returns the call's `structured_output`, unchecked: the port adapter validates it before anything crosses inward. */
  async call(c: HeadlessCall): Promise<unknown> {
    await this.slot();
    try {
      return await this.run(c);
    } finally {
      this.release();
    }
  }

  /** The arguments of one call (exported for the contract test that pins the privacy flags). */
  argumentsFor(c: HeadlessCall): string[] {
    const effort = this.config.portEffort?.[c.port];
    return [
      ...(effort === undefined ? [] : ["--effort", effort]),
      "-p",
      "--output-format",
      "json",
      "--json-schema",
      JSON.stringify(c.schema),
      "--model",
      this.config.tierAliases[this.config.portTiers[c.port]],
      "--system-prompt",
      c.systemPrompt,
      "--tools",
      "",
      "--strict-mcp-config",
      "--no-session-persistence",
      "--setting-sources=",
      "--disable-slash-commands",
    ];
  }

  private async run(c: HeadlessCall): Promise<unknown> {
    const result = await this.launcher.run(this.config.command, this.argumentsFor(c), {
      cwd: this.cwd,
      env: childEnvironment(process.env),
      stdin: c.prompt,
      timeoutMs: this.config.callTimeoutMs,
    });
    if (result.timedOut) throw new ClaudeCodeCallFailed(c.port, `no answer within ${this.config.callTimeoutMs / 1000} s`);
    let envelope: Envelope;
    try {
      envelope = JSON.parse(result.stdout) as Envelope;
    } catch {
      const said = `${result.stderr} ${result.stdout}`.trim().slice(0, 300);
      throw new ClaudeCodeCallFailed(c.port, SIGNED_OUT.test(said) ? SIGN_IN_FIX : `exit ${result.exitCode}: ${said}`);
    }
    if (typeof envelope.total_cost_usd === "number") {
      await this.meter.record({
        category: "model",
        provider: "claude-code",
        amountMicros: Math.round(envelope.total_cost_usd * 1_000_000),
      });
    }
    if (envelope.is_error === true || envelope.structured_output === undefined || envelope.structured_output === null) {
      const said = String(envelope.result ?? envelope.subtype ?? "no structured output");
      throw new ClaudeCodeCallFailed(c.port, SIGNED_OUT.test(said) ? SIGN_IN_FIX : said.slice(0, 300));
    }
    return envelope.structured_output;
  }

  private async slot(): Promise<void> {
    if (this.running < this.config.maxConcurrentCalls) {
      this.running++;
      return;
    }
    await new Promise<void>((resolve) => this.waiting.push(resolve));
  }
  private release(): void {
    const next = this.waiting.shift();
    if (next === undefined) this.running--;
    else next();
  }
}

/** The part of Claude Code's JSON result envelope the runner reads. Nothing of it crosses the package surface. */
type Envelope = {
  readonly is_error?: boolean;
  readonly subtype?: string;
  readonly result?: string;
  readonly total_cost_usd?: number;
  readonly structured_output?: unknown;
};
