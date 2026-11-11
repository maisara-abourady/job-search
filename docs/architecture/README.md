# AI Job Matchmaker: architecture

Requirements: [`docs/prd.md`](../prd.md), the product requirements document (requirement IDs and the six-phase release plan).

AI Job Matchmaker reads a job seeker's resume, interviews them briefly, searches every reachable job source, and gives every job one verdict: **Apply**, **Within reach** (Stretch), or **Not a fit**. Each verdict comes with its reasons, evidence, and the single change that would move it. It tailors a resume per job without inventing anything, watches the market in the background, and runs on a 7-day trial and then a subscription.

This document describes the system as it is now. Decisions and their reasons are in `adr/`. Decisions not yet made, and boundaries being watched, are in `deferred.md`.

## Actors and their use cases

An actor is a group that asks for the same kind of change (§3.2). Each use case below is a file under `packages/use-cases/src/<area>/`.

| Actor | Area | Use cases | PRD |
|---|---|---|---|
| Job seeker (active and passive) | onboarding | `IntakeResume`, `CorrectProfile` (facts, preferences, selling points, Fix a fact), `ConductInterview` | RP, PF, IN, NF-5, Flows 1, 7 |
| Job seeker, scheduler | discovery | `RunJobSearch` (onboarding, manual, scheduled), `RecheckStoredPostings` | DS, Flows 1, 6 |
| Matching-policy owner (strictness, calibration) | matching | `ScoreJobs`, `RescoreAll`, `RunFullAnalysis` | MR-1..6, NF-5, NF-6, MN-2 |
| Job seeker | results | `ListResults`, `ViewJobDetail`, `ReviewNotAFit` (with gap insight), `RecordJobDecision` | MR-3..8, NF-1..4, Flows 2, 3, 5 |
| Job seeker | tailoring | `TailorResume` (missing keywords, generate, export) | TR, Flow 4 |
| Scheduler, passive seeker | monitoring | `RunDueMonitoring`, `ViewInbox` | MN, Flow 6 |
| Business owner, privacy | account | `SignUp`, `ViewAccess`, `StartCheckout`, `RecordSubscriptionChange`, `ExportMyData`, `DeleteMyData`, `PurgeExpiredAccounts` | AB, Flow 8, Privacy |
| Sourcing operator | operations | `OperateSources` (kill switches, run summaries with each run's cost) | Scraping safeguards, DS-7, SearchRun cost |
| Product owner (measuring the product) | measurement | No use cases of its own. Decorators over other areas' input ports emit product events (ADR 0011) | Metrics table, north star |

**Abstract use cases** (§12.4):
- `RunJobSearch` serves all three triggers (onboarding, manual, scheduled).
- `ScoreJobs` serves new postings, re-scoring after profile changes, and full analysis.
- Every profile change, whether a fact, a preference, an interview answer or a new resume, is one rule: a new immutable profile version, then `RescoreAll` (ADR 0005).

## Critical Business Rules (Entities)

These are in `packages/rules/src/`. They would hold for a career coach working by hand.

- **profile/**
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
- **access/**
  - Trial days, banner and paywall, data retention, fair-use caps.

Application-specific policy lives in the owning use case, not in the rules: prefilter cap, widening threshold, source timeout, monitoring interval and inactivity pause, interview length.

## Components and circles

```
                 +--------------------+
                 | @matchmaker/rules  |   circle 1  Entities          I=0.00 A=0.00 D=1.00 (watch W1)
                 +--------------------+
                           ^
                 +----------------------+
                 | @matchmaker/use-cases|  circle 2  Use cases + ports  I=0.53 A=0.44 D=0.03
                 +----------------------+
                  ^          ^          ^
   +--------------------+ +--------------------+ +------------------------------+
   | @matchmaker/       | | @matchmaker/       | | @matchmaker/scraping-sources |  circle 3-4
   | delivery           | | adapters           | | (Tier 4, optional per market)|
   | controllers,       | | in-memory store,   | +------------------------------+
   | presenters,        | | spend meter,       |
   | view models        | | model runtime,     |
   +--------------------+ | Tier 1-3 sources,  |
              ^           | narration, work,   |
              |           | clock              |
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

## Boundaries

| Boundary | Kind | Full or partial | Crossing |
|---|---|---|---|
| Rules and use cases | Package (source-level) | Full: no imports from rules outward; the compiler cannot even resolve them | Function calls; Entities passed in, decisions returned |
| Use cases and delivery | Package | Full: input ports and plain request/response models owned by use cases; types-only surface; interactors only via `/wiring` for Main | Controller calls input port; query use cases return response models; streaming via the `ResultsFeed` output port; presenters build view models of strings, flags and enums |
| Use cases and storage | Package | Full: gateways per area, named for the need, implemented by `InMemoryStore` (later Postgres). Examples: `ResultsReadModel.jobDetail` returns evidence text from the match's own profile version (ADR 0012); `Accounts.applySubscriptionEvent` applies a provider event at most once, atomically (ADR 0013) | Entities and plain records in and out; never rows |
| Use cases and model runtime | Package | Full: one port per judgment need; models receive only `ScoringProfile` | Plain structures (`MatchJudgments`, `SearchPlan`, `Enrichment`, and so on) |
| Use cases and job sources | Package | Full: `JobSource` port, tier as data, `SourceSwitchboard` | `FoundPosting` in the common schema |
| Tier 4 and everything else | Separate package, excluded per market | Full at package level (ADR 0004) | Same `JobSource` port |
| Use-case areas among themselves | Folders in one package | **Partial** (enforced folder isolation; cross-area needs go through request ports wired in Main) | `SearchRequests`, `RescoreRequests`, `ScoringRequests` (carries `runId`), `MonitoringSearchRequests` |
| Measurement and the areas it observes | Folder in one package | Full in direction: measurement imports other areas' input-port **types only** (checked); nothing imports measurement (ADR 0011) | Decorators implement the wrapped input port; `ProductEvents` port to the destination (in memory; D14) |
| Use cases and spend | Package | Full: `SpendMeter` (adapters report), `SpendAttribution` (use cases charge), `SpendLedger` (storage), all owned by `use-cases/shared` (ADR 0010) | `Spend`, `ChargeTo`, `SpendRecord`: integer micros, provider as a label |
| Adapter subfolders among themselves | Folders | **Partial** (enforced no-cross-import, Périphérique guard) | none |
| Background work | In-process queue | **Partial** (request ports in place; process boundary not built; W5) | Function calls deferred to the queue |
| Web and authentication | Not built | Deferred (D5, D6); controllers already framework-free | Will be: route handler, then controller |
| Billing provider | Not built | Deferred (D7). The webhook listener will be a humble object that verifies, namespaces the event id, and calls `RecordSubscriptionChange` | `SubscriptionChange { eventId, userId, status, at }` |

The **decoupling mode** is source-level: one process and one deployment (ADR 0001). Promotion order when pressure appears: the worker process (D4/W5), Tier 4 isolation (W6), then area packages (W3). Each is reversible because the ports do not change.

**Interpretations made** where the PRD was ambiguous, each cheap to reverse:
- Tier 3 aggregators run only to cover failed, switched-off or absent Tier 4 sources.
- Two or more Missing must-haves at Fit 80 or above (coverage still at least 50%) is Stretch.
- The primary-reason precedence when several Not a fit triggers apply is: language, authorization, seniority, posting quality, coverage, fit.
- Fewer than 20 unique jobs triggers one widening pass.

## Main

- **`apps/main/src/compose-matchmaker.ts`** is the single composition function. It creates every interactor and wires the cross-area request ports to discovery and matching through the in-process queue. It wraps the measured input ports in their decorators (ADR 0011), so every delivery receives the measured port.
- Its input is `MatchmakerDetails`: storage, model ports, sources, clock, ids, feed, usage ledger, spend ledger and spend attribution, and the product-events destination.
- Each configuration creates one `AsyncSpendMeter` and hands it both to `composeMatchmaker` (as attribution) and to every adapter that spends money (as `SpendMeter`, ADR 0010).
- **`apps/main/src/main.dev.ts`** is the development configuration: in-memory storage, Tier 1 only, `UnchosenModelRuntime`, `TemplateNarrator`. Run it with `node apps/main/src/main.dev.ts`.
- **Planned configurations:**
  - `apps/web` for production delivery (D5);
  - `apps/worker` (D4);
  - one configuration per launch market where legal or privacy terms differ (Tier 4 included or not, model provider terms). See ADR 0004 and W10.

## Testing API

`packages/testing-api` exposes `MatchmakerTestingApi` (ADR 0008). It forces state (users, profiles, postings, time), scripts the details (judge, sources), and observes (judge calls, the results stream). It exercises the real presenters.

Further superpowers:
- spend: paid scripted sources (`sourceReturns(..., costPerCallMicros)`) and `judgeCosts`;
- observations: `lastSearchRun`, `spentBy`, `unattributedSpendMicros` and `productEvents`;
- operations: `jobDetail`, `markApplied`, and `billingProviderSends` (what the webhook listener will do).

The tests in `packages/testing-api/test/` run with no framework, server, database or model. They cover:
- Apply verdicts;
- the evidence rule;
- gate failures skipping the model;
- caching per profile version;
- source failure tolerance, deduplication, widening and Tier 3 fallback;
- the paywall;
- run cost and per-user spend, including concurrent users and zero unattributed spend;
- the north-star events and the applied event;
- job-detail evidence text, including after Fix a fact;
- idempotent subscription events.

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
