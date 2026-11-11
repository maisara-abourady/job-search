import type { Clock } from "../shared/ports.ts";
import type { RecordSubscriptionChange, RecordSubscriptionChangeResponse, SubscriptionChange } from "../account/manage-subscription.ts";
import type { SignUp, SignUpRequest } from "../account/sign-up.ts";
import type { ListResults, ListResultsRequest, ListResultsResponse } from "../results/list-results.ts";
import type { RecordJobDecision, RecordJobDecisionRequest } from "../results/record-job-decision.ts";
import type { ProductEvents } from "./ports.ts";

/**
 * Measurement as decorators over other areas' input ports (ADR 0011). Each one observes only the request and
 * response of the port it wraps, emits after the wrapped use case succeeds, and returns its response unchanged.
 * The measured use cases know nothing of measurement; Main wraps them. Imports from other areas are types only
 * (enforced by tools/architecture/check.mjs).
 */
export class MeasuredSignUp implements SignUp {
  private readonly inner: SignUp;
  private readonly events: ProductEvents;
  constructor(inner: SignUp, events: ProductEvents) {
    this.inner = inner;
    this.events = events;
  }
  async execute(request: SignUpRequest) {
    const response = await this.inner.execute(request);
    this.events.record({ name: "signed-up", userId: request.userId, at: response.trialStartedAt });
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
      this.events.record({ name: "apply-verdict-shown", userId: request.userId, at: this.clock.now().toISOString(), applyCount: response.apply.length });
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
      this.events.record({ name: "job-marked-applied", userId: request.userId, at: this.clock.now().toISOString(), postingId: request.postingId });
    }
  }
}

export class MeasuredRecordSubscriptionChange implements RecordSubscriptionChange {
  private readonly inner: RecordSubscriptionChange;
  private readonly events: ProductEvents;
  constructor(inner: RecordSubscriptionChange, events: ProductEvents) {
    this.inner = inner;
    this.events = events;
  }
  async execute(change: SubscriptionChange): Promise<RecordSubscriptionChangeResponse> {
    const response = await this.inner.execute(change);
    // A redelivered provider event is not a second conversion.
    if (response.outcome === "applied" && change.status === "active") {
      this.events.record({ name: "subscription-activated", userId: change.userId, at: change.at });
    }
    return response;
  }
}
