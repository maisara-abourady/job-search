import type { DocumentReader, ReadDocumentResult, ResumeUpload } from "@matchmaker/use-cases";

/**
 * The testing API's DocumentReader: answers what a test scripted for a file name; an unscripted upload reads as its
 * own text (pasted text, or the bytes decoded as UTF-8), in English. The DocumentReader contract runs against it.
 */
export class ScriptedDocumentReader implements DocumentReader {
  private readonly scripts = new Map<string, ReadDocumentResult>();
  willRead(fileName: string, result: ReadDocumentResult): this {
    this.scripts.set(fileName, result);
    return this;
  }
  async read(upload: ResumeUpload): Promise<ReadDocumentResult> {
    const scripted = this.scripts.get(upload.fileName);
    if (scripted !== undefined) return scripted;
    const text = upload.text ?? new TextDecoder().decode(upload.bytes ?? new Uint8Array());
    return { outcome: "read", text, language: "en" };
  }
}
