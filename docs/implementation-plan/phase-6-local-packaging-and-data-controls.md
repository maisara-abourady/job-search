# Phase 6: Local packaging and data controls

Goal: In the local app the owner manages profiles (list, create, rename, switch), exports or deletes any profile, sees spend per profile and per month, sets an optional monthly budget and is asked before spending past it, and installs and starts the whole app with one command. **Exit test (PRD): on a fresh machine, the owner installs, starts the app, creates a profile and reaches a first match, then exports and deletes that profile cleanly.**
Detail level: Outline — detail at Gate 5, using S-7's answer
Traces to: UC-16 to UC-21 (screens), E-13, E-16, P-2, P-30, P-31, P-34, A-16b, A-22, A-24, A-28, A-32, D-2, D-8, D-12, M-3, X-7, X-14; PRD AB-1 to AB-5, Flow 8, "Running cost", Privacy 1, 2, 4, 5, release plan Phase 6; D15; watch W8, W15, W16
Prerequisites: Gate 5 passed; S-7 answered; H-17 fresh machine available for the exit test.

Rewritten 2026-11-11 for the scope revision; it replaces "Trial, billing and launch" (file `phase-6-trial-billing-launch.md`, removed). None of that phase's tasks had started; their IDs are reused here (see PROGRESS.md deviations log). The use cases behind these screens already exist and are tested (ADR 0014, 0015): this phase is delivery, the W16 hand-off, completeness of export and delete across the real local stores, and packaging.

## Tasks (outline)

### P6-T01 — Profile-management screens: list, create, rename, switch (AB-1, Flow 8 step 1)
- **Traces to:** UC-16, UC-17, D-8, D-12, E-13 · **Size:** M
- **Context:** Extends the Phase 3 picker into a profiles screen. A framework-free `ProfilesController` and presenter in a new `delivery/profiles` area (add it to `AREAS` in `components.mjs`, as P1-T07 did for `onboarding`), tested through a testing-API `profilesScreen`.
- **Acceptance:** The screen lists every profile by name with "last opened" in words; create and rename go through `CreatePerson` and `RenamePerson` (a blank or duplicate name shows the use case's `invalid-input` message); switching opens the profile through `OpenPerson` and every screen after it shows only that profile's results, inbox and tailored resumes (AB-2); the view model holds strings, flags and enums only.

### P6-T02 — Export and delete screens (AB-4, Flow 8 step 2, Privacy 2)
- **Traces to:** UC-18, D-12, P-31 · **Size:** S
- **Acceptance:** Export downloads one JSON archive named after the profile and the date, containing a section per store (`ExportPersonData`); delete asks the owner to type the profile's name, then calls `DeletePerson`; afterwards the profile is gone from the list and its spend appears in the running-cost panel's "Deleted profiles and other" line; deleting the open profile returns to the profiles screen.

### P6-T03 — Spend panel screen (AB-3, Flow 8 step 3)
- **Traces to:** UC-19, D-2, D-12, E-16 · **Size:** S
- **Acceptance:** The panel renders `presentRunningCost`: month label, one row per profile, the "other" line, the total, the budget line and the paused notice; a month switcher shows earlier months (`ViewRunningCost` with a month); amounts match `SpendLedger.spentBy` for each profile in a testing-API test.

### P6-T04 — Budget screen and "ask first" across every on-demand action (ADR 0015 §5)
- **Traces to:** UC-20, UC-21, D-12, E-16, W8 · **Size:** M
- **Acceptance:** The owner sets, changes or clears the monthly budget (`SetMonthlyBudget`; an invalid amount shows `invalid-input`); when an on-demand action (manual search, intake, interview, tailoring) is refused with `monthly-budget-reached`, the screen asks "The monthly budget is spent. Spend anyway?" and, on yes, resends the same request with `overBudgetConfirmed: true`; on no, nothing is spent; `daily-cap-reached` says which cap and that it resets tomorrow (UTC); a testing-API test covers each of the four actions.

### P6-T05 — Cancel a person's queued background work on delete (W16)
- **Traces to:** UC-18, P-34, A-32, W16, ADR 0014 Consequences · **Size:** L
- **Layer:** Use cases (`profiles` owns the new port) and adapters (`work`), wired in Main
- **Context:** Closes the HAND-OFF in `DeletePersonInteractor`: deferred.md W16's action is to give the work queue a cancel-by-person operation and have `DeletePerson` request it through a port it owns, before erasing. Tasks are already named `search:<personId>` and `rescore:<personId>`; the queue must track the person for each task, drop queued ones and wait for running ones to finish (or abort them) before `eraseAll`. Update `deferred.md` W16 through `/architect` when done.
- **Acceptance:** Deleting a profile while its search is queued means the search never runs; while its search is running, erasure happens only after it ends, and afterwards the export for that id is empty (no matches, runs, usage or events); spend from that work is kept with `personId` null and counted in the total; another profile's queued work still runs.

### P6-T06 — Export and delete are complete across every local store (ADR 0014 review trigger)
- **Traces to:** UC-18, P-31, A-22, A-16b, A-24, A-28, X-6, X-7 · **Size:** M
- **Context:** Every store holding a person's data must be in the local configuration's `JsonArchiveVault`; a missing one is a privacy defect. The in-memory stores were done by the Architect; Phases 3 and 4 added the local database, the resume folder, the interview transcripts and generated files.
- **Acceptance:** A test against the local web Main's configuration (temporary data folder) runs a full journey for two profiles (intake, preferences, interview, search, tailored resume, file export), exports one: the archive has a section for every store and nothing of the other profile; deletes it: no row in the database file and no file in the data folder mentions its `personId`, except spend rows with a null person; the month's total is unchanged.

### P6-T07 — Record the packaging decision (D15)
- **Traces to:** D15, X-14, S-7, ADR 0016 · **Size:** S
- **Acceptance:** `/architect` writes an ADR (next free number) from S-7's answer naming the install and start command, the supported Node version (`.node-version`), where the data folder and local configuration live by default, and how the app stays loopback-only; `deferred.md` D15 is marked decided. A container or anything needing a non-loopback bind requires the ADR to say how AB-5 still holds.

### P6-T08 — One-command install and start, and the owner's README
- **Traces to:** M-3, X-2, X-7, X-14, D15, AB-5, Privacy 1, 4, 5 · **Size:** L
- **Acceptance:** On a machine with only the prerequisites the ADR names, one command installs dependencies, creates the data folder and a local configuration from a template, applies the database schema, starts the app on `127.0.0.1` and prints the address; starting again reuses the data; a missing credential is reported by name and the app does not start. `README.md` for the owner covers install, the credential and its no-training setting (Privacy 4), where data lives and how to back it up, that disk encryption protects it (Privacy 1), asking friends before adding their resume (Privacy 5), and the Tier 4 warning.

### P6-T09 — Fresh-machine exit test (the Phase 6 exit test)
- **Traces to:** Gate 6, H-17, AB-1, AB-4, AB-5 · **Size:** M
- **Acceptance:** A scripted check (`pnpm e2e:local`, against the running app's HTTP routes with recorded model responses) creates a profile, uploads a fixture resume, waits for the first scored match, exports, deletes and checks the data folder holds nothing of the profile; it passes in CI. On the fresh machine (H-17) the owner follows only the README, installs with the one command, starts the app, creates a real profile, reaches a first match, then exports and deletes it; PROGRESS.md Notes records the date, the operating system and any step that needed help.

## Gate 6

- **Exit criteria:**
  - [ ] `pnpm verify`, `pnpm check:architecture` and `pnpm metrics` green
  - [ ] `pnpm e2e:local` green
  - [ ] **PRD exit test:** P6-T09 done on the fresh machine, recorded in PROGRESS.md Notes
- **Demo:** on the fresh machine: the one install command, start, create a profile, first match, export, delete; then the spend panel showing the month's total with the deleted profile under "other".
- **Human checkpoint:** Is the app ready for the friends you help? Review `deferred.md` in full (every D row, W8, W15, W16) and the PRD metrics targets for the first month of real use; decide whether any P1 requirement deserves a follow-up plan.
