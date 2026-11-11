# Phase 5: Full coverage and monitoring

Goal: Searches reach all four source tiers (Tier 4 only where legally cleared), every source can be switched off without a deploy, searches re-run in the background on a schedule, and an in-app inbox shows new Apply and Within reach matches. **Exit test (PRD): a run completes with any single source disabled.**
Detail level: Outline — detail at Gate 4, using S-5's answer
Traces to: UC-5, UC-14, UC-15, UC-22, P-9, P-10, P-11, P-29, A-19, A-20, A-25, A-26, D-7, D-9, M-3; PRD MN-1 to MN-4, DS-5 (daily re-check), DS-7, Scraping safeguards 1 to 4, Flow 6; D4, D10, D11; watch W5, W6, W10
Prerequisites: Gate 4 passed; H-10 (legal review) for any Tier 4 board; H-11 keys and budget; H-16 caps and interval confirmed.

## Tasks (outline)

### P5-T01 — Tier 3 aggregator adapters: JSearch, SerpApi Google Jobs, TheirStack, Apify
- **Traces to:** A-19, P-10, ADR 0004 §5 · **Size:** L (split per two sources at Gate 4)
- **Acceptance:** Each passes the `JobSource` contract on fixtures and declares tier 3; they are queried only when a Tier 4 source failed, is switched off or none is configured (existing rule).

### P5-T02 — Tier 4 adapters in `@matchmaker/scraping-sources` for boards cleared by H-10
- **Traces to:** A-20, D11, ADR 0004 §6, Scraping safeguards 1 to 3 · **Size:** L
- **Acceptance:** The bridge from S-5 passes the `JobSource` contract; rate limit and proxy pool internal; only normalized fields and the link are stored; a market configuration without clearance does not include the package.

### P5-T03 — Kill switches that work without a deploy (D10) and the operator console
- **Traces to:** UC-22, P-11, A-26, D-7 · **Size:** M
- **Acceptance:** The operator flips a source off and the next run skips it; source states show the correct tier (fixes the in-memory tier default); recent run summaries list fetched, merged and failed sources.

### P5-T04 — Durable queue and `apps/worker` (D4, W5)
- **Traces to:** A-25, D-9, P-9 · **Size:** L
- **Acceptance:** Searches and re-scores survive a web restart; `apps/worker` is a second Main using `composeMatchmaker`; use cases unchanged; recorded as an ADR via `/architect`.

### P5-T05 — Monitoring roster and scheduled runs (MN-1, MN-2, MN-4)
- **Traces to:** UC-14, P-29 · **Size:** M
- **Acceptance:** Replaces the inline roster stub in `compose-matchmaker.ts`; users are searched every interval confirmed in H-16; only jobs not seen before are scored; monitoring pauses after 14 days without a login.

### P5-T06 — Daily re-check of stored postings (DS-5) on the scheduler
- **Traces to:** UC-5, A-21 · **Size:** S
- **Acceptance:** Expired postings are marked closed and leave Apply and Within reach within a day.

### P5-T07 — Inbox (MN-3): `InboxSource` adapter, presenter and screen
- **Traces to:** UC-15, P-29, D-7 · **Size:** M
- **Acceptance:** On the next visit the inbox shows new Apply and Within reach matches since the last visit, then resets.

### P5-T08 — Any-single-source-disabled acceptance test and live run (the Phase 5 exit test)
- **Traces to:** DS-2, Availability NFR · **Size:** M
- **Acceptance:** A testing-API test runs one search per configured source with only that source switched off and every run completes; the same is shown live on staging via the operator console.

## Gate 5

- **Exit criteria:**
  - [ ] `pnpm verify`, `pnpm check:architecture` and `pnpm metrics` green
  - [ ] **PRD exit test:** P5-T08 green in the testing API and demonstrated live
- **Demo:** switch off each source in turn on staging and run a search.
- **Human checkpoint:** Review cost per active user against S-6; confirm H-13, H-14, H-15 for Phase 6. Review `deferred.md` (W5, W6, W8, W10; D12).
- **Detail next phase:** expand Phase 6 to full task specs.
