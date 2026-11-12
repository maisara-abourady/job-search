# 0016. Local-only operation: one process on the owner's machine, loopback-only delivery, monitoring while the app runs, Tier 4 off by default

Status: accepted (2026-11-11). **Amends** ADR 0003 (the runtime options and their trigger), ADR 0004 (no launch markets; Tier 4 off by default; no proxy pool), ADR 0006 (web, background work, file storage and database rows: now local choices) and ADR 0011 (the event destination D14 is decided: local). Decision 5 is made concrete by ADR 0009: the "credential" is a signed-in `claude` CLI that Main checks at start.

## Context

The revised PRD fixes where the system runs and who reaches it:
- **AB-5:** listen only on the local machine (localhost) by default; never expose the app to the internet.
- **Flow 6:** scheduled runs happen only while the app is running on the owner's machine; a run missed while it was off happens at the next start.
- **Runtime (D1):** Claude Code headless with the owner's subscription, or the Claude API with the owner's API key, decided in Phase 0 against Anthropic's documentation and terms. The API key is the safer default if the subscription terms are unclear.
- **Stack (assumption):** Next.js with SSE on localhost; a local database (SQLite, or Postgres with pgvector if embeddings need it); a folder on the owner's machine for files.
- **Privacy 1:** all data stays on the owner's machine apart from calls to the model provider and job sources; the data folder relies on the machine's disk encryption.
- **Tier 4:** off by default; the owner turns a board on after reading its terms; no proxy pool; never a logged-in personal account.
- **Phase 6:** one-command local install and start.

Before this, the design assumed a hosted product: a web host whose request lifetime would force a worker process (old D4 trigger), Postgres and object storage with encryption at rest, a vendor-or-own-table analytics question (D14), and one Main per launch market (ADR 0004, W10).

There is no login (ADR 0014). Anything that can reach the app's port can read every profile, including friends' resumes. Binding to loopback stops other machines, but a web page the owner visits can still send requests to `localhost` (cross-site requests) or rebind its hostname to `127.0.0.1` (DNS rebinding).

## Decision

1. **Topology: one local process.** The decoupling mode stays source-level (ADR 0001). The future web delivery, the use cases and background work share one Node process started by the owner. The worker process (D4, W5) loses its hosted trigger; it stays deferred with local triggers (deferred.md).
2. **Loopback only, enforced in two places.**
   - The web Main binds `LOOPBACK_BIND_ADDRESS` (127.0.0.1) and nothing else by default.
   - Every route handler refuses a request unless `acceptsLocalRequest({ host, origin })` holds: Host is a loopback name, and Origin, when sent, is a loopback http(s) origin. The function is framework-free and lives in `delivery/local-only/`; the web Main calls it before any controller. Tested through the testing API.
3. **Monitoring runs while the app runs.** `RunDueMonitoring` stays the policy: a profile is due when its last search is at least 12 hours old and it was opened in the last 14 days (ADR 0014), and nothing runs when the budget is reached (ADR 0015). Each configuration that serves the owner calls it **once at start** (the catch-up run: one search per due profile however long the app was off) and then on a timer. `IntervalTicker` (adapters `work/`) is the humble timer; the tick period (`MONITORING_TICK_MS`, 15 minutes) is configuration, not policy. The roster is the store's `peopleWithMonitoringOn`: monitoring is on once a profile's first search has run (Flow 6 step 1).
4. **Tier 4 is off until switched on.** `SourceSwitchboard.switchedOn(name)` returns null when the owner never decided. `RunJobSearch` applies `SOURCE_POLICY.offUntilSwitchedOn = [4]` by tier, never by name (§3.4). The owner turns a board on through `OperateSources`. With Tier 4 off, the existing fallback rule already queries Tier 3 aggregators. `scraping-sources` stays a separate package (its library must not reach anything else, §3.5, §4.2), and an installation may leave it out. There is no proxy pool, so the `proxy` spend category is removed.
5. **The runtime (D1) stays behind the need-named ports** (ADR 0003). Whichever runtime is chosen, the owner's credential (subscription session or API key) is gathered by Main from local configuration and given to the adapters' constructors. Nothing inside the use-case circle sees it. The PRD's preference for the API key when terms are unclear is an input to the Phase 0 decision, not a code branch.
6. **Local details, still deferred, now with local defaults** (deferred.md):
   - database (D2): a local database; SQLite (Node's built-in `node:sqlite`, no dependency) is the default candidate, Postgres with pgvector only if embeddings need it;
   - vector search (D3): in-process cosine is enough at this scale unless measured otherwise;
   - file storage (D8): a data folder on the owner's machine; no application-level encryption (Privacy 1 relies on disk encryption);
   - product events (D14): **decided**: stored locally by the same storage adapter. A third-party analytics vendor would send data off the machine, which Privacy 1 forbids.
   - packaging (new D15): the one-command install and start of Phase 6.

## Rationale

- §5.6, §13.6: start source-level; services and processes only under stated pressure. A single local user has no operational pressure that hardware on the desk cannot meet.
- §6.4, §9.1: the web route handlers are humble objects; the local-request check is a testable function they call.
- §7.1: the timer is IO, low level; the due rule is policy and stays in the use case. Main is the plugin that decides when to ask (§10.1).
- §3.4: tier as data decides the default; no source is special-cased by name.
- §5.3, §12.1: the database and file store stay details; the PRD's local stack is a good default, plugged in behind the same gateways.
- §13.3: the runtime is a vendor product with terms still open; isolating it keeps a "no" cheap.

## Consequences

- `monitoring.test.ts` proves the catch-up run and the 14-day pause; `discovery.test.ts` proves Tier 4 is off by default and Tier 3 covers it; `local-only.test.ts` proves the request check.
- The web Main (D5) must call `acceptsLocalRequest` in one place before every handler. A missing call is a security defect, not a style issue: the Phase 3 web task needs a test that a request with a foreign Host is refused.
- No encryption-at-rest code, no secrets store beyond the owner's local configuration, no migrations against a server.
- Monitoring coverage depends on the machine being on (PRD Risks); the catch-up run limits the gap to one search.

## Alternatives rejected

- **A login for a local app:** the PRD forbids it (AB-1); loopback plus the request check gives the protection a single-machine app needs.
- **Relying on the bind address alone:** leaves cross-site requests and DNS rebinding open while friends' resumes are on the machine.
- **An operating-system scheduler (cron, launchd, Task Scheduler) running searches while the app is closed:** the PRD says monitoring runs only while the app runs; it would also add per-OS install steps against the one-command goal.
- **Running every missed interval at start:** wastes the owner's money; one search finds the same new jobs.
- **Tier 4 excluded from Main unless enabled:** a restart would be needed to turn a board on; the switch already works without one.

## Review trigger

- The owner wants to reach the app from another device (a phone on the home network): that is exposure beyond loopback and needs authentication (reopens ADR 0014).
- A full run makes the UI unresponsive, or a background failure brings the UI down (D4, W5).
- D1 is decided: confirm the credential handling and whether subscription spend can be priced (ADR 0015).
