# 0011. Product events are measured at the input ports by a measurement area; the destination is a detail

Status: accepted (2026-11-11). Amends ADR 0001 decision 3 ("areas never import each other") with one exception: the measurement area, types only. Amended by ADR 0014 (`signed-up` becomes `profile-created` from `CreatePerson`; `subscription-activated` and its decorator are removed; measurement imports `profiles` instead of `account`) and ADR 0016 (D14 decided: events are stored locally; no vendor).

## Context

The PRD's metrics table defines the product's success:
- **north star:** time to first strong match, the minutes from signup to the first Apply verdict shown;
- first-session match rate;
- onboarding completion (finishes preferences);
- interview completion (answers at least three questions);
- tailoring rate and applied rate (shares of Apply jobs);
- fix-a-fact rate;
- trial-to-paid conversion.

Phase 3's exit test is the north star, measured on five real users (P3-T14, P3-T15). Nothing in the system emits or stores these events yet.

Forces:
- The actor is the product owner measuring the product. That actor changes event definitions for its own reasons, for example "should onboarding count from the third preference screen?" The job seeker's use cases change for other reasons. Putting `analytics.track(...)` lines inside `ListResults`, `SignUp` and the rest would make every measurement change an edit to a seeker's use case (§3.2).
- The analytics destination is a detail with its own risks:
  - an own table, a vendor (PostHog, Amplitude and the like), or both;
  - Privacy 3 (no data shared with third parties);
  - per-market terms (W10);
  - cost.
- Every fact the metrics need is visible in a request or response at an input port. Signup: `SignUp` returns `trialStartedAt`. Apply shown: the `ListResults` response. Applied: the `RecordJobDecision` request. Conversion: the `RecordSubscriptionChange` response. Preferences, fact fixes, interview finished and tailoring are visible in the `CorrectProfile`, `ConductInterview` and `TailorResume` requests and responses.
- "Shown" is the slippery one. A `ResultsFeed` notice can fire while nobody is looking, for example a scheduled monitoring run at night. Counting it would flatter the north star.

## Decision

1. **A `measurement` area in `@matchmaker/use-cases`** owns:
   - the event vocabulary `ProductEvent`: a closed union, one event per PRD metric, carrying ids, counts and times only;
   - the port `ProductEvents.record(event): void`.

   The port is fire-and-forget. Implementations must not throw and must not block the user's action.
2. **Events are emitted by decorators over other areas' input ports**, in `measurement/measured-input-ports.ts`. Each decorator implements the port it wraps. It calls the real interactor, emits only after success, and returns the response unchanged. Main wraps; the measured use cases do not know measurement exists.

   | Event | Decorator | Fires when | Metric |
   |---|---|---|---|
   | `signed-up` (at = trial start) | `MeasuredSignUp` | sign-up returns | north star start, denominators |
   | `apply-verdict-shown` (applyCount) | `MeasuredListResults` | a results screen is served with at least one Apply | north star end (first per user), first-session match rate |
   | `job-marked-applied` (postingId) | `MeasuredRecordJobDecision` | decision is `applied` | applied rate |
   | `subscription-activated` | `MeasuredRecordSubscriptionChange` | an `applied` (not duplicate) `active` change | trial-to-paid |
   | `preferences-saved` | hand-off with `CorrectProfile` | a preferences correction is saved | onboarding completion |
   | `fact-fixed` | hand-off with `CorrectProfile` | a fact correction is saved | fix-a-fact rate |
   | `interview-finished` (answered) | hand-off with `ConductInterview` | state `finished` | interview completion (answered at least 3) |
   | `tailored-resume-generated` (postingId) | hand-off with `TailorResume.generate` | outcome `generated` | tailoring rate |

3. **"Shown" means served to a screen by `ListResults`.** Feed notices do not count, because a feed notice is not proof that anyone is looking. P3-T12 must make the results screen obtain its cards through `ListResults`. If streaming renders Apply cards without it, add a `ResultsShown` input port that the view calls, wrapped by a decorator. The event name and its meaning do not change (W11).
4. **"First", "rate" and "median" are queries, not events.** Every occurrence is stored, and the metric takes the first per user. The decorators keep no state.
5. **Enforcement.**
   - `components.mjs` declares the `measurement` area. It may import `shared`, `onboarding`, `results`, `tailoring` and `account`, and no other area may import it.
   - `TYPE_ONLY_AREA_IMPORTS` makes the architecture check fail any import from measurement into another area that is not `import type`, so measurement depends only on contracts, never on behavior.
6. **Destination.** `InMemoryProductEventLog` (adapters/in-memory) is the destination for now. The real destination is D14. When it is decided, it is an adapter behind the same port. Fanning out to several destinations is a composite adapter in Main.

## Rationale

- §3.2 and §5.4: the product owner is a separate actor, so their changes land in one area.
- §3.3 (OCP): measuring a new port means adding a decorator, not editing a use case.
- §10.2: cross-cutting concerns are handled by extension (decorators, Template Method or Strategy), not by touching every component. This is the kitty problem avoided.
- §5.3 and §12.3: the analytics vendor is a detail. Treat the analytics framework with a jaded eye, and keep it behind a port owned by the inside.
- §9.3: the API is owned by its user. The inner side defines the event vocabulary; the vendor maps it.
- §10.3: measurement is verified through the testing API (`productEvents(userId)`), with no vendor present.
- §12.5: the compiler and the check enforce the area rule and the type-only rule.

## Consequences

- The north star is computable today from `signed-up` and the first `apply-verdict-shown`. A test proves seven minutes for a scripted user.
- P3-T14 builds the operator-facing read (time to first strong match per user and median). This needs a read port in `measurement` and an operator use case. Nothing here needs to change for it.
- Each task that wires `CorrectProfile`, `ConductInterview` or `TailorResume` also adds and wires that port's decorator (plan tasks updated).
- AB-4: product events are keyed by user id. Erasing a user anonymizes them (P6-T05). They hold no personal data by construction, so the analytics destination never receives resume or profile content (Privacy 3).
- "Active user" for cost per active user (ADR 0010) means a user with any product event in the month. This is an interpretation, listed in D13.
- `use-cases` gains four concrete classes. A dropped from 0.47 to 0.44 and D is 0.03, so the component stays on the main sequence.

## Alternatives rejected

- **`events.record(...)` inside each interactor:** this mixes two actors in seven files (§3.2), and the seeker's use cases would change whenever a metric does.
- **Emitting in delivery (controllers or route handlers):** every delivery (web, worker, a future app) would have to remember it. It would be untestable through the testing API, and it puts product policy in the outer circle.
- **Decorators in Main:** Main must hold no policy. "Onboarding complete means preferences saved" is policy.
- **Counting `ResultsFeed` notices as shown:** this over-counts monitoring runs the user never sees.
- **One shared ledger for spend and events:** a different actor, unit and destination. The similarity is accidental (§5.5).
- **A vendor SDK now:** nothing is gained by deciding early. Privacy and market terms are still open (W10, H-15).

## Review trigger

- P3-T12 renders streamed Apply cards without `ListResults` (W11).
- D14 is decided.
- A metric needs a fact that no input port's request or response shows. If that happens, the use case's response model gains the fact; the use case never calls analytics.
