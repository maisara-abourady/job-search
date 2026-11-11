# Deferred decisions and boundary watch list

Review this file at every phase exit, and whenever a requirement touches one of these rows (§9.3 step 5).

## Decisions deliberately not made (§5.3)

| # | Decision | Why it can wait | Trigger that forces it | Where it will be made |
|---|---|---|---|---|
| D1 | **Model runtime:** Claude Code headless, the Claude Agent SDK, a direct model API, or a mix per port | Every model use sits behind a need-named port (ADR 0003) | PRD open question "how is Claude Code run as a hosted runtime agent, and do its terms allow it" is answered, or Phase 1 needs real parsing | One adapter class per port in `packages/adapters/src/model-runtime/`, selected in Main. Model tiering is Main configuration |
| D2 | **Database** (Postgres plus pgvector assumed) | In-memory store implements every gateway (ADR 0006) | The first environment with real users (Phase 3 exit, five test users), or data must survive a restart | A new adapter package `packages/storage-postgres` implementing the same gateways. SQL and data mappers stay there. Rows never cross |
| D3 | **Vector search** for the prefilter | `RelevanceRanker` port | Decided with D1 and D2 | `RelevanceRanker` adapter; pgvector or in-process cosine |
| D4 | **Background work:** a queue and a worker process | `InProcessWorkQueue` behind request ports | A full run (5 minutes or less) outlives the web host's request or instance lifetime, or monitoring (Phase 5) must run with no web traffic | Replace the queue adapter; add `apps/worker` as a second Main. The use cases do not change |
| D5 | **Web framework and streaming transport** (Next.js plus server-sent events assumed) | Controllers and presenters are framework-free; `ResultsFeed` is an output port | Phase 1 UI work starts | `apps/web`: route handlers as humble objects calling `composeMatchmaker`. Framework injection stays in that Main |
| D6 | **Authentication provider** (email, Google) | Use cases take an authenticated `userId` | Phase 1 UI | `apps/web` only |
| D7 | **Billing provider** (merchant of record) | `Checkout` port, plus a webhook listener feeding `RecordSubscriptionChange` | The company's country of incorporation is known (PRD open question), Phase 6 | An adapter for the `Checkout` port and a listener in `apps/web` |
| D8 | **File and object storage** for resumes and generated files | `ResumeFiles` and `GeneratedFiles` ports | Phase 1 intake (originals must be kept, RP-8) | Adapter; encryption at rest required (Privacy 1) |
| D9 | **PDF, DOCX and OCR libraries; resume rendering** | `DocumentReader` and `ResumeRenderer` ports | Phase 1 (reading), Phase 4 (rendering) | Adapters. The output is checked by an ATS-parse evaluation outside unit tests |
| D10 | **Flag store for kill switches** | `SourceSwitchboard` port | Decided with D2, or earlier if an operator must flip a switch in production | Adapter |
| D11 | **Scraping library** (JobSpy) and proxy pool | Tier 4 is a separate package (ADR 0004) | Legal review clears a board for a launch market (Phase 5) | `packages/scraping-sources` |
| D12 | **Service split or deployment units** | Source-level monolith (ADR 0001) | See the watch list items W5 and W6 | A new ADR |
| D13 | **Calibration values** to confirm: source-reliability ratios, primary-reason precedence, two-Missing at Fit 80 or above is Stretch, Tier 3 fallback rule, widen threshold of 20, prefilter cap 150, monitoring 12h and 14d, fair-use caps, retention 30d | Constants in one place each (`rules` or the owning use case) | Product owner confirmation, first month of live data | Edit the constant and its test |

## Boundary watch list (§9.3)

Boundaries noted but not built, partial boundaries that may decay, and the friction to watch for.

| # | Boundary | State | Friction to watch for | Action when it appears |
|---|---|---|---|---|
| W1 | `rules` sits in the **Zone of Pain** (I=0, A=0, D=1.0, fan-in 24) | Accepted. It is stable and concrete, and calibration changes constants, not signatures (§4.7: only volatile components hurt there) | A calibration change forces edits in `use-cases`, `adapters` or tests beyond assertions, or the rubric changes shape (new components, per-segment weights) | Extract a `MatchingPolicy` interface in rules with the current rubric as one implementation chosen in Main. Record it as an ADR superseding part of 0002 |
| W2 | Adapters package splitting | Partial ("skip the last step" style folders with an enforced no-cross-import rule) | The first third-party dependency (database driver, model SDK, PDF library) that other adapter consumers do not need | Split that subfolder into its own package (`storage-postgres`, `model-runtime-*`, `documents`) and add it to `components.mjs` |
| W3 | Use-case areas inside one package | Partial. Areas are folders with enforced isolation | Two people or teams change different areas in the same week and conflict, or an area wants its own release cadence | Promote that area to its own package (deployment-level, §5.6) |
| W4 | `TemplateNarrator` versus a model-written narration | Port in place; template today | Users find reasons generic (the "users distrust scores" risk) | Add a model narrator adapter; the verdict does not change |
| W5 | Background work as a process boundary | Request ports exist; in-process today | D4 trigger | A worker Main; later a service only under operational pressure (§5.6) |
| W6 | Tier 4 scraping as a process boundary | Package boundary only | A blocked IP pool, sandboxing demands, or a scraper crash taking down the process | Run Tier 4 adapters in a separate process behind the same `JobSource` port (a proxy adapter in-process, the real one outside) |
| W7 | Interview statefulness | `Interviewer.nextQuestion(profile, transcript)` is stateless | Latency or cost from resending the transcript, or a runtime that keeps sessions | Change the port shape with an ADR; the transcript stays owned by the use case |
| W8 | Access and fair-use guard as a cross-cutting concern | `AccessGuard` called inside cost-incurring interactors | A new cost-incurring use case forgets it | Make the guard a decorator applied in Main to every cost-incurring input port, and add an architecture check |
| W9 | Results read model versus matching write model | Separate ports (`ResultsReadModel` versus `MatchRecords`) over one store | Results queries slow down, or need joins the write model resists | A dedicated read store (CQRS-style). No use-case change |
| W10 | Model-runtime and data-processing terms per market (Privacy 4, 5) | Not a code boundary yet | A market needs data residency, or a provider with different terms | Main configuration per market (§10.1) choosing compliant adapters |
