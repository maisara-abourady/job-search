import { notYetBuilt } from "@matchmaker/rules";
import type { FoundPosting, JobSource, SearchQuery, SourceDescriptor } from "@matchmaker/use-cases";

/**
 * Tier 4 (direct scraping) lives in its own package so its scraping library never reaches anything else, and an
 * installation that never scrapes need not include it (ADR 0004, ADR 0016). Every board is off until the owner turns
 * it on after reading that board's terms (SOURCE_POLICY in RunJobSearch, the kill switch through SourceSwitchboard).
 * The rate limit is internal. There is no proxy pool, and the adapter never uses a logged-in personal account.
 */
export class JobSpyBoardSource implements JobSource {
  readonly descriptor: SourceDescriptor;
  constructor(board: "linkedin" | "indeed" | "glassdoor" | "ziprecruiter" | "google" | "bayt") {
    this.descriptor = { name: `scrape:${board}`, tier: 4 };
  }
  async search(_queries: readonly SearchQuery[], _timeoutMs: number): Promise<readonly FoundPosting[]> {
    // Stores only normalized fields plus the source link (Scraping safeguard 3).
    return notYetBuilt("Phase 5: JobSpy bridge, anonymous only, for the boards the owner turns on");
  }
}
