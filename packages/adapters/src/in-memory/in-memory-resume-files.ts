import type { PersonDataVault, ResumeFiles, ResumeUpload } from "@matchmaker/use-cases";

type StoredResume = { readonly resumeId: string; readonly version: number; readonly storedAt: string; readonly upload: ResumeUpload };

/**
 * Original resume uploads for development and tests (RP-8: every version kept). Files in the owner's data folder
 * (D8, P3-T09) implement the same port. A person's resumes are their data, so this store is also a vault part.
 */
export class InMemoryResumeFiles implements ResumeFiles, PersonDataVault {
  private readonly byPerson = new Map<string, StoredResume[]>();
  private counter = 0;
  private readonly now: () => Date;
  constructor(now: () => Date = () => new Date()) {
    this.now = now;
  }
  async store(personId: string, upload: ResumeUpload): Promise<{ resumeId: string; version: number }> {
    const versions = this.byPerson.get(personId) ?? [];
    const stored = {
      resumeId: `resume-${++this.counter}`,
      version: versions.length + 1,
      storedAt: this.now().toISOString(),
      upload: { ...upload, bytes: upload.bytes === null ? null : upload.bytes.slice() },
    };
    this.byPerson.set(personId, [...versions, stored]);
    return { resumeId: stored.resumeId, version: stored.version };
  }
  async original(personId: string, resumeId: string): Promise<ResumeUpload | null> {
    return this.byPerson.get(personId)?.find((r) => r.resumeId === resumeId)?.upload ?? null;
  }
  /** Metadata of every version (the bytes stay in the store; the export names what was uploaded and when). */
  async exportAll(personId: string): Promise<Uint8Array> {
    const resumes = (this.byPerson.get(personId) ?? []).map((r) => ({
      resumeId: r.resumeId,
      version: r.version,
      storedAt: r.storedAt,
      kind: r.upload.kind,
      fileName: r.upload.fileName,
      sizeBytes: r.upload.bytes?.byteLength ?? new TextEncoder().encode(r.upload.text ?? "").byteLength,
    }));
    return new TextEncoder().encode(JSON.stringify({ resumes }));
  }
  async eraseAll(personId: string): Promise<void> {
    this.byPerson.delete(personId);
  }
}
