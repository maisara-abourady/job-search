import {
  AsyncSpendMeter,
  InMemoryProductEventLog,
  InMemorySpendLedger,
  InMemoryStore,
  InMemoryUsageLedger,
  JsonArchiveVault,
  SystemClock,
  TemplateNarrator,
  UnchosenModelRuntime,
} from "@matchmaker/adapters";
import type { MatchmakerDetails } from "../src/compose-matchmaker.ts";

/**
 * Details with every store in memory and no model runtime (D1 is undecided): an evaluation overrides the ports it
 * measures with real adapters, or with scripted ones for the sample. Returns the store so a run can seed it.
 */
export function inMemoryDetails(overrides: Partial<MatchmakerDetails> = {}): { details: MatchmakerDetails; store: InMemoryStore } {
  const store = new InMemoryStore();
  const usage = new InMemoryUsageLedger();
  const spendLedger = new InMemorySpendLedger();
  const productEvents = new InMemoryProductEventLog();
  const clock = new SystemClock();
  const models = new UnchosenModelRuntime();
  let id = 0;
  const details: MatchmakerDetails = {
    storage: store,
    operatorConsole: { setEnabled: (n, e, r) => store.setEnabled(n, e, r), states: () => store.states(), recent: async () => [] },
    usage,
    spendLedger,
    spendAttribution: new AsyncSpendMeter(spendLedger, clock),
    personData: new JsonArchiveVault([
      { section: "profile", vault: store },
      { section: "dailyUsage", vault: usage },
      { section: "spend", vault: spendLedger },
      { section: "productEvents", vault: productEvents },
    ]),
    productEvents,
    clock,
    ids: { next: (prefix) => `${prefix}-${++id}` },
    judge: models,
    narrator: new TemplateNarrator(),
    planner: models,
    enricher: models,
    ranker: models,
    sources: [],
    liveness: { isLive: async () => true },
    atsLinks: { recognize: () => null },
    feed: { jobScored: () => {} },
    onBackgroundError: (task, e) => console.error(`background task ${task} failed:`, e),
    ...overrides,
  };
  return { details, store };
}
