# 0014. A local personal tool: Person profiles replace users and accounts; trial, paywall, billing and retention are removed

Status: accepted (2026-11-11). **Supersedes ADR 0013** in full. **Amends** ADR 0001 (decision 3: the `account` area becomes `profiles` and `spending`), ADR 0005 (retention consequence), ADR 0006 (authentication and billing rows), ADR 0010 (who spend is charged to, "active user", erasure) and ADR 0011 (the event vocabulary and the measured ports).

## Context

The PRD was revised on 2026-11-11 (its "Scope revision" banner and Change log). The app is no longer a consumer product:
- it runs only on the owner's machine and is never hosted, sold or monetized;
- the owner operates it for themselves and a few friends, with **one profile per person** and no sign-up, login or password (AB-1);
- every profile's data is kept separate (AB-2) and can be exported or deleted on its own (AB-4);
- data is kept until the owner deletes the profile (Running cost, "Data retention"); there is no expiry;
- the data model's `User` (email, trial, subscription) is now `Person` (display name, created time).

The code still carried the consumer product:
- `rules/access` (trial days, banner, paywall, 30-day retention after expiry);
- the `account` area: `SignUp`, `ViewAccess`, `StartCheckout`, `RecordSubscriptionChange` (ADR 0013), `PurgeExpiredAccounts`, `ExportMyData`, `DeleteMyData`, with the `Accounts` and `Checkout` ports;
- `AccessGuard`, which refused cost-incurring work when the trial had ended;
- `presentAccess` (banner and paywall view model) in delivery;
- the `signed-up` and `subscription-activated` product events and their decorators;
- `userId` as the key of every record, the authenticated identity of a signed-up user.

Forces:
- Dead code costs spelunking and invites someone to "finish" it (§5.2 maintenance; §1.5 speculative generality). The billing provider, auth provider and market configurations would never arrive.
- The actor set changed (§3.2, §12.4). The business owner and the paying subscriber are gone. The **owner** now plays three roles that change for different reasons: managing the people they help (profiles, privacy), paying the bills (spend, budget), and switching sources (operations). Each person served is still the job seeker of every other area.
- The identity that keys all data is the person, chosen by the owner when switching profiles, not authenticated. The ubiquitous language should say so (§7.3, §12.5 ports and adapters).

## Decision

1. **Remove, do not stub,** everything that existed only for the consumer product: `rules/access`, the `account` area, `AccessGuard`, `presentAccess`, `MeasuredSignUp`, `MeasuredRecordSubscriptionChange`, the `signed-up` and `subscription-activated` events, the `Accounts`, `AccountsForAccess` and `Checkout` ports, and `billing.test.ts`. ADR 0013 (idempotent subscription events) is superseded: there are no subscription events.
2. **`Person` is an Entity** in `rules/profile/person.ts`: `{ personId, displayName, createdAt }` with `normalizeDisplayName`. Everything else about a person is keyed by `personId`. `userId` is renamed `personId` everywhere (ProfileVersion, every port, request, record and event).
3. **A `profiles` area** (actor: the owner managing the people they help) replaces `account`:
   - `CreatePerson`, `RenamePerson`, `ListPeople`, `OpenPerson` (AB-1, Flow 8 step 1);
   - `ExportPersonData`, `DeletePerson` (AB-4, Flow 8 step 2, Privacy 2);
   - ports `People` (extends the guard's `PeopleForSpending`) and `PersonDataVault`.
4. **Deletion and export cross every store.** Each store that holds a person's data implements `PersonDataVault`. The configuration composes them with `JsonArchiveVault` (adapters `data-controls/`), so the export is one JSON document with a section per store. On delete:
   - profile versions, selling points, matches, search runs, daily-cap counts and product events of that person are removed;
   - **spend records stay, with `personId` set to null.** They are the owner's bill and hold no personal data, so the month's total remains true;
   - postings and the company registry stay: they are shared job data, not the person's.
5. **No authentication anywhere.** Delivery receives the open profile's id from the screen the owner is on. Protection against other machines and other web pages is ADR 0016's job, not a login.
6. **Measurement** (ADR 0011) keeps its shape. The north star now starts at `profile-created`, emitted by `MeasuredCreatePerson` from `CreatePerson`'s response. `subscription-activated` is gone. The measurement area may import `profiles` types instead of `account`.
7. **MN-4 interpretation:** with no login, "14 days without a login" means 14 days since the owner last **opened** that profile (`OpenPerson` records `lastOpenedAt`; a never-opened profile counts from its creation). Recorded in D13.

## Rationale

- §1.5, §5.2: dead code is speculative generality and a maintenance cost; removing it is cheaper than keeping it honest.
- §3.2, §12.4: partition by actor. The owner's roles (people, bills, sources) change for different reasons, so they get different areas; the job seeker's areas are unchanged.
- §7.2: `Person` is Critical Business Data a coach would keep by hand (a client list). It knows nothing of how it is stored or shown.
- §7.3, §12.5: the code should say "person", the domain's word, not "user", the word of an authentication system that no longer exists.
- §9.1: one need-named port per store for export and erase; the implementations are humble.
- §5.5: spend records and personal data look alike (both carry a `personId`) but serve different actors. The owner's bill must survive a friend's deletion; the friend's data must not.

## Consequences

- Fewer moving parts: no auth provider (old D6), billing provider (old D7), retention purge, webhook listener or per-market Mains.
- `use-cases` loses five interactors and gains eight; `pnpm metrics` keeps it on the main sequence (D = 0.05).
- Tests: `profiles.test.ts` covers create, rename, list, open, separation of data per profile, export and delete (including the spend total after deletion).
- Every future store (local database, resume folder, generated files) must implement `PersonDataVault` and be added to the configuration's `JsonArchiveVault`. The contract suite for each store gains "erase leaves nothing of the person".
- `DeletePerson` does not yet wait for or cancel the person's queued background work (hand-off, Phase 6).

## Alternatives rejected

- **Keep the account code dormant "in case the product returns":** speculative generality (§1.5). If the product returns, the boundaries (ports, the use-case circle) make adding it back a matter of new code, not surgery.
- **Keep `userId` as the key and rename only the types:** the inner circles would keep speaking the language of a sign-up system (§7.3), and every reader would ask where authentication is.
- **Delete spend records with the person:** the owner's monthly total and budget would silently drop, which hides real cost.
- **Anonymize product events instead of deleting them:** they would need a nullable person id everywhere they are read, for checks that are not statistics at this scale (PRD Metrics).

## Review trigger

- The owner wants other people to run the app themselves, or to reach it from another device. That reopens authentication and hosting with a new ADR.
- A store is added that keeps a person's data and is not in the configuration's vault.
