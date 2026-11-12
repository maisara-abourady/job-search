/** The sourcing operator's controls. Separate actor from the job seeker (legal, cost, breakage). */
export interface SourceSwitchControl {
  setEnabled(sourceName: string, enabled: boolean, reason: string): Promise<void>;
  states(): Promise<readonly { sourceName: string; tier: 1 | 2 | 3 | 4; enabled: boolean; reason: string | null }[]>;
}
export interface SearchRunHistory {
  /** DS-7 run summaries, with each run's cost (PRD SearchRun "cost", ADR 0010). */
  recent(limit: number): Promise<
    readonly {
      runId: string;
      personId: string;
      trigger: string;
      finishedAt: string;
      fetched: number;
      duplicatesMerged: number;
      failedSources: readonly string[];
      costMicros: number;
    }[]
  >;
}
