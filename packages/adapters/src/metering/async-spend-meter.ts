import type { ChargeTo, Clock, Spend, SpendAttribution, SpendLedger, SpendMeter } from "@matchmaker/use-cases";
import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Attribution of spend to the charge a use case opened (ADR 0010). The charge follows the asynchronous call
 * chain inside one process (AsyncLocalStorage), so adapters report only what they spent, never for whom.
 * Across a process boundary (D4 worker) the charge does not travel: each interactor opens its own from its
 * request, which is why runId is carried in ScoringRequests.
 */
export class AsyncSpendMeter implements SpendMeter, SpendAttribution {
  private readonly current = new AsyncLocalStorage<ChargeTo>();
  private readonly ledger: Pick<SpendLedger, "append">;
  private readonly clock: Clock;
  constructor(ledger: Pick<SpendLedger, "append">, clock: Clock) {
    this.ledger = ledger;
    this.clock = clock;
  }
  charge<T>(to: ChargeTo, work: () => Promise<T>): Promise<T> {
    return this.current.run(to, work);
  }
  async record(spend: Spend): Promise<void> {
    const to = this.current.getStore();
    await this.ledger.append({
      userId: to?.userId ?? null, runId: to?.runId ?? null, purpose: to?.purpose ?? "unattributed",
      ...spend, at: this.clock.now().toISOString(),
    });
  }
}
