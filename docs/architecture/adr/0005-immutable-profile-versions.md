# 0005. Profile versions are immutable; matches are keyed by profile version and posting revision

Status: accepted (2026-11-11). Consequence on retention amended by ADR 0014: data is kept until the owner deletes the profile; there is no purge after expiry.

## Context

The PRD's consistency rules say:
- judgments are cached per profile version and job;
- a job's score never changes unless the profile or posting changes;
- any profile edit re-scores all stored jobs and flags verdicts that changed;
- every resume version is kept (RP-8).

The data model is architecturally significant even though the storage technology is not (§12.1).

## Decision

1. A `ProfileVersion` (rules) is an immutable value. Every intake, correction, preference change and interview answer saves a new version and makes it active. `profileVersionKey = profileId@version`.
2. A `JobPosting` carries a `revision` that increments when its text changes.
3. A match is stored once per (profile version, posting id, posting revision). `ScoreJobs` reuses a stored match instead of calling the judge, so caching and score stability are one mechanism.
4. "Verdict changed" is computed against the latest earlier match for the same posting under a different profile version.
5. Results always read the active profile version's matches.

## Rationale

- §2.4: segregate mutability; prefer append-only data (CR, not CRUD), in the spirit of event sourcing.
- §7.2: Critical Business Data.
- §12.1: the data model matters; the database does not.

## Consequences

- Fix a fact (NF-5) and Flow 7 are one rule: a new version, then `RescoreAll`.
- Storage grows with versions. Retention and purge rules apply per user (AB-4, 30 days after expiry).
- The cost of re-scoring every stored job on every edit is real. Reusing per-requirement judgments whose requirement and cited evidence are unchanged is an optimization inside `RescoreAll` (hand-off). It does not change this decision.

## Alternatives rejected

- **A mutable profile with a cache-invalidation flag:** races between edits and background scoring, and no audit of which facts a verdict relied on.

## Review trigger

- Re-scoring cost per active user exceeds the budget set after pricing.
- A requirement for partial-profile versioning appears.
