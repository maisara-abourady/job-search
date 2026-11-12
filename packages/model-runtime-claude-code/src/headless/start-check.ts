import { type ClaudeCodeRuntimeConfig, MINIMUM_CLAUDE_CODE_VERSION } from "./config.ts";
import { ChildProcessLauncher, childEnvironment, type ProcessLauncher } from "./process.ts";

/**
 * Main's start check (ADR 0009 decisions 3 and 7): the CLI is installed and new enough, signed in with the
 * subscription (checked with `claude auth status --json`, which makes no model call), and the owner has confirmed
 * that model training is off. Returns every failed item with its fix; empty means ready.
 */
export async function checkClaudeCodeReady(
  config: Pick<ClaudeCodeRuntimeConfig, "command" | "modelTrainingOffConfirmed">,
  launcher: ProcessLauncher = new ChildProcessLauncher(),
): Promise<readonly string[]> {
  const problems: string[] = [];
  if (config.modelTrainingOffConfirmed === null) {
    problems.push(
      'MATCHMAKER_MODEL_TRAINING_OFF_CONFIRMED is not set. Turn off "Help improve Claude" (claude.ai: Settings, Privacy), then set it to the date you did (YYYY-MM-DD).',
    );
  }
  const run = (args: string[]) =>
    launcher.run(config.command, args, { cwd: process.cwd(), env: childEnvironment(process.env), stdin: "", timeoutMs: 20_000 });

  const version = await run(["--version"]);
  const found = /(\d+)\.(\d+)\.(\d+)/.exec(version.stdout);
  if (version.exitCode !== 0 || found === null) {
    problems.push(`Claude Code was not found as "${config.command}". Install it, or set MATCHMAKER_CLAUDE_COMMAND to its path.`);
    return problems;
  }
  if (compareVersions(found.slice(1).map(Number), MINIMUM_CLAUDE_CODE_VERSION.split(".").map(Number)) < 0) {
    problems.push(`Claude Code ${found[0]} is older than ${MINIMUM_CLAUDE_CODE_VERSION}. Run \`claude update\`.`);
  }
  const auth = await run(["auth", "status", "--json"]);
  let status: { loggedIn?: boolean; authMethod?: string; apiProvider?: string } = {};
  try {
    status = JSON.parse(auth.stdout) as typeof status;
  } catch {
    // reported below as not signed in
  }
  if (status.loggedIn !== true) {
    problems.push("Claude Code is not signed in. Run `claude`, sign in with your Claude subscription, then start the app again.");
  } else if (status.apiProvider !== undefined && status.apiProvider !== "firstParty") {
    problems.push(`Claude Code is set to use ${status.apiProvider}, not your Claude subscription. Unset CLAUDE_CODE_USE_* and sign in.`);
  } else if (status.authMethod !== undefined && /api.?key/i.test(status.authMethod)) {
    problems.push("Claude Code is signed in with an API key, not your Claude subscription. Run `claude auth login` with the subscription.");
  }
  return problems;
}

function compareVersions(a: readonly number[], b: readonly number[]): number {
  for (let i = 0; i < 3; i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) - (b[i] ?? 0);
  return 0;
}
