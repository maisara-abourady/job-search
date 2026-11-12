import type { Clock } from "../shared/ports.ts";
import type { CorrectProfile, CorrectProfileRequest, CorrectProfileResponse } from "../onboarding/correct-profile.ts";
import type { CreatePerson, CreatePersonRequest, CreatePersonResponse } from "../profiles/manage-people.ts";
import type { ListResults, ListResultsRequest, ListResultsResponse } from "../results/list-results.ts";
import type { RecordJobDecision, RecordJobDecisionRequest } from "../results/record-job-decision.ts";
import type { ProductEvents } from "./ports.ts";

/**
 * Measurement as decorators over other areas' input ports (ADR 0011). Each one observes only the request and
 * response of the port it wraps, emits after the wrapped use case succeeds, and returns its response unchanged.
 * The measured use cases know nothing of measurement; Main wraps them. Imports from other areas are types only
 * (enforced by tools/architecture/check.mjs).
 */
export class MeasuredCreatePerson implements CreatePerson {
  private readonly inner: CreatePerson;
  private readonly events: ProductEvents;
  constructor(inner: CreatePerson, events: ProductEvents) {
    this.inner = inner;
    this.events = events;
  }
  async execute(request: CreatePersonRequest): Promise<CreatePersonResponse> {
    const response = await this.inner.execute(request);
    this.events.record({ name: "profile-created", personId: response.personId, at: response.createdAt });
    return response;
  }
}

export class MeasuredListResults implements ListResults {
  private readonly inner: ListResults;
  private readonly events: ProductEvents;
  private readonly clock: Clock;
  constructor(inner: ListResults, events: ProductEvents, clock: Clock) {
    this.inner = inner;
    this.events = events;
    this.clock = clock;
  }
  async execute(request: ListResultsRequest): Promise<ListResultsResponse> {
    const response = await this.inner.execute(request);
    if (response.apply.length > 0) {
      this.events.record({
        name: "apply-verdict-shown",
        personId: request.personId,
        at: this.clock.now().toISOString(),
        applyCount: response.apply.length,
      });
    }
    return response;
  }
}

export class MeasuredRecordJobDecision implements RecordJobDecision {
  private readonly inner: RecordJobDecision;
  private readonly events: ProductEvents;
  private readonly clock: Clock;
  constructor(inner: RecordJobDecision, events: ProductEvents, clock: Clock) {
    this.inner = inner;
    this.events = events;
    this.clock = clock;
  }
  async execute(request: RecordJobDecisionRequest): Promise<void> {
    await this.inner.execute(request);
    if (request.decision === "applied") {
      this.events.record({
        name: "job-marked-applied",
        personId: request.personId,
        at: this.clock.now().toISOString(),
        postingId: request.postingId,
      });
    }
  }
}

/** Onboarding completion (preferences saved) and fix-a-fact rate, from the one correction use case. */
export class MeasuredCorrectProfile implements CorrectProfile {
  private readonly inner: CorrectProfile;
  private readonly events: ProductEvents;
  private readonly clock: Clock;
  constructor(inner: CorrectProfile, events: ProductEvents, clock: Clock) {
    this.inner = inner;
    this.events = events;
    this.clock = clock;
  }
  async execute(request: CorrectProfileRequest): Promise<CorrectProfileResponse> {
    const response = await this.inner.execute(request);
    const at = this.clock.now().toISOString();
    if (request.correction.kind === "preferences") this.events.record({ name: "preferences-saved", personId: request.personId, at });
    if (request.correction.kind === "fact") this.events.record({ name: "fact-fixed", personId: request.personId, at });
    return response;
  }
}
