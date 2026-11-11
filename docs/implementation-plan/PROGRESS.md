# Progress

Current phase: 0 — Verify and complete the walking skeleton
Next task: P0-T01 (after H-0)
Last updated: 2026-11-11 by planning

## Status

Legend: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked (reason in Notes) · `[-]` dropped (see deviations)

### HUMAN tasks to start now
- [ ] H-0 Commit `docs/prd.md` and the `docs/architecture/README.md` edit
- [ ] H-1 Claude Code as hosted runtime agent: terms answer
- [ ] H-3 20 consented test resumes
- [ ] H-10 Tier 4 legal review per board and market
- [ ] H-13 Country of incorporation and billing provider

### Phase 0 — Verify and complete the walking skeleton
- [ ] P0-T01 Baseline the toolchain from a clean clone
- [ ] P0-T02 Regression tests for the architecture check
- [ ] P0-T03 Extend checker and test coverage to new directories
- [ ] P0-T04 Complete the testing API as a Main configuration
- [ ] P0-T05 Walking skeleton through the dev Main
- [ ] P0-T06 Home for adapter contract suites, with the first storage suite
- [ ] P0-T07 Evaluation harness scaffold
- [ ] P0-T08 Formatter and lint check
- [ ] P0-T09 Continuous integration
- [ ] S-1 Which runtime implements each model port?
- [ ] H-1 May Claude Code be the hosted runtime agent?
- [ ] GATE 0A (technical)
- [ ] P0-T10 Record the model runtime decision (D1)
- [ ] GATE 0B (decision)
- [ ] H-2 Model provider account and key (after P0-T10)
- [x] H-4 Parsing thresholds confirmed (default accepted)

### Phase 1 — Foundations (exit: 20 resumes parse correctly)
- [ ] P1-T01 In-memory resume files and onboarding storage contracts
- [ ] P1-T02 Wire intake and profile correction through Main and the testing API
- [ ] P1-T03 Rules: choose 5 to 8 selling points and suggest a target seniority band
- [ ] P1-T04 `IntakeResume` use case
- [ ] P1-T05 `CorrectProfile`: facts and selling points
- [ ] P1-T06 Account and trial acceptance tests
- [ ] P1-T07 Onboarding controllers and presenters
- [ ] P1-T08 Documents package: read text, DOCX, PDF and LinkedIn PDF
- [ ] P1-T09 OCR for image-only PDFs
- [ ] P1-T10 Model runtime package, configuration loader and the resume analyst
- [ ] P1-T11 Parsing evaluation (exit test)
- [ ] P1-T12 Dev intake driver
- [ ] S-2 Initial Tier 1 company registry
- [ ] H-5 Registry source chosen
- [ ] H-6 Adzuna and USAJobs keys
- [ ] H-8 Hosting, domain, Postgres, object storage, OAuth client, email provider (lead time for Phase 3)
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
- [ ] S-3 Web framework, SSE and authentication
- [ ] H-7 Stability set approved; calibration values confirmed
- [ ] H-9 Five test users recruited
- [ ] GATE 2

### Phase 3 — Results experience (outline; exit: five users reach Apply in under 10 minutes)
- [ ] P3-T01 to P3-T15 (detailed at Gate 2)
- [ ] S-4 ATS parsers; S-6 cost model
- [ ] H-11, H-12, H-16
- [ ] GATE 3

### Phase 4 — Tailoring (outline; exit: three ATS parsers parse cleanly)
- [ ] P4-T01 to P4-T08 (detailed at Gate 3)
- [ ] S-5 Tier 4 bridge; H-14, H-15 started
- [ ] GATE 4

### Phase 5 — Full coverage and monitoring (outline; exit: any single source disabled)
- [ ] P5-T01 to P5-T08 (detailed at Gate 4)
- [ ] GATE 5

### Phase 6 — Trial, billing and launch (outline; exit: signup to payment)
- [ ] P6-T01 to P6-T08 (detailed at Gate 5)
- [ ] GATE 6

## Notes

- 2026-11-11 (planning): `pnpm verify` green on commit 6b5684f (7 components, 71 files, 6 tests). `node apps/main/src/main.dev.ts` exits 0. `pnpm metrics`: rules D=1.00 (accepted, W1), use-cases D=0.05, delivery 0.40, adapters 0.38, main 0.33.
- 2026-11-11 (planning): the architecture check was probed in a scratch copy with injected violations; it reported each one. P0-T02 turns that probe into permanent tests.
- Tests talk only to `MatchmakerTestingApi` (ADR 0008); `packages/rules` cannot hold tests (`node:*` is forbidden there). Adapter contract suites go in `packages/testing-api/contract/`; evaluations in `apps/main/eval/`.
- Current Claude models reject `temperature`; the PRD's "temperature 0" rule needs the replacement recorded in ADR 0009 (PLAN.md open question 2).

## Deviations log

| Date | Task | What changed in the plan | Why |
|------|------|--------------------------|-----|
