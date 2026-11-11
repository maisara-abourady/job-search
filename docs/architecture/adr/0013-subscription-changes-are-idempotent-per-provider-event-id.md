# 0013. Subscription changes carry the provider's event id and are applied at most once, atomically, by the accounts gateway

Status: accepted (2026-11-11). Refines ADR 0006's billing row. The billing provider itself stays deferred (D7).

## Context

AB-3 and Flow 8:
- the paywall lifts after payment;
- a lapsed subscription paywalls again from the lapse date.

A merchant-of-record provider tells the system about payments through webhooks. Every common provider delivers webhooks at least once: retries, redeliveries and occasionally concurrent duplicates. `SubscriptionChange` was `{ userId, status, at }` with no event id, so a redelivered "active" arriving after a "lapsed" would silently reopen the app for free. `RecordSubscriptionChange` was a stub noting "idempotent per provider event id".

Which provider it will be depends on the country of incorporation (H-13). Its event-id format, signature scheme and ordering guarantees are unknown.

## Decision

1. `SubscriptionChange = { eventId, userId, status: "active" | "lapsed", at }`.
   - `eventId` is the provider's event id, opaque to the use case.
   - The webhook listener, a humble object in the web Main (D7, P6-T03), verifies the signature and maps the payload.
   - The listener namespaces the id (for example `provider:evt_123`) so that ids from two providers can never collide.
   - `at` is the provider's change time: the lapse date for "lapsed".
2. `RecordSubscriptionChange` returns `{ outcome: "applied" | "duplicate" }`. The listener can log it and must answer the provider with success in both cases.
3. The `Accounts` gateway gains `applySubscriptionEvent(eventId, userId, subscription): Promise<"applied" | "duplicate">`. It records the event id and updates the subscription **atomically**: one transaction with a unique key on the event id in Postgres, or one synchronous step in memory. Idempotency is a storage guarantee, because a check-then-write in the use case would race with concurrent redeliveries.
4. `RecordSubscriptionChangeInteractor` is implemented:
   - it rejects an empty event id (`invalid-input`) and an unknown user (`not-found`);
   - it maps the status to the rules' `Subscription`: `active` gives `{ active, lapsedAt: null }`, and `lapsed` gives `{ lapsed, lapsedAt: at }`;
   - it calls the gateway.

   Main wires it as `useCases.recordSubscriptionChange`, wrapped by `MeasuredRecordSubscriptionChange` (ADR 0011). A duplicate is not a second conversion.
5. **Out-of-order delivery is not decided here.** Example: a "lapsed" for an older period arriving after a newer "active". The right rule depends on the provider's ordering guarantees (D7). The port does not need to change for it: `at` already crosses. If the provider does not guarantee order, the rule is: ignore a change whose `at` is older than the last applied change for that user. This needs `Subscription.changedAt` in the rules and the gateway (W12, P6-T02).

## Rationale

- §9.1: a gateway method named for the need, whose humble implementation holds the transaction.
- §9.3: the API is owned by its user. The use-case side defines what a subscription change is; the provider's payload is mapped to it by the listener (§9.1, service listeners).
- §6.4: the use case contains no provider names or addresses. The event id is data.
- §5.3: the provider stays deferred, and only what any provider must supply crosses the boundary.

## Consequences

- P6-T01 records only the provider decision (D7) and the namespacing format. P6-T02 decides ordering with the provider's guarantees, adds W12's rule if needed, and keeps the existing tests green.
- The Postgres accounts adapter needs a `subscription_events` table with a unique event id, written in the same transaction as the account. Its contract suite must include "concurrent duplicate applies once".
- Event ids are personal data only through their link to a user. They are erased with the account (P6-T05).

## Alternatives rejected

- **Dedupe in the listener:** every delivery mechanism would need it. It would sit in the outer circle and be untestable through the testing API.
- **Check `seen(eventId)` and then write, in the use case:** this races under concurrent redelivery.
- **Rely on "last write wins" with `at` alone:** this cannot tell a replay from a genuine repeat change with the same time.

## Review trigger

- D7 is decided: confirm the provider's event-id uniqueness and ordering guarantees, then settle W12.
- A second provider or market-specific billing appears: confirm the namespacing.
