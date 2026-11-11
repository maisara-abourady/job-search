# Phase 6: Trial, billing and launch

Goal: A new user signs up, uses the full product for 7 days, sees the banner from day 5 and the paywall on day 8 with their match counts behind it, pays, and returns to where they left off; they can export or delete all their data; legal documents are published for each launch market. **Exit test (PRD): a full signup-to-payment path works end to end.**
Detail level: Outline — detail at Gate 5
Traces to: UC-17 to UC-21, E-13, P-30, P-31, A-28, D-8, M-3; PRD AB-1 to AB-4, Flow 8, Pricing and trial, Privacy 1 to 5; D7; open question 6
Prerequisites: Gate 5 passed; H-13 (billing provider sandbox), H-14 (price, card at trial), H-15 (legal documents, product name).

## Tasks (outline)

### P6-T01 — Billing decision recorded (D7) and the `SubscriptionChange` event id
- **Traces to:** D7, UC-19, open question 6 · **Size:** S
- **Acceptance:** `/architect` ADR names the provider and adds the provider event id to `SubscriptionChange`.

### P6-T02 — `RecordSubscriptionChange` (idempotent per event id)
- **Traces to:** UC-19, E-13 · **Size:** S
- **Acceptance:** Active lifts the paywall; lapsed paywalls from the lapse date; the same event twice changes nothing.

### P6-T03 — `Checkout` adapter and webhook listener in `apps/web`
- **Traces to:** A-28, UC-18 · **Size:** M
- **Acceptance:** Contract passes against the provider sandbox; the listener verifies signatures and is a humble object calling `RecordSubscriptionChange`.

### P6-T04 — Trial banner and paywall screens (Flow 8)
- **Traces to:** D-2, D-8, AB-2, AB-3 · **Size:** M
- **Acceptance:** Banner from day 5 with days remaining; paywall on login from day 8 with match counts visible; after payment the user returns to the screen they left.

### P6-T05 — `UserDataVault` across every store; export and delete (AB-4)
- **Traces to:** UC-20, P-31 · **Size:** M
- **Acceptance:** Export contains every record and file for the user; delete leaves nothing in the database, object storage or queue.

### P6-T06 — Retention purge (30 days after expiry) on the scheduler
- **Traces to:** UC-21, E-13 · **Size:** S
- **Acceptance:** `paywalledBefore` computed from the access policy; purge runs daily; a user 31 days past expiry is erased, one at 29 days is not.

### P6-T07 — Legal documents and per-market configuration (Privacy 4, 5; W10)
- **Traces to:** M-3, X-9 · **Size:** M
- **Acceptance:** Privacy policy and data-processing terms published per launch market; each market's Main configuration lists only compliant model and source adapters.

### P6-T08 — Signup-to-payment end-to-end test (the Phase 6 exit test)
- **Traces to:** Gate 6 · **Size:** M
- **Acceptance:** An automated browser test on staging signs up, advances the trial clock (testing configuration), hits the paywall, pays in the provider sandbox and lands back on the results.

## Gate 6

- **Exit criteria:**
  - [ ] `pnpm verify`, `pnpm check:architecture` green
  - [ ] **PRD exit test:** P6-T08 green on staging
- **Demo:** the full path with a sandbox card.
- **Human checkpoint:** Launch decision; review `deferred.md` in full and the PRD metrics targets for the first month.
