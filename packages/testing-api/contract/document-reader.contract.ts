/**
 * DocumentReader contract (RP-1, RP-3): run against the scripted reader the testing API uses and against the real
 * adapter on small fictional fixture files, so the double cannot promise what the adapter does not do.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import type { DocumentReader, ResumeUpload } from "@matchmaker/use-cases";

const FIXTURES = new URL("./fixtures/", import.meta.url);

export function fixtureUpload(fileName: string, kind: ResumeUpload["kind"]): ResumeUpload {
  const bytes = new Uint8Array(readFileSync(new URL(fileName, FIXTURES)));
  return kind === "text" ? { kind, fileName, bytes: null, text: new TextDecoder().decode(bytes) } : { kind, fileName, bytes, text: null };
}

/** Each readable fixture, a sentence known to be in it, and its language. */
export const READABLE_FIXTURES = [
  { fileName: "resume.pdf", kind: "pdf", sentence: "Cut nightly pipeline time from six hours to forty minutes.", language: "en" },
  {
    fileName: "resume.docx",
    kind: "docx",
    sentence: "Designed an experiment framework that raised retention by four percent.",
    language: "en",
  },
  { fileName: "resume.txt", kind: "text", sentence: "Resolved escalated customer incidents within one business day", language: "en" },
  {
    fileName: "linkedin.pdf",
    kind: "linkedin-pdf",
    sentence: "Led the migration of reporting jobs to a scheduled pipeline.",
    language: "en",
  },
  { fileName: "resume-fr.txt", kind: "text", sentence: "J'ai conçu un service de paiement utilisé par trois équipes", language: "fr" },
] as const;

/** Fixtures with no readable text before OCR (P1-T09 moves image-only.pdf to the readable list). */
export const UNREADABLE_FIXTURES = [
  { fileName: "image-only.pdf", kind: "pdf" },
  { fileName: "blank-image.pdf", kind: "pdf" },
  { fileName: "corrupt.pdf", kind: "pdf" },
  { fileName: "corrupt.docx", kind: "docx" },
] as const;

export function documentReaderContract(name: string, make: () => DocumentReader): void {
  describe(`${name}: DocumentReader`, () => {
    for (const f of READABLE_FIXTURES) {
      test(`${f.fileName} (${f.kind}) reads with its known sentence, in ${f.language}`, async () => {
        const result = await make().read(fixtureUpload(f.fileName, f.kind));
        assert.equal(result.outcome, "read");
        if (result.outcome !== "read") return;
        assert.ok(result.text.replace(/\s+/g, " ").includes(f.sentence), `"${f.sentence}" in: ${result.text}`);
        assert.equal(result.language, f.language);
      });
    }
    for (const f of UNREADABLE_FIXTURES) {
      test(`${f.fileName} as ${f.kind} is unreadable, without throwing`, async () => {
        assert.deepEqual(await make().read(fixtureUpload(f.fileName, f.kind)), { outcome: "unreadable" });
      });
    }
    test("the LinkedIn export's page footers are not part of the text", async () => {
      const result = await make().read(fixtureUpload("linkedin.pdf", "linkedin-pdf"));
      assert.equal(result.outcome, "read");
      assert.doesNotMatch(result.outcome === "read" ? result.text : "", /Page \d+ of \d+/);
    });
    test("the upload's bytes are left as they were", async () => {
      const upload = fixtureUpload("resume.pdf", "pdf");
      const before = upload.bytes?.byteLength;
      await make().read(upload);
      assert.equal(upload.bytes?.byteLength, before);
    });
  });
}
