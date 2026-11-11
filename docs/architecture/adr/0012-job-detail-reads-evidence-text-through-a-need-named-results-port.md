# 0012. Job detail reads evidence text through a need-named results port, resolved from the match's own profile version

Status: accepted (2026-11-11)

## Context

Job detail (Flow 3; MR-5, MR-8) shows the three points to capitalize "with evidence" and a requirement table with the cited evidence. `ResultRow` carries evidence ids only: `pointsToCapitalize[].evidenceId` and `assessment.judgments[].evidenceIds`. Evidence text lives in `ProfileVersion.evidence`. `ViewJobDetail` was a stub noting that it needed "evidence text lookup by id".

A naive lookup ("fetch the active profile, find the id") has a defect. Under ADR 0005 a correction makes a new version, and a fact correction keeps the evidence id while changing its text (`ProfileCorrection` "fact" has `evidenceId` and `newText`). A detail screen showing new text against a verdict judged on old text would misstate why the verdict was given. The text shown must be the text the judge saw.

`ListResults` needs none of this text. Adding it to every `ResultRow` would make the list carry data it never uses (§3.5).

## Decision

1. `ResultsReadModel` gains one method, named for the need: `jobDetail(userId, postingId): Promise<JobDetailRow | null>`.
2. `JobDetailRow = ResultRow & { evidence: readonly EvidenceText[] }`, where `EvidenceText = { id, text }`. `evidence` is the evidence of the profile version that this match was judged against. The read model resolves it from the match's `profileVersionKey`, which the use case never sees. The method returns null when the active version has no match for the posting. Results read only the active version's matches (ADR 0005 §5), so after a correction the detail exists again once re-scoring has run.
3. `ViewJobDetailInteractor` is implemented. It is the port's only consumer, and the decision is not testable without it.
   - It maps the row to the existing `ViewJobDetailResponse`.
   - A citation the row cannot resolve is not shown.
   - Gaps are judged requirements that are not Met, each marked closable or not.
   - The requirement table lists judged requirements, with the first resolvable evidence text.
   - Main wires it as `useCases.viewJobDetail`.
4. `ResultRow` is unchanged. `ListResults` is unaffected.

## Rationale

- §9.1: the gateway has one method per application need, named for the need. Its implementation is humble and does the join (the SQL later).
- §3.5 and §4.2: the list does not depend on data only the detail uses.
- §2.4 and ADR 0005: immutable versions mean the version that was judged is the truth for that verdict.
- §8.3: the row is a plain structure shaped for the use case. No Entity and no database row crosses.
- §5.5: the detail reuses `ResultRow` because it truly is the row plus evidence, which is true duplication. The intersection keeps one definition.

## Consequences

- P3-T05 shrinks to the presenter and view model (D-5), the screen work in P3-T12, and its acceptance list. Report parts 5 and 6 (E-15) stay in P3-T04.
- The Postgres read model (P3-T08) implements `jobDetail` as a join of match, posting and the evidence of the match's profile version. Add it to the results-read-model contract suite.
- Evidence is the user's own text, shown to the same user. No fairness redaction applies here, because redaction is for model calls (ADR 0007).

## Alternatives rejected

- **`ViewJobDetail` also depends on a profile gateway and calls `evidenceById` on the active profile:** it shows wrong text after Fix a fact until re-scoring finishes, and it adds a second gateway for one need.
- **Evidence text inside every `ResultRow`:** the list pays for data it never shows.
- **The narrator writes evidence text into the narration:** this duplicates profile data into match records, and the copy drifts if the evidence is erased (AB-4).

## Review trigger

- Detail needs evidence from a different version than the match's. For example, a "your profile changed since this score" banner would need both. Then extend `JobDetailRow`; do not look up on the side.
- Results reads slow down (W9).
