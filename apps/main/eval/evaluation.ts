import type { Matchmaker, MatchmakerDetails } from "../src/compose-matchmaker.ts";

/**
 * An evaluation (X-5): a phase exit measured on real cases rather than asserted by a unit test. Evaluations run real
 * adapters, cost money and need keys, so they stay out of `pnpm verify`; `pnpm eval <name>` runs one.
 * Each lives in `apps/main/eval/<name>/<name>.eval.ts` and default-exports an `Evaluation`.
 */
export type CaseResult = {
  readonly id: string;
  readonly passed: boolean;
  /** What was expected and what happened, in words a reviewer can check. */
  readonly detail: string;
  readonly metrics?: Readonly<Record<string, number>>;
};
export type ThresholdResult = { readonly passed: boolean; readonly summary: string };
/** `--key=value` arguments after the evaluation's name. */
export type EvalOptions = Readonly<Record<string, string>>;

/** One configured run: the details Main composes the app from, and the cases run against that app. */
export type EvaluationRun = {
  readonly details: MatchmakerDetails;
  run(app: Matchmaker): Promise<readonly CaseResult[]>;
};
export type Evaluation = {
  readonly name: string;
  readonly description: string;
  configure(options: EvalOptions): EvaluationRun;
  threshold(results: readonly CaseResult[]): ThresholdResult;
};
