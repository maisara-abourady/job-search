/**
 * What Main gathers from the owner's local configuration for this runtime (ADR 0009 decision 3). Tiers are model
 * aliases and the port-to-tier map is data, so moving a port to another tier is a configuration edit.
 */
export type ModelTier = "large" | "small";
export type ModelPort =
  | "resumeAnalyst"
  | "searchPlanner"
  | "postingEnricher"
  | "matchJudge"
  | "interviewer"
  | "resumeWriter"
  | "keywordMatcher";

export type ClaudeCodeRuntimeConfig = {
  /** The Claude Code executable. */
  readonly command: string;
  readonly tierAliases: { readonly [T in ModelTier]: string };
  readonly portTiers: { readonly [P in ModelPort]: ModelTier };
  /** Claude Code's reasoning effort per port (`--effort`); a port without one uses the CLI's default. */
  readonly portEffort?: { readonly [P in ModelPort]?: string };
  readonly maxConcurrentCalls: number;
  readonly callTimeoutMs: number;
  /** The date the owner turned "Help improve Claude" off (Privacy 4, ADR 0009 decision 7); null when not confirmed. */
  readonly modelTrainingOffConfirmed: string | null;
};

export const CLAUDE_CODE_DEFAULTS = {
  command: "claude",
  tierAliases: { large: "sonnet", small: "haiku" },
  portTiers: {
    resumeAnalyst: "large",
    searchPlanner: "large",
    postingEnricher: "small",
    matchJudge: "large",
    interviewer: "large",
    resumeWriter: "large",
    keywordMatcher: "small",
  },
  // P1-T13: low effort keeps the resume analyst's thinking short enough for the 20 s card, with parsing unchanged.
  portEffort: { resumeAnalyst: "low" },
  maxConcurrentCalls: 5,
  callTimeoutMs: 60_000,
} as const satisfies Omit<ClaudeCodeRuntimeConfig, "modelTrainingOffConfirmed">;

/** The CLI version S-1 measured. Raise it when the runner needs newer flags. */
export const MINIMUM_CLAUDE_CODE_VERSION = "2.1.322";
