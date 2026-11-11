import {
  AsyncSpendMeter, GreenhouseBoardSource, InMemoryProductEventLog, InMemorySpendLedger, InMemoryStore, InMemoryUsageLedger, RandomIds,
  SystemClock, TemplateNarrator, UnchosenModelRuntime,
} from "@matchmaker/adapters";
import { composeMatchmaker } from "./compose-matchmaker.ts";

/**
 * Development configuration: everything in memory, model runtime not yet chosen, Tier 1 only, no Tier 4.
 * A web delivery (deferred) will call composeMatchmaker the same way from its own entry point.
 */
const store = new InMemoryStore();
const clock = new SystemClock();
const spendLedger = new InMemorySpendLedger();
// ADR 0010: every adapter that spends money gets this meter in its constructor (none does yet: Greenhouse is free).
const meter = new AsyncSpendMeter(spendLedger, clock);
const models = new UnchosenModelRuntime();
const greenhouse = new GreenhouseBoardSource(async () => []);

export const matchmaker = composeMatchmaker({
  storage: store,
  operatorConsole: { ...bind(store, "setEnabled", "states"), recent: async () => [] },
  usage: new InMemoryUsageLedger(),
  spendLedger,
  spendAttribution: meter,
  productEvents: new InMemoryProductEventLog(),
  clock,
  ids: new RandomIds(),
  judge: models,
  narrator: new TemplateNarrator(),
  planner: models,
  enricher: models,
  ranker: models,
  sources: [greenhouse],
  liveness: { isLive: async () => true },
  atsLinks: greenhouse,
  feed: { jobScored: (n) => console.log("scored", n) },
  onBackgroundError: (task, e) => console.error(task, e),
});

function bind<T extends object, K extends keyof T>(target: T, ...keys: K[]): Pick<T, K> {
  return Object.fromEntries(keys.map((k) => [k, (target[k] as (...a: unknown[]) => unknown).bind(target)])) as Pick<T, K>;
}

if (import.meta.main) console.log("AI Job Matchmaker (dev):", Object.keys(matchmaker.useCases).join(", "));
