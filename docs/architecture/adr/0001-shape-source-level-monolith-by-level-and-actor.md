# 0001. Shape: a source-level monolith, split by level into packages and by actor into areas, enforced by the compiler

Status: accepted (2026-11-11)

## Context

Greenfield. The repository held only the Architect agent and the book distillate; there was no code, no build and no prior decision. The requirement is the PRD "AI Job Matchmaker" (52 requirements, 8 flows, 6 release phases). The team is one product owner reviewing and Claude Code building, phase by phase. Builders under deadline pressure (human or AI) erode boundaries that rely on goodwill (§12.5).

Forces:
- Many independent axes of change are already visible: scoring rubric, job sources (four tiers, legal exposure, frequent breakage), model runtime (hosting terms unconfirmed), storage, web delivery, billing provider (depends on where the company incorporates), privacy law per market.
- Volatility is extreme at the edges (sources, models, prices, markets) and should be low at the center (the verdict rules once calibrated).
- One small team means one deployable is right for now (§5.2, §5.6). Deployment must be a single action.

## Decision

1. **Language and build:** TypeScript on Node 22, pnpm workspaces, no build step. Node strips types at run time; `tsc` type-checks; `erasableSyntaxOnly` keeps the code runnable as-is.
2. **One component per level** (Clean Architecture circles, §8.2). Each is a workspace package with an explicit manifest:

   | Package | Circle | May depend on |
   |---|---|---|
   | `@matchmaker/rules` | Entities | nothing |
   | `@matchmaker/use-cases` | Use cases | rules |
   | `@matchmaker/delivery` | Interface adapters (controllers, presenters, view models) | use-cases |
   | `@matchmaker/adapters` | Interface adapters and drivers (gateways, model runtime, sources, narration, background work) | rules, use-cases |
   | `@matchmaker/scraping-sources` | Tier 4 sources, optional | rules, use-cases |
   | `@matchmaker/main` (apps/main) | Main | everything above |
   | `@matchmaker/testing-api` | Tests | everything except itself |

3. **Areas by actor inside the inner packages** (§12.4, two dimensions). In `use-cases`: onboarding, discovery, matching, results, tailoring, monitoring, account, operations, plus shared. Areas never import each other. When one area needs another, it owns a request port (for example `SearchRequests` or `ScoringRequests`) and Main wires it.
4. **Published surfaces.** Each package exports one `index.ts`. `use-cases` exports ports and models as types only. Interactor classes are in `@matchmaker/use-cases/wiring`, which only Main may import.
5. **Enforcement, in order of strength:**
   - pnpm does not hoist workspace packages, so a package cannot even resolve a package its manifest does not list. The compiler refuses an outward import.
   - Inner circles compile with `types: []`, so `node:*` and any library are unresolvable in rules, use-cases and delivery.
   - `tools/architecture/check.mjs` fails the build on:
     - an outward arrow;
     - a surface bypass (`/wiring`);
     - a cross-area import;
     - a relative import that leaves its package;
     - manifest drift;
     - a cycle at package or area level.

     With `--metrics` it reports I, A and D per package.
   - The rules are data in `tools/architecture/components.mjs`. Changing that file needs an ADR.
6. **Decoupling mode:** source-level. One process today. See 0006 for what moves out first and when.
7. **Query use cases return their response model** and the controller hands it to a presenter. Push-style output (the results stream) goes through an output port the use case owns (`ResultsFeed`). Both obey the Dependency Rule, because response models belong to the use-case side (§8.3).

## Rationale

- §8.2 and §6.3: the circles and the plugin architecture.
- §12.4: separate by actor (SRP, §3.2) and by level (Dependency Rule).
- §12.5: "use the compiler to enforce the architecture if at all possible"; minimize public types; avoid the Périphérique anti-pattern. Adapter subfolders may not import each other.
- §5.6: start source-level, keep separability.
- §4.5: the package set is coarse on purpose. Seven packages at levels, with areas as folders, not one package per area. Components are expected to split as code accumulates (see the watch list), not be designed top-down.
- §13.5: no over-architecture for one team. Seven packages cost one manifest each.

## Consequences

- Any developer, or Claude Code, that reaches outward gets a compile error, not a code-review comment.
- `pnpm verify` (typecheck, architecture check, tests) is the gate for every phase exit.
- The adapters package will grow third-party dependencies. When it does, it is split by axis (see the watch list), so that Main and tests do not drag every vendor (CRP, §4.2).

## Alternatives rejected

- **Single package with folders:** the boundaries would hold only by goodwill (§12.5).
- **Package per area per level (about 30 packages):** that is component design ahead of code (§4.5), and over-architecture for one team (§13.5).
- **Services from day one** (the PRD's "API and workers ... services"): §5.6 and §10.2 say services are not an architecture, and the boundaries already run through the code. Promote under pressure only.
- **Python:** viable, but one language across delivery and core is cheaper for one team, and TypeScript's types carry the fairness brand and the published surfaces (0007).

## Review trigger

- A second team joins: consider deployment-level components per area (§5.2, Conway).
- A package's D drifts above 0.7, or a new SDP warning appears in `pnpm metrics`.
- The architecture check is bypassed or loosened.
