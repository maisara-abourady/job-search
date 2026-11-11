/**
 * Spend metering (ADR 0010). Money is spent only at the edge (a model call, a paid aggregator call, proxy
 * traffic), and only the edge knows how much. Who the money was spent for, and on which run, is decided
 * here, by the use case that caused it. Prices, token counts and vendor names stay in the adapters and Main.
 */

/** PRD "Cost per active user": model, aggregator and proxy spend. */
export type SpendCategory = "model" | "aggregator" | "proxy";

/** Why the money was spent: the use case that caused it. */
export type SpendPurpose = "intake" | "interview" | "search" | "scoring" | "tailoring";

/**
 * One priced unit of spend as an adapter reports it. `provider` is a label the adapter declares (data, never
 * branched on, §3.4). Amounts are integer micro-units of the accounting currency (ASSUMPTION: USD; D13).
 */
export type Spend = {
  readonly category: SpendCategory;
  readonly provider: string;
  readonly amountMicros: number;
};

/** Reported by every adapter that spends money, once per paid call, even when the call then fails. */
export interface SpendMeter {
  record(spend: Spend): Promise<void>;
}

/** Whom the spend is charged to. `runId` is set when the spend belongs to a search run (SearchRun "cost"). */
export type ChargeTo = { readonly userId: string; readonly runId: string | null; readonly purpose: SpendPurpose };

/**
 * Used by cost-incurring use cases: every spend reported while `work` runs is charged to `to`. An inner
 * charge (scoring inside a search run) replaces the outer one for its own duration.
 */
export interface SpendAttribution {
  charge<T>(to: ChargeTo, work: () => Promise<T>): Promise<T>;
}

/** A spend as stored. Spend reported outside any charge is kept, with userId null and purpose "unattributed". */
export type SpendRecord = {
  readonly userId: string | null;
  readonly runId: string | null;
  readonly purpose: SpendPurpose | "unattributed";
  readonly category: SpendCategory;
  readonly provider: string;
  readonly amountMicros: number;
  readonly at: string;
};

/** Storage gateway for spend, named for the needs: run cost, spend per user per period (metric, spend caps). */
export interface SpendLedger {
  append(record: SpendRecord): Promise<void>;
  spentOnRun(runId: string): Promise<number>;
  /** Micros charged to the user with fromIso <= at < toIso. */
  spentBy(userId: string, fromIso: string, toIso: string): Promise<number>;
}
