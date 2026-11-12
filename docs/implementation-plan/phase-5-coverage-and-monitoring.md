# Phase 5: Full coverage and monitoring

Goal: Searches reach Tiers 1 to 3 (and Tier 4 only for boards the owner turns on; off by default), the owner can switch any source off or on without restarting the app, searches re-run in the background while the app runs, and an in-app inbox shows new Apply and Within reach matches. **Exit test (PRD): a run completes with any single source disabled.**
Detail level: Outline — detail at Gate 4, using S-5's answer if a Tier 4 board was named
Traces to: UC-5, UC-14, UC-15, UC-22, P-9, P-10, P-11, P-29, A-19, A-20, A-26, A-31, D-7, X-12, X-14; PRD MN-1 to MN-4, DS-5 (daily re-check), DS-7, Scraping safeguards 1 to 4, Flow 6; D10, D11, D15 (S-7); watch W5, W6
Prerequisites: Gate 4 passed; PLAN.md open question 1 answered (which Tier 4 boards, if any); H-11 Tier 3 keys; H-16 caps, interval and budget confirmed.

Amended 2026-11-11 for the scope revision (ADRs 0015, 0016): no legal review per launch market, no proxy pool, no market configurations, no hosted worker. Tier 4 is off by default and optional per installation. Monitoring runs only while the app runs; the roster, the catch-up run at start, the 14-day unopened pause and the budget pause were built by the Architect (P5-T05 done). The durable queue and `apps/worker` (P5-T04) are dropped: D4 has only local triggers now. S-7 (packaging) runs in this phase so Phase 6 can start on a decision.

## Tasks (outline)

### P5-T01 — Tier 3 aggregator adapters: JSearch, SerpApi Google Jobs, TheirStack, Apify
- **Traces to:** A-19, P-10, ADR 0004 §5, ADR 0016 §4 · **Size:** L (split per two sources at Gate 4)
- **Acceptance:** Each passes the `JobSource` contract on fixtures and declares tier 3; each paid call records one `aggregator` spend through `SpendMeter`, priced from Main configuration, even when the call then fails (ADR 0010); they are queried when a Tier 4 source failed, is switched off or none is configured (existing rule; with Tier 4 off by default they normally run).

### P5-T02 — Tier 4 adapters in `@matchmaker/scraping-sources`, only for boards the owner names (conditional)
- **Traces to:** A-20, D11, ADR 0004 §6, ADR 0016 §4, Scraping safeguards 1 to 4 · **Size:** L
- **Condition:** dropped if PLAN.md open question 1 is answered "none"; the package then stays a shell.
- **Acceptance:** Every Tier 4 request goes through one per-board human-pace session governor, per PRD "Human pace" (one request at a time, 8 to 20 s random gaps with longer pauses, at most 30 minutes or 60 requests per session, at least 4 hours rest, at most 3 sessions a day, limits shared by all profiles); the governor is tested with a fake clock; any 429, 403, CAPTCHA page or login wall ends the session and rests the board 24 h, then 48 h, then switches it off and tells the owner; no IP rotation, fingerprint spoofing or CAPTCHA solving; Google Jobs is never scraped directly (SerpApi in Tier 3); Tier 4 runs as a background session off the first-result path and its jobs stream in as scored. The bridge from S-5 passes the `JobSource` contract; each adapter is off until the owner switches it on (`SourceSwitchboard` returns null, so `SOURCE_POLICY` keeps it off); no proxy pool; anonymous requests only, never a logged-in personal account; only normalized fields and the link are stored; an installation without the package still starts and searches Tiers 1 to 3.

### P5-T03 — The owner's sources screen: switches without a restart (D10) and run summaries
- **Traces to:** UC-22, P-11, A-26, D-7 · **Size:** M
- **Acceptance:** The owner switches a source off and the next run skips it, and on again without a restart; a Tier 4 board shows "off (never switched on)" until the owner turns it on, with a one-line warning about the board's terms; source states show the correct tier (fixes the in-memory default of tier 1, P0-T06's `todo`); recent run summaries list fetched, merged and failed sources, and each run's cost (`costMicros`, ADR 0010).

### P5-T04 — DROPPED: durable queue and `apps/worker` (D4, W5)
- **Why:** ADR 0016 §1 keeps one local process; D4's hosted trigger (request lifetime) no longer exists. Its local triggers (a full run makes the UI unresponsive, a background crash takes the UI down, searches must survive a restart) are reviewed at Gates 3 and 5; if one fires, take it to `/architect` and re-plan.

### P5-T05 — DONE (built by the Architect, 2026-11-11): monitoring roster and scheduled runs (MN-1, MN-2, MN-4)
- **Traces to:** UC-14, P-29, A-31, ADR 0014 §7, ADR 0015 §4, ADR 0016 §3
- **What exists:** `RunDueMonitoring` reads the roster from the store's `peopleWithMonitoringOn` (on once a profile's first search has run); a profile is due when its last search is 12 hours old and it was opened in the last 14 days; nothing runs when the budget is reached; `IntervalTicker` runs a catch-up tick at start and then every `MONITORING_TICK_MS`. Tested in `packages/testing-api/test/monitoring.test.ts` and `spending.test.ts`. Remaining work lives elsewhere: the real roster store (P3-T08), the ticker kept alive in the local web Main (P3-T10), and the interval constant if H-16 changes it.
- **Verify:**
  ```bash
  node --test packages/testing-api/test/monitoring.test.ts packages/testing-api/test/spending.test.ts
  ```

### P5-T06 — Daily re-check of stored postings (DS-5) while the app runs
- **Traces to:** UC-5, A-21, A-31 · **Size:** S
- **Acceptance:** The local Main runs `RecheckStoredPostings` on the ticker once a day and once at start if the last re-check is more than a day old; expired postings are marked closed and leave Apply and Within reach.

### P5-T07 — Inbox (MN-3): `InboxSource` adapter, presenter and screen
- **Traces to:** UC-15, P-29, D-7 · **Size:** M
- **Acceptance:** When the owner opens a profile, its inbox shows new Apply and Within reach matches since that profile was last opened, then resets; each profile's inbox is its own (AB-2).

### P5-T08 — Any-single-source-disabled acceptance test and live run (the Phase 5 exit test)
- **Traces to:** DS-2, Availability NFR · **Size:** M
- **Acceptance:** A testing-API test runs one search per configured source with only that source switched off and every run completes; the same is shown live in the local app via the sources screen.

### P5-T09 — Registry: harvest Workable, SmartRecruiters and Recruitee boards (added 2026-11-12)
- **Traces to:** S-2, H-5, ADR 0004 §7 · **Depends on:** P2-T06, P2-T07 · **Size:** M
- **Context:** The Tier 1 seed (S-2) covers Greenhouse, Lever and Ashby only. Harvest public board slugs for the other three ATS from the Common Crawl index, validate them against the live boards, and register them.
- **Acceptance:** each of the three ATS has registered, validated companies; stale slugs are marked inactive.

### P5-T10 — Tier 2 keyed APIs: Adzuna and USAJobs (moved from P2-T09, added 2026-11-12)
- **Traces to:** A-18, P-10, ADR 0004 · **Depends on:** H-6 · **Size:** M
- **Context:** Build P2-T09 as written when the owner targets a market these sources cover (Adzuna: about 19 countries; USAJobs: US federal jobs). Ask the owner at Gate 4 whether that is the case.

### SPIKE S-5 — Tier 4 bridge (see PLAN.md; run in Phase 4 only if a board was named)
### SPIKE S-7 — Packaging for a one-command local install and start (see PLAN.md; feeds P6-T07)

## Gate 5

- **Exit criteria:**
  - [ ] `pnpm verify`, `pnpm check:architecture` and `pnpm metrics` green
  - [ ] **PRD exit test:** P5-T08 green in the testing API and demonstrated live
  - [ ] S-7 answered in PLAN.md "Spike answers"
- **Demo:** in the local app, switch off each source in turn and run a search; leave the app closed for more than 12 hours, start it, and see one catch-up search per due profile.
- **Human checkpoint:** Review cost per profile on the running-cost data against S-6 and your budget (H-16). Review S-7's answer before Phase 6. Confirm H-17 (fresh machine) is ready. Review `deferred.md` (D4 triggers, W5, W6, W8; D12, D15).
- **Detail next phase:** expand Phase 6 to full task specs.
