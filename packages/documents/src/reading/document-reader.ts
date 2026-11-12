import type { DocumentReader, ReadDocumentResult, ResumeUpload } from "@matchmaker/use-cases";
import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";
import { detectLanguage } from "./language.ts";
import { ocrText, type OcrTiming } from "./ocr.ts";

/** Below this many letters and digits a document has no usable text layer (a scan, or an empty file). */
export const MIN_READABLE_CHARACTERS = 50;

/**
 * RP-1: text from pasted text, DOCX, PDF (text layer) and LinkedIn's "Save to PDF" export, plus the language it
 * is written in. Never throws for a bad file: anything it cannot read is "unreadable", and the use case asks for
 * pasted text. A PDF without a usable text layer is read by OCR (RP-3); if that yields too little, it is unreadable.
 */
export class LibraryDocumentReader implements DocumentReader {
  private readonly onOcr: ((timing: OcrTiming) => void) | undefined;
  /** `onOcr` hears how long each OCR run took (the 20 s card budget, W20). */
  constructor(options: { onOcr?: (timing: OcrTiming) => void } = {}) {
    this.onOcr = options.onOcr;
  }

  async read(upload: ResumeUpload): Promise<ReadDocumentResult> {
    let text: string;
    try {
      text = normalize(await this.textOf(upload));
    } catch {
      return { outcome: "unreadable" };
    }
    if (countReadable(text) < MIN_READABLE_CHARACTERS) return { outcome: "unreadable" };
    return { outcome: "read", text, language: detectLanguage(text) };
  }

  private async pdfText(bytes: Uint8Array): Promise<string> {
    // A plain copy: pdf.js refuses Node Buffers and may detach what it is given; the upload's bytes stay the caller's.
    const pdf = await getDocumentProxy(new Uint8Array(bytes), { verbosity: 0 }); // no console warnings for damaged files
    const layer = (await extractText(pdf, { mergePages: false })).text.join("\n");
    return countReadable(layer) >= MIN_READABLE_CHARACTERS ? layer : ocrText(pdf, this.onOcr);
  }

  private async textOf(upload: ResumeUpload): Promise<string> {
    switch (upload.kind) {
      case "text":
        return upload.text ?? "";
      case "docx":
        return (await mammoth.extractRawText({ buffer: Buffer.from(bytesOf(upload)) })).value;
      case "pdf":
        return this.pdfText(bytesOf(upload));
      case "linkedin-pdf":
        return withoutLinkedInFurniture(await this.pdfText(bytesOf(upload)));
    }
  }
}

function bytesOf(upload: ResumeUpload): Uint8Array {
  if (upload.bytes === null) throw new Error(`${upload.kind} upload without bytes`);
  return upload.bytes;
}

/** LinkedIn's export puts a "Page N of M" footer on every page; it is layout, not resume content. */
function withoutLinkedInFurniture(text: string): string {
  return text.replace(/(?<![A-Za-z])Page \d+ of \d+(?!\d)/g, "\n");
}

function normalize(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function countReadable(text: string): number {
  return (text.match(/[\p{L}\p{N}]/gu) ?? []).length;
}
