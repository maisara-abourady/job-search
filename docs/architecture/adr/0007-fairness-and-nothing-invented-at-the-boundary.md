# 0007. Fairness and "nothing is invented" are enforced at the boundary, by types and by rules

Status: accepted (2026-11-11)

## Context

The PRD sets two guarantees:
- **Fairness:** name, photo, age, gender, nationality and marital status are stripped before any scoring call.
- **Nothing is invented:** a claim enters a resume only if the source resume or the user's confirmation supports it. Tailoring never changes employers, titles, dates, degrees, certifications or numbers.

Both guarantees are broken by the low-level side (a model), so they must be checked on the high-level side.

## Decision

1. `ScoringProfile` (rules) is `ProfileVersion` without `personal`, branded with a module-private unique symbol. Only `toScoringProfile()` can produce one. Every model-facing port takes `ScoringProfile`, so the compiler rejects a call that passes a profile with personal details. Redacting personal tokens from free-text evidence is a hand-off inside `toScoringProfile()`.
2. `enforceEvidence()` (rules) turns any Met or Partial judgment without a citation to existing profile evidence into Missing.
3. `checkTailoredResume()` (rules) is the tailoring guard. `TailorResume.generate` must run it on the writer's output and must not show a result with violations. The violations it detects:
   - a role's identity changed;
   - a credential changed;
   - a number appears that was not in the source;
   - a keyword was added that the user did not confirm.

## Rationale

- §7.2: these are business rules about what may be claimed, so they belong in the Entities.
- §12.5: enforce with the compiler where possible.
- §8.3: data crossing a boundary is shaped for the inner side.

## Consequences

- The model adapters cannot weaken either guarantee.
- The guard is conservative. For example, a number moved between bullets passes, and a newly written "40%" fails. Tuning it is a rules change with tests.

## Alternatives rejected

- **Prompt instructions alone:** not checkable, not testable, and owned by the detail.

## Review trigger

- A false positive rate in the guard that blocks legitimate tailoring.
- A new protected attribute is required by a launch market.
