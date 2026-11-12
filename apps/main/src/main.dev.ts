import {
  AsyncSpendMeter,
  GreenhouseBoardSource,
  InMemoryProductEventLog,
  InMemorySpendLedger,
  InMemoryStore,
  InMemoryUsageLedger,
  IntervalTicker,
  JsonArchiveVault,
  RandomIds,
  SystemClock,
  TemplateNarrator,
  UnchosenModelRuntime,
} from "@matchmaker/adapters";
import { presentRunningCost } from "@matchmaker/delivery";
import { composeMatchmaker } from "./compose-matchmaker.ts";

/**
 * Development configuration: everything in memory, model runtime not yet chosen (D1), Tier 1 only, no Tier 4.
 * The owner's local install (D5, D15) will be a sibling configuration: it calls composeMatchmaker the same way,
 * serves the web UI on 127.0.0.1 only (AB-5, LOOPBACK_BIND_ADDRESS), and starts the monitoring ticker below.
 */
const store = new InMemoryStore();
const usage = new InMemoryUsageLedger();
const clock = new SystemClock();
const spendLedger = new InMemorySpendLedger();
const productEvents = new InMemoryProductEventLog();
// ADR 0010: every adapter that spends money gets this meter in its constructor (none does yet: Greenhouse is free).
const meter = new AsyncSpendMeter(spendLedger, clock);
const models = new UnchosenModelRuntime();
const greenhouse = new GreenhouseBoardSource(async () => []);

/** How often Main asks whether any profile is due (ADR 0016). The 12-hour interval itself is MONITORING_POLICY. */
export const MONITORING_TICK_MS = 15 * 60_000;

export const matchmaker = composeMatchmaker({
  storage: store,
  operatorConsole: { ...bind(store, "setEnabled", "states"), recent: async () => [] },
  usage,
  spendLedger,
  spendAttribution: meter,
  personData: new JsonArchiveVault([
    { section: "profile", vault: store },
    { section: "dailyUsage", vault: usage },
    { section: "spend", vault: spendLedger },
    { section: "productEvents", vault: productEvents },
  ]),
  productEvents,
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

/**
 * The walking skeleton (D-10): one request through every layer. Creates and opens a profile, reads the running
 * cost and the (empty) results through their presenters and controller, and prints both view models.
 */
async function smoke(): Promise<void> {
  const { personId } = await matchmaker.useCases.createPerson.execute({ displayName: "Smoke" });
  await matchmaker.useCases.openPerson.execute({ personId });
  const runningCost = presentRunningCost(await matchmaker.useCases.viewRunningCost.execute({}));
  const results = await matchmaker.controllers.results.show(personId);
  console.log(JSON.stringify({ runningCost, results }, null, 2));
}

if (import.meta.main) {
  const command = process.argv[2];
  if (command === "smoke") {
    await smoke();
  } else if (command === undefined) {
    console.log("AI Job Matchmaker (dev):", Object.keys(matchmaker.useCases).join(", "));
    // Monitoring while the app runs: a catch-up tick now, then every MONITORING_TICK_MS. The dev run does not stay alive for it.
    new IntervalTicker((e) => console.error("monitoring", e)).start(
      () => matchmaker.useCases.runDueMonitoring.execute(),
      MONITORING_TICK_MS,
      { keepProcessAlive: false },
    );
  } else {
    console.error(`unknown command: ${command} (known: smoke)`);
    process.exitCode = 2;
  }
}
