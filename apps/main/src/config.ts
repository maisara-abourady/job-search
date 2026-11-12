import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CLAUDE_CODE_DEFAULTS, type ClaudeCodeRuntimeConfig } from "@matchmaker/model-runtime-claude-code";

/**
 * The owner's local configuration (ADR 0016 §5, X-2): environment variables, or the gitignored file
 * `matchmaker.local.json` at the repository root (or the path in MATCHMAKER_CONFIG). The environment wins. There is
 * no secrets store and no key: the model "credential" is the signed-in Claude Code CLI (ADR 0009 decision 3).
 * Each configuration declares the settings it needs; a missing required one stops the start with every name listed.
 */
export const LOCAL_CONFIG_FILE = "matchmaker.local.json";

type Setting = { readonly name: string; readonly required: boolean; readonly help: string };

export const MODEL_RUNTIME_SETTINGS = {
  trainingOff: {
    name: "MATCHMAKER_MODEL_TRAINING_OFF_CONFIRMED",
    required: true,
    help: 'the date (YYYY-MM-DD) you turned off "Help improve Claude" in claude.ai Settings, Privacy (Privacy 4)',
  },
  command: {
    name: "MATCHMAKER_CLAUDE_COMMAND",
    required: false,
    help: `the Claude Code executable (default ${CLAUDE_CODE_DEFAULTS.command})`,
  },
  large: {
    name: "MATCHMAKER_MODEL_LARGE",
    required: false,
    help: `model alias for the large tier (default ${CLAUDE_CODE_DEFAULTS.tierAliases.large})`,
  },
  small: {
    name: "MATCHMAKER_MODEL_SMALL",
    required: false,
    help: `model alias for the small tier (default ${CLAUDE_CODE_DEFAULTS.tierAliases.small})`,
  },
  concurrency: {
    name: "MATCHMAKER_MAX_CONCURRENT_CALLS",
    required: false,
    help: `parallel model calls (default ${CLAUDE_CODE_DEFAULTS.maxConcurrentCalls})`,
  },
  timeout: {
    name: "MATCHMAKER_CALL_TIMEOUT_SECONDS",
    required: false,
    help: `seconds per model call (default ${CLAUDE_CODE_DEFAULTS.callTimeoutMs / 1000})`,
  },
} as const satisfies Record<string, Setting>;

export class ConfigurationMissing extends Error {
  readonly missing: readonly Setting[];
  constructor(missing: readonly Setting[]) {
    super(
      [
        `Missing configuration (set it in the environment or in ${LOCAL_CONFIG_FILE}):`,
        ...missing.map((s) => `  ${s.name}: ${s.help}`),
      ].join("\n"),
    );
    this.missing = missing;
  }
}

export type ConfigSource = { readonly env: NodeJS.ProcessEnv; readonly root: string };

/** Settings from the environment over the local file. */
export function readSettings(source: ConfigSource): (name: string) => string | undefined {
  const path = source.env["MATCHMAKER_CONFIG"] ?? join(source.root, LOCAL_CONFIG_FILE);
  const file = existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>) : {};
  return (name) => {
    const value = source.env[name] ?? file[name];
    return value === undefined || value === null || String(value).trim() === "" ? undefined : String(value).trim();
  };
}

/** What the model runtime needs, typed. Throws ConfigurationMissing naming every required setting that is absent or invalid. */
export function loadModelRuntimeConfig(source: ConfigSource): ClaudeCodeRuntimeConfig {
  const get = readSettings(source);
  const s = MODEL_RUNTIME_SETTINGS;
  const missing: Setting[] = [];
  const trainingOff = get(s.trainingOff.name);
  if (trainingOff === undefined || !/^\d{4}-\d{2}-\d{2}$/.test(trainingOff)) missing.push(s.trainingOff);
  const count = (setting: Setting, fallback: number) => {
    const raw = get(setting.name);
    if (raw === undefined) return fallback;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1) missing.push(setting);
    return n;
  };
  const config: ClaudeCodeRuntimeConfig = {
    command: get(s.command.name) ?? CLAUDE_CODE_DEFAULTS.command,
    tierAliases: {
      large: get(s.large.name) ?? CLAUDE_CODE_DEFAULTS.tierAliases.large,
      small: get(s.small.name) ?? CLAUDE_CODE_DEFAULTS.tierAliases.small,
    },
    portTiers: CLAUDE_CODE_DEFAULTS.portTiers,
    portEffort: CLAUDE_CODE_DEFAULTS.portEffort,
    maxConcurrentCalls: count(s.concurrency, CLAUDE_CODE_DEFAULTS.maxConcurrentCalls),
    callTimeoutMs: count(s.timeout, CLAUDE_CODE_DEFAULTS.callTimeoutMs / 1000) * 1000,
    modelTrainingOffConfirmed: trainingOff ?? null,
  };
  if (missing.length > 0) throw new ConfigurationMissing(missing);
  return config;
}
