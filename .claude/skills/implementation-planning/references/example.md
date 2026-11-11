# Worked example (calibration only)

This shows the expected granularity and tone. It is a small, invented system; do not copy its content into a real plan.

**Architecture summary (what the planner was given):** A "job application tracker" CLI. Entities: `Application` (company, role, status, dates; invariant: status moves only forward through Applied → Interviewing → Offer/Rejected, Rejected is terminal) and `Status` value object. Use cases: UC-1 Record application, UC-2 Advance status, UC-3 List stale applications (no change in N days). Ports: P-1 `ApplicationRepository`, P-2 `Clock`. Adapters: A-1 SQLite repository, A-2 system clock. Delivery: D-1 CLI. Main in `src/tracker/main.py`. Python 3.12, pytest. ADR-0002 chose import-linter for enforcement. `deferred.md` defers "sync to a web service" with trigger "user asks for a second device".

## PLAN.md excerpt

| Phase | Goal | Slices | Tasks |
|-------|------|--------|-------|
| 0 | `tracker --version` runs through Main, CI and the layer check are green | skeleton | 6 |
| 1 | A user can record an application and see it persisted after restarting the CLI | UC-1 | 9 |
| 2 | A user can advance an application's status and is refused an illegal move | UC-2 | 6 |
| 3 | A user can list applications untouched for N days | UC-3 | 5 |

Risks: SQLite schema evolution (addressed by introducing migrations, X-3, in Phase 1 with the first adapter rather than later). No spikes needed: every technology is familiar. Deferred: web sync is not planned; no task touches it.

Detail level: Phases 0-2 full; Phase 3 outline, detailed at Gate 2.

## phase-1-record-application.md excerpt

### P1-T01 — `Application` entity and `Status` value object

- **Traces to:** E-1, E-2
- **Layer:** Entities — must not import anything outside the standard library
- **Depends on:** P0-T06
- **Size:** S  PARALLEL-OK
- **Context:** The core record of a job application and its lifecycle. Status transitions are a Critical Business Rule, so they live here, not in the use case. See `docs/architecture/README.md` §2 "Entities".
- **Files:**
  - create `src/tracker/entities/application.py`
  - create `tests/unit/entities/test_application.py`
- **Acceptance criteria:**
  - [ ] Creating an `Application` with an empty company name raises `InvalidApplication`
  - [ ] A new application has status `Applied`
  - [ ] `advance(Rejected)` from `Applied` succeeds; `advance(Interviewing)` from `Rejected` raises `IllegalTransition`
- **Verify:**
  ```bash
  pytest tests/unit/entities -q
  lint-imports
  ```

### P1-T03 — `RecordApplication` use case and `ApplicationRepository` / `Clock` ports

- **Traces to:** UC-1, P-1, P-2
- **Layer:** Use cases — must not import `tracker.adapters`, `tracker.cli`, `sqlite3`
- **Depends on:** P1-T01, P0-T05 (error model)
- **Size:** M
- **Context:** Accepts a request model (company, role), stamps the applied date from `Clock`, saves through the repository, returns a response model with the new ID. Ports are abstract base classes owned by this layer. See README §3 "Use cases", ADR-0001.
- **Files:**
  - create `src/tracker/usecases/record_application.py`
  - create `src/tracker/usecases/ports.py`
- **Acceptance criteria:**
  - [ ] Returns a response with a non-empty ID and `applied_on` equal to the clock's today
  - [ ] Returns `DuplicateApplication` when the same company and role already exist with a non-terminal status
- **Verify:**
  ```bash
  pytest tests/unit/usecases/test_record_application.py -q
  lint-imports
  ```

### P1-T05 — Repository contract test suite

- **Traces to:** P-1, A-1
- **Layer:** Tests (interface adapters)
- **Depends on:** P1-T04 (in-memory fake)
- **Size:** M
- **Context:** One parametrized suite run against every `ApplicationRepository` implementation, so the fake cannot drift from SQLite. Fixtures supply each implementation.
- **Files:** create `tests/contract/test_application_repository.py`
- **Acceptance criteria:**
  - [ ] Suite passes against the in-memory fake
  - [ ] Save-then-get round-trips every field; get of an unknown ID returns `None`
- **Verify:**
  ```bash
  pytest tests/contract -q
  ```

### P1-T09 — End-to-end acceptance test for UC-1

- **Traces to:** UC-1, D-1, A-1
- **Layer:** Tests (end to end through Main)
- **Depends on:** P1-T08
- **Size:** S
- **Acceptance criteria:**
  - [ ] `tracker add "Acme" "Backend Engineer"` then a fresh process running `tracker list` shows the entry, using a temp database path
- **Verify:**
  ```bash
  pytest tests/e2e/test_record_application.py -q
  ```

## Gate 1

- **Exit criteria:** `pytest -q` green; `lint-imports` green; `tests/e2e/test_record_application.py` green
- **Demo:**
  ```bash
  tracker --db /tmp/demo.db add "Acme" "Backend Engineer" && tracker --db /tmp/demo.db list
  ```
  Expected: one row, status `Applied`, today's date.
- **Human checkpoint:** Is the CLI shape right before UC-2 and UC-3 build on it? Is the duplicate rule what you want?

## What to notice

- Each task is one session's work and names its forbidden imports.
- Criteria are behaviors with named errors, not "implement validation".
- Every Verify is a command; the boundary check runs on every core-layer task.
- The fake (P1-T04) and its contract suite (P1-T05) precede the SQLite adapter, so the core is proven with no infrastructure.
- No hours or days anywhere.
