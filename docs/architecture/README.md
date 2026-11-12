# AI Job Matchmaker: architecture

Requirements: [`docs/prd.md`](../prd.md), the product requirements document (requirement IDs and the six-phase release plan).

AI Job Matchmaker reads a job seeker's resume, interviews them briefly, searches every reachable job source, and gives every job one verdict: **Apply**, **Within reach** (Stretch), or **Not a fit**. Each verdict comes with its reasons, evidence, and the single change that would move it. It tailors a resume per job without inventing anything and watches the market while it runs.

It is a **personal tool that runs only on the owner's machine**. The owner uses it for their own search and keeps one profile per friend they help. There is no sign-up, login, trial, billing or hosting. The owner pays the model and aggregator bills, so spend is shown per profile and bounded by daily caps and an optional monthly budget.

This document describes the system as it is now. Decisions and their reasons are in `adr/`. Decisions not yet made, and boundaries being watched, are in `deferred.md`.

## Actors and their use cases

An actor is a group that asks for the same kind of change (§3.2). Each use case below is a file under `packages/use-cases/src/<area>/`. "The job seeker" is the person whose profile is open; the owner operates the app on their behalf.

| Actor | Area | Use cases | PRD |
|---|---|---|---|
| Job seeker (active and passive) | onboarding | `IntakeResume`, `CorrectProfile` (facts, preferences, selling points, Fix a fact), `ConductInterview` | RP, PF, IN, NF-5, Flows 1, 7 |
| Job seeker, scheduler | discovery | `RunJobSearch` (onboarding, manual, scheduled), `RecheckStoredPostings` | DS, Flows 1, 6 |
| Matching-policy owner (strictness, calibration) | matching | `ScoreJobs`, `RescoreAll`, `RunFullAnalysis` | MR-1..6, NF-5, NF-6, MN-2 |
| Job seeker | results | `ListResults`, `ViewJobDetail`, `ReviewNotAFit` (with gap insight), `RecordJobDecision` | MR-3..8, NF-1..4, Flows 2, 3, 5 |
| Job seeker | tailoring | `TailorResume` (missing keywords, generate, export) | TR, Flow 4 |
| Scheduler, passive seeker | monitoring | `RunDueMonitoring` (catch-up at start, then on a timer), `ViewInbox` | MN, Flow 6 |
| Owner, managing the people they help | profiles | `CreatePerson`, `RenamePerson`, `ListPeople`, `OpenPerson`, `ExportPersonData`, `DeletePerson` | AB-1, AB-2, AB-4, Flow 8, Privacy 2 |
| Owner, paying the bills | spending | `ViewRunningCost`, `SetMonthlyBudget`; the `SpendingGuard` in `shared` enforces daily caps and the budget | AB-3, Running cost |
| Owner, as sourcing operator | operations | `OperateSources` (switches, Tier 4 on per board, run summaries with each run's cost) | Scraping safeguards, DS-7, SearchRun cost |
| Owner, checking the product works | measurement | No use cases of its own. Decorators over other areas' input ports emit product events (ADR 0011) | Metrics table, north star |

**Abstract use cases** (§12.4):
- `RunJobSearch` serves all three triggers (onboarding, manual, scheduled).
- `ScoreJobs` serves new postings, re-scoring after profile changes, and full analysis.
- Every profile change, whether a fact, a preference, an interview answer or a new resume, is one rule: a new immutable profile version, then `RescoreAll` (ADR 0005).
- Every cost-incurring action passes the same spending guard: on demand (capped or not, may be confirmed past the budget) or in the background (pauses at the budget) (ADR 0015).

## Critical Business Rules (Entities)

These are in `packages/rules/src/`. They would hold for a career coach working by hand.

- **profile/**
  - `Person`: a profile the owner keeps, keyed by `personId` (ADR 0014).
  - Profile versions, evidence, preferences.
  - `ScoringProfile`: the fairness-stripped, compiler-branded view.
  - Selling-point tiers.
  - Resume Strength weights.
- **jobs/**
  - The common job schema.
  - Duplicate identity.
  - Merging source links.
- **matching/**
  - Hard gates.
  - The evidence rule (no citation means Missing).
  - Fit, Confidence, Job Quality.
  - Verdict, primary reason, priority.
  - Distance to Apply and the biggest lever.

  These are implemented and pure (ADR 0002).
- **tailoring/**
  - ATS keyword coverage.
  - The tailoring guard ("what tailoring never changes", "nothing is invented"; ADR 0007).
- **spending/**
  - The owner's monthly budget and its status for a calendar month (ADR 0015).

Application-specific policy lives in the owning use case, not in the rules: prefilter cap, widening threshold, source timeout, Tier 4 off until switched on (`SOURCE_POLICY`), daily caps (`DAILY_CAPS`), monitoring interval and 14-day unopened pause, interview length.

## Components and circles

```
                 +--------------------+
                 | @matchmaker/rules  |   circle 1  Entities          I=0.00 A=0.00 D=1.00 (watch W1)
                 +--------------------+
                           ^
                 +----------------------+
                 | @matchmaker/use-cases|  circle 2  Use cases + ports  I=0.52 A=0.43 D=0.05
                 +----------------------+
                  ^          ^          ^
   +--------------------+ +--------------------+ +------------------------------+
   | @matchmaker/       | | @matchmaker/       | | @matchmaker/scraping-sources |  circle 3-4
   | delivery           | | adapters           | | (Tier 4, off by default)     |
   | controllers,       | | in-memory store,   | +------------------------------+
   | presenters,        | | spend meter,       |
   | view models,       | | model runtime,     |
   | local-request check| | Tier 1-3 sources,  |
   +--------------------+ | narration, work    |
              ^           | queue and ticker,  |
              |           | data export, clock |
              |           +--------------------+
              |                    ^
           +----------------------------+
           | @matchmaker/main (apps/main)|  circle 4  Main: composeMatchmaker + one file per configuration
           +----------------------------+
                        ^
           +----------------------------+
           | @matchmaker/testing-api    |  tests: a Main configuration with superpowers
           +----------------------------+
```

Every arrow points toward higher-level policy. Instability decreases along every arrow, and the graph has no cycles: `pnpm metrics` reports this and `pnpm check:architecture` enforces it.

- `delivery` depends only on `use-cases`; it never sees an Entity.
- `adapters` and `scraping-sources` depend on `use-cases` and `rules`.
- Nothing depends on `main` except the testing API. Nothing depends on the testing API.
- **Planned (ADR 0009, created by P1-T10):** `@matchmaker/model-runtime-claude-code`, circle 3-4, which may import `rules` and `use-cases`. Main and the testing API's contract suites depend on it. Its areas are `headless` (the humble CLI runner) and one area per use-case area it serves (`onboarding`, `discovery`, `matching`, `tailoring`), each of which may import only `headless`. `@matchmaker/adapters` gains the area `relevance`. `UnchosenModelRuntime` is deleted once every model port has its adapter.

## Boundaries

| Boundary | Kind | Full or partial | Crossing |
|---|---|---|---|
| Rules and use cases | Package (source-level) | Full: no imports from rules outward; the compiler cannot even resolve them | Function calls; Entities passed in, decisions returned |
| Use cases and delivery | Package | Full: input ports and plain request/response models owned by use cases; types-only surface; interactors only via `/wiring` for Main | Controller calls input port; query use cases return response models; streaming via the `ResultsFeed` output port; presenters build view models of strings, flags and enums. "Ask first" past the budget is an error code plus `overBudgetConfirmed` in the next request (ADR 0015) |
| Use cases and storage | Package | Full: gateways per area, named for the need, implemented by `InMemoryStore` (later a local database, D2). Examples: `ResultsReadModel.jobDetail` returns evidence text from the match's own profile version (ADR 0012); `People.recordOpened`; `MonitoringRoster.peopleWithMonitoringOn` | Entities and plain records in and out; never rows |
| Use cases and a person's data across stores | Package | Full: `PersonDataVault` owned by `profiles`, implemented by every store and composed by `JsonArchiveVault` in each configuration (ADR 0014) | Bytes of a JSON archive out; erase by `personId` (spend kept with a null person) |
| Use cases and model runtime | Package (planned `model-runtime-claude-code`; the adapters drive the `claude` CLI as a child process per call) | Full: one port per judgment need; models receive only `ScoringProfile`; the runtime's configuration and its start check stay in Main (ADR 0003, 0009, 0016). The prefilter ranks lexically in `adapters/relevance`, with no model (ADR 0009) | Plain structures (`MatchJudgments`, `SearchPlan`, `Enrichment`, and so on), mapped from the CLI's `structured_output` inside the adapter; the envelope, cost fields and model ids never cross |
| Use cases and job sources | Package | Full: `JobSource` port, tier as data, `SourceSwitchboard` (null means never switched; Tier 4 then off) | `FoundPosting` in the common schema |
| Tier 4 and everything else | Separate package, optional per installation | Full at package level (ADR 0004) | Same `JobSource` port |
| Use-case areas among themselves | Folders in one package | **Partial** (enforced folder isolation; cross-area needs go through request ports wired in Main) | `SearchRequests`, `RescoreRequests`, `ScoringRequests` (carries `runId`), `MonitoringSearchRequests` |
| Measurement and the areas it observes | Folder in one package | Full in direction: measurement imports other areas' input-port **types only** (checked); nothing imports measurement (ADR 0011) | Decorators implement the wrapped input port; `ProductEvents` port to a local destination |
| Use cases and spend | Package | Full: `SpendMeter` (adapters report), `SpendAttribution` (use cases charge), `SpendLedger` (storage), all owned by `use-cases/shared` (ADR 0010); `SpendingGuard` reads the ledger's `totalSpent` and the budget (ADR 0015) | `Spend`, `ChargeTo`, `SpendRecord`: integer micros, provider as a label |
| Adapter subfolders among themselves | Folders | **Partial** (enforced no-cross-import, Périphérique guard) | none |
| Background work and the monitoring timer | In-process queue and `IntervalTicker` | **Partial** (request ports in place; process boundary not built; W5) | Function calls deferred to the queue; the ticker calls `RunDueMonitoring` |
| The owner's machine and everything else (AB-5) | Loopback bind plus `acceptsLocalRequest` on every request (ADR 0016) | Function ready and tested; the web Main that calls it is not built (D5, W15) | Host and Origin header values in, accept or refuse out |
| Web delivery | Not built | Deferred (D5); controllers already framework-free | Will be: local-request check, route handler, then controller |

The **decoupling mode** is source-level: one local process and one deployment (ADR 0001, 0016). Promotion order if pressure appears: a worker process (D4/W5), a child process for Tier 4 (W6), then area packages (W3). Each is reversible because the ports do not change.

**Interpretations made** where the PRD was ambiguous, each cheap to reverse:
- Tier 3 aggregators run only to cover failed, switched-off or absent Tier 4 sources. With Tier 4 off by default, they normally run.
- Two or more Missing must-haves at Fit 80 or above (coverage still at least 50%) is Stretch.
- The primary-reason precedence when several Not a fit triggers apply is: language, authorization, seniority, posting quality, coverage, fit.
- Fewer than 20 unique jobs triggers one widening pass.
- MN-4 "14 days without a login" is 14 days since the owner last opened the profile (ADR 0014).
- The monthly budget is one owner-wide budget over all profiles' spend in the calendar month (UTC) (ADR 0015).
- The PRD's "embedding similarity" prefilter is in-process lexical ranking, because the chosen runtime has no embeddings. Model spend under the subscription is the CLI's priced estimate, not a charge (ADR 0009).

## Main

- **`apps/main/src/compose-matchmaker.ts`** is the single composition function. It creates every interactor and the `SpendingGuard`, and wires the cross-area request ports to discovery and matching through the in-process queue. It wraps the measured input ports in their decorators (ADR 0011), so every delivery receives the measured port.
- Its input is `MatchmakerDetails`: storage, model ports, sources, clock, ids, feed, usage ledger, spend ledger and spend attribution, the person-data vault, and the product-events destination.
- Each configuration creates one `AsyncSpendMeter` and hands it both to `composeMatchmaker` (as attribution) and to every adapter that spends money (as `SpendMeter`, ADR 0010). It composes the `JsonArchiveVault` from every store that holds a person's data.
- **`apps/main/src/main.dev.ts`** is the development configuration: in-memory storage, Tier 1 only, `UnchosenModelRuntime`, `TemplateNarrator`. It starts the monitoring `IntervalTicker` (a catch-up tick now, then every 15 minutes) without keeping the process alive. Run it with `node apps/main/src/main.dev.ts`.
- **Model runtime (ADR 0009).** Every configuration that makes real model calls does the following:
  - It gathers a `ClaudeCodeRuntimeConfig` from the owner's local configuration (environment or a gitignored file; X-2). The settings are:
    - the command (`claude`);
    - the tier aliases (large `sonnet`, small `haiku`) and the map from port to tier;
    - `maxConcurrentCalls` (5);
    - the per-call timeout (60 s);
    - `modelTrainingOffConfirmed`.
  - It calls `checkClaudeCodeReady` before composing, and exits 1 with one message listing what is missing. The checks are:
    - the CLI is installed at the minimum version;
    - the CLI is signed in with the subscription, checked without a model call;
    - the owner has confirmed that "Help improve Claude" is off (Privacy 4). This is a declaration: no CLI or API can verify it, so the start prints the confirmed date and the owner's README repeats the rule.
  - It hands the configuration and the `SpendMeter` to each port adapter. Adapters record the CLI's priced estimate (`total_cost_usd`) as model spend.

  The testing API, CI's smoke run and the contract suites use scripted or recorded models and skip the check.
- **Planned configuration:** the owner's local install (D5, D15). It is the local web Main:
  - it binds `127.0.0.1` only and calls `acceptsLocalRequest` before every handler;
  - it uses a local database and data folder (D2, D8);
  - it uses the Claude Code runtime as above (D1, ADR 0009);
  - it keeps the ticker alive while the app runs.

  A worker Main is added only if D4 fires.

## Testing API

`packages/testing-api` exposes `MatchmakerTestingApi` (ADR 0008). It forces state (people, profiles, postings, time), scripts the details (judge, sources, their costs), and observes (judge calls, sources queried, the results stream, runs, spend, product events). It exercises the real presenters.

Operations mirror what the owner, the UI and the scheduler do:
- profiles: `createProfile`, `renameProfile`, `profiles`, `openProfile`, `exportProfile`, `deleteProfile`;
- spending: `setMonthlyBudget`, `runningCost`, `runningCostScreen`, and `searchNow(..., { overBudgetConfirmed })`;
- sources: `switchSource`;
- start-up: `appStarts` (what every configuration does at start and on each tick);
- local-only: `localRequestAccepted`;
- results: `scorePostings`, `searchNow`, `results`, `resultsScreen`, `jobDetail`, `markApplied`.

The tests in `packages/testing-api/test/` run with no framework, server, database or model. They cover:
- Apply verdicts, the evidence rule, gate failures skipping the model, caching per profile version;
- source failure tolerance, deduplication, widening, Tier 3 fallback, Tier 4 off by default;
- run cost and per-profile spend, including concurrent profiles and zero unattributed spend;
- the north-star events (from profile creation) and the applied event;
- job-detail evidence text, including after Fix a fact;
- profiles: create, rename, list, open, separation of data, export, delete with the spend total kept;
- spending: daily caps per profile, the budget asking first, monitoring paused until next month, the running-cost panel;
- monitoring: the catch-up run at start and the 14-day unopened pause;
- the local-request check.

## Enforcement

`pnpm verify` runs three steps.

1. **`pnpm typecheck`** checks each package on its own.
   - pnpm resolves only the workspace packages a manifest declares, so an outward import is a compile error.
   - Inner circles compile with `types: []`, so they cannot reach `node:*`.
2. **`pnpm check:architecture`** applies the architecture as data in `tools/architecture/components.mjs`. The build fails on:
   - outward arrows;
   - manifest drift;
   - `/wiring` imports outside Main;
   - cross-area imports;
   - non-type imports from the measurement area into the areas it observes;
   - relative imports that leave a package;
   - libraries or platform imports in inner circles;
   - cycles between packages or areas.

   `pnpm metrics` prints fan-in, fan-out, I, A and D per package; track D across releases (§4.7). SDP warnings are not raised for edges whose source is the testing API or Main, because nothing in production depends on either (ADR 0010).
3. **`pnpm test`** runs the testing-API suite.

Conventions:
- Ports (behavioral contracts) are `interface`.
- Data that crosses boundaries is `type` (plain, readonly).
- Interactors are classes exported only through `/wiring`.
- No framework type, decorator or annotation appears in `rules`, `use-cases` or `delivery`.
- No source is named in policy; tier is data (§3.4).
