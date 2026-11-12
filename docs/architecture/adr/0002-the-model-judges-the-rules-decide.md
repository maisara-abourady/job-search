# 0002. The model judges; the rules decide

Status: accepted (2026-11-11). Amended by ADR 0009: the runtime has no temperature setting. "Scoring runs at temperature 0" is replaced by structured output, a fixed versioned rubric and cached judgments, and stability is measured on fresh judgments.

## Context

The PRD lists "Scorer" as a runtime-agent task whose output is "gate results, scores, verdict, reason, report". Its scoring section also specifies exact gates, weights, thresholds, confidence rules, ranking and verdict rules, and demands that:
- scoring runs at temperature 0;
- judgments are cached;
- re-scoring the same pair lands within 3 points;
- a judgment without evidence counts as Missing.

A career coach doing this by hand would apply the same verdict rules. They are Critical Business Rules (§7.2). What a coach needs judgment for is narrower: is this requirement Met, Partial or Missing for this person, citing what evidence? And how relevant is this experience?

The calibration actor (whoever tunes strictness) and the model vendor change for different reasons at different rates. Putting the rules in a prompt would couple them.

## Decision

1. The verdict policy is code in `@matchmaker/rules/src/matching/`:
   - gates;
   - the evidence rule;
   - Fit composition and weights;
   - Confidence;
   - Job Quality;
   - verdict thresholds;
   - primary reason;
   - priority;
   - distance to Apply and the single biggest lever.

   It is pure and deterministic. Selling-point tiers, Resume Strength weights, ATS keyword coverage and the tailoring guard follow the same pattern in `profile/` and `tailoring/`.
2. A model contributes only judgments, through the `MatchJudge` port owned by the matching use case. The judgments are `MatchJudgments`:
   - per requirement: met, partial or missing, with evidence ids, plus closable-by-user;
   - three ratios: experience relevance, skills and tools, scope alignment.
3. Cheap rules run first. `needsJudgment()` skips the model when a gate fails or the posting is not in English (MR-1, cost).
4. The narration (one-sentence reason, three points to capitalize) is generated after the verdict is decided, by `MatchNarrator`. It may describe; it may not decide. The first implementation is a deterministic template (`TemplateNarrator`).

## Rationale

- §7.2: Entities hold Critical Business Rules, free of frameworks and external agencies.
- §9.3: "higher-level policy can hide inside what looked like the top component". The PRD's Scorer splits into a low-level judge and a high-level verdict policy.
- §6.3: boundaries go along axes of change.
- §3.3: the most protected component holds the business rules.
- The 3-point stability target becomes a property of the judge alone. The arithmetic adds no variance.

## Consequences

- Verdict changes for calibration are edits to `rules`, tested in milliseconds through the testing API with scripted judgments.
- A judge that cites evidence the profile does not hold is overruled by `enforceEvidence()`. This is "nothing is invented" on the scoring side.
- The stability metric (95% within 3 points) is measured by an evaluation suite against the real judge adapter, outside unit tests. That suite is on the hand-off list.
- Assumptions recorded in code, each to be confirmed:
  - Primary-reason precedence when several Not a fit triggers hold: language, authorization, seniority, posting quality, must-have coverage, overall fit.
  - Fit ≥ 80 with two or more Missing must-haves (coverage still ≥ 50%) is Stretch.
  - Source-reliability ratios per tier: 1, 0.75, 0.5, 0.25.
  - An empty must-have list counts as full coverage; thin postings are handled by Confidence.

## Alternatives rejected

- **The model returns scores and a verdict:** this cannot meet stability or evidence rules by construction, couples calibration to the vendor, and cannot be unit-tested.
- **Rules in a shared prompt file:** the policy would still be shaped by a detail.

## Review trigger

- Calibration wants to change the rubric shape, not just constants. For example: new components, per-segment weights, or user-adjustable weights (out of scope in v1). Then introduce a `MatchingPolicy` abstraction (watch list).
- Stability below 95% after the judge adapter exists.
