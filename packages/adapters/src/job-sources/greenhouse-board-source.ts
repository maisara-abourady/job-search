import { notYetBuilt } from "@matchmaker/rules";
import type { AtsCompany, AtsLinkRecognizer, FoundPosting, JobSource, SearchQuery, SourceDescriptor } from "@matchmaker/use-cases";

/**
 * Tier 1 adapter shell: one per ATS (Greenhouse, Lever, Ashby, Workable, SmartRecruiters, Recruitee), all the
 * same shape. Owns its endpoint, rate limit, timeout and the mapping to the common schema; nothing else knows them.
 */
export class GreenhouseBoardSource implements JobSource, AtsLinkRecognizer {
  readonly descriptor: SourceDescriptor = { name: "greenhouse", tier: 1 };
  private readonly companies: () => Promise<readonly string[]>;
  constructor(companiesFromRegistry: () => Promise<readonly string[]>) {
    this.companies = companiesFromRegistry;
  }
  async search(_queries: readonly SearchQuery[], _timeoutMs: number): Promise<readonly FoundPosting[]> {
    void this.companies;
    return notYetBuilt("Phase 2: Greenhouse public job-board endpoint per company (verify endpoint and quota)");
  }
  recognize(url: string): AtsCompany | null {
    const m = /boards\.greenhouse\.io\/([^/?#]+)/.exec(url);
    return m?.[1] ? { ats: "greenhouse", companyId: m[1] } : null;
  }
}
