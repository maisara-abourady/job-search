# 0017. Document reading is its own adapter package; its libraries are in-process, offline details

Status: accepted (2026-11-12). Decides watch item W2 for `documents` and the reading half of D9. Makes concrete ADR 0009's row for `DocumentReader` ("no model: document libraries, including OCR").

## Context

`IntakeResume` reads every upload through the `DocumentReader` port, owned by `use-cases/onboarding`:
- `read(upload: ResumeUpload): Promise<ReadDocumentResult>`;
- the result is `{ outcome: "read", text, language }` or `{ outcome: "unreadable" }`.

The use case decides what to do with the result. `INTAKE_POLICY.supportedLanguage` is `"en"`, and unreadable text leads to asking for pasted text. Until now Main passed a `notYetBuilt` placeholder (P1-T02).

P1-T08 (text, DOCX, PDF text layer, LinkedIn PDF) and P1-T09 (OCR for image-only PDFs) bring the system's first third-party parsing libraries. The implementer intends four, all pure JavaScript or WebAssembly with no native build:
- `unpdf` for PDF text;
- `mammoth` for DOCX;
- `franc-min` for language detection;
- `tesseract.js` for OCR in P1-T09, with English trained data installed locally.

W2 said: split a subfolder of `@matchmaker/adapters` into its own package when its first third-party dependency arrives. ADR 0009 already did this for the model runtime.

Forces:
- **Volatility.** These libraries change on their own schedules: pdf.js inside `unpdf`, mammoth's DOCX mapping, and the OCR engine and its trained data. The reasons are file formats and library releases. No other adapter changes for those reasons (§4.2 CCP).
- **Weight.** The OCR engine and its trained data add megabytes and a worker thread. The in-memory store, the sources, the work queue and the scenario tests need none of it (§3.5 ISP, §4.2 CRP).
- **Privacy 1.** Resumes are the most personal data in the system. Reading them must send nothing off the machine. By default `tesseract.js` downloads its WebAssembly core and language data from a CDN at first use.
- **The selling-points card within 20 seconds of upload** (NFR). OCR is the slow step: seconds per page.
- **One-command install** (D15, Phase 6). A native build (node-gyp, a system Tesseract or Poppler) would break it on the owner's or a friend's machine.

## Decision

1. **New component `@matchmaker/documents`** at `packages/documents`, circle 3-4 (interface adapters), next to `@matchmaker/scraping-sources` and the planned `@matchmaker/model-runtime-claude-code`.
   - **It may import** `@matchmaker/rules`, `@matchmaker/use-cases` (the published surface only), `node:*` and its own libraries.
   - **It may not import** `@matchmaker/delivery`, `@matchmaker/main`, `@matchmaker/testing-api`, `@matchmaker/use-cases/wiring` or `@matchmaker/adapters`. Not importing the shared adapters package keeps it off the Périphérique (§12.5): reading cannot reach the store or the sources directly.
   - **Who depends on it.** `@matchmaker/main` and `@matchmaker/testing-api` add it to their allowed lists. Nothing else may. In the testing API, only `contract/` imports it. Scenario tests in `test/` keep the scripted reader (`documentWillRead`), so they load no parsing library and run in milliseconds (§10.3).
   - **Published surface.** `src/index.ts` exports the adapter class that implements `DocumentReader`, the options Main may pass it, and any threshold the contract suite asserts against. No library type, library option object or library error appears in an exported signature (§8.2).
2. **One area, `reading/`** (`AREAS["@matchmaker/documents"] = { reading: [] }`).
   - Everything for P1-T08 and P1-T09 goes there: format dispatch, LinkedIn page-furniture stripping, language detection and OCR. These change together whenever a resume format or a reading library changes (§4.2 CCP).
   - Because the area is declared, the checker refuses any other folder under `src/` until it is declared with an ADR. That is the hook for D9's rendering half (decision 6).
3. **The libraries are details inside `reading/`. This ADR states the constraints they must meet and does not bind the names.**
   - **The constraints:**
     - pure JavaScript or WebAssembly, running on the supported Node (22), with no native build and no install-time download;
     - in-process, with **no network access at any time**. OCR's core and language data load from installed files whose paths the adapter sets explicitly. Remote URLs are not allowed, CDN defaults included (Privacy 1);
     - a library failure or a corrupt file becomes `{ outcome: "unreadable" }`, never a thrown error, because the use case already has the path for unreadable input (§9.1: the adapter is the humble object around the library);
     - the languages OCR can read are adapter options set by Main, today English only. Adding a language is configuration plus installed data, not a code branch.
   - **The current picks** are `unpdf`, `mammoth`, `franc-min` and `tesseract.js` with locally installed English data. They are recorded here as the first implementation, not as a decision. Replacing one with another library that meets the constraints changes only `reading/` and the package manifest, and needs no ADR (§1.1: the cost of change is confined to one package).
   - **Breaking a constraint needs a new ADR**, because it would move a boundary. Examples: a native OCR engine, a cloud OCR or document service, or OCR by the model runtime (ADR 0009).
4. **What crosses the port** (§8.3: shaped for the inner circle).
   - `text` is plain Unicode text in reading order, with layout residue removed: LinkedIn's "Page N of M" footers, and DOCX or PDF artifacts that are not content.
   - `language` is a lowercase ISO 639-1 code when one exists (`en`, `fr`), otherwise the detector's ISO 639-3 code. It is `und` (the BCP 47 "undetermined" tag) when the text is too short or too mixed to tell.
   - **The adapter reports what it detects; the use case decides what to accept.** Whether `und` counts as English is application policy and belongs in `INTAKE_POLICY` and `IntakeResume` (§7.2). It does not belong in the adapter's mapping table.
   - Library-specific results never cross: pdf.js objects, mammoth messages, franc scores, OCR confidences.
5. **OCR stays in the same package and the same process** (P1-T09).
   - It runs when the PDF text layer yields less than the adapter's minimum readable text. Its page and time bounds are adapter options with defaults, which Main may override.
   - The OCR worker thread is not an architectural boundary (§6.4: threads are not boundaries). The decoupling mode stays source-level, in one local process (ADR 0001, 0016).
   - If OCR proves too slow for the 20-second card, or crashes or bloats the process, the remedy is a child process behind the same `DocumentReader` port (watch item W20). The use cases do not change.
6. **D9's other half, resume rendering, stays deferred** until Phase 4 (`ResumeRenderer`).
   - Its default home is a sibling area `rendering/` in this package, which may not import `reading/`, provided its library meets the same constraints.
   - If the rendering library breaks a constraint, or tailoring needs it released apart from reading, it gets its own package instead.
   - The Phase 4 task decides this with an ADR (deferred.md D9).
7. **If `pnpm metrics` warns about SDP on the edge `documents -> use-cases`, the fix is in the metric, not in the package.**
   - **Why the warning may appear.** Once `main.dev.ts` imports the reader, the package will have one file depending outward and two files depending on it (Main and the contract test). That gives I = 0.33, below `use-cases` (0.42 today). The metric would then call a leaf plugin "more stable" than the policy it plugs into, only because Main and a test name it.
   - **The fix.** In `check.mjs`, fan-in from `@matchmaker/main` and `@matchmaker/testing-api` is not counted when computing I for the SDP comparison. Composition and tests are not dependents that make a plugin hard to change (§10.1, §10.3; it extends the exemption ADR 0010 gave those two components as sources). Add a regression test in `tools/architecture/test/`.
   - **Not allowed:** dummy imports, or folding files together, to move the number (§4.7: the metric is not a god).

## Rationale

- §4.2 (CCP, CRP) and §3.5: a package for what changes when a reading library or a resume format changes. Main and the contract suites take the weight; nothing else does. This is the W2 trigger exactly as written.
- §5.3, §12.3: libraries are details. The ADR binds the constraints that keep them reversible (offline, in-process, no native build, nothing crosses) and leaves the names to the package, so swapping one stays a package-local change.
- §8.2, §8.3: the port and its plain result are owned by onboarding. The adapter maps library output into it, and the language code is shaped for the use case's comparison.
- §7.2: "too short to tell means English" is an application rule about which resumes this app accepts. It sits with `INTAKE_POLICY`, not in a detector's mapping table.
- §9.1: the adapter is the humble object around the parsing libraries. The contract suite falsifies it with small fixture files, and every use-case test runs with the scripted reader.
- §5.6, §6.4: one process; the worker thread is not a boundary. A child process stays available behind the same port if OCR forces it.
- §12.5: the component, its allowed list and its area are data in `components.mjs`. The compiler (manifest resolution) and the checker enforce them, not review.
- §13.3, Privacy 1: a reading library that phones home, even for model data, would move resume handling off the machine without anyone deciding it. The no-network constraint makes that a visible decision.

## Consequences

- `tools/architecture/components.mjs` holds the component, the `reading` area, and the new entries in Main's and the testing API's allowed lists. `README.md` shows the package in the component diagram and the boundary table.
- **P1-T08** creates the package. Its code must follow these rules:
  - every library error is caught inside `reading/`;
  - nothing beyond the published surface of decision 1 is exported;
  - `main.dev.ts` composes the real reader;
  - the contract suite runs both the scripted reader and the real one against the same expectations.

  If the detector's mapping currently turns `und` into `en`, P1-T08 moves that choice into `IntakeResume`, with a use-case test.
- **P1-T09** adds OCR in `reading/`. It sets the OCR core and language data paths to installed files, and it records seconds per page (PROGRESS.md). The contract suite proves an image-only PDF reads its known sentence with networking unavailable to the test process, or, if the library cannot be isolated that way in a test, that every configured path is a local file.
- Main and the testing API pay the libraries' load time once. Scenario tests do not.
- A future `ResumeRenderer` has a default home, and a rule for when it leaves that home (decision 6).

## Alternatives rejected

- **A `documents/` area inside `@matchmaker/adapters`:** every consumer of the shared adapters package (Main, all testing-API scenarios, the eval Mains) would drag pdf.js, mammoth and an OCR engine with its trained data (§4.2 CRP). W2 existed to stop this.
- **A package per library or per format (`pdf`, `docx`, `ocr`):** these change together whenever reading behavior changes, serve one port and one actor, and would add three manifests for no separate release need (§4.2 CCP over REP early, §4.3).
- **Naming the libraries as the decision:** this would make a library swap look architectural and need an ADR for a package-local edit. The constraints are what is costly to change; the names are not.
- **OCR by the model runtime:** calls run with no tools (ADR 0009 decision 3), images through the CLI were not measured within the card budget, and every page would cost money. It stays possible behind the same port with a new ADR.
- **A system OCR or PDF tool (Tesseract binary, Poppler) through `node:child_process`:** it adds a per-OS install step against D15's one-command install, and nothing in the requirements needs its extra accuracy yet.
- **A document-reading service or separate process now:** there is no development, deployment or operational pressure (§5.6). W20 names the pressure that would justify a child process.

## Review trigger

- OCR pushes the selling-points card past 20 seconds on the owner's machine, or an OCR crash or memory spike takes down the process (W20).
- A reading library needs a native build, a network fetch or a newer Node than the supported one.
- Resumes in a language other than English become supported (`INTAKE_POLICY`): OCR language data and the detector's mapping become configuration that Main must supply.
- Phase 4 brings `ResumeRenderer` (decision 6).
