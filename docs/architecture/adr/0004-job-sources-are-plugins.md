# 0004. Job sources are plugins: one port, tier and kill switch as data, Tier 4 in its own package

Status: accepted (2026-11-11). Amended by ADR 0016: there are no launch markets; Tier 4 is off until the owner turns a board on (decision 6 now reads "an installation may leave the package out"); there is no proxy pool.

## Context

The PRD has four tiers and more than 25 named sources. The tiers differ in how they reach jobs:
- ATS endpoints per company;
- free APIs and RSS feeds;
- paid aggregators;
- scraping.

Sources break and change quotas often. Tier 4 carries legal exposure and may be forbidden per market. The product must work on Tiers 1 to 3 alone. When a Tier 4 source fails, the same queries fall back to Tier 3. Every source needs a kill switch that works without a deploy. The Tier 1 company registry grows from links found in Tiers 2 to 4.

## Decision

1. One port, `JobSource`, owned by the discovery use case: `descriptor { name, tier }` plus `search(queries, timeoutMs)`. It returns `FoundPosting` in the common schema. Adapters normalize; nothing source-specific crosses the boundary.
2. Tier is data the adapter declares. The use case branches on tier, never on a source's name. Each source owns its rate limits, proxies and endpoints.
3. The kill switch is the `SourceSwitchboard` port, read at run start. Its implementation is a stored flag (in memory today). The operator flips it through `OperateSources`.
4. A failed source never fails the run. The use case uses `Promise.allSettled`, and the failed sources are named in the run summary.
5. **Tier 3 fallback** (interpretation, cheap to change, inside `RunJobSearchInteractor.fetchAll`): paid Tier 3 aggregators are queried when any configured Tier 4 source failed or is switched off, or when no Tier 4 source is configured. Otherwise they are skipped to save per-call cost.
6. Tier 4 adapters live in `@matchmaker/scraping-sources`. Main for a market without legal clearance does not list them, so they are not even in that configuration's object graph.
7. Registry growth uses the `AtsLinkRecognizer` port, implemented by each Tier 1 adapter (it knows its own URL shape), and the `CompanyRegistry` gateway.

## Rationale

- §3.4 (LSP): the taxi-dispatch example; never special-case an implementation by name, and isolate variation behind configuration.
- §6.3: plugins as firewalls.
- §9.1: humble objects at the service boundary.
- §12.1: accommodate external demands at the side.
- §5.4: add a source by adding code, never by changing the use case (OCP, §3.3).

## Consequences

- Adding a source means one class plus one line in a Main configuration.
- Legal decisions per market become Main configurations (§10.1: one Main per jurisdiction), not code branches.
- The fallback interpretation must be confirmed. Reversing it is a one-function change.

## Alternatives rejected

- **A source registry keyed by name with switch statements:** an LSP violation.
- **Scrapers in the shared adapters package:** they could not be excluded per market, and they would drag a proxy pool and scraping libraries into everything (CRP, §4.2).
- **Sources as separate services now:** no pressure yet (§5.6). They stay plugins in-process until scraping isolation forces a process boundary (watch list).

## Review trigger

- The legal review is completed per market.
- Scraping needs its own IP space or sandbox. That promotes Tier 4 to a local process or service behind the same `JobSource` port.
