import {
  AsyncSpendMeter,
  GreenhouseBoardSource,
  InMemoryProductEventLog,
  InMemoryResumeFiles,
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
import { presentRunningCost, type OnboardingViewModel } from "@matchmaker/delivery";
import { LibraryDocumentReader } from "@matchmaker/documents";
import { checkClaudeCodeReady, ClaudeCodeResumeAnalyst, HeadlessRunner } from "@matchmaker/model-runtime-claude-code";
import type { ResumeAnalyst, ResumeUpload } from "@matchmaker/use-cases";
import { readFileSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { composeMatchmaker, type Matchmaker } from "./compose-matchmaker.ts";
import { ConfigurationMissing, loadModelRuntimeConfig } from "./config.ts";

/**
 * Development configuration: everything in memory, Tier 1 only, no Tier 4. Commands that call models (starting the
 * app) load the owner's local configuration and run the Claude Code start check first (ADR 0009); `smoke` calls no
 * model, so it needs neither and runs in CI. The owner's local install (D5, D15) will be a sibling configuration:
 * it calls composeMatchmaker the same way, serves the web UI on 127.0.0.1 only (AB-5, LOOPBACK_BIND_ADDRESS), and
 * starts the monitoring ticker below.
 */
const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const store = new InMemoryStore();
const usage = new InMemoryUsageLedger();
const clock = new SystemClock();
const spendLedger = new InMemorySpendLedger();
const productEvents = new InMemoryProductEventLog();
const resumeFiles = new InMemoryResumeFiles(() => clock.now());
// ADR 0010: every adapter that spends money gets this meter in its constructor.
const meter = new AsyncSpendMeter(spendLedger, clock);
const unchosen = new UnchosenModelRuntime();
const greenhouse = new GreenhouseBoardSource(async () => []);

/** How often Main asks whether any profile is due (ADR 0016). The 12-hour interval itself is MONITORING_POLICY. */
export const MONITORING_TICK_MS = 15 * 60_000;

/** The model-backed ports this configuration has adapters for; the rest stay on the placeholder until their phase. */
type Models = { readonly analyst: ResumeAnalyst };

function composeDev(
  models: Models,
  onBackgroundError: (task: string, e: unknown) => void = (task, e) => console.error(task, e),
): Matchmaker {
  return composeMatchmaker({
    storage: store,
    operatorConsole: { ...bind(store, "setEnabled", "states"), recent: async () => [] },
    usage,
    spendLedger,
    spendAttribution: meter,
    personData: new JsonArchiveVault([
      { section: "profile", vault: store },
      { section: "resumeFiles", vault: resumeFiles },
      { section: "dailyUsage", vault: usage },
      { section: "spend", vault: spendLedger },
      { section: "productEvents", vault: productEvents },
    ]),
    productEvents,
    clock,
    ids: new RandomIds(),
    resumeFiles,
    reader: new LibraryDocumentReader(),
    analyst: models.analyst,
    judge: unchosen,
    narrator: new TemplateNarrator(),
    planner: unchosen,
    enricher: unchosen,
    ranker: unchosen,
    sources: [greenhouse],
    liveness: { isLive: async () => true },
    atsLinks: greenhouse,
    feed: { jobScored: (n) => console.log("scored", n) },
    onBackgroundError,
  });
}

/**
 * The Claude Code models, or exit 1 with every missing setting and failed start check listed. Prints the owner's
 * training-off confirmation date at each start (ADR 0009 decision 7).
 */
async function claudeCodeModels(): Promise<Models> {
  let config: ReturnType<typeof loadModelRuntimeConfig>;
  try {
    config = loadModelRuntimeConfig({ env: process.env, root: repositoryRoot });
  } catch (e) {
    if (!(e instanceof ConfigurationMissing)) throw e;
    console.error(e.message);
    process.exit(1);
  }
  const problems = await checkClaudeCodeReady(config);
  if (problems.length > 0) {
    console.error(["Claude Code is not ready:", ...problems.map((p) => `  - ${p}`)].join("\n"));
    process.exit(1);
  }
  console.error(`Model training off: confirmed by the owner on ${config.modelTrainingOffConfirmed}.`);
  return { analyst: new ClaudeCodeResumeAnalyst(new HeadlessRunner(config, meter)) };
}

function bind<T extends object, K extends keyof T>(target: T, ...keys: K[]): Pick<T, K> {
  return Object.fromEntries(keys.map((k) => [k, (target[k] as (...a: unknown[]) => unknown).bind(target)])) as Pick<T, K>;
}

/**
 * The walking skeleton (D-10): one request through every layer. Creates and opens a profile, reads the running
 * cost and the (empty) results through their presenters and controller, and prints both view models.
 */
async function smoke(): Promise<void> {
  const matchmaker = composeDev({ analyst: unchosen });
  const { personId } = await matchmaker.useCases.createPerson.execute({ displayName: "Smoke" });
  await matchmaker.useCases.openPerson.execute({ personId });
  const runningCost = presentRunningCost(await matchmaker.useCases.viewRunningCost.execute({}));
  const results = await matchmaker.controllers.results.show(personId);
  console.log(JSON.stringify({ runningCost, results }, null, 2));
}

async function start(): Promise<void> {
  const matchmaker = composeDev(await claudeCodeModels());
  console.log("AI Job Matchmaker (dev):", Object.keys(matchmaker.useCases).join(", "));
  // Monitoring while the app runs: a catch-up tick now, then every MONITORING_TICK_MS. The dev run does not stay alive for it.
  new IntervalTicker((e) => console.error("monitoring", e)).start(
    () => matchmaker.useCases.runDueMonitoring.execute(),
    MONITORING_TICK_MS,
    {
      keepProcessAlive: false,
    },
  );
}

const INTAKE_USAGE = "usage: pnpm dev intake <path-to-resume (.pdf, .docx or .txt)> [--profile <name>] [--linkedin]";

/**
 * D-10 for onboarding (Flow 1 steps 1 to 3): creates or reuses a dev profile by name, opens it, uploads the file
 * through the IntakeController and prints the selling-points card and the seconds it took.
 */
async function intake(args: readonly string[]): Promise<void> {
  const path = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--profile");
  if (path === undefined) {
    console.error(INTAKE_USAGE);
    process.exitCode = 2;
    return;
  }
  const profileFlag = args.indexOf("--profile");
  const profileName = profileFlag >= 0 ? (args[profileFlag + 1] ?? "Dev") : "Dev";
  const upload = uploadOf(path, args.includes("--linkedin"));
  // The onboarding search needs the search planner, which arrives in Phase 2: one line instead of a stack trace.
  const matchmaker = composeDev(await claudeCodeModels(), (task) =>
    console.log(`(${task.split(":")[0]} requested; it fails until the search planner is built in Phase 2)`),
  );

  const existing = (await matchmaker.useCases.listPeople.execute()).people.find((p) => p.displayName === profileName);
  const personId = existing?.personId ?? (await matchmaker.useCases.createPerson.execute({ displayName: profileName })).personId;
  await matchmaker.useCases.openPerson.execute({ personId });

  const started = performance.now();
  const screen = await matchmaker.controllers.onboarding.intake.upload(personId, upload);
  const seconds = (performance.now() - started) / 1000;
  console.log(printable(screen));
  console.log(`\nTime from upload to card: ${seconds.toFixed(1)} s`);
  await matchmaker.work.drain();
}

function uploadOf(path: string, linkedin: boolean): ResumeUpload {
  const fileName = basename(path);
  const extension = extname(path).toLowerCase();
  if (extension === ".txt" || extension === ".md") return { kind: "text", fileName, bytes: null, text: readFileSync(path, "utf8") };
  const bytes = new Uint8Array(readFileSync(path));
  if (extension === ".docx") return { kind: "docx", fileName, bytes, text: null };
  return { kind: linkedin ? "linkedin-pdf" : "pdf", fileName, bytes, text: null };
}

/** The view model as a person would read it on screen. */
function printable(screen: OnboardingViewModel): string {
  switch (screen.kind) {
    case "card":
      return [
        screen.heading,
        "",
        ...screen.points.map((p) => `  [${p.tierLabel}] ${p.statement}\n      proof: ${p.proof}`),
        ...(screen.fewPointsNote === null ? [] : ["", screen.fewPointsNote]),
        "",
        `${screen.strengthLabel}: ${screen.strengthScore}`,
        `${screen.fixesHeading}:`,
        ...screen.fixes.map((f, i) => `  ${i + 1}. ${f}`),
        "",
        screen.suggestedLevel,
      ].join("\n");
    case "paste-text":
      return `${screen.heading}\n${screen.prompt}`;
    case "unsupported-language":
      return `${screen.heading}\n${screen.message}`;
    case "ask-first":
      return screen.question;
  }
}

if (import.meta.main) {
  const command = process.argv[2];
  if (command === "smoke") {
    await smoke();
  } else if (command === "intake") {
    await intake(process.argv.slice(3));
  } else if (command === undefined) {
    await start();
  } else {
    console.error(`unknown command: ${command} (known: smoke, intake)`);
    process.exitCode = 2;
  }
}
