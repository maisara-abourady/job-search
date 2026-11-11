import type { PostingCatalog, PostingLiveness } from "./ports.ts";

/** DS-5: re-check stored jobs daily; expired postings are marked closed and leave Apply and Stretch. */
export type RecheckStoredPostingsResponse = { readonly checked: number; readonly closed: number };
export interface RecheckStoredPostings {
  execute(): Promise<RecheckStoredPostingsResponse>;
}
export class RecheckStoredPostingsInteractor implements RecheckStoredPostings {
  private readonly catalog: PostingCatalog;
  private readonly liveness: PostingLiveness;
  constructor(catalog: PostingCatalog, liveness: PostingLiveness) {
    this.catalog = catalog;
    this.liveness = liveness;
  }
  async execute(): Promise<RecheckStoredPostingsResponse> {
    const open = await this.catalog.openPostings();
    let closed = 0;
    for (const p of open) {
      const anyLive = (await Promise.all(p.sources.map((s) => this.liveness.isLive(s.url)))).some(Boolean);
      if (!anyLive) {
        await this.catalog.markClosed(p.id);
        closed++;
      }
    }
    return { checked: open.length, closed };
  }
}
