import { LibraryDocumentReader } from "@matchmaker/documents";
import { ScriptedDocumentReader } from "../src/scripted-document-reader.ts";
import { documentReaderContract, READABLE_FIXTURES, UNREADABLE_FIXTURES } from "./document-reader.contract.ts";

documentReaderContract("LibraryDocumentReader", () => new LibraryDocumentReader());

// The double, scripted the way tests script it, keeps the port's promises (it never throws, it reports a language).
documentReaderContract("ScriptedDocumentReader", () => {
  const reader = new ScriptedDocumentReader();
  for (const f of READABLE_FIXTURES)
    reader.willRead(f.fileName, { outcome: "read", text: `Fictional text. ${f.sentence}`, language: f.language });
  for (const f of UNREADABLE_FIXTURES) reader.willRead(f.fileName, { outcome: "unreadable" });
  return reader;
});
