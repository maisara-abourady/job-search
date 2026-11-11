// Fails the build when an arrow points outward, a surface is bypassed, an area reaches into another,
// a manifest drifts from the architecture, or a cycle appears. With --metrics, reports I, A and D (§4.6, §4.7).
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { AREAS, COMPONENTS, RESTRICTED_SUBPATHS } from "./components.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const errors = [];
const warn = [];

const walk = (dir) =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (f === "node_modules") return [];
    return statSync(p).isDirectory() ? walk(p) : p.endsWith(".ts") ? [p] : [];
  });

const IMPORT_RE = /(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;
const specifiers = (src) => [...src.matchAll(IMPORT_RE)].map((m) => m[1] ?? m[2]);
const packageOf = (spec) => spec.split("/").slice(0, spec.startsWith("@") ? 2 : 1).join("/");

const files = {}; // component -> [{ path, src }]
for (const [name, c] of Object.entries(COMPONENTS)) {
  const dirs = ["src", "test"].map((d) => join(root, c.dir, d)).filter((d) => { try { return statSync(d).isDirectory(); } catch { return false; } });
  files[name] = dirs.flatMap(walk).map((path) => ({ path, src: readFileSync(path, "utf8") }));
}

const areaOf = (name, path) => {
  const rel = relative(join(root, COMPONENTS[name].dir, "src"), path).split(sep);
  return rel.length > 1 && !rel[0].startsWith("..") ? rel[0] : null;
};

const pkgEdges = new Map(Object.keys(COMPONENTS).map((n) => [n, new Set()]));
const fanIn = Object.fromEntries(Object.keys(COMPONENTS).map((n) => [n, 0]));
const fanOut = Object.fromEntries(Object.keys(COMPONENTS).map((n) => [n, 0]));
const areaEdges = {}; // component -> Map(area -> Set(area))

for (const [name, c] of Object.entries(COMPONENTS)) {
  areaEdges[name] = new Map();
  for (const { path, src } of files[name]) {
    const where = relative(root, path);
    let dependsOutside = false;
    for (const spec of specifiers(src)) {
      if (spec.startsWith(".")) {
        const target = resolve(dirname(path), spec);
        if (!target.startsWith(join(root, c.dir) + sep)) errors.push(`${where}: relative import leaves the component: ${spec}`);
        const from = areaOf(name, path), to = areaOf(name, target);
        if (AREAS[name] && from && to && from !== to) {
          if (!(AREAS[name][from] ?? []).includes(to)) errors.push(`${where}: area "${from}" may not import area "${to}" (${spec})`);
          if (!areaEdges[name].has(from)) areaEdges[name].set(from, new Set());
          areaEdges[name].get(from).add(to);
        }
        if (AREAS[name] && from && !(from in AREAS[name])) errors.push(`${where}: area "${from}" is not declared in components.mjs`);
        continue;
      }
      if (spec.startsWith("node:")) {
        if (!c.platform) errors.push(`${where}: ${c.circle} code may not use the platform (${spec}); put it behind a port`);
        continue;
      }
      const pkg = packageOf(spec);
      if (pkg.startsWith("@matchmaker/")) {
        if (pkg !== name && !c.allowed.includes(pkg)) errors.push(`${where}: ${name} may not depend on ${pkg} (Dependency Rule)`);
        if (spec !== pkg && !(RESTRICTED_SUBPATHS[spec] ?? []).includes(name)) errors.push(`${where}: ${spec} is not published to ${name}`);
        if (pkg !== name) {
          pkgEdges.get(name).add(pkg);
          fanIn[pkg] = (fanIn[pkg] ?? 0) + 1;
          dependsOutside = true;
        }
        continue;
      }
      if (!c.platform) errors.push(`${where}: ${c.circle} code may not import a library or framework (${spec})`);
    }
    if (dependsOutside) fanOut[name]++;
  }
  // Manifest must not grant more than the architecture allows (pnpm resolves only declared dependencies).
  const manifest = JSON.parse(readFileSync(join(root, c.dir, "package.json"), "utf8"));
  for (const dep of Object.keys(manifest.dependencies ?? {})) {
    if (dep.startsWith("@matchmaker/") && !c.allowed.includes(dep)) errors.push(`${c.dir}/package.json: declares ${dep}, which ${name} may not depend on`);
  }
}

function findCycle(graph) {
  const state = new Map();
  const stack = [];
  const visit = (n) => {
    state.set(n, "open");
    stack.push(n);
    for (const m of graph.get(n) ?? []) {
      if (state.get(m) === "open") return [...stack.slice(stack.indexOf(m)), m];
      if (!state.has(m)) { const c = visit(m); if (c) return c; }
    }
    stack.pop();
    state.set(n, "done");
    return null;
  };
  for (const n of graph.keys()) if (!state.has(n)) { const c = visit(n); if (c) return c; }
  return null;
}
const pkgCycle = findCycle(pkgEdges);
if (pkgCycle) errors.push(`component cycle: ${pkgCycle.join(" -> ")}`);
for (const [name, g] of Object.entries(areaEdges)) {
  const c = findCycle(g);
  if (c) errors.push(`area cycle in ${name}: ${c.join(" -> ")}`);
}

// ---- metrics: I = Fan-out / (Fan-in + Fan-out); A = abstract / all declarations; D = |A + I - 1| ----
const metrics = {};
for (const name of Object.keys(COMPONENTS)) {
  const src = files[name].filter((f) => f.path.includes(`${sep}src${sep}`)).map((f) => f.src).join("\n");
  const na = (src.match(/^\s*export\s+interface\s/gm) ?? []).length + (src.match(/^\s*export\s+abstract\s+class\s/gm) ?? []).length;
  const concrete = (src.match(/^\s*export\s+class\s/gm) ?? []).length + (src.match(/^\s*export\s+(?:async\s+)?function\s/gm) ?? []).length
    + (src.match(/^\s*export\s+type\s+\w+(?:<[^>]*>)?\s*=/gm) ?? []).length;
  const I = fanIn[name] + fanOut[name] === 0 ? 0 : fanOut[name] / (fanIn[name] + fanOut[name]);
  const A = na + concrete === 0 ? 0 : na / (na + concrete);
  metrics[name] = { fanIn: fanIn[name], fanOut: fanOut[name], I, A, D: Math.abs(A + I - 1) };
}
for (const [from, tos] of pkgEdges) {
  for (const to of tos) {
    if (metrics[from].I <= metrics[to].I && from !== "@matchmaker/testing-api") {
      warn.push(`SDP: ${from} (I=${metrics[from].I.toFixed(2)}) depends on ${to} (I=${metrics[to].I.toFixed(2)}), which is not more stable`);
    }
  }
}

if (process.argv.includes("--metrics")) {
  console.log("component                       circle        fan-in fan-out    I     A     D");
  for (const [name, m] of Object.entries(metrics)) {
    console.log(`${name.padEnd(31)} ${COMPONENTS[name].circle.padEnd(13)} ${String(m.fanIn).padStart(6)} ${String(m.fanOut).padStart(7)}  ${m.I.toFixed(2)}  ${m.A.toFixed(2)}  ${m.D.toFixed(2)}${m.D > 0.7 ? "  <- investigate" : ""}`);
  }
}
for (const w of warn) console.warn(`warning: ${w}`);
if (errors.length > 0) {
  for (const e of errors) console.error(`architecture violation: ${e}`);
  process.exit(1);
}
console.log(`architecture ok: ${Object.keys(COMPONENTS).length} components, ${Object.values(files).flat().length} files, no outward arrows, no cycles`);
