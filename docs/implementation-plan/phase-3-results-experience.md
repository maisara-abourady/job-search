# Phase 3: Results experience

Goal: Real people sign up on the web, upload a resume, answer four preference screens and a short interview, and see their Apply, Within reach and Not a fit tabs stream in, with job detail, Not a fit reports, the gap insight and Fix a fact. **Exit test (PRD): five test users reach a first Apply verdict in under 10 minutes.**
Detail level: Outline — detail at Gate 2, using S-3's answer
Traces to: UC-2, UC-3, UC-7, UC-8, UC-10, UC-11, UC-12, E-15, P-5, P-6, P-8, P-22, A-12, A-16b, A-22, A-26, A-27, D-4, D-5, D-8, X-7, X-10; PRD PF-1 to PF-5, IN-1 to IN-5, MR-5 to MR-8, NF-1 to NF-6, RP-7, Flows 1 to 3, 5, 7; NFRs on first result, devices, accessibility; D2, D5, D6, D8, D10
Prerequisites: Gate 2 passed; S-3 answered; H-8 provisioned; H-9 five consenting test users; open questions 4 and 5 (PLAN.md) answered by `/architect` (ADR 0010, 0011, 0012).

## Tasks (outline)

### P3-T01 — Preference screens' use-case support and inferred defaults (PF-5)
- **Traces to:** UC-2, E-14, D-4 · **Size:** S
- **Acceptance:** A preferences view request returns the four screens with inferred defaults pre-selected (suggested band, latest role's location, work modes from history); one tap saves through `CorrectProfile` (P2-T15).

### P3-T02 — `ConductInterview` use case (IN-1 to IN-4) with scripted interviewer
- **Traces to:** UC-3, P-5, P-8, E-1 · **Size:** M
- **Acceptance:** 5 to 7 questions, each skippable; ending early is allowed; each confirmed answer becomes `interview-answer` evidence in a new profile version; finishing requests one re-score; new graduates get projects and education topics; career changers get "target field". Interviewer spend is charged with purpose `interview` (ADR 0010); Main wires it wrapped in a new `MeasuredConductInterview` emitting `interview-finished` with the answered count (ADR 0011).

### P3-T03 — Interviewer adapter (watch W7) and reopen the interview (IN-5)
- **Traces to:** A-12, P-5, IN-5, W7 · **Size:** M
- **Acceptance:** Contract suite passes on scripted and recorded responses; reopening adds questions without repeating answered topics; one `model` spend recorded per call through `SpendMeter` (ADR 0010). If the stateless port causes measurable latency or cost, stop and take W7 to `/architect`.

### P3-T04 — Points lost and "what would change this verdict" (E-15)
- **Traces to:** E-15, E-9, E-10, NF-3 parts 5 and 6, shape of encouragement 4 · **Size:** S
- **Acceptance:** The three largest deductions are ranked by Fit points lost; gaps split into closable and not closable; when nothing is closable the report says plainly that nothing in the user's control would change the verdict.

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

### P3-T08 — `@matchmaker/storage-postgres` (D2) with migrations, encryption and the flag store (D10)
- **Traces to:** A-22, A-26, X-7, X-10, every storage port · **Size:** L
- **Acceptance:** Every storage contract suite (P0-T06 onward) passes against Postgres in CI (service container), including `jobDetail` (ADR 0012), `applySubscriptionEvent` with a unique event-id key and one transaction, concurrent duplicate applied once (ADR 0013), and `SpendLedger` (ADR 0010); migrations run forward from empty; resume and profile data encrypted at rest; recorded as an ADR via `/architect` (W2, D2). Split into two L tasks at Gate 2 if needed (write side; read model and switchboard).

### P3-T09 — Encrypted object storage for resume files (D8)
- **Traces to:** A-16b, P-6, X-7, RP-8 · **Size:** M
- **Acceptance:** `ResumeFiles` contract passes against the object store; every version kept; objects encrypted at rest.

### P3-T10 — `apps/web` skeleton: framework, authentication (email and Google), route handlers as humble objects (D5, D6)
- **Traces to:** D-8, UC-16, AB-1 · **Size:** L
- **Acceptance:** Sign-up with email and with Google creates an account and starts the trial; route handlers authenticate, call controllers from `composeMatchmaker`, serialize view models, and hold no policy; an ADR via `/architect` records D5 and D6; `apps/web` added to `components.mjs` as a Main.

### P3-T11 — Onboarding screens (upload, selling-points card, four preference screens, interview)
- **Traces to:** D-3, D-4, D-8, Flow 1 · **Size:** M
- **Acceptance:** One decision per screen; the search starts when the resume parses; the card renders within 20 seconds of upload on the staging environment.

### P3-T12 — Results tabs with streaming (`ResultsFeed` over SSE), job detail and Not a fit screens
- **Traces to:** A-27, D-1, D-5, D-8, Flows 2, 3, 5, MR-6, MR-7 · **Size:** L
- **Acceptance:** Cards appear while scoring continues, and the screen obtains its cards through `ListResults` so `apply-verdict-shown` is measured (ADR 0011; if not, take watch item W11 to `/architect` first); first scored job on screen within 60 seconds of profile completion; Mark applied and Dismiss work; the selling-points card is one tap away on every screen.

### P3-T13 — Accessibility and phone layout pass
- **Traces to:** NFR Devices, Accessibility · **Size:** M
- **Acceptance:** Automated WCAG 2.1 AA checks pass on every screen; every flow is usable at phone width.

### P3-T14 — North-star read for the operator, and the product-events destination (D14)
- **Traces to:** PRD Metrics, ADR 0010, ADR 0011, P-32, P-33, A-30 · **Size:** M
- **Context:** Events are already emitted (`signed-up`, `apply-verdict-shown`, `job-marked-applied`, `subscription-activated`). Decide D14 through `/architect` (own table in `storage-postgres` is the default). Add a read port in the measurement area and an operator use case returning time to first strong match per user and the median, plus spend per active user for the month from `SpendLedger.spentBy` (S-6).
- **Acceptance:** Time from sign-up to first Apply on screen is recorded per user and readable by the operator; events survive a restart on staging; no event carries resume, profile or job text.

### P3-T15 — Staging deployment and the five-user test
- **Traces to:** Gate 3 · **Size:** M
- **Acceptance:** Five test users (H-9) complete onboarding on staging; each user's time to first Apply is recorded; the report lists the median and every user's time.

### SPIKE S-4 — Which three ATS parsers for the Phase 4 exit? (see PLAN.md)
### SPIKE S-6 — Cost model per active user (see PLAN.md)

## Gate 3

- **Exit criteria:**
  - [ ] `pnpm verify` green, including contract suites against Postgres
  - [ ] `pnpm check:architecture && pnpm metrics` green
  - [ ] Testing-API acceptance tests for every Phase 3 use case green
  - [ ] **PRD exit test:** five test users reach a first Apply verdict in under 10 minutes each (P3-T15 report)
- **Demo:** sign up on staging with a fresh account and reach the first Apply card.
- **Human checkpoint:** Watch one test user's session. Review the S-4 and S-6 answers; confirm H-12, H-14, H-15 and H-16 have started. Review `deferred.md` (W4 reasons, W7 interview, W9 read model).
- **Detail next phase:** expand Phase 4 to full task specs.
