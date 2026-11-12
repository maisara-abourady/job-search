// SPIKE S-1 (docs/implementation-plan/phase-0-skeleton.md): how each model port runs on Claude Code headless with
// the owner's subscription. Throwaway measurement code, not part of the app: no package imports it.
//
//   node tools/spikes/s1/run-s1.mjs [--large=sonnet] [--small=haiku] [--repeats=3] [--claude=claude]
//
// Needs Claude Code installed and signed in with the subscription. Sends only the fictional samples in ./samples.
// Writes results.json and report.md to tools/spikes/s1/results/<timestamp>/ (gitignored) and prints the report.
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const opts = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"];
  }),
);
const LARGE = opts.large ?? "sonnet";
const SMALL = opts.small ?? "haiku";
const REPEATS = Number(opts.repeats ?? 3);
const CLAUDE = opts.claude ?? "claude";
const sample = (f) => readFileSync(join(here, "samples", f), "utf8");
// An empty working directory, so no project CLAUDE.md, settings or memory shapes the answers.
const cwd = mkdtempSync(join(tmpdir(), "s1-"));

// ---------- schemas mirroring the ports (packages/use-cases, packages/rules) ----------
const SENIORITY = ["intern", "entry", "mid", "senior", "lead-or-staff", "manager", "director", "vp", "executive"];
const str = { type: "string" };
const strs = { type: "array", items: str };
const ratio = { type: "number", minimum: 0, maximum: 1 };
const obj = (properties) => ({ type: "object", properties, required: Object.keys(properties), additionalProperties: false });
const RESUME = obj({
  evidence: { type: "array", items: obj({ id: str, text: str }) },
  roles: {
    type: "array",
    items: obj({
      employer: str,
      title: str,
      start: { type: "string", pattern: "^\\d{4}-\\d{2}$" },
      end: { type: ["string", "null"] },
      evidenceIds: strs,
    }),
  },
  skills: { type: "array", items: obj({ name: str, evidenceIds: strs }) },
  credentials: strs,
  languages: strs,
  inferredSeniority: { enum: SENIORITY },
});
const ENRICHMENT = obj({
  requirements: { type: "array", items: obj({ id: str, text: str, kind: { enum: ["must-have", "nice-to-have"] }, keywords: strs }) },
  seniority: { enum: SENIORITY },
  workMode: { enum: ["on-site", "hybrid", "remote"] },
  country: str,
  language: str,
  authorization: obj({
    kind: { enum: ["sponsorship-offered", "authorization-required", "silent"] },
    postingText: { type: ["string", "null"] },
  }),
});
const JUDGMENTS = obj({
  requirements: {
    type: "array",
    items: obj({
      requirementId: str,
      judgment: { enum: ["met", "partial", "missing"] },
      evidenceIds: strs,
      closableByUser: { type: "boolean" },
    }),
  },
  experienceRelevance: ratio,
  skillsAndTools: ratio,
  scopeAlignment: ratio,
});
const RANKING = obj({ orderedIds: strs });

// ---------- one headless call ----------
function call({ label, model, system, prompt, schema }) {
  const args = ["-p", "--output-format", "json", "--json-schema", JSON.stringify(schema), "--model", model, "--tools", ""];
  args.push("--system-prompt", system, "--no-session-persistence", "--strict-mcp-config");
  const started = performance.now();
  return new Promise((resolve) => {
    const child = spawn(CLAUDE, args, { cwd, stdio: ["pipe", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => {
      out += d;
    });
    child.stderr.on("data", (d) => {
      err += d;
    });
    child.on("error", (e) => resolve({ label, model, ok: false, error: String(e), wallMs: performance.now() - started }));
    child.on("close", (code) => {
      const wallMs = Math.round(performance.now() - started);
      try {
        const r = JSON.parse(out);
        resolve({
          label,
          model,
          ok: code === 0 && !r.is_error && r.structured_output != null,
          wallMs,
          durationMs: r.duration_ms,
          apiMs: r.duration_api_ms,
          costUsd: r.total_cost_usd ?? null,
          servedBy: Object.keys(r.modelUsage ?? {}),
          output: r.structured_output ?? null,
          error: r.is_error ? (r.result ?? r.subtype) : null,
        });
      } catch {
        resolve({ label, model, ok: false, wallMs, error: `exit ${code}: ${(err || out).slice(0, 400)}` });
      }
    });
    child.stdin.end(prompt);
  });
}

// ---------- the ports, as single structured judgments ----------
const SYS = {
  analyst:
    "You structure resumes. Copy facts only from the resume text; invent nothing. Every achievement line becomes an evidence item with a stable id (ev-1, ev-2, ...). Roles and skills cite evidence ids. Months are YYYY-MM; end is null for a current role. Personal details (name, contact) are not part of the output.",
  enricher:
    "You extract structured requirements from a job posting. Copy facts only from the posting text. Requirement ids are r-1, r-2, ... in posting order. Country is an ISO 3166 alpha-2 code; language is the posting's ISO 639-1 code.",
  judge:
    "You judge how a candidate's evidence meets each job requirement, using a fixed rubric. met: the evidence clearly shows it. partial: related or weaker evidence. missing: no evidence. Every met or partial judgment cites the evidence ids that support it; cite only ids that exist. closableByUser: could the candidate close the gap by confirming, learning or reframing? The three ratios (0 to 1) rate experience relevance, skills and tools, and scope alignment. You only judge; you never decide whether to apply.",
  ranker: "You order job postings from most to least relevant to the candidate's profile. Return every posting id exactly once.",
};

const postings = [1, 2, 3, 4, 5].map((i) => ({ id: `job-${i}`, text: sample(`posting-${i}.txt`) }));
const resumes = [
  { id: "resume-a", text: sample("resume-a.txt") },
  { id: "resume-b", text: sample("resume-b.txt") },
];
const parallel = (items, fn) => Promise.all(items.map(fn));
const timed = async (fn) => {
  const t = performance.now();
  const value = await fn();
  return { value, ms: Math.round(performance.now() - t) };
};

console.log(`S-1: large=${LARGE} small=${SMALL} repeats=${REPEATS}. Calls run in parallel batches; expect a few minutes.`);

// 1. ResumeAnalyst.structure (large): NFR selling-points card within 20 s of upload.
const structured = await parallel(resumes, (r) =>
  call({ label: `structure ${r.id}`, model: LARGE, system: SYS.analyst, prompt: r.text, schema: RESUME }),
);
// 2. PostingEnricher (small), all postings at once.
const enrichBatch = await timed(() =>
  parallel(postings, (p) => call({ label: `enrich ${p.id}`, model: SMALL, system: SYS.enricher, prompt: p.text, schema: ENRICHMENT })),
);
const enriched = enrichBatch.value;
// 3. RelevanceRanker (small): no embeddings in Claude Code, so a ranking call stands in for D3.
const rank = await parallel(resumes, (r, i) =>
  call({
    label: `rank for ${r.id}`,
    model: SMALL,
    system: SYS.ranker,
    prompt: `Candidate evidence:\n${JSON.stringify(structured[i]?.output?.evidence ?? r.text)}\n\nPostings:\n${postings.map((p) => `[${p.id}] ${p.text}`).join("\n\n")}`,
    schema: RANKING,
  }),
);
// 4. MatchJudge (large): each resume against each posting, five at a time (NFR: first result within 60 s).
const judgePrompt = (ri, pi) =>
  `Candidate evidence (cite these ids):\n${JSON.stringify(structured[ri]?.output?.evidence ?? [])}\n\nRequirements (judge every id):\n${JSON.stringify(enriched[pi]?.output?.requirements ?? postings[pi].text)}`;
const judgeBatches = [];
for (const [ri, r] of resumes.entries()) {
  judgeBatches.push(
    await timed(() =>
      parallel(postings, (p, pi) =>
        call({ label: `judge ${r.id} x ${p.id}`, model: LARGE, system: SYS.judge, prompt: judgePrompt(ri, pi), schema: JUDGMENTS }),
      ),
    ),
  );
}
// 5. Consistency without temperature: the same judgment repeated (structured output plus a fixed rubric).
const repeated = await parallel([0, 2], (pi) =>
  parallel(
    Array.from({ length: REPEATS }, (_, k) => k),
    (k) =>
      call({
        label: `repeat ${k + 1} resume-a x ${postings[pi].id}`,
        model: LARGE,
        system: SYS.judge,
        prompt: judgePrompt(0, pi),
        schema: JUDGMENTS,
      }),
  ),
);

// ---------- analysis ----------
const all = [...structured, ...enriched, ...rank, ...judgeBatches.flatMap((b) => b.value), ...repeated.flat()];
const pct = (xs, q) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : null;
};
const byKind = (prefix) => all.filter((c) => c.label.startsWith(prefix));
const latency = (prefix) => {
  const ms = byKind(prefix)
    .filter((c) => c.ok)
    .map((c) => c.wallMs);
  return { calls: byKind(prefix).length, ok: ms.length, p50: pct(ms, 0.5), max: pct(ms, 1) };
};
const citationsValid = (judge, ri) => {
  const ids = new Set((structured[ri]?.output?.evidence ?? []).map((e) => e.id));
  return (judge.output?.requirements ?? []).every((r) => r.evidenceIds.every((id) => ids.has(id)));
};
const stability = repeated.map((runs) => {
  const ok = runs.filter((r) => r.ok).map((r) => r.output);
  const key = (o) => JSON.stringify(o.requirements.map((r) => [r.requirementId, r.judgment]));
  const same = ok.length > 0 && ok.every((o) => key(o) === key(ok[0]));
  const spread = (f) => (ok.length ? Math.max(...ok.map(f)) - Math.min(...ok.map(f)) : null);
  return {
    pair: runs[0]?.label.replace(/^repeat \d+ /, ""),
    runs: runs.length,
    ok: ok.length,
    identicalJudgments: same,
    ratioSpread: { experienceRelevance: spread((o) => o.experienceRelevance), skillsAndTools: spread((o) => o.skillsAndTools) },
  };
});
const costs = all.map((c) => c.costUsd).filter((c) => typeof c === "number");
const summary = {
  when: new Date().toISOString(),
  claudeVersion: await new Promise((res) => {
    const c = spawn(CLAUDE, ["--version"]);
    let o = "";
    c.stdout.on("data", (d) => {
      o += d;
    });
    c.on("close", () => res(o.trim()));
    c.on("error", () => res("unknown"));
  }),
  node: process.version,
  platform: `${process.platform} ${process.arch}`,
  models: { large: LARGE, small: SMALL, servedBy: [...new Set(all.flatMap((c) => c.servedBy ?? []))] },
  structuredOutput: {
    calls: all.length,
    valid: all.filter((c) => c.ok).length,
    failures: all.filter((c) => !c.ok).map((c) => `${c.label}: ${c.error}`),
  },
  latencyMs: {
    structure: latency("structure"),
    enrich: latency("enrich"),
    rank: latency("rank"),
    judge: latency("judge"),
    repeat: latency("repeat"),
  },
  batchesMs: { enrichFive: enrichBatch.ms, judgeFivePerResume: judgeBatches.map((b) => b.ms) },
  firstJudgeResultMs: Math.min(...judgeBatches.flatMap((b) => b.value.filter((c) => c.ok).map((c) => c.wallMs))),
  citations: {
    judgeCallsWithOnlyValidIds: judgeBatches.flatMap((b, ri) => b.value.map((j) => citationsValid(j, ri))).filter(Boolean).length,
  },
  stability,
  spend: {
    reportsCost: costs.length === all.length,
    totalUsd: costs.reduce((a, b) => a + b, 0),
    perCallUsd: { p50: pct(costs, 0.5), max: pct(costs, 1) },
  },
};

const outDir = join(here, "results", summary.when.replace(/[:.]/g, "-"));
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "results.json"), JSON.stringify({ summary, calls: all }, null, 2));
const l = summary.latencyMs;
const row = (name, x) => `| ${name} | ${x.ok}/${x.calls} | ${x.p50 ?? "-"} | ${x.max ?? "-"} |`;
const md = [
  "# S-1 results",
  "",
  `${summary.when} · ${summary.claudeVersion} · Node ${summary.node} · ${summary.platform}`,
  `Models asked: large=${LARGE}, small=${SMALL}; served by: ${summary.models.servedBy.join(", ")}`,
  "",
  "## Structured output",
  `${summary.structuredOutput.valid}/${summary.structuredOutput.calls} calls returned schema-valid output.`,
  ...summary.structuredOutput.failures.map((f) => `- ${f}`),
  "",
  "## Latency per call (wall clock, ms)",
  "| Port | OK | p50 | max |",
  "|---|---|---|---|",
  row("ResumeAnalyst.structure (large)", l.structure),
  row("PostingEnricher (small)", l.enrich),
  row("RelevanceRanker (small)", l.rank),
  row("MatchJudge (large)", l.judge),
  "",
  `NFR checks: structure p50 ${l.structure.p50} ms against the 20 s card (one call; the card also needs selling points). First judge result ${summary.firstJudgeResultMs} ms after its batch started, against 60 s for the first result (search and enrichment come first). Five enrichments in parallel: ${summary.batchesMs.enrichFive} ms. Five judgments in parallel: ${summary.batchesMs.judgeFivePerResume.join(" ms, ")} ms.`,
  "",
  "## Evidence citations",
  `${summary.citations.judgeCallsWithOnlyValidIds}/10 judge calls cited only evidence ids that exist (the rules drop invalid citations anyway).`,
  "",
  "## Consistency without temperature (same input repeated)",
  ...stability.map(
    (s) =>
      `- ${s.pair}: ${s.ok}/${s.runs} ok; identical judgments: ${s.identicalJudgments}; spread experienceRelevance ${s.ratioSpread.experienceRelevance}, skillsAndTools ${s.ratioSpread.skillsAndTools}`,
  ),
  "",
  "## Spend",
  `Every call reported a cost: ${summary.spend.reportsCost}. Total reported ${summary.spend.totalUsd.toFixed(4)} USD; per call p50 ${summary.spend.perCallUsd.p50}, max ${summary.spend.perCallUsd.max}. Under a subscription this is Claude Code's priced estimate, not a charge.`,
  "",
  "## Fill in by hand",
  "- Where this ran (owner's machine or cloud session):",
  "- Subscription plan, and whether these calls counted against its usage limits:",
  "- Model-training setting on the account (Privacy 4):",
  "",
].join("\n");
writeFileSync(join(outDir, "report.md"), md);
console.log(md);
console.log(`Saved: ${join(outDir, "report.md")}`);
