# Phase 1: Foundations

Goal: A resume dropped into the dev app for a person's profile becomes a structured profile with a selling-points card and a Resume Strength score. **Exit test (PRD): 20 varied test resumes parse with correct roles, dates and skills.**
Detail level: Full
Traces to: UC-1, UC-2 (facts and selling points), UC-16 to UC-21 (pinned; done by the Architect), E-1, E-3, E-4, E-13, E-14, E-16, P-2, P-3, P-4, P-6, P-7, P-31, A-7, A-15, A-16a, D-3, D-10, X-2, X-5, X-12; PRD RP-1 to RP-8, AB-1 and AB-2 (use-case side), Flow 1 steps 1 to 3
Prerequisites: Gate 0A passed. Gate 0B (D1 decided) before P1-T10. H-2 before P1-T10. H-3 and H-4 before P1-T11.

Order inside the phase follows the dependency rule outward: fakes and testing-API superpowers, then rules and the use cases proven against scripted details, then real adapters, then the evaluation. P1-T01 to P1-T08 need no model decision and may run while D1 is still being decided.

Web delivery is not in this phase (PLAN.md assumption; answered question 1). The PRD's "Person profiles" for this phase are met at the use-case level: `CreatePerson`, `RenamePerson`, `ListPeople`, `OpenPerson`, `ExportPersonData` and `DeletePerson` exist and are tested (ADR 0014). There is no authentication anywhere: delivery passes the open profile's `personId`. The picker arrives with `apps/web` in Phase 3, full profile management in Phase 6.

Amended 2026-11-11 for the scope revision: `userId` is `personId`; `AccessGuard` is `SpendingGuard`; P1-T06 is replaced by the Architect's profile and spending tests and marked done; resume files take part in export and delete.

## Tasks

### P1-T01 — In-memory resume files and onboarding storage contracts

- **Traces to:** P-6, P-7, P-31, A-16a, A-28, X-6, RP-8, D8, ADR 0014 §4
- **Layer:** Interface adapters (`packages/adapters/src/in-memory`) — must not import delivery, main, testing-api or another adapter subfolder
- **Depends on:** P0-T06
- **Size:** M  PARALLEL-OK
- **Context:** `IntakeResume` needs `ResumeFiles` (store the original upload, return a resume id and version; every version kept, RP-8). Files in the owner's data folder are D8 and arrive in Phase 3 (P3-T09); until then an in-memory implementation serves dev and tests. A person's resumes are their data, so the in-memory store also implements `PersonDataVault` and joins the `JsonArchiveVault` in `main.dev.ts` and the testing API (ADR 0014: every store holding a person's data must). Add the contract suite for `ResumeFiles` and extend the `ProfileVersions` suite with `sellingPoints`. See ADR 0006 table "File storage", deferred.md D8.
- **Files:**
  - create `packages/adapters/src/in-memory/in-memory-resume-files.ts`
  - modify `packages/adapters/src/index.ts`
  - modify `apps/main/src/main.dev.ts`, `packages/testing-api/src/matchmaker-testing-api.ts` (add a `resumeFiles` section to the `JsonArchiveVault`)
  - modify `packages/testing-api/contract/storage-contracts.ts` (add `resumeFilesContract`; `sellingPoints` cases; run the `PersonDataVault` suite on the new store)
  - modify `packages/testing-api/contract/in-memory-store.contract.test.ts`
- **Acceptance criteria:**
  - [ ] Storing two uploads for one person returns versions 1 and 2 with distinct resume ids; both remain retrievable
  - [ ] `sellingPoints(personId)` returns the points saved with the latest `saveNewVersion`, and `[]` for an unknown person
  - [ ] After `eraseAll(personId)` neither upload is retrievable and another person's uploads are; the export lists both versions' metadata
- **Verify:**
  ```bash
  pnpm test:contract && pnpm check:architecture
  ```

### P1-T02 — Wire intake and profile correction through Main and the testing API

- **Traces to:** M-1, M-2, UC-1, UC-2, UC-21, P-3, P-4, P-6, P-9, ADR 0008, ADR 0015
- **Layer:** Main (`apps/main/src`) and tests (`packages/testing-api/src`) — Main must not import testing-api
- **Depends on:** P1-T01, P0-T04
- **Size:** M
- **Context:** Walking skeleton of the slice. Add `reader: DocumentReader`, `analyst: ResumeAnalyst` and `resumeFiles: ResumeFiles` to `MatchmakerDetails`; compose `IntakeResumeInteractor` (searches go to `requests.searchRequests`, ADR 0001 §3; `spend: d.spendAttribution`, ADR 0010; add `spending` to its dependencies and pass the `SpendingGuard`, ADR 0015 and the hand-off comment in `compose-matchmaker.ts`) and `CorrectProfileInteractor` (re-scores go to `requests.rescoreRequests`), the latter wrapped in a new `MeasuredCorrectProfile` decorator in `packages/use-cases/src/measurement/measured-input-ports.ts` that emits `preferences-saved` and `fact-fixed` after success (ADR 0011); expose both in `useCases`. `main.dev.ts` passes `UnchosenModelRuntime`-style placeholders until P1-T08 and P1-T10. Testing API superpowers: `documentWillRead(fileName, result)`, `analystWillSay({ structured, candidates, strength })`, `intake(personId, upload, { overBudgetConfirmed })`, `correct(personId, correction)`, `profileVersions(personId)` (observe), `rescoresRequested` (`searchesRequested` comes from P0-T04). Tests create the person first with `createProfile`. The interactors are still stubs, so the first test asserts the call reaches them.
- **Files:**
  - modify `apps/main/src/compose-matchmaker.ts`
  - modify `apps/main/src/main.dev.ts`
  - modify `packages/use-cases/src/measurement/measured-input-ports.ts`, `packages/use-cases/src/wiring.ts` (`MeasuredCorrectProfile`)
  - modify `packages/testing-api/src/matchmaker-testing-api.ts`
  - modify `packages/testing-api/src/builders.ts` (`aStructuredResume`, `aResumeUpload`)
  - create `packages/testing-api/test/onboarding.test.ts`
- **Acceptance criteria:**
  - [ ] After `createProfile("Dana")`, `api.intake(personId, aResumeUpload())` rejects with `/Not yet built: RP-1/` (replaced by real assertions in P1-T04)
  - [ ] `pnpm smoke` and every earlier test still pass
- **Verify:**
  ```bash
  node --test "packages/testing-api/test/*.test.ts" && pnpm smoke && pnpm verify
  ```

### P1-T03 — Rules: choose 5 to 8 selling points and suggest a target seniority band

- **Traces to:** E-3, E-14, RP-4, RP-6, PF-3, PF-5, edge case "No work history"
- **Layer:** Entities (`packages/rules/src/profile`, `shared`) — must not import anything outside `packages/rules`, no `node:*`, no library
- **Depends on:** P0-T01
- **Size:** S  PARALLEL-OK
- **Context:** Two pure rules a career coach would apply by hand. (1) `selectSellingPoints(candidates)`: tier each candidate with the existing `sellingPointTier`, drop those with no tier, rank Signature before Strong before Supporting (stable within a tier), keep at most 8; if fewer than 5 qualify, return what qualifies (the card says so). (2) `suggestedSeniorityBand(inferred)`: the inferred level plus the next level up on `SENIORITY_LADDER`; `null` (no history) suggests `["entry"]`. Also `initialPreferences(suggestedBand)`: soft preferences empty, salary floor `null`, authorization never invented (`authorizedCountries: []`, `acceptsSponsorship: false`) until the user answers PF-2 in Phase 3. Behavior is asserted through the testing API in P1-T04 (ADR 0008).
- **Files:**
  - modify `packages/rules/src/profile/selling-points.ts`
  - create `packages/rules/src/profile/preference-defaults.ts`
  - modify `packages/rules/src/index.ts`
- **Acceptance criteria:**
  - [ ] Exported from `@matchmaker/rules`; `pnpm typecheck` and `pnpm check:architecture` green
  - [ ] Behavioral criteria are listed in P1-T04 and pass there
- **Verify:**
  ```bash
  pnpm typecheck && pnpm check:architecture
  ```

### P1-T04 — `IntakeResume` use case

- **Traces to:** UC-1, UC-21, E-1, E-3, E-4, E-14, X-1, X-12; ADR 0015 §5; RP-1, RP-2, RP-4, RP-5, RP-6, RP-8; Flow 1 steps 1 to 3; edge cases "cannot be parsed", "not in English", "no work history"; principle 5
- **Layer:** Use cases (`packages/use-cases/src/onboarding`) — must not import adapters, delivery, main, `node:*`, any library, or another area
- **Depends on:** P1-T02, P1-T03
- **Size:** M
- **Context:** Replace the stub in `intake-resume.ts`, following the steps in its comment: reject uploads over 10 MB (`UseCaseError` "invalid-input"); call `spending.beforeOnDemand(personId, null, overBudgetConfirmed === true)` (on demand and uncapped, ADR 0015 §5; watch item W8); add `overBudgetConfirmed?: boolean` to `IntakeResumeRequest`; run the remaining steps inside `spend.charge({ personId, runId: null, purpose: "intake" }, ...)` (ADR 0010); store the original (`ResumeFiles`); read text (`DocumentReader`, OCR is the reader's business); stop with `unsupported-language` if not English; structure (`ResumeAnalyst.structure`); select selling points (`selectSellingPoints`); compute Resume Strength (`resumeStrength` on the analyst's ratios, top three fixes from the analyst); save a new `ProfileVersion` (version = previous + 1, preferences from `initialPreferences` on a first intake, kept from the previous version on a re-upload); request the onboarding search; return the card. The card's `proof` is the evidence text the selling point cites. See README "Actors", ADR 0005, ADR 0015.
- **Files:**
  - modify `packages/use-cases/src/onboarding/intake-resume.ts`
  - modify `apps/main/src/compose-matchmaker.ts` (pass `spending`, if P1-T02 did not)
  - modify `packages/testing-api/test/onboarding.test.ts`
- **Acceptance criteria:**
  - [ ] A readable English resume returns `parsed` with 5 to 8 points ordered Signature, Strong, Supporting, each `proof` equal to the cited evidence text, and `resumeStrength` equal to the weighted total of the scripted ratios
  - [ ] A candidate with no "yes" is not on the card; with only three qualifying candidates the card has three
  - [ ] `suggestedSeniority` is the inferred level; with no work history the saved profile targets `["entry"]`
  - [ ] An unreadable document returns `needs-pasted-text` and saves no profile version; a French resume returns `unsupported-language` with `language: "fr"` and requests no search
  - [ ] An upload over 10 MB rejects with code `invalid-input` before anything is stored
  - [ ] A second upload creates version 2, keeps version 1, keeps the preferences of version 1, and both originals remain in `ResumeFiles`
  - [ ] Exactly one search with trigger `onboarding` is requested per successful intake
  - [ ] With the monthly budget reached, intake without confirmation rejects with `monthly-budget-reached` and stores nothing; with `overBudgetConfirmed: true` it proceeds; intake never counts against a daily cap
  - [ ] Intake for an unknown `personId` rejects with `not-found`
  - [ ] The analyst's spend is charged to the person with purpose `intake`, and `unattributedSpendMicros()` stays 0
  - [ ] The scripted analyst receives text, and no model-facing port receives `personal` (ScoringProfile is not involved here; the structured resume's `personal` is stored only on the profile)
- **Verify:**
  ```bash
  node --test packages/testing-api/test/onboarding.test.ts && pnpm verify
  ```

### P1-T05 — `CorrectProfile`: facts and selling points

- **Traces to:** UC-2, UC-7, E-1, RP-7, Flow 7, ADR 0005
- **Layer:** Use cases (`packages/use-cases/src/onboarding`) — same forbidden imports as P1-T04
- **Depends on:** P1-T04
- **Size:** M
- **Context:** Every correction is one rule: a new immutable profile version, then a re-score request (ADR 0005, README "Abstract use cases"). Implement the `fact` and `selling-point` corrections: `fact` replaces the text of one evidence item; `selling-point` replaces one point's statement and keeps its evidence. The `preferences` branch stays `notYetBuilt("PF-1..PF-5: preferences (Phase 3)")`. Unknown person or evidence id → `UseCaseError` "not-found". Corrections spend nothing themselves (the re-score they request is charged by matching), so no guard call here.
- **Files:**
  - modify `packages/use-cases/src/onboarding/correct-profile.ts`
  - modify `packages/testing-api/test/onboarding.test.ts`
- **Acceptance criteria:**
  - [ ] Correcting a fact returns `newVersion` one higher; the old version is unchanged; the active version carries the new text; one re-score is requested
  - [ ] Correcting a selling point changes the card statement and keeps its proof
  - [ ] An unknown evidence id rejects with `not-found` and creates no version
- **Verify:**
  ```bash
  node --test packages/testing-api/test/onboarding.test.ts && pnpm verify
  ```

### P1-T06 — Profile and spending acceptance tests — DONE (built by the Architect, 2026-11-11)

- **Status:** done. Replaces "Account and trial acceptance tests", which the scope revision removed with the trial (ADR 0014). The Architect pinned the replacement behavior while building ADRs 0014 and 0015.
- **Traces to:** UC-16 to UC-21, E-13, E-16, D-2, AB-1 to AB-4 (use-case side), Flow 8
- **Layer:** Tests (`packages/testing-api/test`) — talk only to `MatchmakerTestingApi`
- **What exists:**
  - `packages/testing-api/test/profiles.test.ts`: create, rename, list, open; each profile's results are its own; export holds one person's data; delete removes it and keeps the owner's spend total
  - `packages/testing-api/test/spending.test.ts`: three on-demand searches per profile per day; the budget asks first and pauses monitoring until next month; the running-cost panel per profile for the month
- **Acceptance criteria:**
  - [x] Both files pass through the testing API only
- **Verify:**
  ```bash
  node --test packages/testing-api/test/profiles.test.ts packages/testing-api/test/spending.test.ts
  ```

### P1-T07 — Onboarding controllers and presenters

- **Traces to:** D-3, UC-1, UC-2, Flow 1 step 2, principles 3 and 6 of the shape of encouragement
- **Layer:** Interface adapters (`packages/delivery/src/onboarding`) — must not import rules, adapters, main, `/wiring`, `node:*` or any library
- **Depends on:** P1-T05
- **Size:** M  PARALLEL-OK
- **Context:** Framework-free, like `ResultsController` (ADR 0001 §7). `IntakeController.upload(personId, upload, overBudgetConfirmed?)` (the open profile's id, chosen on screen; there is no authentication, ADR 0014 §5) returns a view model: for `parsed`, a selling-points card (heading "Here is what you are selling", one line per point with a tier label Signature/Strong/Supporting and its proof, Resume Strength as "NN / 100", the three fixes, the suggested level in words); for `needs-pasted-text`, a prompt to paste text; for `unsupported-language`, a plain statement of the English-only limit; for a `monthly-budget-reached` error, an "ask first" view model (the question, and a flag telling the view to resend with `overBudgetConfirmed`; ADR 0015 §5). `CorrectionController` maps a corrected line to the request and returns the refreshed card. Add `delivery/onboarding` to `AREAS` in `components.mjs` (an area within an existing package; record the line in the PR description, no ADR needed for a new area folder unless the Architect says otherwise at Gate 1). Add `intakeScreen` to the testing API and test through it.
- **Files:**
  - create `packages/delivery/src/onboarding/intake-controller.ts`
  - create `packages/delivery/src/onboarding/selling-points-presenter.ts`
  - create `packages/delivery/src/onboarding/onboarding-view-model.ts`
  - modify `packages/delivery/src/index.ts`
  - modify `tools/architecture/components.mjs` (`@matchmaker/delivery` areas: add `onboarding`)
  - modify `apps/main/src/compose-matchmaker.ts` (`controllers.onboarding`)
  - modify `packages/testing-api/src/matchmaker-testing-api.ts`, `packages/testing-api/test/onboarding.test.ts`
- **Acceptance criteria:**
  - [ ] The card view model contains only strings, booleans and enums; tier labels read Signature, Strong, Supporting
  - [ ] Copy describes the resume, never the person (no "you are" sentences in presenter strings)
  - [ ] The unsupported-language view model says English is the only language in v1
  - [ ] A `monthly-budget-reached` refusal becomes the ask-first view model; resending with the flag returns the card
- **Verify:**
  ```bash
  node --test packages/testing-api/test/onboarding.test.ts && pnpm verify
  ```

### P1-T08 — Documents package: read text, DOCX, PDF and LinkedIn PDF

- **Traces to:** A-15, P-3, D9, W2, RP-1, X-6
- **Layer:** Interface adapters (new `packages/documents`) — may import rules, use-cases, `node:*` and its own libraries; must not import delivery, main, testing-api, `/wiring` or `@matchmaker/adapters`
- **Depends on:** P0-T06
- **Size:** L
- **Context:** The first third-party parsing library triggers W2: split it into its own package so Main and tests do not drag it everywhere (CRP). Run `/architect` to record the split (ADR) and update `components.mjs` (new component allowed `rules`, `use-cases`, platform true; add it to Main's and testing-api's allowed lists) and the README component diagram. Implement `DocumentReader.read(upload)` for `text`, `docx`, `pdf` (text layer) and `linkedin-pdf` (text layer, strip LinkedIn's page furniture), returning the text and a detected language. Look up current libraries and their APIs in their documentation (PDF text extraction, DOCX to text, language detection); prefer pure-JavaScript libraries that run on Node 22 without native builds. An image-only PDF returns `unreadable` here (OCR is P1-T09). Add a `documentReaderContract` run against the scripted reader and this adapter with small fixture files you create.
- **Files:**
  - create `packages/documents/package.json`, `packages/documents/tsconfig.json`, `packages/documents/src/index.ts`, `packages/documents/src/reading/document-reader.ts`
  - modify `tools/architecture/components.mjs`, `apps/main/package.json`, `packages/testing-api/package.json`, `pnpm-lock.yaml`
  - create `docs/architecture/adr/00NN-*.md` (by `/architect`, next free number from 0017; 0009 is reserved for P0-T10 and 0010 to 0016 are taken); modify `docs/architecture/README.md`
  - create `packages/testing-api/contract/document-reader.contract.ts`, `packages/testing-api/contract/document-reader.contract.test.ts`, `packages/testing-api/contract/fixtures/` (`resume.pdf`, a one-page resume with a text layer; a DOCX, a text file, a French text file, an image-only PDF)
  - modify `apps/main/src/main.dev.ts` (dev configuration uses the real reader)
- **Acceptance criteria:**
  - [ ] Each fixture's known sentence appears in the extracted text; English fixtures report `en`, the French one `fr`
  - [ ] The image-only PDF returns `unreadable`; a corrupt file returns `unreadable` rather than throwing
  - [ ] `pnpm metrics` shows the new component and no new SDP warning involving it
- **Verify:**
  ```bash
  pnpm test:contract && pnpm metrics && pnpm verify
  ```

### P1-T09 — OCR for image-only PDFs

- **Traces to:** A-15, RP-3 (P1 priority), edge case "Resume cannot be parsed"
- **Layer:** Interface adapters (`packages/documents`) — same forbidden imports as P1-T08
- **Depends on:** P1-T08, P0-T10 (S-1 says whether the model runtime reads images within the time budget)
- **Size:** M
- **Context:** When the text layer is empty, run OCR; if OCR yields too little text, return `unreadable` so the use case asks for pasted text (exists). Choose an in-process OCR library (look up current options; must run on Node 22 without a native build) unless ADR 0009 (written in P0-T10) assigns OCR to the model runtime. Record the time per page; the NFR is the selling-points card within 20 seconds of upload.
- **Files:**
  - modify `packages/documents/src/reading/document-reader.ts`; create `packages/documents/src/reading/ocr.ts`
  - modify `packages/testing-api/contract/document-reader.contract.ts` (image-only case now reads)
  - modify `packages/documents/package.json`, `pnpm-lock.yaml`
- **Acceptance criteria:**
  - [ ] The image-only fixture now returns `read` with its known sentence
  - [ ] A blank image PDF returns `unreadable`
  - [ ] PROGRESS.md Notes records OCR seconds per page on the fixture
- **Verify:**
  ```bash
  pnpm test:contract && pnpm verify
  ```

### P1-T10 — Model runtime package, configuration loader and the resume analyst

- **Traces to:** A-7, P-4, X-2, X-9, X-12, D1, ADR 0003, ADR 0009 (written in P0-T10), ADR 0016 §5, RP-2, RP-4, RP-5, RP-6
- **Layer:** Interface adapters (`@matchmaker/model-runtime-claude-code`, ADR 0009 decision 2) and Main (`apps/main/src/config.ts`) — the adapter must not import delivery, main, testing-api or `/wiring`; nothing inside use-cases or rules may name a model, vendor or prompt
- **Depends on:** P0-T10 (Gate 0B), H-2, P1-T04
- **Size:** L
- **Context:** Real resume parsing. Create the model-runtime package per ADR 0009 (components entry, manifests; the ADR already covers it). Implement `ResumeAnalyst`: `structure(text)` (roles with employer, title, start and end month, achievements as evidence items with stable ids, skills with evidence ids, credentials, languages, inferred seniority on the ladder, personal details only in `personal`), `sellingPointCandidates` (the three tier questions answered per candidate, citing an evidence id), `strengthRatios` (five component ratios and the three fixes that would raise the score most). Use structured output against schemas; use the `claude-api` skill for current SDK usage if the runtime is the Messages API. Main gets a typed configuration loader for the owner's local configuration (environment variables or a gitignored local file; no secrets store, ADR 0016 §5): each configuration declares what it needs, such as the owner's API key or the Claude Code subscription session as ADR 0009 says, and fails at start with a message listing what is missing. The credential goes to the adapters' constructors and never into use cases. Add `resumeAnalystContract`: every id a role, skill or candidate cites exists in `evidence`; months are `YYYY-MM`; ratios are within 0 to 1. Run it against the scripted analyst and against this adapter with a recorded response (no network in `pnpm verify`).
- **Files:**
  - create `packages/model-runtime-claude-code/` per ADR 0009 decision 2 (`package.json`, `tsconfig.json`, `src/index.ts`, `src/headless/` for the CLI runner, `src/onboarding/resume-analyst.ts` and its schema), and apply the `components.mjs` entry and areas the ADR gives
  - create `apps/main/src/config.ts`
  - modify `apps/main/src/main.dev.ts`, `apps/main/package.json`, `pnpm-lock.yaml`
  - create `packages/testing-api/contract/resume-analyst.contract.ts`, `packages/testing-api/contract/resume-analyst.contract.test.ts`, `packages/testing-api/contract/fixtures/analyst-recorded-response.json`
- **Acceptance criteria:**
  - [ ] The contract suite passes for the scripted analyst and for the adapter on the recorded response
  - [ ] The adapter receives a `SpendMeter` in its constructor and records one `model` spend per call, priced from Main configuration (or as ADR 0009 says for subscription calls: estimate or zero), before parsing the response; the contract checks it (ADR 0010, 0015)
  - [ ] Starting the dev configuration without the credential prints the missing setting names and exits 1; with it, starts
  - [ ] `.gitignore` covers the local configuration file; `git check-ignore` confirms it
  - [ ] `grep` finds no model name, vendor name or prompt text under `packages/use-cases` or `packages/rules`
  - [ ] Main refuses to start a model-calling configuration until the training-off confirmation is set (ADR 0009 decision 7, Privacy 4); the owner's H-2 confirmation date is in PROGRESS.md Notes
  - [ ] Confirmed against current Claude Code docs, and recorded in PROGRESS.md: the sign-in status command that makes no model call, and the flag that keeps user-level CLAUDE.md, hooks and plugins out of calls (ADR 0009 hand-off)
- **Verify:**
  ```bash
  pnpm test:contract && pnpm verify && ! grep -rniE "claude|anthropic|prompt|temperature" packages/use-cases/src packages/rules/src
  ```

### P1-T11 — Parsing evaluation (the Phase 1 exit test)

- **Traces to:** X-5, A-7, A-15, UC-1, RP-2; PRD release plan Phase 1 exit; NFR "selling-points card within 20 seconds"
- **Layer:** Main (`apps/main/eval/parsing`) — must not import testing-api
- **Depends on:** P0-T07, P1-T10, H-3, H-4
- **Size:** M
- **Context:** Compose the real reader and analyst with in-memory storage, run `IntakeResume` on each resume in `apps/main/eval/fixtures/private/resumes/` (gitignored; supplied by H-3), and compare the saved profile with `<id>.expected.json` (roles: employer, title, start, end; skills). Normalize case, whitespace and month format before comparing. Thresholds come from H-4 (default assumption: every role exact for every resume; skills precision and recall at least 0.9 per resume). Draft each expected file by reading the resume yourself, then have the user review them (H-3); never generate ground truth with the adapter under test. The report lists, per resume, the mismatches and the seconds from upload to card.
- **Files:**
  - create `apps/main/eval/parsing/parsing.eval.ts`
  - create `apps/main/eval/parsing/compare.ts`
  - create `apps/main/eval/parsing/README.md` (fixture layout, expected-file schema, how to add a resume)
- **Acceptance criteria:**
  - [ ] `pnpm eval parsing` runs all 20 resumes and writes a report
  - [ ] The report's verdict is pass when all 20 meet the thresholds; it names each failing field otherwise
  - [ ] The report shows the median and maximum seconds to card
- **Verify:**
  ```bash
  pnpm eval parsing
  ```

### P1-T12 — Dev intake driver

- **Traces to:** D-10, D-3, UC-1, Flow 1 steps 1 to 3
- **Layer:** Main (`apps/main/src/main.dev.ts`) — must not import testing-api
- **Depends on:** P1-T07, P1-T10
- **Size:** S
- **Context:** The demo a non-engineer can run before the web exists: `pnpm dev intake <path-to-resume> [--profile <name>]` creates (or reuses by name) a dev profile through `CreatePerson` and `ListPeople`, opens it, uploads the file through `IntakeController`, prints the selling-points card view model in readable form, and prints the elapsed seconds. The onboarding search is requested and will fail in the background until Phase 2 (planner not built); print one line saying so instead of a stack trace.
- **Files:**
  - modify `apps/main/src/main.dev.ts`
  - modify `package.json` (script `dev`)
  - modify `apps/main/test/smoke.test.ts` (driver prints usage with no path)
- **Acceptance criteria:**
  - [ ] `pnpm dev intake <a fixture>` prints a card with 5 to 8 points, a Resume Strength out of 100, three fixes, a suggested level, and the elapsed time
  - [ ] `pnpm dev intake` with no path prints usage and exits 2
- **Verify:**
  ```bash
  pnpm dev intake packages/testing-api/contract/fixtures/resume.pdf && pnpm verify
  ```

### SPIKE S-2 — Where does the initial Tier 1 company registry come from?

- **Question:** Which public sources list employers per ATS (Greenhouse, Lever, Ashby, Workable, SmartRecruiters, Recruitee) with their board identifiers, under terms that allow use, and how many companies can be seeded? Check whether the current Tier 2 sources' links already reveal ATS-hosted postings (the registry growth path in ADR 0004 §7).
- **Time box:** One session
- **Feeds decision:** H-5 (PRD open question 6); the seed list and format for P2-T05 to P2-T07
- **Deliverable:** a short written answer appended to PLAN.md "Spike answers"; code on a throwaway branch, not merged.

### P1-T13 — Selling-points card within 20 seconds (added 2026-11-12)

- **Traces to:** NFR "selling-points card within 20 seconds", ADR 0009 (review trigger: the 20 s card), RP-2
- **Layer:** Interface adapters (`@matchmaker/model-runtime-claude-code`, `onboarding/`) — no port changes
- **Depends on:** P1-T11
- **Size:** M
- **Context:** The P1-T11 run took a median of 32.8 s and a maximum of 56.4 s to card. The `structure` call writes about 7,700 output tokens (about 2,900 thinking) for the longest resume, about 42 s. Citing line ranges and `--effort low` did not help. Split the work the analyst does into calls that run in parallel inside the adapter (for example roles and evidence in one call, skills in another), keeping the `ResumeAnalyst` port unchanged, and measure.
- **Acceptance criteria:**
  - [ ] `pnpm eval parsing` still passes the H-4 thresholds on the six resumes
  - [ ] Median seconds to card under 20 in the cloud session; PROGRESS.md records median and maximum
  - [ ] The analyst contract passes on newly recorded envelopes (fictional sample)
- **Verify:**
  ```bash
  pnpm test:contract && pnpm verify && pnpm eval parsing
  ```

## Gate 1

- **Exit criteria:**
  - [ ] Full suite green: `pnpm verify`
  - [ ] Boundary check green: `pnpm check:architecture && pnpm metrics` (no new SDP warning)
  - [ ] Phase acceptance tests green: `node --test packages/testing-api/test/onboarding.test.ts packages/testing-api/test/profiles.test.ts packages/testing-api/test/spending.test.ts`
  - [ ] **PRD exit test:** `pnpm eval parsing` passes on the 20 resumes with the H-4 thresholds
- **Demo:**
  ```bash
  pnpm dev intake <one of your own resumes>
  ```
  Expected: a selling-points card with tiered points and proofs, Resume Strength out of 100, three fixes, a suggested level, and the seconds it took (target under 20).
- **Human checkpoint:** Read three cards: are the points ones you would lead with, and is the copy about the resume, not the person? Decide whether initial preferences that never invent work authorization (the onboarding search then fails the authorization gate for jobs that require it, until preferences are saved: use-case side in P2-T15, screens in Phase 3) is acceptable. Confirm S-2's answer (H-5) and that H-6 has started. Review `deferred.md` (W2 after the package splits).
- **Detail next phase:** Phase 2 is already detailed; re-check it against what Phase 1 taught (model latency, cost per call) and amend.
