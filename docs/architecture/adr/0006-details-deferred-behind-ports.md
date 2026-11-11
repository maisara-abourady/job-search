# 0006. Storage, background work, web delivery, authentication, billing and file storage are deferred details

Status: accepted (2026-11-11)

## Context

The PRD marks its stack as an assumption:
- Next.js with server-sent events;
- TypeScript or Python services with a job queue;
- Postgres with pgvector;
- object storage;
- JobSpy;
- a merchant-of-record billing provider whose choice depends on the country of incorporation.

The release plan does not need persistence across restarts until real test users arrive (Phase 3 exit). It does not need a scheduler process until monitoring (Phase 5), or a billing provider until Phase 6.

## Decision

Each detail sits behind ports owned by the use cases that need them, named for the need. Each is implemented first by the cheapest adapter.

| Detail | Ports (owner) | Today | Decided when (see deferred.md) |
|---|---|---|---|
| Database | `ProfilesForScoring`, `PostingCatalog`, `MatchRecords`, `ResultsReadModel`, `Accounts`, and others (per area) | `InMemoryStore` | First environment with real users |
| Vector search | `RelevanceRanker` (discovery) | unchosen | With the model runtime |
| Background work and queue | request ports `SearchRequests`, `RescoreRequests`, `MonitoringSearchRequests`, `ScoringRequests` | `InProcessWorkQueue` | A run outlives a request, or monitoring must run without the web process |
| Web framework and streaming | `ResultsFeed` output port; framework-free controllers and presenters in `delivery` | none | Phase 1 UI work starts |
| Authentication (email, Google) | none inside: use cases receive an authenticated `userId` | none | Phase 1 UI work starts |
| Billing provider | `Checkout` port and `RecordSubscriptionChange` input port, fed by a webhook listener | none | The incorporation country is known |
| File storage | `ResumeFiles`, `GeneratedFiles` | none | Phase 1 intake |
| PDF and DOCX parsing, OCR, rendering | `DocumentReader`, `ResumeRenderer` | none | Phases 1 and 4 |

When chosen, the PRD's assumptions (Postgres plus pgvector, Next.js plus server-sent events) are good defaults. They are implemented as adapters and glue, and never imported inward.

## Rationale

- §5.3: a good architect maximizes decisions not made, and pretends the company has not chosen.
- §6.1: the FitNesse deferral.
- §12.1 and §12.2: the database and the web are details.
- §9.1: gateways have one method per need; their implementations are humble and hold the SQL.
- §12.2: abstract the use-case boundary, not the device.
- §10.1: framework injection stays in Main.

## Consequences

- Phases 1 to 3 can be built and accepted on in-memory storage. The Postgres adapter is a separate, parallelizable piece of work.
- The web app will be `apps/web`: route handlers that authenticate, call controllers built by `composeMatchmaker`, and serialize view models. They are humble objects with no policy.
- Fewer things to secure and operate early. Encryption at rest arrives with the first real store.

## Alternatives rejected

- **Committing to Postgres, Next.js and a queue now:** no information gained by deciding early, and it invites rows and request objects into use cases (§8.3).

## Review trigger

Each row's trigger in `deferred.md`.
