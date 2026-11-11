import type { PersonDataVault, ProductEvent, ProductEvents, SpendLedger, SpendRecord } from "@matchmaker/use-cases";

/** Spend records in RAM (ADR 0010). The first local database implements the same gateway (D2). */
export class InMemorySpendLedger implements SpendLedger, PersonDataVault {
  private records: SpendRecord[] = [];
  async append(record: SpendRecord) {
    this.records.push(record);
  }
  async spentOnRun(runId: string) {
    return sum(this.records.filter((r) => r.runId === runId));
  }
  async spentBy(personId: string, fromIso: string, toIso: string) {
    return sum(this.records.filter((r) => r.personId === personId && r.at >= fromIso && r.at < toIso));
  }
  async totalSpent(fromIso: string, toIso: string) {
    return sum(this.records.filter((r) => r.at >= fromIso && r.at < toIso));
  }
  async exportAll(personId: string): Promise<Uint8Array> {
    return new TextEncoder().encode(JSON.stringify(this.records.filter((r) => r.personId === personId)));
  }
  /** Spend is the owner's bill, not the person's data: the amounts stay, the link to the person goes (ADR 0014). */
  async eraseAll(personId: string) {
    this.records = this.records.map((r) => (r.personId === personId ? { ...r, personId: null } : r));
  }
  recorded(): readonly SpendRecord[] {
    return this.records;
  }
}
function sum(records: readonly SpendRecord[]): number {
  return records.reduce((total, r) => total + r.amountMicros, 0);
}

/** Product events in RAM (ADR 0011). The local database implements the same port (D14, decided local by ADR 0016). */
export class InMemoryProductEventLog implements ProductEvents, PersonDataVault {
  private events: ProductEvent[] = [];
  record(event: ProductEvent): void {
    this.events.push(event);
  }
  async exportAll(personId: string): Promise<Uint8Array> {
    return new TextEncoder().encode(JSON.stringify(this.events.filter((e) => e.personId === personId)));
  }
  async eraseAll(personId: string) {
    this.events = this.events.filter((e) => e.personId !== personId);
  }
  recorded(): readonly ProductEvent[] {
    return this.events;
  }
}
