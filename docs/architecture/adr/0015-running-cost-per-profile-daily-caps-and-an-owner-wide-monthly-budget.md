# 0015. Running cost is bounded by per-profile daily caps and one optional owner-wide monthly budget, enforced by a spending guard inside the use cases

Status: accepted (2026-11-11). **Supersedes ADR 0010 decision 7** (count-based fair-use caps in `rules/access`) and closes watch item W13. Amends ADR 0010 decision 8 and its "active user" interpretation, and watch item W8. Its open consequence on subscription spend is settled by ADR 0009: adapters report the CLI's priced estimate.

## Context

The PRD's "Running cost" section replaces "Pricing and trial":
- the owner pays every model and aggregator bill through their own Claude account or API key and aggregator keys;
- spend is shown per profile and per month (AB-3);
- an **optional monthly budget** set by the owner: when reached, monitoring pauses and on-demand actions ask first;
- **daily caps** of 3 on-demand searches and 10 tailored resumes per profile per day (assumption), "to stop runaway spend";
- the metric "cost per profile" is spend per profile per month, compared with the owner's budget.

Spend metering itself (ADR 0010) is unchanged and already answers spend per person per period. What changed is who is protected and how: the trial guard (`AccessGuard`) is gone with the paywall (ADR 0014), and the caps were labelled "fair use", a subscription concept.

The PRD sentence "spend per profile and per month, with an optional monthly budget" can be read as one budget per profile or one for the owner. The owner is the only payer and has one bill per provider.

## Decision

1. **The budget is a Critical Business Rule** in `rules/spending/monthly-budget.ts`: `MonthlyBudget` (a positive integer of micros, or null), `budgetStatus(budget, spentThisMonth)` giving `no-budget`, `within` or `reached`, `validMonthlyBudget`, and `monthContaining(now)` (calendar month, UTC).
2. **INTERPRETATION: one owner-wide budget** over the total spend of all profiles in the month, including deleted profiles and anything unattributed (`SpendLedger.totalSpent`). Spend is still shown per profile. Recorded in D13; changing it to per-profile budgets is a rules and guard change, not a port change.
3. **The daily caps are application cost policy**, like the prefilter cap: `DAILY_CAPS` in `use-cases/shared/spending-guard.ts`, counted per profile per UTC day in `UsageLedger`. They were "fair use"; they are now "daily caps".
4. **`SpendingGuard`** (use-cases `shared`) replaces `AccessGuard`. Cost-incurring interactors call it before they spend:
   - `beforeOnDemand(personId, cappedAction | null, overBudgetConfirmed)`: refuses `not-found`, `daily-cap-reached`, or `monthly-budget-reached` unless the owner confirmed; then counts the action against today's cap;
   - `beforeBackground(personId)`: refuses `monthly-budget-reached`; background work never asks, it pauses;
   - `monthlyBudgetReached()`: read by `RunDueMonitoring`, which then requests nothing and says `pausedByBudget`.
5. **"Ask first" is the use-case boundary dance** (§12.2). The request models of on-demand cost-incurring use cases carry `overBudgetConfirmed?: boolean`. Delivery shows the question when it gets `monthly-budget-reached` and resends with the confirmation. The use case never asks; it states the condition.
   - `RunJobSearch`: manual counts against `onDemandSearches`; onboarding is on demand but uncapped; scheduled pauses.
   - `TailorResume.generate`: `tailoredResumes` (stub, Phase 4).
   - `IntakeResume` and `ConductInterview`: on demand, uncapped (hand-off with their phases).
6. **A `spending` area** (actor: the owner as payer): `ViewRunningCost` (per profile for a month, "other" for deleted and unattributed, total, budget status, monitoring paused) and `SetMonthlyBudget`. The budget is stored through `MonthlyBudgetControl`; the guard reads it through `MonthlyBudgetSetting`. `presentRunningCost` in delivery formats micros as currency.
7. **Metric:** "cost per profile" is `SpendLedger.spentBy(personId, month)` for every profile. The "active user" interpretation of ADR 0010 and 0011 is retired: with a handful of profiles, every profile is counted.

## Rationale

- §7.2: a spending limit on one's own money would exist without automation, so it is a business rule; a cap that stops a runaway loop exists because of automation, so it is application policy.
- §10.2 and the kitty problem: a cross-cutting concern handled in one place (the guard) that every cost-incurring use case calls, as `AccessGuard` was (W8).
- §12.2: the UI and the use case dance until the input is complete. Confirmation is input, not a callback into the UI.
- §3.5, §9.1: the guard owns narrow gateways (`PeopleForSpending`, `UsageLedger`, `MonthlyBudgetSetting`, `Pick<SpendLedger, "totalSpent">`).
- §5.5: daily counts and money are accidentally similar; they stay two ledgers (ADR 0010).

## Consequences

- `spending.test.ts` proves: three manual searches a day per profile; budget reached means an on-demand search is refused until confirmed; monitoring pauses and resumes in the next month; the panel shows spend per profile for a month.
- Under the Claude Code subscription runtime (D1), model calls may have no per-call price. Whether the meter then reports an estimated equivalent cost (so the budget still bounds use) or zero must be settled with D1 in Phase 0.
- A scheduled search already queued when the budget is reached is refused when it starts, and the refusal goes to `onBackgroundError`. The local Main logs it; it is not a failure.

## Alternatives rejected

- **One budget per profile:** possible reading of AB-3, but the owner pays one bill; per-profile budgets would let total spend exceed what the owner meant. Kept cheap to change (decision 2).
- **Caps and budget as decorators in Main:** Main must hold no policy (§10.1); the use case also needs the confirmation flag inside its request.
- **The use case asks the owner through an output port and waits:** a chatty UI callback inside a use case; it ties the use case to an interactive delivery and fails for scheduled work.
- **Keep the name "fair use":** the word belongs to a subscription product; the PRD now calls them daily caps.

## Review trigger

- The owner wants a budget per profile, or a per-day money cap.
- D1 is decided for the subscription runtime and model spend cannot be priced.
- A new cost-incurring use case does not call the guard (W8).
