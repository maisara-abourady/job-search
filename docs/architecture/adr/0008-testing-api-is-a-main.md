# 0008. Business rules are tested through a testing API that is a Main configuration

Status: accepted (2026-11-11)

## Context

The phase exits in the PRD include:
- score stability on a fixed test set;
- five users reaching Apply in under 10 minutes;
- a run that completes with any single source disabled.

These are acceptance criteria about business behavior. Tests coupled to the GUI or to the class structure would make the system rigid (§10.3).

## Decision

1. `@matchmaker/testing-api` exposes `MatchmakerTestingApi`. It builds the application with the same `composeMatchmaker` used by every Main, wired with in-memory storage, a scripted judge, scripted sources, a fixed clock and sequential ids.
2. Superpowers:
   - force state: `givenSignedUpUser`, `givenProfile`, `givenPosting`, `atTime`;
   - script the details: `judgeWillSay`, `sourceReturns`, `sourceFails`;
   - observe: `judgeCalls`, `feed`.
3. Operations mirror what the UI and the scheduler can do: `scorePostings`, `searchNow`, `results`, `resultsScreen` (through the real presenter), `access`.
4. Tests (`packages/testing-api/test/`) talk only to this class, never to interactors, adapters or file paths. They run with `node --test`: no framework, server, database or model.

## Rationale

- §10.3: the testing API, superpowers, and avoiding structural coupling.
- §10.1: one Main per configuration.
- §7.3: every use case is testable with no framework in place.

## Consequences

- Production refactors (splitting packages, renaming interactors) do not touch tests unless behavior changes.
- The testing API holds no dangerous production powers; it lives in a package nothing in production depends on.

## Review trigger

- A test needs to reach past the API. Add the superpower to the API instead.
