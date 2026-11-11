import type { PersonDataVault } from "@matchmaker/use-cases";

/**
 * AB-4: one person's export and deletion across every store that holds their data. Each part exports JSON; the
 * archive is one JSON document with a section per part. Deletion runs every part, all of them even if one fails,
 * then reports the first failure. Resume files and generated files join as parts when their stores exist (D8).
 */
export class JsonArchiveVault implements PersonDataVault {
  private readonly parts: readonly { readonly section: string; readonly vault: PersonDataVault }[];
  constructor(parts: readonly { readonly section: string; readonly vault: PersonDataVault }[]) {
    this.parts = parts;
  }
  async exportAll(personId: string): Promise<Uint8Array> {
    const decoder = new TextDecoder();
    const sections: Record<string, unknown> = {};
    for (const p of this.parts) sections[p.section] = JSON.parse(decoder.decode(await p.vault.exportAll(personId)));
    return new TextEncoder().encode(JSON.stringify({ format: "ai-job-matchmaker-export", version: 1, personId, ...sections }, null, 2));
  }
  async eraseAll(personId: string): Promise<void> {
    const settled = await Promise.allSettled(this.parts.map((p) => p.vault.eraseAll(personId)));
    const failed = settled.find((s) => s.status === "rejected");
    if (failed !== undefined) throw failed.reason;
  }
}
