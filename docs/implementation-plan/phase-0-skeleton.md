# Phase 0: Verify and complete the walking skeleton

Goal: `pnpm verify` and CI are green on every push, a trivial request runs through every layer from the dev Main, and the model runtime decision (D1) is recorded.
Detail level: Full
Traces to: X-1, X-3, X-4, X-5, X-6, X-11, M-1, M-2, D-10 (smoke), D1 (deferred.md)
Prerequisites: H-0 done (the scope-revision work and this plan amendment committed). Node 22.18 or later and pnpm 10.28.
Amended 2026-11-11 for the scope revision (ADRs 0014 to 0016): the smoke request, the testing-API gaps and the storage contract suites now use person profiles and spending instead of accounts and the trial; H-1 asks the local runtime question; ADR 0009 is still to be written (P0-T10).

The skeleton already exists (see PLAN.md "Starting point"). This phase verifies it, closes the gaps that would bite later (the checker has no tests of its own, there is no CI, no place for contract tests or evaluations, background failures in the testing API are thrown inside a promise chain), and settles the model runtime on the owner's machine before Phase 1 needs it.

The gate has two parts. **Gate 0A (technical)** covers P0-T01 to P0-T09; Phase 1 tasks that need no model decision (P1-T01 to P1-T08) may start once it passes. **Gate 0B (decision)** is P0-T10; P1-T10 (real resume parsing) may not start before it.

## Tasks

### P0-T01 — Baseline the toolchain from a clean clone

- **Traces to:** X-3, ADR 0001 §1
- **Layer:** Root tooling — must not touch any package source
- **Depends on:** H-0
- **Size:** S
- **Context:** Confirms the skeleton the Architect left is reproducible, and pins the runtime so every session and CI use the same Node. `package.json` already declares `engines.node >=22.18` and `packageManager pnpm@10.28.0`. See `docs/architecture/README.md` "Enforcement".
- **Files:**
  - create `.node-version` (one line: the Node 22 version in use, 22.18 or later)
  - modify `docs/implementation-plan/PROGRESS.md` (Notes: the measured baseline)
- **Acceptance criteria:**
  - [ ] In a fresh clone, `pnpm install --frozen-lockfile && pnpm verify` exits 0 with 7 components and at least 22 passing tests (the count after the scope revision)
  - [ ] `pnpm metrics` output is recorded in PROGRESS.md Notes as the D baseline (rules D=1.00 is accepted, watch item W1)
  - [ ] `node apps/main/src/main.dev.ts` exits 0 promptly (the monitoring ticker does not keep the process alive)
- **Verify:**
  ```bash
  pnpm install --frozen-lockfile && pnpm verify && pnpm metrics && node apps/main/src/main.dev.ts
  ```

### P0-T02 — Regression tests for the architecture check

- **Traces to:** X-3, ADR 0001 §5
- **Layer:** Tools — `tools/architecture` may use `node:*`; it must not import any `@matchmaker/*` package
- **Depends on:** P0-T01
- **Size:** M  PARALLEL-OK
- **Context:** `check.mjs` is the only thing standing between a hurried session and an outward import, and today nothing fails if it is loosened. A probe (2026-11-11) showed it catches the violations below; pin that. Each case copies a minimal fixture workspace into a temp directory, injects one violation and asserts the exit code and message. Make `check.mjs` accept a root directory (argument or env var) instead of deriving it only from its own path, so fixtures can be checked.
- **Files:**
  - modify `tools/architecture/check.mjs` (root directory as a parameter; no rule changes)
  - create `tools/architecture/test/check.test.mjs`
  - create `tools/architecture/test/fixtures/` (a minimal two- or three-package workspace with `components.mjs`)
  - modify `package.json` (`test` script also runs `tools/architecture/test/*.test.mjs`)
- **Acceptance criteria:**
  - [ ] The clean fixture passes with exit 0
  - [ ] Each of these fails with exit 1 and names the file: an outward arrow (use-cases importing adapters); `node:fs` in rules; a library import in rules; a cross-area import in use-cases; `@matchmaker/use-cases/wiring` imported outside Main; a relative import leaving its package; a manifest declaring a forbidden dependency; a package cycle; an adapter subfolder importing another
  - [ ] Running the check on the real repository still prints `architecture ok`
- **Verify:**
  ```bash
  node --test "tools/architecture/test/*.test.mjs" && pnpm check:architecture
  ```

### P0-T03 — Extend checker and test coverage to new directories

- **Traces to:** X-3, X-5, X-6
- **Layer:** Tools and root configuration
- **Depends on:** P0-T02
- **Size:** S
- **Context:** Later tasks add `packages/testing-api/contract/` (adapter contract suites) and `apps/main/eval/` (evaluations, a Main configuration). The checker scans only `src/` and `test/`, and tsconfigs include only `src/` (testing-api also `test/`), so code in the new directories would escape both checks. Also add `apps/*/test/` to the test glob for Main tests.
- **Files:**
  - modify `tools/architecture/check.mjs` (scan `src`, `test`, `contract`, `eval` when present)
  - modify `packages/testing-api/tsconfig.json` (include `contract/**/*.ts`)
  - modify `apps/main/tsconfig.json` (include `eval/**/*.ts`, `test/**/*.ts`)
  - modify `package.json` (`test` script globs `packages/*/test/**/*.test.ts`, `apps/*/test/**/*.test.ts`, `tools/**/test/*.test.mjs`; add `test:contract` globbing `packages/testing-api/contract/**/*.contract.test.ts`; `verify` runs `test:contract`)
  - modify `tools/architecture/test/check.test.mjs` (a violation inside `contract/` and inside `eval/` is caught)
- **Acceptance criteria:**
  - [ ] A forbidden import placed in a fixture's `contract/` or `eval/` directory fails the check
  - [ ] `pnpm verify` runs typecheck, check, `test` and `test:contract` (the last may find zero files until P0-T06)
- **Verify:**
  ```bash
  node --test "tools/architecture/test/*.test.mjs" && pnpm verify
  ```

### P0-T04 — Complete the testing API as a Main configuration

- **Traces to:** M-2, ADR 0008, X-1
- **Layer:** Tests (`packages/testing-api/src`) — tests in `test/` must import only `@matchmaker/testing-api`
- **Depends on:** P0-T01
- **Size:** M  PARALLEL-OK
- **Context:** Gaps in `packages/testing-api/src/matchmaker-testing-api.ts`. (1) `onBackgroundError` throws inside the queue's promise chain, so a failed background search surfaces as an unhandled rejection rather than a clear test failure; collect errors instead and make `backgroundWorkSettled()` reject with them. (2) `operatorConsole: Object.assign(this.store, ...)` mutates the store; build a separate object. (3) Add the superpowers the existing use cases still lack: `searchesRequested` (observe the request ports Main wires) and `onboardingSearch(personId)` that goes through `requests.searchRequests` and the queue. Switching a source off already exists as `switchSource(name, false)` (built by the Architect with ADR 0016); do not add a second operation for it. Also document, in a header comment, the rule that every new port gets a scripted double here when its slice arrives.
- **Files:**
  - modify `packages/testing-api/src/matchmaker-testing-api.ts`
  - create `packages/testing-api/test/skeleton.test.ts`
- **Acceptance criteria:**
  - [ ] A test where the scripted planner throws during an onboarding search sees `backgroundWorkSettled()` reject with a message naming the task `search:<personId>`
  - [ ] After `switchSource("board-b", false)`, a search does not call that source and does not list it as failed
  - [ ] Setting a source's switch through `switchSource` leaves `InMemoryStore`'s own methods unchanged (no `recent` property added to the store)
  - [ ] `UseCaseError` codes reach the test unchanged (a fourth manual search on one day rejects with code `daily-cap-reached`; with the monthly budget spent, a manual search without confirmation rejects with `monthly-budget-reached`)
  - [ ] The 22 existing tests still pass unchanged
- **Verify:**
  ```bash
  node --test "packages/testing-api/test/*.test.ts" && pnpm verify
  ```

### P0-T05 — Walking skeleton through the dev Main

- **Traces to:** D-10, M-1, D-1, D-2, UC-16, UC-17, UC-19, UC-9, E-16, A-1, P-1
- **Layer:** Main (`apps/main/src`) — must not import `@matchmaker/testing-api`
- **Depends on:** P0-T01
- **Size:** S  PARALLEL-OK
- **Context:** `main.dev.ts` builds the app, starts the monitoring ticker and prints interactor names; no request travels through it. Add a `smoke` command: create a profile named "Smoke" through `CreatePerson`, open it through `OpenPerson`, read the running cost through `ViewRunningCost` and `presentRunningCost`, list results through `ResultsController.show` (empty), and print both view models as JSON. That one request crosses Main, delivery (controller and presenters), use cases, rules (`normalizeDisplayName`, `budgetStatus`, `monthContaining`) and adapters (`InMemoryStore`, `InMemorySpendLedger`, `SystemClock`, `RandomIds`). The smoke command does not start the ticker. See README "Main", ADR 0014, ADR 0015.
- **Files:**
  - modify `apps/main/src/main.dev.ts` (argument dispatch: no argument keeps today's output; `smoke` runs the request)
  - modify `package.json` (script `smoke`: `node apps/main/src/main.dev.ts smoke`)
  - create `apps/main/test/smoke.test.ts` (spawns the script and checks output)
- **Acceptance criteria:**
  - [ ] `pnpm smoke` exits 0 and prints a running-cost view model with one row `{ "name": "Smoke", "amount": "$0.00" }`, `"budgetLine": "No monthly budget set"` and `"budgetReached": false`, and a results view model with three tabs labelled Apply, Within reach, Not a fit, each count `"0"`, and a non-null empty-Apply heading
  - [ ] The smoke test is part of `pnpm test`
- **Verify:**
  ```bash
  pnpm smoke && node --test "apps/main/test/*.test.ts" && pnpm check:architecture
  ```

### P0-T06 — Home for adapter contract suites, with the first storage suite

- **Traces to:** X-6, A-1, A-28, P-2, P-7, P-15, P-21, P-23, P-29, P-30, P-31, P-32, ADR 0014, ADR 0015
- **Layer:** Tests (`packages/testing-api/contract`) — may import adapters and use-case types; must not import `/wiring` or Main internals
- **Depends on:** P0-T03
- **Size:** M
- **Context:** Every port gets one shared suite run against the fake and every real adapter, so `InMemoryStore` cannot drift from the local database later (D2). Each suite is a function taking a factory, e.g. `matchRecordsContract(name, () => new InMemoryStore())`, so Phase 3 calls it again with the local database adapter. Start with the gateways the matching core, profiles and spending already rely on. Every store that holds a person's data gets the `PersonDataVault` suite: export holds only that person's records, and "erase leaves nothing of the person" (ADR 0014 Consequences), except the spend ledger, which keeps the records with `personId` null. The known gap in `InMemoryStore` (`setEnabled` defaults tier to 1) is a `todo` case naming Phase 5 (P5-T03).
- **Files:**
  - create `packages/testing-api/contract/storage-contracts.ts` (suite functions: `PostingCatalog`, `PostingsForScoring`, `MatchRecords`, `ResultsReadModel`, `ProfileVersions`, `People`, `MonitoringRoster`, `MonthlyBudgetControl`, `UsageLedger`, `SpendLedger`, `PersonDataVault`)
  - create `packages/testing-api/contract/in-memory-store.contract.test.ts`
- **Acceptance criteria:**
  - [ ] Save-then-find round-trips every `JobPosting` field; `findByIdentityKey` of an unknown key returns `null`; `markClosed` removes a posting from `openPostings`
  - [ ] `findMatch` distinguishes profile version and posting revision; `latestVerdictBefore` ignores matches under the given profile version
  - [ ] `currentResults` returns only matches for the active profile version
  - [ ] `jobDetail` returns the evidence of the match's own profile version and `null` without an active-version match (ADR 0012)
  - [ ] `People`: `add` then `personOf` round-trips; `exists` is false for an unknown id; `rename` changes only the name; `recordOpened` updates the last-opened time
  - [ ] `MonitoringRoster.peopleWithMonitoringOn` lists a person only after their first search has run, with their last search and last opened times
  - [ ] `MonthlyBudgetControl`: an unset budget reads `null`; set then read round-trips; setting `null` clears it
  - [ ] `UsageLedger.usedToday` counts per person, per action and per UTC day (an action at 23:59 UTC does not count the next day)
  - [ ] `SpendLedger`: `spentOnRun` sums only that run; `spentBy` and `totalSpent` respect the half-open period (ADR 0010, 0015)
  - [ ] `PersonDataVault` on each in-memory store (`InMemoryStore`, `InMemoryUsageLedger`, `InMemorySpendLedger`, `InMemoryProductEventLog`) and on `JsonArchiveVault` over them: export holds only that person's data; after `eraseAll` nothing of the person remains, another person's data is untouched, and spend records remain with `personId` null
  - [ ] `saveNewVersion` makes the newest version active and keeps earlier ones
  - [ ] `pnpm test:contract` runs the suites and they pass against `InMemoryStore`
- **Verify:**
  ```bash
  pnpm test:contract && pnpm check:architecture
  ```

### P0-T07 — Evaluation harness scaffold

- **Traces to:** X-5, ADR 0002 Consequences, ADR 0008
- **Layer:** Main (`apps/main/eval`) — a Main configuration; must not import `@matchmaker/testing-api`
- **Depends on:** P0-T03
- **Size:** M
- **Context:** Three phase exits are evaluations, not unit tests: parsing accuracy (Gate 1), score stability (Gate 2), ATS parse (Gate 4). They run real adapters, cost money and need keys, so they stay out of `pnpm verify`. Build the harness once: an evaluation is a module exporting `name`, `run(details)` returning per-case results, and `threshold(results)`; the runner composes the app with `composeMatchmaker`, writes a JSON and a Markdown report to `apps/main/eval/results/<name>-<timestamp>/` (gitignored), prints a summary and exits non-zero when the threshold fails. Ship one sample evaluation that uses scripted details so the harness itself is tested without keys.
- **Files:**
  - create `apps/main/eval/run-eval.ts` (runner: `node apps/main/eval/run-eval.ts <name>`)
  - create `apps/main/eval/evaluation.ts` (the evaluation type)
  - create `apps/main/eval/sample/sample.eval.ts`
  - create `apps/main/test/eval-harness.test.ts`
  - modify `package.json` (script `eval`: `node apps/main/eval/run-eval.ts`)
  - modify `.gitignore` (`apps/main/eval/results/`, `apps/main/eval/fixtures/private/`)
- **Acceptance criteria:**
  - [ ] `pnpm eval sample` exits 0 and writes `report.md` and `results.json`
  - [ ] A sample run with a failing threshold exits 1 and the report says which cases failed
  - [ ] An unknown evaluation name exits 2 and lists the known ones
- **Verify:**
  ```bash
  pnpm eval sample && node --test apps/main/test/eval-harness.test.ts && pnpm check:architecture
  ```

### P0-T08 — Formatter and lint check

- **Traces to:** X-11
- **Layer:** Root tooling
- **Depends on:** P0-T01
- **Size:** S  PARALLEL-OK
- **Context:** Add Biome as one root dev dependency (look up its current configuration format in its documentation rather than writing it from memory). Formatting only plus recommended lint rules that do not overlap `tsc` strictness. Reformat the codebase in one commit that changes no behavior, then add `pnpm lint` to `verify`.
- **Files:**
  - modify `package.json` (dev dependency, scripts `lint` and `format`, `verify` runs `lint`)
  - create `biome.json`
  - modify any source file reformatted (formatting only)
- **Acceptance criteria:**
  - [ ] `pnpm lint` exits 0 on the repository; an introduced unused variable or misformatted file makes it exit 1
  - [ ] `git diff --stat` of the reformat commit touches only whitespace and punctuation (tests and check still green)
- **Verify:**
  ```bash
  pnpm lint && pnpm verify
  ```

### P0-T09 — Continuous integration

- **Traces to:** X-4
- **Layer:** Root tooling
- **Depends on:** P0-T03, P0-T05 (P0-T08 if done first)
- **Size:** S
- **Context:** The repository is on GitHub (`origin`). One workflow on push and pull request: set up Node from `.node-version`, enable Corepack for the pinned pnpm, `pnpm install --frozen-lockfile`, `pnpm verify`, `pnpm smoke`. Evaluations are not run in CI. Look up current action versions in their documentation.
- **Files:**
  - create `.github/workflows/verify.yml`
- **Acceptance criteria:**
  - [ ] The workflow runs on a pushed branch and passes
  - [ ] A deliberately failing test on a throwaway branch makes it fail (then delete the branch)
- **Verify:**
  ```bash
  gh run list --workflow verify.yml --limit 1
  ```

### SPIKE S-1 — Which runtime implements each model port?

- **Question:** For each need-named model port (ADR 0003: `ResumeAnalyst`, `DocumentReader` only if OCR needs a model, `SearchPlanner`, `PostingEnricher`, `RelevanceRanker`, `MatchJudge`, `Interviewer`, `ResumeWriter`, `KeywordMatcher`), which of the two runtimes the PRD and ADR 0016 name should run it on the owner's machine: Claude Code headless with the owner's subscription, or the Claude API with the owner's API key (or a mix per port)? The ports are single structured judgments, which is the API's simplest tier. Measure on two sample resumes and five postings: structured output against a schema (`output_config.format` on the API; the equivalent for headless Claude Code), latency against the NFRs (card within 20 s, first result within 60 s), cost per call, and the no-training settings available on the owner's account (Privacy 4). For the subscription route, find out what spend each call can report (a priced estimate, or nothing), since the monthly budget depends on it (ADR 0015). Confirm that current models reject `temperature` (the PRD's consistency rule 1), the fact behind the replacement the user already approved. Find out whether an embeddings source is available for `RelevanceRanker` or in-process lexical ranking is needed (D3). Use the `claude-api` skill and current Anthropic documentation, not memory, for model IDs and parameters.
- **Time box:** One session
- **Feeds decision:** D1 and D3, recorded in ADR 0009 (still to be written): one adapter per port in a model-runtime package, model tiering per port (small model for enrichment, large for judging, interview, tailoring), how the owner's credential reaches the adapters (ADR 0016 §5), how subscription spend is reported, and the approved replacement for "temperature 0" (PLAN.md answered question 2)
- **Deliverable:** a short written answer appended to PLAN.md "Spike answers" with measurements; code on a throwaway branch, not merged. If H-1 is already done and the answer is firm, the spike may hand it straight to `/architect` to write ADR 0009; P0-T10 then only checks the ADR against its criteria.

### HUMAN H-1 — Choose the runtime on the owner's machine

- **What the user must do:** Choose the runtime on the owner's machine: Claude Code headless with your own subscription vs the Claude API with your own key (PRD open question 1, "Agent architecture"). Read Anthropic's current terms and the Claude Code documentation on headless use with a subscription, bearing in mind that friends' resumes pass through it; the PRD makes the API key the default if the terms are unclear. Write the choice (and, for the subscription, any conditions you found) in PROGRESS.md Notes.
- **Blocks:** P0-T10, and through it P1-T10
- **Done when:** PROGRESS.md Notes has the dated choice and its source.

### P0-T10 — Record the model runtime decision (D1)

- **Traces to:** D1, D3, ADR 0003, ADR 0015 (spend under the subscription), ADR 0016 §5, X-2, X-9
- **Layer:** Architecture documents only
- **Depends on:** S-1, H-1
- **Size:** S
- **Context:** ADR 0009 does not exist yet; its number is reserved for this decision. Hand the S-1 answer and the H-1 choice to `/architect`, which writes ADR 0009: runtime per port (Claude Code headless with the owner's subscription, the Claude API with the owner's key, or a mix), model tiering as Main configuration, the package that will hold the adapters under W2, how Main gathers the owner's credential from local configuration (ADR 0016 §5), whether subscription calls report a priced estimate or zero spend (ADR 0015), and the replacement for "temperature 0" that the user approved (structured output, fixed rubric, cached judgments; PLAN.md answered question 2). It also updates `deferred.md` D1 and D3 and README "Main". If S-1 already led `/architect` to write ADR 0009, this task checks it against the criteria below and fills any gap. No port signature changes unless the ADR says so; if one must, list the affected tasks for re-planning.
- **Files:**
  - create `docs/architecture/adr/0009-*.md` (written by `/architect`)
  - modify `docs/architecture/deferred.md`, `docs/architecture/README.md` (by `/architect`)
  - modify `docs/implementation-plan/PLAN.md` (Spike answers; Deferred decisions honored) and `phase-1-foundations.md` P1-T10 Files if the package name differs
- **Acceptance criteria:**
  - [ ] ADR 0009 exists with status accepted and names, for each model port, the runtime and model tier
  - [ ] It records the "temperature 0" replacement, the credential handling and how subscription spend is reported
  - [ ] `deferred.md` D1 is marked decided with a link to ADR 0009
  - [ ] `pnpm verify` still green (documents only)
- **Verify:**
  ```bash
  ls docs/architecture/adr/0009-*.md && grep -n "D1" docs/architecture/deferred.md && pnpm verify
  ```

## Gate 0

- **Exit criteria (0A, technical):**
  - [ ] Full suite green: `pnpm verify` (typecheck, architecture check, lint, tests, contract tests)
  - [ ] Boundary check green and self-tested: `pnpm check:architecture && node --test "tools/architecture/test/*.test.mjs"`
  - [ ] CI green on the default branch: `gh run list --workflow verify.yml --limit 1`
  - [ ] Skeleton acceptance: `pnpm smoke` and `pnpm eval sample`
- **Exit criteria (0B, decision):**
  - [ ] ADR 0009 accepted; D1 decided (P0-T10)
- **Demo:**
  ```bash
  pnpm verify && pnpm smoke && pnpm eval sample
  ```
  Expected: all checks pass; the smoke prints a running-cost view model with the "Smoke" profile at $0.00 and no budget, and an empty three-tab results view model; the sample evaluation writes a report.
- **Human checkpoint:** Test placement, open questions 1 to 3 and the parsing thresholds (H-4) are already answered (PLAN.md). Check that H-1 and H-3 have started, and look at PLAN.md open question 1 (Tier 4 boards, needed by Gate 4). Review `deferred.md`.
- **Detail next phase:** Phase 1 is already detailed; re-read it against ADR 0009 and amend P1-T10 if the runtime or package name differs.
