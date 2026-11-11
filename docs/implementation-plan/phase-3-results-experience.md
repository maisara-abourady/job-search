# Phase 3: Results experience

Goal: On the owner's machine, the owner opens the local web app, creates or picks a person's profile, uploads that person's resume, answers four preference screens and a short interview, and sees the Apply, Within reach and Not a fit tabs stream in, with job detail, Not a fit reports, the gap insight and Fix a fact. **Exit test (PRD): five test users reach a first Apply verdict in under 10 minutes.**
Detail level: Outline — detail at Gate 2, using S-3's answer
Traces to: UC-2, UC-3, UC-7, UC-8, UC-10, UC-11, UC-12, UC-16, UC-17, UC-21, E-15, P-2, P-5, P-6, P-8, P-11, P-22, P-29, P-30, P-31, P-33, A-12, A-16b, A-22, A-26, A-27, A-30, A-31, D-4, D-5, D-8, D-11, M-3, X-7, X-10, X-13; PRD PF-1 to PF-5, IN-1 to IN-5, MR-5 to MR-8, NF-1 to NF-6, RP-7, AB-1, AB-2, AB-5, Flows 1 to 3, 5, 7; NFRs on first result, devices, accessibility; D2, D5, D8, D10, D14; watch W11, W15
Prerequisites: Gate 2 passed; S-3 answered; H-9 five consenting test users lined up.

Amended 2026-11-11 for the scope revision (ADRs 0014 to 0016): no sign-up, authentication, hosting or staging. The app runs on the owner's machine, bound to `127.0.0.1`, with the local-request check before every handler; storage is a local database and a data folder with no application-level encryption; a minimal profile picker replaces sign-up; product events are stored locally (D14 decided).

## Tasks (outline)

### P3-T01 — Preference screens' use-case support and inferred defaults (PF-5)
- **Traces to:** UC-2, E-14, D-4 · **Size:** S
- **Acceptance:** A preferences view request returns the four screens with inferred defaults pre-selected (suggested band, latest role's location, work modes from history); one tap saves through `CorrectProfile` (P2-T15).

### P3-T02 — `ConductInterview` use case (IN-1 to IN-4) with scripted interviewer
- **Traces to:** UC-3, UC-21, P-5, P-8, E-1, X-12 · **Size:** M
- **Acceptance:** 5 to 7 questions, each skippable; ending early is allowed; each confirmed answer becomes `interview-answer` evidence in a new profile version; finishing requests one re-score; new graduates get projects and education topics; career changers get "target field". Calls `SpendingGuard.beforeOnDemand(personId, null, overBudgetConfirmed)` (on demand, uncapped; ADR 0015 §5) and rejects `monthly-budget-reached` without confirmation. Interviewer spend is charged with purpose `interview` (ADR 0010); Main wires it wrapped in a new `MeasuredConductInterview` emitting `interview-finished` with the answered count (ADR 0011). The transcript store implements `PersonDataVault` and joins the configuration's `JsonArchiveVault`.

### P3-T03 — Interviewer adapter (watch W7) and reopen the interview (IN-5)
- **Traces to:** A-12, P-5, IN-5, W7 · **Size:** M
- **Acceptance:** Contract suite passes on scripted and recorded responses; reopening adds questions without repeating answered topics; one `model` spend recorded per call through `SpendMeter` (ADR 0010, priced as ADR 0009 says). If the stateless port causes measurable latency or cost, stop and take W7 to `/architect`.

### P3-T04 — Points lost and "what would change this verdict" (E-15)
- **Traces to:** E-15, E-9, E-10, NF-3 parts 5 and 6, shape of encouragement 4 · **Size:** S
- **Acceptance:** The three largest deductions are ranked by Fit points lost; gaps split into closable and not closable; when nothing is closable the report says plainly that nothing in the person's control would change the verdict.

### P3-T05 — Job detail presenter and view model (MR-5, MR-8) over the existing `ViewJobDetail`
- **Traces to:** UC-10, P-23, D-5, ADR 0012 · **Size:** S
- **Context:** The port change and the interactor exist (ADR 0012: `ResultsReadModel.jobDetail`, evidence from the match's own profile version; tests in `packages/testing-api/test/job-detail.test.ts`). This task adds `delivery/results` presenter and view model, a `jobDetail` controller method, and a testing-API `jobDetailScreen`.
- **Acceptance:** Detail shows verdict and reason first, three points linked to evidence text, gaps marked closable or not, the collapsed breakdown and the requirement table; every value on screen is a string, flag or enum in the view model.

### P3-T06 — `ReviewNotAFit` (NF-1 to NF-4) and the seven-part report
- **Traces to:** UC-11, E-15, D-5 · **Size:** M
- **Acceptance:** Counts by primary reason; jobs grouped by reason; gap insight shows the five most frequent Missing requirements with jobs blocked; prefilter cuts get the short report with parts 1 and 7 and a Run full analysis action; exact duplicates and expired postings are not listed.

### P3-T07 — Fix a fact end to end (NF-5) and `RescoreAll` judgment reuse; `RunFullAnalysis` supersedes the cut (NF-6)
- **Traces to:** UC-2, UC-7, UC-8 · **Size:** M
- **Acceptance:** Correcting a fact from a report re-scores every stored job and flags changed verdicts; requirement judgments whose requirement and cited evidence are unchanged are reused (fewer judge calls, same verdicts); full analysis replaces a Low-relevance match with a scored one.

### P3-T08 — Local database adapter (D2) with schema versioning and the switch store (D10)
- **Traces to:** A-22, A-26, A-30, X-7, X-10, P-2, P-29, P-30, P-31, P-32, every storage port, ADR 0014 §4, ADR 0016 §6 · **Size:** L
- **Acceptance:** A new package (`@matchmaker/storage-sqlite` on Node's built-in `node:sqlite` by default; Postgres with pgvector only if P2-T13 showed embeddings need it) stores the database file in the data folder chosen by Main configuration. Every storage contract suite (P0-T06 onward) passes against it in `pnpm test:contract` with a temporary file, including `jobDetail` (ADR 0012), `People`, `MonitoringRoster`, `MonthlyBudgetControl`, `UsageLedger`, `SpendLedger.totalSpent` (ADR 0010, 0015), `SourceSwitchboard` returning null for a never-switched source (ADR 0016 §4), and `PersonDataVault` (erase leaves nothing of the person; spend records kept with `personId` null). The schema version is stored in the file and forward-only migrations run at start from empty and from the previous version. No application-level encryption (Privacy 1 relies on disk encryption). Recorded as an ADR via `/architect` (W2, D2; next free number from 0017). Split into two L tasks at Gate 2 if needed (write side; read model, roster and switchboard).

### P3-T09 — Resume files in the owner's data folder (D8)
- **Traces to:** A-16b, P-6, P-31, X-7, RP-8 · **Size:** M
- **Acceptance:** `ResumeFiles` and `PersonDataVault` contracts pass against a folder adapter on a temporary directory; every version kept; the data folder location comes from Main configuration (default under the owner's home directory, D8); erase removes that person's files and nothing else.

### P3-T10 — `apps/web`, the local web Main: framework, loopback only, local-request check, profile picker, ticker (D5)
- **Traces to:** D-8, D-11, M-3, A-31, UC-16, UC-17, AB-1, AB-5, ADR 0016 §2, §3, W15 · **Size:** L
- **Acceptance:** The server binds `LOOPBACK_BIND_ADDRESS` only; `acceptsLocalRequest` runs in the framework's single request hook (S-3), so no route can skip it (W15); a web-level test sends a foreign `Host` and a foreign `Origin` to every route, including the framework's own endpoints, and each is refused. Route handlers are humble objects calling controllers from `composeMatchmaker` and serializing view models. A minimal profile picker lists profiles (`ListPeople`), creates one (`CreatePerson`) and opens one (`OpenPerson`); the open profile's id travels with each request; there is no login. This Main composes the local database (P3-T08) and data folder (P3-T09) into its `JsonArchiveVault`, reads the owner's credential through the configuration loader (P1-T10), and starts `IntervalTicker` with `keepProcessAlive: true` (catch-up tick at start). An ADR via `/architect` records D5; `apps/web` is added to `components.mjs` as a Main.

### P3-T11 — Onboarding screens (upload, selling-points card, four preference screens, interview)
- **Traces to:** D-3, D-4, D-8, Flow 1 · **Size:** M
- **Acceptance:** Flow 1 starts from the profile picker; one decision per screen; the search starts when the resume parses; the card renders within 20 seconds of upload on the owner's machine; `daily-cap-reached` and `monthly-budget-reached` refusals show as plain messages (the ask-first confirmation is P6-T04).

### P3-T12 — Results tabs with streaming (`ResultsFeed` over SSE on localhost), job detail and Not a fit screens
- **Traces to:** A-27, D-1, D-5, D-8, Flows 2, 3, 5, MR-6, MR-7, W11 · **Size:** L
- **Acceptance:** Cards appear while scoring continues, and the screen obtains its cards through `ListResults` so `apply-verdict-shown` is measured (ADR 0011; if not, take watch item W11 to `/architect` first); first scored job on screen within 60 seconds of profile completion; Mark applied and Dismiss work; the selling-points card is one tap away on every screen; the SSE endpoint is behind the same local-request hook.

### P3-T13 — Accessibility and responsive layout pass
- **Traces to:** NFR Devices (a browser on the owner's macOS, Windows or Linux machine; responsive layout), Accessibility · **Size:** M
- **Acceptance:** Automated WCAG 2.1 AA checks pass on every screen; every flow is usable at narrow and wide browser widths.

### P3-T14 — North-star read for the owner, and the local product-events store (D14)
- **Traces to:** PRD Metrics, ADR 0011, ADR 0014 §6, ADR 0016 §6, P-33, A-30, X-13 · **Size:** M
- **Context:** Events are already emitted (`profile-created`, `apply-verdict-shown`, `job-marked-applied`). D14 is decided: events are stored locally by the storage adapter, never a vendor (Privacy 1). Add the events table to the local database, a read port in the measurement area and a use case returning time to first strong match per profile and the median. Cost per profile is already `ViewRunningCost` (ADR 0015 §7); do not duplicate it.
- **Acceptance:** Time from profile creation to first Apply on screen is recorded per profile and readable by the owner; events survive a restart of the local app; erase removes a deleted profile's events; no event carries resume, profile or job text.

### P3-T15 — The five-user test on the owner's machine
- **Traces to:** Gate 3, H-9 · **Size:** M
- **Acceptance:** Five test users (H-9), each with their own profile, complete onboarding on the owner's machine with the owner operating; each profile's time to first Apply is read from P3-T14; the report lists the median and every profile's time.

### SPIKE S-4 — Which three ATS parsers for the Phase 4 exit? (see PLAN.md)
### SPIKE S-6 — Running-cost model per profile (see PLAN.md)

## Gate 3

- **Exit criteria:**
  - [ ] `pnpm verify` green, including contract suites against the local database and the data folder
  - [ ] `pnpm check:architecture && pnpm metrics` green
  - [ ] Testing-API acceptance tests for every Phase 3 use case green; the web-level foreign-Host and foreign-Origin test green on every route
  - [ ] **PRD exit test:** five test users reach a first Apply verdict in under 10 minutes each (P3-T15 report)
- **Demo:** start the local app, create a fresh profile in the picker, upload a resume and reach the first Apply card; restart the app and see the profile and its results still there.
- **Human checkpoint:** Watch one test user's session. Review the S-4 and S-6 answers; confirm H-11, H-12 and H-16 have started; answer PLAN.md open question 1 (Tier 4 boards) if not yet done. Review `deferred.md` (W4 reasons, W7 interview, W9 read model, W11, W15; D4 triggers: did a full run make the UI unresponsive?).
- **Detail next phase:** expand Phase 4 to full task specs.
