/**
 * @matchmaker/documents: the DocumentReader adapter (D9) and its third-party parsing libraries, split out of
 * @matchmaker/adapters so only Main and the contract suites depend on them (W2, ADR 0017).
 */
export { LibraryDocumentReader, MIN_READABLE_CHARACTERS } from "./reading/document-reader.ts";
export type { OcrTiming } from "./reading/ocr.ts";
