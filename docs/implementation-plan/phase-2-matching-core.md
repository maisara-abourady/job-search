# Phase 2: Matching core

Goal: A search over real Tier 1 and Tier 2 sources, run from a parsed resume, gives every fetched job one verdict with its reason. **Exit test (PRD): score stability holds at 95% on a fixed test set** (re-scoring the same pair lands within 3 points).
Detail level: Full
Traces to: UC-2 (preferences, use-case side), UC-4, UC-5, UC-6, UC-9, E-2, E-5 to E-10, P-10, P-12 to P-16, P-18, P-19, A-8 to A-11, A-17, A-18, A-21, D-1, D-10, X-5, X-6, X-8; PRD DS-1 to DS-6 (DS-7 exists), MR-1 to MR-4, MR-6, Scoring systems, Verdicts, Consistency rules, Job sources Tiers 1 and 2
Prerequisites: Gate 1 passed. H-5 (registry source) before P2-T05. H-6 (Adzuna, USAJobs keys) before P2-T09.

The pipeline (`RunJobSearchInteractor`) and the verdict rules already exist and are proven with scripted details. This phase pins them with characterization tests first, closes the two pipeline hand-offs (fairness redaction, second-stage deduplication and revisions), then replaces each scripted detail with a real adapter behind a contract suite, and ends with the stability evaluation. Each source adapter starts by verifying its endpoint, quota and terms in current documentation (the PRD warns they change often) and records a response fixture so tests stay offline.

Mid-phase checkpoint (no stop required): once P2-T05, P2-T11, P2-T12 and P2-T13 are done, the scripted parts of `pnpm dev search` (P2-T16) can already run against Greenhouse alone.

## Tasks

### P2-T01 — Characterization tests for the existing matching rules

- **Traces to:** E-7, E-8, E-9, E-10, UC-6, UC-9, D-1; MR-1, MR-3, Confidence, Job Quality, Verdicts, Primary reasons, shape of encouragement 2 and 3
- **Layer:** Tests (`packages/testing-api/test`) — talk only to `MatchmakerTestingApi`
- **Depends on:** Gate 1
- **Size:** M  PARALLEL-OK
- **Context:** The rules in `packages/rules/src/matching` were written with the architecture and are pinned by four tests. Before real judges change their inputs, pin every rule through the testing API with scripted judgments, so a later edit that changes a verdict fails loudly. Where the code records an ASSUMPTION (primary-reason precedence; two Missing must-haves at Fit 80 or above is Stretch; source reliability ratios), the test name says "assumption" so H-7 can confirm or change it.
- **Files:**
  - create `packages/testing-api/test/verdicts.test.ts`
  - modify `packages/testing-api/src/builders.ts` (judgment builders, if needed)
- **Acceptance criteria:**
  - [ ] Confidence: 5+ requirements with both gates resolved is High; 3 or 4, or one Unknown gate, is Medium; fewer than 3, or both Unknown, is Low (and the card shows "Thin posting")
  - [ ] Job Quality: a 7-day-old posting keeps full freshness; a 45-day-old one has none; a posting asking for payment loses legitimacy points; Job Quality below 40 is Not a fit "poor-posting"
  - [ ] Stretch: Fit 65 to 79 with no gate failing; Fit 80+ with one Missing must-have; Fit 80+ with Low confidence (assumption: two Missing at 80+ is Stretch)
  - [ ] Not a fit reasons: unsupported language, work authorization, seniority, missing must-haves (coverage below 50%), low overall fit, low relevance at the prefilter; precedence when several hold (assumption)
  - [ ] An Unknown authorization or seniority gate passes with its flag on the card
  - [ ] Within a tab, cards order by 0.8 × Fit + 0.2 × Job Quality; dismissed and closed postings are not listed; an empty Apply tab shows the three closest jobs with their distance line
  - [ ] Re-scoring after a posting revision bump calls the judge again; the same revision does not
- **Verify:**
  ```bash
  node --test packages/testing-api/test/verdicts.test.ts && pnpm verify
  ```

### P2-T02 — Fairness redaction in `toScoringProfile`

- **Traces to:** E-2, X-8, ADR 0007 §1, PRD Fairness
- **Layer:** Entities (`packages/rules/src/profile/scoring-profile.ts`) — no imports outside rules, no `node:*`, no library
- **Depends on:** Gate 1
- **Size:** S  PARALLEL-OK
- **Context:** The brand already keeps `personal` away from every model port. The hand-off in `toScoringProfile` remains: redact the person's own name, age, gender, nationality and marital-status tokens that leaked into evidence text, before the first real planner and judge (P2-T11, P2-T12) see profiles. Redaction uses the values in `personal` (exact, case-insensitive whole-word matches) plus a small list of protected-attribute patterns (age statements such as "aged 34", marital status words); it replaces them with a neutral marker and never deletes the rest of the evidence. Test through the testing API: a scripted judge records the profile it receives.
- **Files:**
  - modify `packages/rules/src/profile/scoring-profile.ts`
  - modify `packages/testing-api/src/matchmaker-testing-api.ts` (observe `judgedProfiles`)
  - create `packages/testing-api/test/fairness.test.ts`
- **Acceptance criteria:**
  - [ ] A profile whose name is "Dana Example" and whose evidence says "Dana Example led the migration" reaches the judge as "[redacted] led the migration"
  - [ ] "Married, 34 years old" in an interview answer does not reach the judge; "34 stores" does
  - [ ] Evidence ids and every other field are unchanged
- **Verify:**
  ```bash
  node --test packages/testing-api/test/fairness.test.ts && pnpm verify
  ```

### P2-T03 — Second-stage deduplication and posting revisions

- **Traces to:** E-5, E-6, UC-4, P-15; DS-4, DS-5, PRD pipeline step 4, ADR 0005 §2
- **Layer:** Entities (`rules/jobs`) and use cases (`use-cases/discovery`) — rules import nothing outside rules; use cases must not import adapters, delivery, main, `node:*`, libraries or another area
- **Depends on:** P2-T01
- **Size:** L
- **Context:** Closes the HAND-OFF in `run-job-search.ts`. (1) A pure rule `sameDescription(a, b)` (normalized token-set similarity at or above a named threshold constant, calibration value per D13) merges postings from the same employer whose title or location spelling differs ("Sr." versus "Senior"). Add `PostingCatalog.openPostingsByEmployer(normalizedEmployer)` to the discovery-owned port and to `InMemoryStore` plus its contract suite. (2) When a stored posting is found again with a changed description, save it with `revision + 1` and re-enrich it, so matches keyed on the old revision are not reused (ADR 0005). Unchanged text keeps the revision and only merges source links.
- **Files:**
  - modify `packages/rules/src/jobs/duplicates.ts`, `packages/rules/src/index.ts`
  - modify `packages/use-cases/src/discovery/run-job-search.ts`, `packages/use-cases/src/discovery/ports.ts`
  - modify `packages/adapters/src/in-memory/in-memory-store.ts`
  - modify `packages/testing-api/contract/storage-contracts.ts`
  - modify `packages/testing-api/test/discovery.test.ts`
- **Acceptance criteria:**
  - [ ] "Senior Engineer" and "Sr. Engineer" at Acme in Berlin with near-identical descriptions become one posting with both source links; two different roles at Acme stay separate
  - [ ] Fetching a stored posting with an edited description yields revision 2, one enrichment call, and a new judge call on the next score; fetching it unchanged yields no enrichment and no judge call
  - [ ] `duplicatesMerged` in the run summary counts second-stage merges
  - [ ] Contract suite covers `openPostingsByEmployer`
- **Verify:**
  ```bash
  node --test packages/testing-api/test/discovery.test.ts && pnpm test:contract && pnpm verify
  ```

### P2-T04 — `JobSource` contract suite and HTTP posting liveness

- **Traces to:** P-10, P-16, A-21, X-6, UC-5; DS-2, DS-5, ADR 0004
- **Layer:** Interface adapters (`packages/adapters/src/job-sources`) and tests (`packages/testing-api/contract`) — adapters must not import delivery, main, testing-api or another adapter subfolder
- **Depends on:** Gate 1
- **Size:** M  PARALLEL-OK
- **Context:** One suite every source adapter must pass, run against the testing API's scripted source and, from P2-T05 on, each real adapter with its recorded fixture served by an injected fetch: every result is a complete `FoundPosting` with the adapter's declared name and tier, `fetchedAt` from the run, an absolute URL, and no source-specific fields; an elapsed timeout rejects (the use case counts it as a failed source); an empty response returns `[]`. Also implement `HttpPostingLiveness.isLive(url)` with Node's `fetch`: a HEAD (falling back to GET) with a short timeout; 404 and 410 are not live, network errors are treated as live once and logged (a flaky network must not close postings).
- **Files:**
  - create `packages/testing-api/contract/job-source.contract.ts`, `packages/testing-api/contract/job-sources.contract.test.ts`
  - create `packages/adapters/src/job-sources/http-posting-liveness.ts`, `packages/adapters/src/job-sources/http.ts` (injectable fetch, timeout helper shared by source adapters in this folder)
  - modify `packages/adapters/src/index.ts`
- **Acceptance criteria:**
  - [ ] The suite passes against the scripted source
  - [ ] Liveness returns false for 404 and 410, true for 200, and true on a single network error, with an injected fetch
- **Verify:**
  ```bash
  pnpm test:contract && pnpm verify
  ```

### P2-T05 — Greenhouse adapter and the Tier 1 registry seed

- **Traces to:** A-17, P-10, P-18, ADR 0004 §1, §2, §7; DS-2, DS-3; PRD "Tier 1 company registry"
- **Layer:** Interface adapters (`adapters/job-sources`) and Main (seed loading) — the adapter must not import delivery, main or testing-api
- **Depends on:** P2-T04, H-5
- **Size:** M
- **Context:** Replace the stub search in `greenhouse-board-source.ts`: for each company id from the registry, call the public job-board endpoint (verify the current URL, response shape and rate limits in Greenhouse's documentation), filter jobs whose title matches the queries' titles or keywords, map to `FoundPosting`, respect the timeout across all companies, and cap concurrency. Load the seed list chosen in H-5 into the in-memory registry from Main (a JSON file under `apps/main/src/registry-seed/`); add an adapter-side `InMemoryStore.companiesFor(ats)` read that Main passes to the adapter's constructor. `recognize(url)` exists; extend it to the current Greenhouse URL forms.
- **Files:**
  - modify `packages/adapters/src/job-sources/greenhouse-board-source.ts`
  - modify `packages/adapters/src/in-memory/in-memory-store.ts`
  - create `apps/main/src/registry-seed/greenhouse.json`; modify `apps/main/src/main.dev.ts`
  - create `packages/testing-api/contract/fixtures/greenhouse-board.json`; modify `packages/testing-api/contract/job-sources.contract.test.ts`
- **Acceptance criteria:**
  - [ ] The `JobSource` contract passes on the recorded fixture
  - [ ] A query for "Platform Engineer" returns only matching titles from the fixture; a company whose board errors does not fail the other companies, but if every company fails the source rejects
  - [ ] `recognize` returns the company id for each documented board URL form and `null` for other hosts
- **Verify:**
  ```bash
  pnpm test:contract && pnpm verify
  ```

### P2-T06 — Lever, Ashby and Workable adapters

- **Traces to:** A-17, P-10, P-18, ADR 0004
- **Layer:** Interface adapters (`adapters/job-sources`) — must not import delivery, main or testing-api
- **Depends on:** P2-T05
- **Size:** M  PARALLEL-OK
- **Context:** Same shape as Greenhouse (one class per ATS, registry-driven, `AtsLinkRecognizer` for its own URLs). Verify each public endpoint and its terms first; skip and record in PROGRESS.md any ATS whose public endpoint no longer exists or forbids this use. Add seed files per H-5.
- **Files:**
  - create `packages/adapters/src/job-sources/lever-source.ts`, `ashby-source.ts`, `workable-source.ts`
  - create recorded fixtures under `packages/testing-api/contract/fixtures/`; modify `packages/testing-api/contract/job-sources.contract.test.ts`
  - create `apps/main/src/registry-seed/{lever,ashby,workable}.json`; modify `apps/main/src/main.dev.ts`, `packages/adapters/src/index.ts`
- **Acceptance criteria:**
  - [ ] Each adapter passes the `JobSource` contract on its fixture and declares tier 1
  - [ ] Each `recognize` maps its documented posting URL to a company id
- **Verify:**
  ```bash
  pnpm test:contract && pnpm verify
  ```

### P2-T07 — SmartRecruiters and Recruitee adapters

- **Traces to:** A-17, P-10, P-18, ADR 0004
- **Layer:** Interface adapters (`adapters/job-sources`) — as P2-T06
- **Depends on:** P2-T05
- **Size:** M  PARALLEL-OK
- **Context:** As P2-T06, for the remaining two Tier 1 ATSs in the PRD.
- **Files:**
  - create `packages/adapters/src/job-sources/smartrecruiters-source.ts`, `recruitee-source.ts`
  - fixtures, contract test entries, seed files and dev wiring as in P2-T06
- **Acceptance criteria:**
  - [ ] Each adapter passes the `JobSource` contract on its fixture and declares tier 1
  - [ ] Each `recognize` maps its documented posting URL to a company id
- **Verify:**
  ```bash
  pnpm test:contract && pnpm verify
  ```

### P2-T08 — Tier 2 keyless APIs: Remotive, RemoteOK, Arbeitnow, Jobicy, Himalayas, The Muse

- **Traces to:** A-18, P-10, ADR 0004; DS-2, DS-3
- **Layer:** Interface adapters (`adapters/job-sources`) — as P2-T06
- **Depends on:** P2-T04
- **Size:** M  PARALLEL-OK
- **Context:** Free JSON APIs that need no key (verify each; The Muse may accept an optional key). Each adapter turns `SearchQuery` titles, keywords and locations into that API's parameters (or filters client-side where the API has none), honors the source's published rate limit and attribution terms, and maps to `FoundPosting`. Descriptions may be HTML: convert to plain text in the adapter. Results that link to an ATS-hosted posting feed registry growth automatically (the use case calls each Tier 1 recognizer; exists).
- **Files:**
  - create one file per source under `packages/adapters/src/job-sources/`
  - fixtures and contract test entries; modify `packages/adapters/src/index.ts`, `apps/main/src/main.dev.ts`
- **Acceptance criteria:**
  - [ ] Each adapter passes the `JobSource` contract on its fixture and declares tier 2
  - [ ] HTML descriptions arrive as plain text
  - [ ] PROGRESS.md Notes lists each source's verified endpoint, limit and attribution requirement
- **Verify:**
  ```bash
  pnpm test:contract && pnpm verify
  ```

### P2-T09 — Tier 2 keyed APIs: Adzuna and USAJobs

- **Traces to:** A-18, P-10, X-2, ADR 0004
- **Layer:** Interface adapters (`adapters/job-sources`) and Main configuration — as P2-T06
- **Depends on:** P2-T04, P1-T10 (configuration loader), H-6
- **Size:** M  PARALLEL-OK
- **Context:** As P2-T08, with credentials read by the Main configuration loader and passed to the adapter's constructor (never read from the environment inside the adapter). A missing key leaves that source out of the dev configuration with one warning line, rather than failing start-up.
- **Files:**
  - create `packages/adapters/src/job-sources/adzuna-source.ts`, `usajobs-source.ts`
  - modify `apps/main/src/config.ts`, `apps/main/src/main.dev.ts`; fixtures and contract test entries
- **Acceptance criteria:**
  - [ ] Both pass the `JobSource` contract on fixtures and declare tier 2
  - [ ] Without the keys the dev configuration starts, warns once per source, and omits them
- **Verify:**
  ```bash
  pnpm test:contract && pnpm verify
  ```

### P2-T10 — Tier 2 feeds: We Work Remotely and Hacker News "Who is hiring"

- **Traces to:** A-18, P-10, ADR 0004
- **Layer:** Interface adapters (`adapters/job-sources`) — as P2-T06
- **Depends on:** P2-T04
- **Size:** M  PARALLEL-OK
- **Context:** We Work Remotely is an RSS feed; Hacker News "Who is hiring" is a monthly thread of free-text comments (verify the current API). For HN, the adapter splits each top-level comment into employer, title, location and description with conservative heuristics (first line conventions such as "Company | Role | Location"); comments it cannot split are skipped and counted, never guessed. The enricher (P2-T11) does the rest.
- **Files:**
  - create `packages/adapters/src/job-sources/weworkremotely-source.ts`, `hackernews-hiring-source.ts`
  - fixtures and contract test entries; dev wiring
- **Acceptance criteria:**
  - [ ] Both pass the `JobSource` contract on fixtures and declare tier 2
  - [ ] On the HN fixture, comments without a recognizable first line are skipped and the skip count is logged
- **Verify:**
  ```bash
  pnpm test:contract && pnpm verify
  ```

### P2-T11 — Search planner and posting enricher adapters

- **Traces to:** A-9, A-10, P-12, P-13, ADR 0003, ADR 0009; DS-1, DS-6; edge case "Search returns very few jobs"
- **Layer:** Interface adapters (model-runtime package) — must not import delivery, main, testing-api or `/wiring`
- **Depends on:** P1-T10, P2-T02
- **Size:** M
- **Context:** `SearchPlanner.plan(profile, widen)`: queries covering target titles, title synonyms, adjacent roles (only when `widen`), key skills and locations; `adjacentTitlesUsed` lists what widening added. `PostingEnricher.enrich(found)` on the small model tier (ADR 0009): requirements with stable ids, kind (must-have or nice-to-have) and keywords; seniority on the ladder with the posting text that shows it; authorization signal with its posting text (silent when absent); salary and currency; work mode; country (ISO code); language; completeness flags; legitimacy flags. Both use structured output. Contract suites: planner returns at least one query, and adjacent titles only when widening; enricher returns requirement ids unique within the posting, `seniorityText` present whenever `seniority` is, `postingText` present unless the signal is silent. Run them on scripted doubles and on recorded responses.
- **Files:**
  - create `src/search-planner.ts`, `src/posting-enricher.ts`, `src/schemas/` entries in the model-runtime package
  - create `packages/testing-api/contract/model-ports.contract.ts`, `packages/testing-api/contract/model-ports.contract.test.ts`, recorded responses under `contract/fixtures/`
  - modify `apps/main/src/main.dev.ts`
- **Acceptance criteria:**
  - [ ] Contract suites pass for scripted doubles and the adapters on recorded responses
  - [ ] Neither adapter receives a `ProfileVersion` (compile-time: ports take `ScoringProfile` or `FoundPosting`)
- **Verify:**
  ```bash
  pnpm test:contract && pnpm verify
  ```

### P2-T12 — Match judge adapter

- **Traces to:** A-8, P-19, E-8, ADR 0002 §2, ADR 0007, ADR 0009; MR-2, Fit components, Consistency rules
- **Layer:** Interface adapters (model-runtime package) — as P2-T11
- **Depends on:** P2-T11
- **Size:** M
- **Context:** `MatchJudge.judge(profile, posting)` returns `MatchJudgments` only: per requirement met, partial or missing with cited evidence ids and closable-by-user, plus experience relevance, skills and tools, and scope alignment as ratios. The adapter decides nothing else (ADR 0002): no score, verdict or reason. Give the model the profile's evidence with ids and the posting's requirements with ids, a fixed rubric (versioned as a constant in the adapter), and a schema for structured output. For PRD consistency rule 1 apply the replacement recorded in ADR 0009 (current models reject `temperature`). Contract: exactly one judgment per posting requirement id, ratios within 0 to 1, cited ids are profile evidence ids (the rules overrule any others, but the contract flags them).
- **Files:**
  - create `src/match-judge.ts`, `src/rubric.ts`, schema entry in the model-runtime package
  - modify `packages/testing-api/contract/model-ports.contract.ts`, `.contract.test.ts`, recorded responses
  - modify `apps/main/src/main.dev.ts`
- **Acceptance criteria:**
  - [ ] Contract passes for the scripted judge and the adapter on a recorded response
  - [ ] The rubric version appears in the adapter's request metadata so PROGRESS.md can track which rubric produced the stability numbers
- **Verify:**
  ```bash
  pnpm test:contract && pnpm verify
  ```

### P2-T13 — Relevance ranker (prefilter)

- **Traces to:** A-11, P-14, D3, ADR 0009; MR-2, PRD "Ranking and cost control"
- **Layer:** Interface adapters (as ADR 0009 places it) — must not import delivery, main, testing-api
- **Depends on:** P2-T11
- **Size:** M
- **Context:** `RelevanceRanker.rank(profile, postings)` returns posting ids, most relevant first, as S-1 and ADR 0009 decided (embeddings with in-process cosine similarity, or a lexical fallback if no embeddings provider is chosen). The prefilter cap of 150 stays in `SEARCH_POLICY` (use case). Contract: returns each input id exactly once; deterministic for the same inputs.
- **Files:**
  - create the ranker adapter file in the package ADR 0009 names
  - modify the model-ports contract suite and its test; dev wiring
- **Acceptance criteria:**
  - [ ] Contract passes for the scripted ranker and this adapter
  - [ ] On a fixture of 10 postings, a posting whose title equals the profile's latest title ranks above an unrelated one
- **Verify:**
  ```bash
  pnpm test:contract && pnpm verify
  ```

### P2-T14 — Score stability evaluation (the Phase 2 exit test)

- **Traces to:** X-5, A-8, E-9, E-10, UC-6; PRD Consistency rule 3, Metrics "Score stability", release plan Phase 2 exit
- **Layer:** Main (`apps/main/eval/stability`) — must not import testing-api
- **Depends on:** P0-T07, P2-T12, H-7 (set approved before the gate run)
- **Size:** M
- **Context:** The fixed test set is a frozen file of pairs: profiles from the H-3 corpus (or the parsed profiles they produced in Phase 1) and postings captured from real Tier 1 and 2 fetches during this phase, enriched once and frozen, so only the judge varies. For each pair, score K times (default 5) with a fresh in-memory store each time, because the production cache (ADR 0005) would otherwise make stability trivially 100%. A re-score is "stable" when its Fit total is within 3 points of the first score of that pair. Report the share of stable re-scores (target at least 95%), verdict agreement, the worst pairs with their per-requirement disagreements, cost and latency per judgment, and the rubric version.
- **Files:**
  - create `apps/main/eval/stability/stability.eval.ts`
  - create `apps/main/eval/stability/build-test-set.ts` (captures and freezes pairs; run once, output reviewed by the user)
  - create `apps/main/eval/fixtures/stability/test-set.json` (or under `private/` if it holds resume text)
  - create `apps/main/eval/stability/README.md`
- **Acceptance criteria:**
  - [ ] `pnpm eval stability` runs every pair K times and reports the share within 3 points
  - [ ] The run passes at 95% or more on the approved set; otherwise the report names the requirements the judge disagrees with itself on
- **Verify:**
  ```bash
  pnpm eval stability
  ```

### P2-T15 — `CorrectProfile` preferences branch (use-case side)

- **Traces to:** UC-2, UC-7, E-1, E-14; PF-1 to PF-4 (use-case side), Flow 1 step 6, Flow 7, ADR 0005
- **Layer:** Use cases (`packages/use-cases/src/onboarding`) — must not import adapters, delivery, main, `node:*`, libraries or another area
- **Depends on:** P1-T05
- **Size:** S  PARALLEL-OK
- **Context:** Pulled forward from Phase 3 so the matching demo and the stability set can use real authorization and seniority answers. Replace the `preferences` branch's `notYetBuilt`: map `PreferencesInput` to the rules' `Preferences` (target seniority values must be on `SENIORITY_LADDER` and adjacent, otherwise `invalid-input`), save a new version, request a re-score. The four preference screens (PF-5) stay in Phase 3.
- **Files:**
  - modify `packages/use-cases/src/onboarding/correct-profile.ts`
  - modify `packages/testing-api/test/onboarding.test.ts`
- **Acceptance criteria:**
  - [ ] Saving preferences creates a new version with them and requests one re-score; jobs re-scored afterwards use the new authorization countries
  - [ ] A band of `["entry", "director"]` (not adjacent) or an unknown level rejects with `invalid-input`
- **Verify:**
  ```bash
  node --test packages/testing-api/test/onboarding.test.ts && pnpm verify
  ```

### P2-T16 — Dev search driver and timing report

- **Traces to:** D-10, UC-1, UC-2, UC-4, UC-6, UC-9, D-1; NFR "First result within 60 seconds", "Full run within 5 minutes", "A failed source never fails a run"
- **Layer:** Main (`apps/main/src/main.dev.ts`) — must not import testing-api
- **Depends on:** P1-T12, P2-T05, P2-T08, P2-T11, P2-T12, P2-T13, P2-T15
- **Size:** S
- **Context:** `pnpm dev search <resume> [--authorized DE,US] [--levels senior,lead-or-staff] [--off <source>]` runs intake, applies the preference flags through `CorrectProfile` (P2-T15), switches off named sources through `OperateSources`, waits for the search, scoring and re-scoring, then prints the results view model (three tabs, cards with reasons and distance lines), the run summary (fetched, duplicates merged, failed sources, widening) and timings: seconds to the first `ResultsFeed` notice and to the end of the run.
- **Files:**
  - modify `apps/main/src/main.dev.ts`
  - modify `apps/main/test/smoke.test.ts`
- **Acceptance criteria:**
  - [ ] On a real resume, the driver prints the three tabs with counts, at least one card per non-empty tab, and a run summary
  - [ ] With `--off <a source>` the run completes and does not list the switched-off source as failed
  - [ ] Timings are printed and copied into PROGRESS.md Notes
- **Verify:**
  ```bash
  pnpm dev search <path-to-resume> --authorized DE --levels senior,lead-or-staff && pnpm verify
  ```

## Gate 2

- **Exit criteria:**
  - [ ] Full suite green: `pnpm verify`
  - [ ] Boundary check green: `pnpm check:architecture && pnpm metrics` (no new SDP warning; adapters D recorded)
  - [ ] Phase acceptance tests green: `node --test packages/testing-api/test/` and `pnpm test:contract`
  - [ ] **PRD exit test:** `pnpm eval stability` at 95% or more on the approved fixed test set
- **Demo:**
  ```bash
  pnpm dev search <one of your own resumes>
  ```
  Expected: Apply, Within reach and Not a fit tabs with counts; each card has a one-sentence reason; Within reach cards show "N points from Apply: confirm or build ..."; the run summary names any failed source; timings for first result and full run.
- **Human checkpoint:** Read ten verdicts against the postings: is the strictness right? Confirm or change the calibration assumptions (H-7, deferred.md D13). Review cost and latency per judgment for S-6. Confirm S-3's answer (web framework, SSE, authentication), that H-8 is provisioned and H-9 has five people lined up. Review `deferred.md` (W2, W4: are template reasons good enough?).
- **Detail next phase:** at this gate, expand Phase 3 from outline to full task specs, using S-3's answer.
