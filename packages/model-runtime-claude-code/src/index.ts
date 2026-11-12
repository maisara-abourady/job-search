/**
 * @matchmaker/model-runtime-claude-code: the model-backed ports on Claude Code headless with the owner's
 * subscription (ADR 0009). No npm dependency: it drives the `claude` binary. Main gathers the configuration,
 * runs the start check, and hands the runner and the SpendMeter to each port adapter.
 */
export {
  CLAUDE_CODE_DEFAULTS,
  MINIMUM_CLAUDE_CODE_VERSION,
  type ClaudeCodeRuntimeConfig,
  type ModelPort,
  type ModelTier,
} from "./headless/config.ts";
export { ChildProcessLauncher, type ProcessLauncher, type ProcessResult } from "./headless/process.ts";
export { ClaudeCodeCallFailed, HeadlessRunner, type HeadlessCall } from "./headless/runner.ts";
export { checkClaudeCodeReady } from "./headless/start-check.ts";
export { ClaudeCodeResumeAnalyst } from "./onboarding/resume-analyst.ts";
export { ANALYST_PROMPT_VERSION } from "./onboarding/resume-schemas.ts";
