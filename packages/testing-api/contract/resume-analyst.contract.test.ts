import { readFileSync } from "node:fs";
import { CLAUDE_CODE_DEFAULTS, ClaudeCodeResumeAnalyst, HeadlessRunner, type ProcessLauncher } from "@matchmaker/model-runtime-claude-code";
import { ScriptedResumeAnalyst } from "../src/scripted-resume-analyst.ts";
import { resumeAnalystContract } from "./resume-analyst.contract.ts";

/** Claude Code's envelopes for a fictional resume, replayed by call order (no CLI or sign-in needed). */
const recorded = JSON.parse(readFileSync(new URL("./fixtures/analyst-recorded-response.json", import.meta.url), "utf8")) as {
  resumeText: string;
  calls: { structured_output: unknown }[];
};

/** Replays the recorded envelope whose schema matches the call (structure, candidates or strength). */
export function replayingLauncher(): ProcessLauncher {
  return {
    run: async (_command, args) => {
      const schema = JSON.parse(args[args.indexOf("--json-schema") + 1] ?? "{}") as { properties: Record<string, unknown> };
      const call =
        "candidates" in schema.properties
          ? recorded.calls[1]
          : "impactEvidence" in schema.properties
            ? recorded.calls[2]
            : recorded.calls[0];
      return { exitCode: 0, stdout: JSON.stringify(call), stderr: "", timedOut: false };
    },
  };
}

resumeAnalystContract("ClaudeCodeResumeAnalyst on recorded envelopes", () => {
  const spends: number[] = [];
  const runner = new HeadlessRunner(
    { ...CLAUDE_CODE_DEFAULTS, modelTrainingOffConfirmed: "2026-11-12" },
    { record: async (s) => void spends.push(s.amountMicros) },
    replayingLauncher(),
  );
  return {
    analyst: new ClaudeCodeResumeAnalyst(runner, () => new Date("2026-11-12T00:00:00Z")),
    resumeText: recorded.resumeText,
    spendRecorded: () => spends,
  };
});

resumeAnalystContract("ScriptedResumeAnalyst", () => {
  const spends: number[] = [];
  const analyst = new ScriptedResumeAnalyst({ record: async (s) => void spends.push(s.amountMicros) });
  return { analyst, resumeText: "Fictional resume text" };
});
