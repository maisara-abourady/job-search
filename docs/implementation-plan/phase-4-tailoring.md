# Phase 4: Tailoring

Goal: From any Apply or Within reach job, the person (with the owner operating) confirms missing keywords, gets a tailored resume with keyword coverage before and after and a diff, and downloads PDF or DOCX, with nothing invented. **Exit test (PRD): tailored resumes parse cleanly in three common ATS parsers.**
Detail level: Outline — detail at Gate 3, using S-4's answer
Traces to: UC-13, UC-21, E-11, E-12, P-24 to P-28, P-31, A-13, A-14, A-23, A-24, D-6, X-5, X-12; PRD TR-1 to TR-5, Flow 4, "Tailored resume" section, NFR "Tailored resume within 45 seconds"; D9 (rendering)
Prerequisites: Gate 3 passed; S-4 answered; H-12 access to the three parsers.

Amended 2026-11-11 for the scope revision: "fair-use cap" is the daily cap enforced by `SpendingGuard` (ADR 0015); generated files live in the owner's data folder, not encrypted object storage; demos run on the owner's machine, not staging.

## Tasks (outline)

### P4-T01 — Testing-API superpowers and in-memory stores for tailoring
- **Traces to:** M-2, P-24, P-28 · **Size:** M
- **Acceptance:** Scripted matcher, writer and renderer; in-memory `TailoringSources` (source resume derived from the active profile's roles and evidence), `TailoredResumes`, `GeneratedFiles`, each implementing `PersonDataVault` and added to the configuration's `JsonArchiveVault`; wired through Main with the `SpendingGuard` the interactor already declares.

### P4-T02 — `TailorResume.missingKeywords` (TR-2)
- **Traces to:** UC-13, E-11 · **Size:** S
- **Acceptance:** Keywords absent exactly and by synonym are offered as chips; keywords already confirmed or denied are never asked again.

### P4-T03 — `TailorResume.generate` (TR-1, TR-3, TR-4) with the tailoring guard
- **Traces to:** UC-13, E-11, E-12, ADR 0007 §3 · **Size:** M
- **Acceptance:** Matcher and writer spend charged with purpose `tailoring` (ADR 0010); Main wires `TailorResume` wrapped in a new `MeasuredTailorResume` emitting `tailored-resume-generated` on outcome `generated` (ADR 0011); `SpendingGuard.beforeOnDemand(personId, "tailoredResumes", overBudgetConfirmed)` enforces the daily cap of 10 per profile per UTC day (`daily-cap-reached` on the 11th) and the monthly budget (`monthly-budget-reached` unless confirmed); "Have it" keywords saved to the profile as `confirmed-keyword` evidence with the user's line; a writer output with any guard violation is rejected (one adapter retry at most) and never shown; coverage before and after reported; diff against the source; list of added keywords.

### P4-T04 — Keyword matcher and resume writer adapters
- **Traces to:** A-13, A-14, P-25, P-26 · **Size:** M
- **Acceptance:** Contract suites pass on scripted and recorded responses; the guard rejects a recorded output that invents a number; each paid call records one `model` spend through `SpendMeter` (ADR 0010).

### P4-T05 — ATS-safe renderer for PDF and DOCX (TR-5) in `@matchmaker/documents`
- **Traces to:** A-23, P-27, D9 · **Size:** L
- **Acceptance:** Single column, standard headings, no tables, images or text boxes; round-trip through `DocumentReader` recovers every role and bullet.

### P4-T06 — `TailorResume.export` and generated-file storage
- **Traces to:** UC-13, A-24, P-28 · **Size:** S
- **Acceptance:** Export returns a file reference for PDF and DOCX; files stored in the owner's data folder (D8; no application-level encryption, Privacy 1); the folder store passes the `GeneratedFiles` and `PersonDataVault` contracts (erase removes the person's files).

### P4-T07 — Tailoring presenter and screens (Flow 4)
- **Traces to:** D-6, D-8 · **Size:** M
- **Acceptance:** Chips "Have it" and "Don't have it" with a one-line usage field; coverage before and after; diff; downloads; generated within 45 seconds of confirmation on the owner's machine.

### P4-T08 — ATS-parse and coverage evaluation (the Phase 4 exit test)
- **Traces to:** X-5, TR-3, TR-5 · **Size:** M
- **Acceptance:** `pnpm eval ats-parse` sends tailored resumes for a fixed job set to the three parsers from S-4 and checks roles, dates, titles and skills are recovered; reports coverage after tailoring against the 85% target.

### SPIKE S-5 — Tier 4 scraping bridge (see PLAN.md; only if the owner names a Tier 4 board, PLAN.md open question 1)

## Gate 4

- **Exit criteria:**
  - [ ] `pnpm verify` and `pnpm check:architecture` green
  - [ ] Testing-API tailoring tests green, including guard rejections
  - [ ] **PRD exit test:** `pnpm eval ats-parse` passes in all three parsers
- **Demo:** in the local app, tailor a resume for one Apply job, confirm one keyword, download both formats.
- **Human checkpoint:** Read three tailored resumes for overclaiming. Confirm H-16 (caps, interval, budget) and H-11 (Tier 3 keys). PLAN.md open question 1 (which Tier 4 boards, if any) must be answered now; if any, review S-5's answer. Check H-17 (fresh machine) has started. Review `deferred.md` (W6, W8).
- **Detail next phase:** expand Phase 5 to full task specs.
