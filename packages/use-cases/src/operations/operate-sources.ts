import type { SearchRunHistory, SourceSwitchControl } from "./ports.ts";

/** Scraping safeguard 1 (kill switch without a deploy) and DS-7 (run summaries) for the operator. */
export interface OperateSources {
  switchSource(request: { sourceName: string; enabled: boolean; reason: string }): Promise<void>;
  sourceStates(): ReturnType<SourceSwitchControl["states"]>;
  recentRuns(request: { limit: number }): ReturnType<SearchRunHistory["recent"]>;
}
export class OperateSourcesInteractor implements OperateSources {
  private readonly control: SourceSwitchControl;
  private readonly history: SearchRunHistory;
  constructor(control: SourceSwitchControl, history: SearchRunHistory) {
    this.control = control;
    this.history = history;
  }
  switchSource(r: { sourceName: string; enabled: boolean; reason: string }) {
    return this.control.setEnabled(r.sourceName, r.enabled, r.reason);
  }
  sourceStates() {
    return this.control.states();
  }
  recentRuns(r: { limit: number }) {
    return this.history.recent(r.limit);
  }
}
