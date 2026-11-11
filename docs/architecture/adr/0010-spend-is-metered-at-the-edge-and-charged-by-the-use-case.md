# 0010. Spend is metered at the edge and charged by the use case that caused it

Status: accepted (2026-11-11). Decision 7 superseded by ADR 0015 (daily caps and the monthly budget). Amended by ADR 0014 (spend is charged to a person, `personId`; erasure keeps amounts with a null person) and ADR 0015 (cost per profile replaces cost per active user). The `proxy` category is removed (ADR 0016).

## Context

The PRD needs money figures in three places:
- the SearchRun record logs "each run's sources, counts, failures, and cost";
- the metric "cost per active user" is "model, aggregator, and proxy spend per user per month", and pricing depends on it;
- the fair-use caps "exist to bound model and aggregator cost per user".

Until now nothing recorded spend. `UsageLedger` counts actions for the fair-use caps; it holds no money.

Where the facts live:
- **Only the edge knows the amount.** Token counts, per-call aggregator prices and proxy traffic are visible only inside the adapter that made the call. Prices are vendor configuration. ADR 0003 forbids model names, vendors and prices inside the use-case circle.
- **Only the use case knows whom to charge.** `JobSource.search(queries, timeoutMs)` and `PostingEnricher.enrich(found)` carry no user, by design. Postings are shared across users. The run id exists only inside `RunJobSearch`.
- **Paid calls can fail after spending.** A Tier 3 call that times out, or a model call whose output fails validation, is still billed.

The actors differ. The business owner wants cost per user and per month. The sourcing operator wants cost per run. The caps come from the access policy (rules). Volatility is high at the edge (prices, vendors, tiering) and should stay zero in the use cases.

## Decision

1. **Three ports in `use-cases/src/shared/metering.ts`.** The use-case circle owns all three.

   | Port | Used by | Implemented by | Purpose |
   |---|---|---|---|
   | `SpendMeter.record(spend)` | every adapter that spends money | metering adapter | Reports one priced unit: `{ category: model, aggregator or proxy; provider label; amountMicros }` |
   | `SpendAttribution.charge(to, work)` | cost-incurring use cases | metering adapter | Everything reported while `work` runs is charged to `to = { userId, runId, purpose }` |
   | `SpendLedger` | metering adapter (`append`), use cases (`spentOnRun`, `spentBy`) | storage | Stores `SpendRecord`s; answers run cost and spend per user per period |

2. **Adapters report what they spent, never for whom.** Each paid adapter gets a `SpendMeter` in its constructor from the Main configuration. It records once per paid call, before parsing the response, so failed calls are counted. Prices come from Main configuration and are passed to the adapter's constructor. `provider` is a label, and nothing branches on it (§3.4).
3. **Use cases charge explicitly.**
   - `RunJobSearch` creates a `runId` and charges `{ userId, runId, purpose: "search" }` around the whole pipeline.
   - `ScoreJobs` charges `{ userId, runId, purpose: "scoring" }`. The `runId` arrives in `ScoreJobsRequest` and in `ScoringRequests`, so scoring stays charged to its run even when a worker process runs it (D4).
   - `IntakeResume`, `ConductInterview` and `TailorResume` have a `spend: SpendAttribution` dependency already. They charge with purpose `intake`, `interview` or `tailoring` when they are built.
4. **Run cost.** `SearchRunRecord` and `RunJobSearchResponse` carry `runId` and `costMicros`, which is `SpendLedger.spentOnRun(runId)` when the run finishes. That includes scoring the run awaited. `SearchRunHistory.recent` returns them to the operator (DS-7).
5. **Mechanism (a detail).** `AsyncSpendMeter` in `adapters/src/metering/` implements `SpendMeter` and `SpendAttribution` with `AsyncLocalStorage`. The charge follows the asynchronous call chain, including `Promise.allSettled` fan-outs and concurrent users. Spend reported outside any charge is stored with `userId: null` and purpose `unattributed`, never dropped. `InMemorySpendLedger` is the storage for now. Postgres implements the same gateway (D2).
6. **Money.** Spend is stored as integer micro-units of one accounting currency. The currency is assumed to be USD and is listed in D13. Amounts are never floats and never per-vendor currencies.
7. **Fair-use caps.** The caps stay count-based, as the PRD states them (`FAIR_USE_PER_DAY`, `UsageLedger`). If pricing introduces a money cap:
   - the rule goes in `rules/access`, for example `withinSpendBudget(spentMicros)`;
   - `AccessGuard` gets a narrow guard-owned read (`Pick<SpendLedger, "spentBy">`).

   No other code changes (watch item W13).
8. **Cost per active user** is `SpendLedger.spentBy(userId, monthStart, monthEnd)` over the users ADR 0011 counts as active. The operator report that shows it is a hand-off (S-6, P3-T14).
9. **Metrics rule.** An SDP warning was raised when the new adapter files pushed adapters' I (0.70) past Main's (0.67). The check no longer warns on edges whose source is Main. Main's I is low only because the testing API (itself a Main configuration, ADR 0008) depends on it, and nothing in production depends on Main (§10.1). The metrics still print Main's I.

## Rationale

- §5.3, ADR 0003: prices, token counts and vendors are details. The use case decides only whom to charge.
- §8.3: the data crossing the boundary is a plain structure shaped for the inner side (`Spend`, `ChargeTo`, `SpendRecord`).
- §9.3: the API is owned by its user. The use-case side defines what a spend is.
- §3.5: three narrow ports instead of a cost field added to every model and source port. Adding the field to 13 port signatures would be tramp data (§7.2). It also could not record a call that fails after being billed.
- §12.5: adapters may not import each other, so the meter's type must live in the inner circle. Every adapter subfolder depends on it there, not on each other.
- §5.5: spend money and fair-use counts are accidentally similar. They serve different actors and change for different reasons, so they stay two ledgers.

## Consequences

- SearchRun cost, cost per user per period and per-run cost are available now. `pnpm test` proves:
  - a run's cost equals its source and model spend;
  - two concurrent users are charged separately;
  - re-scoring outside a run is charged to the user;
  - nothing goes unattributed.
- Every paid adapter task gains one acceptance line: it records spend through `SpendMeter` once per paid call, and its contract test checks this. Those tasks are P1-T10, P2-T11 to P2-T13, P3-T03, Phase 4 and Phase 5 (Tier 3 and the Tier 4 proxy).
- `AsyncLocalStorage` is a Node facility. Moving off Node means rewriting `AsyncSpendMeter` and nothing else.
- Erasing a user (AB-4) anonymizes that user's spend records: `userId` becomes null and the amounts stay, so the cost totals remain true. This is added to P6-T05.
- Enrichment of a shared posting is charged to the user whose run first fetched it. This is an interpretation, listed in D13.

## Alternatives rejected

- **Each port returns `{ result, spend }`:** it changes every model and source port, makes the use cases sum spend, and loses spend when a call fails after billing.
- **A `charge` parameter on every port method:** tramp data through 13 signatures (§7.2), with the same failure problem.
- **Metering decorators in Main around ports:** they can count calls but cannot see tokens, and they would put price policy in Main.
- **Spend kept in `UsageLedger`:** a different actor and unit. Caps count actions; accounting sums money.
- **Cost computed later from provider invoices:** it gives no per-run or per-user breakdown, and invoices arrive monthly, too late for S-6.

## Review trigger

- Unattributed spend above zero in any environment.
- The worker process (D4) arrives. Confirm that every queued request carries what its interactor needs to open its own charge.
- Pricing (H-14, S-6) sets a money cap (W13).
- Spend reconciliation with provider invoices drifts by more than 5% in a month.
