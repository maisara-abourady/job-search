import { spawn } from "node:child_process";

/** One finished CLI process. */
export type ProcessResult = {
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly timedOut: boolean;
};

/**
 * Starts the CLI. The humble edge around `node:child_process`; contract tests replace it with recorded output,
 * so neither `pnpm verify` nor CI needs Claude Code or a sign-in.
 */
export interface ProcessLauncher {
  run(
    command: string,
    args: readonly string[],
    options: { cwd: string; env: NodeJS.ProcessEnv; stdin: string; timeoutMs: number },
  ): Promise<ProcessResult>;
}

export class ChildProcessLauncher implements ProcessLauncher {
  run(
    command: string,
    args: readonly string[],
    o: { cwd: string; env: NodeJS.ProcessEnv; stdin: string; timeoutMs: number },
  ): Promise<ProcessResult> {
    return new Promise((resolve) => {
      const child = spawn(command, args, { cwd: o.cwd, env: o.env, stdio: ["pipe", "pipe", "pipe"] });
      let stdout = "";
      let stderr = "";
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGKILL");
      }, o.timeoutMs);
      child.stdout.setEncoding("utf8").on("data", (d: string) => {
        stdout += d;
      });
      child.stderr.setEncoding("utf8").on("data", (d: string) => {
        stderr += d;
      });
      child.on("error", (e) => {
        clearTimeout(timer);
        resolve({ exitCode: null, stdout, stderr: stderr + String(e), timedOut });
      });
      child.on("close", (exitCode) => {
        clearTimeout(timer);
        resolve({ exitCode, stdout, stderr, timedOut });
      });
      child.stdin.on("error", () => {}); // the CLI may exit before reading stdin; "close" reports it
      child.stdin.end(o.stdin);
    });
  }
}

/**
 * The child's environment: the parent's, minus every variable that could move a call off the owner's subscription
 * (an API key, a cloud-provider switch) or change the CLI's behavior (ADR 0009 decision 3).
 */
export function childEnvironment(parent: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return Object.fromEntries(Object.entries(parent).filter(([k]) => !/^ANTHROPIC_/.test(k) && !/^CLAUDE_CODE_USE_/.test(k)));
}
