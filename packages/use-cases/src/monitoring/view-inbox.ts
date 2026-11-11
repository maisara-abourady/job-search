import type { Clock } from "../shared/ports.ts";
import type { InboxSource } from "./ports.ts";

/** MN-3: new Apply and Stretch matches since the last visit. */
export type InboxResponse = { readonly items: readonly { postingId: string; title: string; employer: string; verdict: "apply" | "stretch"; reason: string }[] };
export interface ViewInbox {
  execute(request: { personId: string }): Promise<InboxResponse>;
}
export class ViewInboxInteractor implements ViewInbox {
  private readonly inbox: InboxSource;
  private readonly clock: Clock;
  constructor(inbox: InboxSource, clock: Clock) {
    this.inbox = inbox;
    this.clock = clock;
  }
  async execute(request: { personId: string }): Promise<InboxResponse> {
    const since = await this.inbox.lastVisitAt(request.personId);
    const items = await this.inbox.matchesSince(request.personId, since);
    await this.inbox.recordVisit(request.personId, this.clock.now().toISOString());
    return { items };
  }
}
