# 0003. The runtime agent is a detail behind need-named ports; the pipeline is a use case

Status: accepted (2026-11-11). Supersedes the PRD's topology "the API hands work to the agent; the agent dispatches pipeline workers".

## Context

The PRD gives Claude Code two roles:
- **builder:** implements the product phase by phase;
- **runtime agent:** plans searches, scores, tailors, and drafts adapter repairs.

It also leaves open whether Claude Code may run headless inside a hosted consumer product, and on what terms. It tiers models (small for extraction and enrichment, large for scoring reports, interview and tailoring, embeddings for the prefilter).

The runtime is therefore the most uncertain detail in the system. If the agent orchestrates the pipeline, the pipeline's policy lives inside the detail:
- ordering;
- failure tolerance;
- the Tier 3 fallback;
- the prefilter cap;
- the cost controls.

## Decision

1. The pipeline (plan, fetch, normalize, deduplicate, validate, enrich, prefilter, score) is a use case: `RunJobSearchInteractor` and `ScoreJobsInteractor`. Models are consulted at named steps through ports the use cases own, each named for the need:

   | Port | Area | PRD task |
   |---|---|---|
   | `SearchPlanner` | discovery | Search planner |
   | `PostingEnricher` | discovery | Enrich (small model) |
   | `RelevanceRanker` | discovery | Prefilter (embeddings) |
   | `MatchJudge`, `MatchNarrator` | matching | Scorer (split per 0002) |
   | `ResumeAnalyst`, `DocumentReader` | onboarding | Parsing, selling points, Resume Strength |
   | `Interviewer` | onboarding | AI interview |
   | `ResumeWriter`, `KeywordMatcher` | tailoring | Resume tailor |

2. No code inside the use-case circle names a model, a vendor, Claude Code, a prompt or a temperature. Model tiering is a Main configuration decision: which adapter, with which model, implements which port.
3. The runtime choice is deferred: Claude Code headless, the Claude Agent SDK, a direct model API, or a mix per port. `UnchosenModelRuntime` in adapters marks the place. Each port gets its own adapter class when chosen.
4. **Adapter repair is not a product use case.** It is a builder workflow: Claude Code in the repository, run by the operator, proposing a change that a human approves and deploys. Its only product touchpoints are the kill switch and the run summary (`OperateSources`).
5. All model ports receive `ScoringProfile`, never `ProfileVersion` (0007).

## Rationale

- §5.3: details that need not be decided early: maximize the number of decisions not made.
- §12.3: do not marry a framework.
- §13.3: a vendor can disappear and strand you.
- §6.4: higher-level code contains no names or addresses of lower-level services.
- §7.1: level is distance from IO, and a model call is IO.
- §3.5: depend only on what you use, so there is one narrow port per need, not an "Agent" god-interface.

## Consequences

- If the open question about Claude Code's terms comes back "no", nothing inside the boundary changes. Only adapters change.
- The pipeline is unit-testable with scripted planners, enrichers and judges (testing API).
- Cost controls (prefilter cap 150, fair-use caps, caching per profile version) are application code. Swapping a model cannot remove them.

## Alternatives rejected

- **The agent as orchestrator (the PRD diagram):** policy would live in a detail, untestable without the runtime, and the hosting question would become existential.
- **One `Agent` port with `run(task)`:** an ISP violation and a stringly-typed backchannel.

## Review trigger

- The hosting and terms question is answered. Write the first real adapter, and record a new ADR if any port's shape has to change.
- A port proves to need streaming or multi-turn state that its signature cannot carry. The likely candidate is `Interviewer`.
