import type { ProductEvent, ProductEvents, SpendLedger, SpendRecord } from "@matchmaker/use-cases";

/** Spend records in RAM (ADR 0010). The first real database implements the same gateway. */
export class InMemorySpendLedger implements SpendLedger {
  private readonly records: SpendRecord[] = [];
  async append(record: SpendRecord) {
    this.records.push(record);
  }
  async spentOnRun(runId: string) {
    return sum(this.records.filter((r) => r.runId === runId));
  }
  async spentBy(userId: string, fromIso: string, toIso: string) {
    return sum(this.records.filter((r) => r.userId === userId && r.at >= fromIso && r.at < toIso));
  }
  recorded(): readonly SpendRecord[] {
    return this.records;
  }
}
function sum(records: readonly SpendRecord[]): number {
  return records.reduce((total, r) => total + r.amountMicros, 0);
}

/** Product events in RAM (ADR 0011). A vendor or own-table destination implements the same port (D14). */
export class InMemoryProductEventLog implements ProductEvents {
  private readonly events: ProductEvent[] = [];
  record(event: ProductEvent): void {
    this.events.push(event);
  }
  recorded(): readonly ProductEvent[] {
    return this.events;
  }
}
