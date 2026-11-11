import { notYetBuilt } from "@matchmaker/rules";
import type { FoundPosting, JobSource, SearchQuery, SourceDescriptor } from "@matchmaker/use-cases";

/**
 * Tier 4 (direct scraping) lives in its own package so a market whose legal review says no can ship
 * without it: Main simply does not include it (ADR 0004). Rate limit and proxy pool are internal;
 * the kill switch is read by the use case through SourceSwitchboard.
 */
export class JobSpyBoardSource implements JobSource {
  readonly descriptor: SourceDescriptor;
  constructor(board: "linkedin" | "indeed" | "glassdoor" | "ziprecruiter" | "google" | "bayt") {
    this.descriptor = { name: `scrape:${board}`, tier: 4 };
  }
  async search(_queries: readonly SearchQuery[], _timeoutMs: number): Promise<readonly FoundPosting[]> {
    // Stores only normalized fields plus the source link (Scraping safeguard 3).
    return notYetBuilt("Phase 5: JobSpy bridge (after legal review per board and market)");
  }
}
