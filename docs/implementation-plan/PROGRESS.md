# Progress

Current phase: 0 — Verify and complete the walking skeleton
Next task: S-1 confirmation run on the owner's machine, then P0-T10; Phase 1 (P1-T01 to P1-T08) in a fresh session
Last updated: 2026-11-12 by execution (P0-T09)

## Status

Legend: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked (reason in Notes) · `[-]` dropped (see deviations)

### HUMAN tasks to start now
- [x] H-0 Commit the scope-revision work (PRD, ADRs 0014 to 0016, README, deferred.md, code) and this plan amendment
- [x] H-1 Runtime: Claude Code headless with the owner's existing subscription (2026-11-12)
- [x] H-3 Consented test resumes: 6 received (owner's cap); the owner confirmed all six consented (2026-11-12)

### Phase 0 — Verify and complete the walking skeleton
- [x] P0-T01 Baseline the toolchain from a clean clone
- [x] P0-T02 Regression tests for the architecture check
- [x] P0-T03 Extend checker and test coverage to new directories
- [x] P0-T04 Complete the testing API as a Main configuration
- [x] P0-T05 Walking skeleton through the dev Main
- [x] P0-T06 Home for adapter contract suites, with the first storage suite
- [x] P0-T07 Evaluation harness scaffold
- [x] P0-T08 Formatter and lint check
- [x] P0-T09 Continuous integration
- [x] S-1 Which runtime implements each model port?
- [x] H-1 Runtime on the owner's machine chosen (subscription)
- [x] GATE 0A (technical) — approved by the owner 2026-11-12 (Phase 1 tasks P1-T01 to P1-T08 may start)
- [ ] P0-T10 Record the model runtime decision (D1) in ADR 0009 (not yet written)
- [ ] GATE 0B (decision)
- [ ] H-2 Owner's model account, no-training setting, local credential (after P0-T10)
- [x] H-4 Parsing thresholds confirmed (default accepted)

### Phase 1 — Foundations (exit: 20 resumes parse correctly)
- [ ] P1-T01 In-memory resume files and onboarding storage contracts
- [ ] P1-T02 Wire intake and profile correction through Main and the testing API
- [ ] P1-T03 Rules: choose 5 to 8 selling points and suggest a target seniority band
- [ ] P1-T04 `IntakeResume` use case
- [ ] P1-T05 `CorrectProfile`: facts and selling points
- [x] P1-T06 Profile and spending acceptance tests (built by the Architect; replaces account and trial tests)
- [ ] P1-T07 Onboarding controllers and presenters
- [ ] P1-T08 Documents package: read text, DOCX, PDF and LinkedIn PDF
- [ ] P1-T09 OCR for image-only PDFs
- [ ] P1-T10 Model runtime package, configuration loader and the resume analyst
- [ ] P1-T11 Parsing evaluation (exit test)
- [ ] P1-T12 Dev intake driver
- [ ] S-2 Initial Tier 1 company registry
- [ ] H-5 Registry source chosen
- [ ] H-6 Adzuna and USAJobs keys
- [ ] GATE 1

### Phase 2 — Matching core (exit: 95% score stability)
- [ ] P2-T01 Characterization tests for the existing matching rules
- [ ] P2-T02 Fairness redaction in `toScoringProfile`
- [ ] P2-T03 Second-stage deduplication and posting revisions
- [ ] P2-T04 `JobSource` contract suite and HTTP posting liveness
- [ ] P2-T05 Greenhouse adapter and the Tier 1 registry seed
- [ ] P2-T06 Lever, Ashby and Workable adapters
- [ ] P2-T07 SmartRecruiters and Recruitee adapters
- [ ] P2-T08 Tier 2 keyless APIs
- [ ] P2-T09 Tier 2 keyed APIs: Adzuna and USAJobs
- [ ] P2-T10 Tier 2 feeds: We Work Remotely and Hacker News
- [ ] P2-T11 Search planner and posting enricher adapters
- [ ] P2-T12 Match judge adapter
- [ ] P2-T13 Relevance ranker (prefilter)
- [ ] P2-T14 Score stability evaluation (exit test)
- [ ] P2-T15 `CorrectProfile` preferences branch (use-case side)
- [ ] P2-T16 Dev search driver and timing report
- [ ] S-3 Web framework, SSE on localhost, request hook for the local-request check
- [ ] H-7 Stability set approved; calibration values confirmed
- [ ] H-9 Five consenting test users lined up
- [ ] GATE 2

### Phase 3 — Results experience (outline; exit: five users reach Apply in under 10 minutes)
- [ ] P3-T01 to P3-T15 (detailed at Gate 2; P3-T08 local database, P3-T09 data folder, P3-T10 local web Main with picker and loopback check)
- [ ] S-4 ATS parsers; S-6 running-cost model
- [ ] H-11, H-12, H-16
- [ ] GATE 3

### Phase 4 — Tailoring (outline; exit: three ATS parsers parse cleanly)
- [ ] P4-T01 to P4-T08 (detailed at Gate 3)
- [ ] S-5 Tier 4 bridge (only if PLAN.md open question 1 names a board)
- [ ] GATE 4

### Phase 5 — Full coverage and monitoring (outline; exit: any single source disabled)
- [ ] P5-T01 Tier 3 aggregator adapters
- [ ] P5-T02 Tier 4 adapters for boards the owner names (conditional)
- [ ] P5-T03 The owner's sources screen and run summaries
- [-] P5-T04 Durable queue and `apps/worker` (dropped: one local process, ADR 0016)
- [x] P5-T05 Monitoring roster and scheduled runs (built by the Architect)
- [ ] P5-T06 Daily re-check of stored postings while the app runs
- [ ] P5-T07 Inbox
- [ ] P5-T08 Any-single-source-disabled test (exit test)
- [ ] S-7 Packaging for a one-command install
- [ ] H-17 Fresh machine ready
- [ ] GATE 5

### Phase 6 — Local packaging and data controls (outline; exit: fresh machine install, first match, export and delete)
- [ ] P6-T01 Profile-management screens
- [ ] P6-T02 Export and delete screens
- [ ] P6-T03 Spend panel screen
- [ ] P6-T04 Budget screen and "ask first"
- [ ] P6-T05 Cancel a person's queued work on delete (W16)
- [ ] P6-T06 Export and delete complete across every local store
- [ ] P6-T07 Record the packaging decision (D15)
- [ ] P6-T08 One-command install and start; the owner's README
- [ ] P6-T09 Fresh-machine exit test
- [ ] GATE 6

## Notes

- 2026-11-11 (planning): `pnpm verify` green on commit 6b5684f (7 components, 71 files, 6 tests). `node apps/main/src/main.dev.ts` exits 0. `pnpm metrics`: rules D=1.00 (accepted, W1), use-cases D=0.05, delivery 0.40, adapters 0.38, main 0.33.
- 2026-11-11 (amendment): re-surveyed the working tree after the Architect's scope-revision changes (uncommitted on top of ae33ed0). `pnpm verify` green: 7 components, 87 files, 22 tests in 9 files. `node apps/main/src/main.dev.ts` exits 0 and lists 18 use cases. `pnpm metrics`: rules D=1.00 (W1), use-cases 0.05, delivery 0.40, adapters 0.27, scraping-sources 0.00, main 0.33.
- 2026-11-11 (planning): the architecture check was probed in a scratch copy with injected violations; it reported each one. P0-T02 turns that probe into permanent tests.
- Tests talk only to `MatchmakerTestingApi` (ADR 0008); `packages/rules` cannot hold tests (`node:*` is forbidden there). Adapter contract suites go in `packages/testing-api/contract/`; evaluations in `apps/main/eval/`.
- **ADR 0009 does not exist yet.** The number is reserved for the runtime decision. P0-T10 writes it (or `/architect` writes it from S-1's answer if S-1 settles it first). It must record the "temperature 0" replacement the user approved (structured output, fixed rubric, cached judgments; current Claude models reject `temperature`), the runtime per port, the owner's credential handling, and how subscription spend is reported. Later tasks that cite ADR 0009 depend on Gate 0B. New ADRs take numbers from 0017.
- Known gaps the Architect left as hand-offs: `IntakeResume`, `ConductInterview` and `TailorResume` must call `SpendingGuard` when built (P1-T04, P3-T02, P4-T03); `DeletePerson` does not cancel queued work (W16, P6-T05); `InMemoryStore.setEnabled` defaults the tier to 1 (P5-T03); the testing API still throws background errors inside the queue and mutates the store for `operatorConsole` (P0-T04).
- 2026-11-12 (H-0): the scope-revision work and plan amendment are committed (d13cfc0, 035db16); the working branch was fast-forwarded onto them.
- 2026-11-12 (P0-T01): fresh clone on Node 22.23.4 (pinned in `.node-version`), pnpm 10.28.0: `pnpm install --frozen-lockfile && pnpm verify` green, 7 components, 87 files, 22/22 tests. D baseline (`pnpm metrics`): rules 1.00 (W1, accepted), use-cases 0.05, delivery 0.40, adapters 0.27, scraping-sources 0.00, main 0.33, testing-api 0.00. `node apps/main/src/main.dev.ts` exits 0 in 0.1 s.
- 2026-11-12 (P0-T02): `check.mjs` takes `--root <dir>` (or `ARCH_ROOT`) and reads `<root>/tools/architecture/components.mjs`; no rule changed. 11 checker tests (clean fixture, nine injected violations, real repo) in `tools/architecture/test/`, part of `pnpm test` (33 tests). A mutation that disables the `node:*` rule makes the matching case fail.
- 2026-11-12 (P0-T03): the checker scans `src`, `test`, `contract` and `eval`; testing-api typechecks `contract/`, Main typechecks `eval/` and `test/`. `pnpm test` also globs `apps/*/test` and `tools/**/test`; `pnpm verify` ends with `test:contract` (0 files until P0-T06). 35 tests.
- 2026-11-12 (P0-T04): the testing API collects background failures; `backgroundWorkSettled()` (and `appStarts()`) rejects once with every failed task named. `operatorConsole` is its own object delegating to the store. New superpowers: `searchPlannerFails`, `onboardingSearch`, `searchesRequested` (wraps the `searchRequests` port Main returns; monitoring looks it up per call). Header comment states the scripted-double rule. 4 tests in `skeleton.test.ts`; the 22 earlier tests unchanged. "No `recent` property on the store" cannot be asserted through the testing API (ADR 0008), so it was checked by a one-off probe (store has no `recent`). `UseCaseError` does not set `name`, so tests match on `code` only.
- 2026-11-12 (P0-T05): `pnpm smoke` runs CreatePerson, OpenPerson, ViewRunningCost + `presentRunningCost`, and `ResultsController.show`, printing both view models (Smoke at $0.00, no budget; three empty tabs; empty-Apply heading set). No ticker in smoke; an unknown command exits 2. `apps/main/test/smoke.test.ts` spawns it inside `pnpm test` (41 tests).
- 2026-11-12 (P0-T06): `packages/testing-api/contract/storage-contracts.ts` holds factory-taking suites for `PostingCatalog`+`PostingsForScoring`, `ProfileVersions`, `MatchRecords`, `ResultsReadModel`, `People`, `MonitoringRoster`, `MonthlyBudgetControl`, `UsageLedger`, `SpendLedger`, `SourceSwitchControl` and `PersonDataVault` (opaque exports checked by markers). Run against `InMemoryStore`, the three in-memory ledgers and `JsonArchiveVault` over them: 39 pass, 1 todo (tier default, P5-T03). Mutations to `latestVerdictBefore` and to `eraseAll` make the suites fail. `pnpm verify`: 41 tests + 40 contract cases.
- 2026-11-12 (P0-T07): `pnpm eval <name> [--key=value]` runs `apps/main/eval/<name>/<name>.eval.ts`. An `Evaluation` has `name`, `description`, `configure(options)` returning `{ details, run(app) }` (the plan's `run(details)`: the runner composes the app from the evaluation's details) and `threshold(results)`. Reports go to `apps/main/eval/results/<name>-<timestamp>/` (gitignored; `EVAL_RESULTS_DIR` overrides). Exit 0 pass, 1 threshold failed, 2 unknown name. `eval/in-memory-details.ts` gives in-memory details for evaluations to override. The sample scores three scripted cases; `--break=<case>` forces a failure. 3 tests in `apps/main/test/eval-harness.test.ts`.
- 2026-11-12 (metrics, watch): since P0-T05/T06, `pnpm check:architecture` prints a warning "SDP: delivery (I=0.50) depends on use-cases (I=0.50)". No production dependency changed: the checker counts test, contract and Main files as fan-in, so `main.dev.ts` importing delivery and the contract suite importing use-cases types moved both to 0.50. Warning only; raised at Gate 0.
- 2026-11-12 (P0-T08): Biome 2.6.7 (config from `biome init`), limited to `.ts`, `.mjs`, `.json` so docs are untouched; 2-space indent, double quotes, line width 140. Recommended rules except `style/noNonNullAssertion` and `complexity/useLiteralKeys`, which fight the `!` and `["key"]` escapes the code uses for `noUncheckedIndexedAccess`. Two commits: a formatting-only reformat (every changed source equal to the old one once whitespace and punctuation are ignored), then two lint fixes (`self` alias in the testing API; `forEach` returning a value in `RunJobSearch.fetchAll`, now a `for` loop) and `pnpm lint` (`biome check .`) in `verify`. An unused variable or a misformatted file makes `pnpm lint` exit 1.
- 2026-11-12 (P0-T09): `.github/workflows/verify.yml` (actions/checkout v7.0.1, actions/setup-node v7.1.0 with `.node-version`, pnpm through Corepack, frozen install, `pnpm verify`, `pnpm smoke`). Run 43181059712 on 71057d4 passed. A probe commit with a failing test (9cc7ddc) made run 43181144195 fail; the probe was removed in the next commit. Merged to `main` on the owner's instruction (fast-forward to 7d13c3f); CI run 43182882370 on `main` passed.
- 2026-11-12 (S-1, P0-T10): S-1 has no task dependencies, but its measurements (structured output, latency, what spend headless calls report) must run Claude Code headless on the owner's subscription on the owner's machine. This container has neither, and a run here would not measure the owner's setup, so S-1 is left for the owner (or a session on their machine). P0-T10 and Gate 0B wait on it.
- 2026-11-12 (S-1): spike script `tools/spikes/s1/run-s1.mjs` with fictional samples. First run in this cloud session on the owner's account: all 25 calls schema-valid, latencies well inside the NFRs, every call reports a cost estimate, one of two repeated judgments flipped one requirement. Answer in PLAN.md "Spike answers". Left: a run on the owner's machine for latency and the hand-filled facts (usage limits, training setting).
- 2026-11-12 (S-1, owner): plan is Claude Ultra. "Help improve Claude" is currently ON, which breaks PRD Privacy 4; turning it off is part of H-2 and must happen before any real resume reaches the model (P1-T10, P1-T11). The owner accepts the cloud-session latency numbers as the S-1 latency answer. The owner will install and run the app on their machine at the end (ADR 0016) without working in the repository.

## Deviations log

| Date | Task | What changed in the plan | Why |
|------|------|--------------------------|-----|
| 2026-11-11 | all | Plan amended for the PRD scope revision: a personal, local-only tool for the owner and a few friends; no accounts, trial, billing or hosting; Tier 4 off by default with no proxy pool; Phase 6 is "Local packaging and data controls". PLAN.md inventory updated (E-13 is `Person`, new E-16 monthly budget; UC-16 to UC-21 are the profiles and spending use cases and the `SpendingGuard`; P-2, P-30, P-31, P-33 re-scoped, new P-34; A-16b, A-22, A-28, A-30 re-scoped, new A-31, A-32; D-2, D-8, D-9 re-scoped, new D-11, D-12; M-3 is the owner's local configuration; X-2, X-7, X-9, X-10 re-scoped, new X-14), spikes S-1, S-3, S-6 reworded and S-7 added, risks and assumptions rewritten | PRD revision of 2026-11-11; ADRs 0014, 0015, 0016; updated README and deferred.md; code changes by the Architect |
| 2026-11-11 | HUMAN | H-1 reworded to the local runtime choice; H-0 now covers committing the scope-revision work; H-2, H-3, H-9 mention the owner's account and friends' consent (Privacy 4, 5); H-11 loses the proxy pool; H-16 says daily caps and adds the budget; H-8, H-10, H-13, H-14, H-15 removed; H-17 (fresh machine for the Phase 6 exit) added | No hosting, legal review per market, billing, price or privacy policy any more; the Phase 6 exit needs a fresh machine |
| 2026-11-11 | P1-T06 | Replaced "Account and trial acceptance tests" with "Profile and spending acceptance tests" and marked done | The trial is gone (ADR 0014); the Architect wrote `profiles.test.ts` and `spending.test.ts` |
| 2026-11-11 | P5-T05 | Marked done | The Architect built the store roster, catch-up at start, the 14-day unopened pause and the budget pause (`monitoring.test.ts`, `spending.test.ts`); remaining wiring moved to P3-T08 and P3-T10 |
| 2026-11-11 | P5-T04 | Dropped (durable queue and `apps/worker`) | ADR 0016 §1: one local process; D4 has only local triggers, reviewed at Gates 3 and 5 |
| 2026-11-11 | Phase 6 | `phase-6-trial-billing-launch.md` renamed to `phase-6-local-packaging-and-data-controls.md` and rewritten; the old P6-T01 to P6-T08 (billing decision, subscription ordering, checkout, banner and paywall, user data vault, retention purge, legal documents, signup-to-payment test) are dropped and their IDs reused for the new P6-T01 to P6-T09 | None of the old tasks had started; the PRD's Phase 6 is now profile management, export and delete, spend and budget, W16, and one-command packaging (D15) |
| 2026-11-11 | P0-T04, P0-T05, P0-T06 | Smoke request uses `CreatePerson` and `presentRunningCost` instead of sign-up and the access presenter; the testing-API task drops `givenSourceSwitchedOff` (`switchSource` exists) and asserts `daily-cap-reached` and `monthly-budget-reached` instead of `access-denied`; contract suites cover `People`, `MonitoringRoster`, `MonthlyBudgetControl`, `UsageLedger` and `PersonDataVault` instead of `Accounts` | The account area and access presenter were deleted (ADR 0014) |
| 2026-11-11 | P0-T10, S-1, Phases 1 and 2 | Fixed the dangling "ADR 0009" citations: the ADR is still to be written by P0-T10 (or from S-1), and must record the temperature-0 replacement the user approved; Phase 1 and 2 citations now say so. P1-T08's ADR number changed from 0010 (now taken) to the next free number | ADR 0009 does not exist; ADRs 0010 to 0016 were written since the plan |
| 2026-11-11 | P1-T01, P1-T02, P1-T04, P1-T07, P1-T10, P1-T12 | `userId` is `personId`; `IntakeResume` calls `SpendingGuard` (on demand, uncapped) instead of `AccessGuard`; resume files implement `PersonDataVault`; the intake controller handles "ask first"; the configuration loader gathers the owner's credential | ADRs 0014, 0015, 0016 |
| 2026-11-11 | Phases 3, 4, 5 | Phase 3: no sign-up, authentication or staging; local database (SQLite default) with schema versioning instead of Postgres with encryption; data-folder files instead of encrypted object storage; local web Main with loopback bind, the local-request hook (W15), a minimal profile picker and the ticker; product events stored locally (D14). Phase 4: daily cap through `SpendingGuard`; files in the data folder. Phase 5: Tier 4 conditional on the owner naming boards, no proxy pool or markets; switches without a restart; S-7 added | ADRs 0014, 0015, 0016; deferred.md D2, D5, D8, D11, D14, D15, W15 |
| 2026-11-12 | 0, 5, HUMAN | H-1 done: runtime is Claude Code headless with the owner's subscription (API key route not explored, per owner). S-1 narrowed to how each port runs on it. P5-T02 acceptance adds the PRD's per-board blocking-risk table and human-pace session rules | Owner's instruction 2026-11-12; PRD revision of 2026-11-12 |
| 2026-11-12 | P0-T02, P0-T03, P0-T04, P0-T05, Gate 0, P1-T01, Gate 2 | Verify commands of the form `node --test <directory>/` changed to quoted globs (`node --test "tools/architecture/test/*.test.mjs"`, `"packages/testing-api/test/*.test.ts"`, `"apps/main/test/*.test.ts"`) | Node 22 treats a directory argument to `node --test` as a module to load and fails with MODULE_NOT_FOUND |
| 2026-11-12 | P0-T08 | Done as two commits (formatting-only reformat, then lint fixes plus `lint` in `verify`) | The task asks for a reformat commit that changes only whitespace and punctuation; the two lint fixes are small code edits and needed their own commit |
| 2026-11-12 | P0-T09 | The "failing test makes CI fail" check ran as a probe commit on the working branch, removed in the next commit, instead of on a throwaway branch | This session may push only to its working branch |
| 2026-11-12 | H-3, P1-T11, Gate 1 | The parsing test set is 6 real resumes, not 20 (all PDFs). Variety the plan asked for (DOCX, pasted text, LinkedIn export, scanned PDF; new graduate, career changer, long history, gaps) is not yet covered; how to fill it is an open question for the owner | The owner can supply at most 6 |
| 2026-11-12 | S-1 | Spike code is on the working branch (`tools/spikes/s1/`, results gitignored), not a throwaway branch; first run in the cloud session, confirmation run on the owner's machine | The owner must be able to fetch and run it; this session may push only to its working branch |
