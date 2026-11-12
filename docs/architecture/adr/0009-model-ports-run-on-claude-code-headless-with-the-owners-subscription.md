# 0009. The model ports run on Claude Code headless with the owner's subscription; the prefilter ranks lexically in process

Status: accepted (2026-11-12). Decides D1 and D3. **Amends** ADR 0002 (the PRD's "temperature 0" is replaced; decision 4), ADR 0003 (decision 3: the runtime is chosen; `UnchosenModelRuntime` is retired port by port), ADR 0015 (consequence on subscription spend: decision 5) and ADR 0016 §5 (what "the owner's credential" is under the subscription: decision 3).

## Context

Every model use sits behind a port named for the need, owned by the use cases (ADR 0003). The runtime behind them was the most uncertain detail (D1). It is now fixed by the owner (H-1, 2026-11-12):
- **Claude Code headless** (`claude -p`) with the owner's existing Claude subscription (Ultra plan);
- no API key route; it is not evaluated;
- the app runs on the owner's machine (ADR 0016). The owner installs it at the end and does not work in the repository.

Spike S-1 measured the ports on this runtime: Claude Code 2.1.322, fictional samples, 25 calls, in a cloud session on the owner's account (PLAN.md "Spike answers"). The owner accepted its latency numbers as the answer, although they were measured in the cloud and not on the owner's machine.
- **Structured output.** `--json-schema` returned a schema-valid object in `structured_output` in 25 of 25 calls.
- **Latency per call, CLI start included.** Structure about 5.6 s (large). Enrichment p50 5.3 s (small). Ranking 5 postings 5.9 s (small). Judging p50 3.3 s (large). Five calls in parallel took about as long as one.
- **Citations.** 10 of 10 judge calls cited only evidence ids that exist.
- **No temperature.** The CLI has no temperature setting. Repeating one judgment three times, a strong pair was identical, and a poor-fit pair flipped one requirement between partial and met once.
- **Spend.** Every call returns `total_cost_usd`, a priced estimate (about 0.007 USD per call at p50). Under the subscription it is not a charge.
- **No embeddings.** Claude Code offers none.

The PRD's consistency rule 1 ("temperature 0 with a fixed rubric and structured output") cannot be met literally. The owner approved its replacement (PLAN.md answered question 2): structured output, a fixed rubric, cached judgments.

The owner's "Help improve Claude" setting is currently **on**. That breaks PRD Privacy 4 ("the model provider account must be configured so data is not used for training"). No CLI command or API reports that setting.

Forces:
- **Volatility at the edge.** CLI flags, the result envelope, model aliases and subscription limits change with Claude Code releases, which update themselves. None of that may reach the use cases (§5.3, §13.3).
- **Latency.** A card within 20 s of upload; the first result within 60 s; a full run within 5 minutes. Each call pays a CLI start of a few seconds.
- **Spend.** The monthly budget and the daily caps (ADR 0015) need a number per call.
- **Privacy.** Friends' resumes pass through the runtime (Privacy 4, 5). The owner's own Claude Code setup (memory files, hooks, MCP servers, project files) must not reach a prompt.

## Decision

1. **Runtime and tier per port.** Every model-backed port runs on Claude Code headless with the owner's subscription. "Large" and "small" are Main configuration: model aliases, today `sonnet` and `haiku` (S-1 was served by claude-sonnet-5-5 and claude-haiku-5-5). They are never code. Main also holds the map from port to tier, so moving a port to another tier is a configuration edit.

   | Port (methods) | Area | Runs on | Tier | Reason and evidence |
   |---|---|---|---|---|
   | `ResumeAnalyst` (`structure`, `sellingPointCandidates`, `strengthRatios`) | onboarding | Claude Code headless | large | S-1: structure 5.6 s, and structure plus a selling-points call is about 11 s, inside the 20 s card |
   | `SearchPlanner.plan` | discovery | Claude Code headless | large | One or two calls per run. The plan decides coverage for the whole run, and its cost is negligible. Not measured in S-1; P2-T11 measures it |
   | `PostingEnricher.enrich` | discovery | Claude Code headless | small | Extraction by the PRD's tiering. S-1: p50 5.3 s, five in parallel 5.9 s |
   | `MatchJudge.judge` | matching | Claude Code headless | large | S-1: p50 3.3 s, citations 10 of 10 valid |
   | `Interviewer` (`nextQuestion`, `evidenceFrom`) | onboarding | Claude Code headless | large | The PRD's tiering. Stateless per call (W7); built in P3-T03 |
   | `ResumeWriter.rewrite` | tailoring | Claude Code headless | large | The PRD's tiering. The tailoring guard in the rules decides what may be shown (ADR 0007) |
   | `KeywordMatcher.presence` | tailoring | Claude Code headless | small | One narrow judgment per keyword (is a synonym present, and where), many per tailored resume. That is the same class of work as enrichment. Upgrade to large if the Phase 4 coverage evaluation traces misses to it |
   | `RelevanceRanker.rank` | discovery | **No model:** in-process lexical ranking (decision 6) | none | D3 |
   | `DocumentReader.read` | onboarding | **No model:** document libraries, including OCR (D9, P1-T08 and P1-T09) | none | Calls run with no tools (decision 3), so the model never reads files. A model-backed OCR would need a new ADR |
   | `MatchNarrator.narrate` | matching | **No model:** `TemplateNarrator` (W4) | large if W4 fires | User-facing copy, if it is ever model-written |

2. **One adapter package: `@matchmaker/model-runtime-claude-code`** (`packages/model-runtime-claude-code`), created by P1-T10. This is watch item W2's split.
   - **Why split now.** The adapters depend on an external program that no other adapter consumer needs (§3.5, §4.2 CRP). They change together whenever Claude Code changes (§4.2 CCP). No other adapter changes for that reason.
   - **The package has no npm dependency.** It drives the `claude` binary through `node:child_process`. Its contract tests replay recorded envelopes, so `pnpm verify` and CI need neither the CLI nor a sign-in.
   - **Areas inside it**, one per use-case area it serves, so a rubric change for the matching-policy owner lands in one folder (§3.2, §12.4).
     - `headless/` is the humble runner: building the arguments, the empty working directory, the child environment, stdin, the timeout, the concurrency limit, parsing the envelope, recording spend, and the start check.
     - `onboarding/` holds `ResumeAnalyst` and `Interviewer`.
     - `discovery/` holds `SearchPlanner` and `PostingEnricher`.
     - `matching/` holds `MatchJudge`, its rubric and `RUBRIC_VERSION`.
     - `tailoring/` holds `ResumeWriter` and `KeywordMatcher`.

     Each port adapter owns its JSON schemas and its system prompt. It maps `structured_output` into the port's plain types, and validates it before anything crosses inward.
   - **Changes to `tools/architecture/components.mjs`**, made by P1-T10 and not by this ADR:

     ```js
     "@matchmaker/model-runtime-claude-code": {
       dir: "packages/model-runtime-claude-code",
       circle: "3-4 adapters",
       allowed: ["@matchmaker/rules", "@matchmaker/use-cases"],
       platform: true,
     },
     // "@matchmaker/main".allowed and "@matchmaker/testing-api".allowed (contract suites) add "@matchmaker/model-runtime-claude-code".
     // AREAS:
     "@matchmaker/model-runtime-claude-code": {
       headless: [],
       onboarding: ["headless"],
       discovery: ["headless"],
       matching: ["headless"],
       tailoring: ["headless"],
     },
     // AREAS["@matchmaker/adapters"] adds relevance: [] (decision 6).
     ```

     When the last model port has its adapter (P4-T04), delete `UnchosenModelRuntime` together with the `model-runtime` area in `@matchmaker/adapters`.

3. **The "credential" is a signed-in CLI, checked by Main at start** (ADR 0016 §5). There is no key.
   - **Main gathers the configuration.** Each configuration that composes these adapters gathers a `ClaudeCodeRuntimeConfig` from the owner's local configuration (environment or the gitignored local file, X-2). It holds:
     - the command (default `claude`);
     - the tier aliases and the map from port to tier;
     - `maxConcurrentCalls` (default 5, the parallelism S-1 measured);
     - a per-call timeout (default 60 s; S-1's slowest call took 6 s);
     - `modelTrainingOffConfirmed` (decision 7).

     Main passes this configuration and the `SpendMeter` to the adapters' constructors. Nothing inside the use-case circle sees it.
   - **Start check.** Before composing, Main calls the package's `checkClaudeCodeReady(config)` and stops with exit 1 if any item fails. The message lists every failed item with its fix.
     - **Installed:** `claude --version` runs and is at least the version S-1 measured (2.1.322). Main raises that minimum when the adapters need newer flags.
     - **Signed in with the subscription:** checked with the CLI's own account-status output, without a model call. P1-T10 confirms the exact command against current Claude Code documentation.
     - **Training off confirmed:** `modelTrainingOffConfirmed` is present (decision 7).
   - **Signing out while the app runs.** The runner turns an authentication failure into the same message, thrown as an ordinary adapter failure.
   - **Configurations that run no model calls skip the check.** The testing API, `pnpm smoke` in CI and contract suites use scripted or recorded models.
   - **No leakage into prompts.** Every call runs as follows:
     - `claude -p --output-format json --json-schema <schema> --model <alias> --system-prompt <port prompt> --tools "" --strict-mcp-config --no-session-persistence`;
     - in an empty working directory the runner creates at start (so no project files, `CLAUDE.md` or project settings are in reach);
     - with no tools, no MCP servers and no saved session;
     - with the prompt on stdin, never in arguments, so resume text does not show in process listings;
     - with a child environment stripped of every `ANTHROPIC_*` and `CLAUDE_CODE_USE_*` variable, so a stray API key or cloud-provider switch cannot move the call off the subscription.

     The empty directory does not exclude user-level memory (`~/.claude/CLAUDE.md`), user hooks or plugins. P1-T10 confirms the flag that excludes them in the current CLI (for example `--setting-sources`), adds it to the runner, and records how it verified this in PROGRESS.md.

4. **"Temperature 0" is replaced** by three measures (approved 2026-11-11). Their combined guarantee is that a score never changes unless the profile or the posting changes.
   - **Structured output.** Each port method has a JSON schema passed with `--json-schema`, and the result is read from `structured_output`. A missing or schema-invalid result is a failed call: the adapter throws, and its spend is already recorded (decision 5).
   - **A fixed rubric.** The judge's rubric is the system prompt, a constant with a `RUBRIC_VERSION` in the package's `matching/` area. Changing the rubric is a versioned change, reported by every stability evaluation (P2-T14). Other ports keep fixed prompts in the same way. The model per tier is fixed by its alias in Main configuration.
   - **Cached judgments.** Matches are keyed by profile version and posting revision (ADR 0005), and `ScoreJobs` judges a pair once. S-1 showed that repeated fresh judgments can flip a requirement, so **the cache is what guarantees stability**. The Gate 2 stability evaluation (P2-T14) must keep scoring **fresh** judgments, with a new store per repetition, against the 95% within 3 points target.

5. **Spend under the subscription is the priced estimate.** The monthly budget and the daily caps run on estimates (ADR 0010, 0015).
   - For every call whose envelope carries `total_cost_usd`, the runner records `{ category: "model", provider: "claude-code", amountMicros: round(total_cost_usd × 1 000 000) }` through the `SpendMeter`.
   - The record is made once per call and before `structured_output` is validated, so failed and `is_error` calls are counted.
   - A call that produces no envelope (the CLI did not start, or was not signed in) records nothing, because the CLI reported no usage.
   - The provider label is data and never branched on (§3.4).
   - These amounts are not charges. They measure use at API prices, so they show which profile and which action uses the subscription, and the owner's budget works as a usage governor.

6. **D3: `RelevanceRanker` ranks lexically in process. It makes no model call.**
   - **The algorithm.** A deterministic term-weighting score (BM25 style) of each posting against the `ScoringProfile`: target and held titles, skills, keywords. Ties are broken by posting id.
   - **Location.** It lives in `@matchmaker/adapters`, in a new area `relevance/`. It has no third-party dependency, so W2 does not apply.
   - **Inputs.** It reads only a posting's title, description and location. Those fields exist before enrichment, which keeps the W17 remedy a one-type change.
   - **What stays in the use case.** The prefilter cap of 150 stays in `SEARCH_POLICY`.
   - **The PRD's "embedding similarity" is an interpretation**, recorded in D13. With no embeddings, D2 needs no pgvector, and SQLite stays the candidate.

7. **Privacy 4 is a precondition, made visible because it cannot be checked.**
   - **The rule.** The owner turns "Help improve Claude" **off** before any real person's resume, profile or posting judgment reaches the runtime. That is H-2, and it comes before P1-T10's real-resume runs, the H-3 corpus in P1-T11, and every later use. Only fictional samples (S-1, recorded fixtures) may be sent before then.
   - **It cannot be verified.** No CLI command or API exposes the setting. So the owner confirms it in local configuration with `modelTrainingOffConfirmed`, the date they turned it off.
   - **How it is made visible.**
     - Every configuration that composes these adapters, the evaluation Mains included, refuses to start without the setting. The message names the setting and where in Claude's settings to turn training off.
     - The confirmed date is printed at each start.
     - The owner's README (P6-T08) repeats the requirement.
   - **What the check does not cover.** It is the owner's declaration and does not prove the setting is off. If the owner switches training back on later, the app cannot notice. The README says so.

## Rationale

- §5.3, ADR 0003: the runtime is a detail chosen late, behind need-named ports. Choosing it changes only adapters and Main; no port signature changes.
- §3.2, §4.2 (CCP, CRP), §12.5: one package for everything that changes when Claude Code changes. Areas inside it mirror the actors, and the compiler and checker keep it from reaching any other adapter.
- §6.4, §9.1: the CLI is a local-process boundary owned by the CLI. The runner is the humble object around it, and the port adapters are testable on recorded envelopes. No command, path or account of the runtime appears above Main.
- §10.1: Main gathers the configuration, checks the environment and hands the adapters their settings. A failed start check is Main's job; the use cases never learn whether a CLI exists.
- §8.3, §7.2: `structured_output` is mapped into the ports' plain types inside the adapter. The envelope, cost fields and model ids never cross inward.
- §3.4: tiers and the provider label are data in configuration; no code branches on a model name.
- §2.4, ADR 0005: stability comes from immutability (judge once per profile version and posting revision), not from a sampling knob the runtime lacks.
- §13.6 (operation versus development): the CLI start overhead is bought off with parallelism inside a bound. It does not justify a second runtime.
- D3, §5.3, §13.3: adding an embeddings vendor would bring a second provider, key, bill and data flow against the owner's single-runtime choice. A ranking model call scales badly to the hundreds of postings the prefilter exists to cut. A lexical ranker is deterministic, which suits the consistency rules, costs nothing, takes milliseconds on the path to the first result, and runs offline in tests.

## Consequences

- **CLI start overhead (3 to 6 s per call).** The use cases currently enrich (`RunJobSearch`) and judge (`ScoreJobs`) one posting at a time, so 150 judgments in sequence would take about 8 minutes.
  - **Who bounds what.** The use cases fan their calls out: that is application policy and needs no port change. The runner bounds concurrent CLI processes with `maxConcurrentCalls`: that is a detail. `AsyncSpendMeter` already follows charges through fan-outs (ADR 0010).
  - **Expected timings.** 150 judgments at 5 in parallel take about 105 s, inside the 5-minute full run.
  - **Hand-off.** P2-T11 makes enrichment concurrent in `RunJobSearch`, and P2-T12 does the same for judging in `ScoreJobs`.
- **The onboarding run's first result.** Enrichment happens before the prefilter, so the first result waits until every new posting is enriched. With 5 in parallel, about 35 new postings fit inside the 60 s target. Later runs enrich only new postings, because the catalog is shared. This is watch item **W17**, decided with real fetch counts before P2-T13 builds the ranker.
- **Usage limits.** The subscription's usage limits are separate from the estimates and may be reached before any budget. A call refused for a usage limit is an ordinary adapter failure:
  - a search or scoring run fails;
  - a scheduled run's error goes to `onBackgroundError`.

  The owner sees no specific message yet. This is watch item **W18**.
- **Latency was measured in the cloud.** The owner accepted it. P2-T16 prints timings from the first real run, and the Phase 3 exit test runs on the owner's machine. Both are the check.
- **The model behind an alias can change.** A change of alias or rubric changes fresh judgments, not cached ones. Evaluation reports print the served model id (the envelope's `modelUsage`) and `RUBRIC_VERSION`, and the adapters do not pass either inward.
- **Claude Code updates itself.** A release can change flags or the envelope. Recorded-envelope contract tests catch shape changes in the adapters' own parsing but not in the live CLI. The evaluation runs are the live check. This is watch item **W19**.
- **Spend is shown as an estimate.** The running-cost screen (P6-T03) and the owner's README (P6-T08) label model spend "estimated at API prices; the subscription is not charged per call".
- **No port signature changes.** `RelevanceRanker` keeps `rank(profile, postings: JobPosting[])`. If W17 fires, the affected tasks are P2-T03, P2-T11, P2-T13 and P3-T07 (see `deferred.md`).
- **Plan text to align** (by the caller, documents only):
  - P1-T10 names `packages/model-runtime-claude-code`, with files under `src/headless/` and `src/onboarding/`;
  - P2-T13 places the ranker in `packages/adapters/src/relevance/` with no model call and no spend (its spend acceptance line is dropped);
  - P1-T10's no-training acceptance points to decision 7;
  - the `UnchosenModelRuntime` stub text still says "temperature 0" and goes away with it.

## Alternatives rejected

- **The Claude API with the owner's key**, for some or all ports: excluded by the owner (H-1). It was not evaluated.
- **The Claude Agent SDK in process:** it would add an npm dependency and a second way to reach the same subscription for no measured gain. The CLI with `--tools ""` already gives single-shot structured calls.
- **One shared Claude Code adapter class implementing every port** (as `UnchosenModelRuntime` does): one class responsible to four actors (§3.2). Kept only as the placeholder until each port has its own class.
- **Keeping the adapters in `@matchmaker/adapters/model-runtime`:** every consumer of the in-memory store or the job sources would then depend on code that changes with every Claude Code release (§4.2 CRP). W2's trigger is met.
- **Zero spend for subscription calls:** the monthly budget and the "cost per profile" metric would read zero while the subscription's usage is being consumed. The estimate is the only per-call measure available.
- **A small-model ranking call for `RelevanceRanker`:** S-1 took 5.9 s for 5 postings. Hundreds of postings need chunked calls that do not produce one global order, and "return every id exactly once" is not reliable at that length. It would also be non-deterministic and draw on usage limits on the path to the first result.
- **An embeddings provider for the prefilter:** a second vendor, key and data flow for friends' data, against Privacy 1 and 4 and the owner's single-runtime choice. It also pulls D2 toward pgvector.
- **Session reuse (`--resume`) for the interview:** it keeps state outside the data folder and outside the use case. The transcript stays owned by `ConductInterview` (W7).
- **Verifying the training setting programmatically:** not possible. A start-up refusal without a confirmation is the strongest visible guard available.

## Review trigger

- P2-T14 finds fewer than 95% of fresh re-scores within 3 points. First tighten the rubric (anchored definitions of partial). Then, by a new ADR, consider a three-call vote per judgment in the adapter, which triples judge spend.
- W17 fires: the remedy is in `deferred.md`.
- W18 or W19 friction appears.
- The Phase 3 exit test on the owner's machine misses the 20 s card or the 60 s first result.
- Low relevance jobs that the owner fully analyses (NF-6) come back Apply or Stretch in more than 1 in 10 cases. Then reconsider the lexical ranker: a model re-rank of the lexical top few hundred, behind the same port.
- The owner changes runtime or subscription, or Anthropic's terms for headless subscription use change.
