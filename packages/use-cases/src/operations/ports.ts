/** The sourcing operator's controls. Separate actor from the job seeker (legal, cost, breakage). */
export interface SourceSwitchControl {
  setEnabled(sourceName: string, enabled: boolean, reason: string): Promise<void>;
  states(): Promise<readonly { sourceName: string; tier: 1 | 2 | 3 | 4; enabled: boolean; reason: string | null }[]>;
}
export interface SearchRunHistory {
  recent(limit: number): Promise<readonly { userId: string; trigger: string; finishedAt: string; fetched: number; duplicatesMerged: number; failedSources: readonly string[] }[]>;
}
