/**
 * The architecture as data. The check script enforces it; docs/architecture/README.md explains it.
 * Changing this file is an architectural decision: it needs an ADR (latest: ADR 0009 added @matchmaker/model-runtime-claude-code, built by P1-T10).
 */
export const COMPONENTS = {
  "@matchmaker/rules": { dir: "packages/rules", circle: "1 entities", allowed: [], platform: false },
  "@matchmaker/use-cases": { dir: "packages/use-cases", circle: "2 use cases", allowed: ["@matchmaker/rules"], platform: false },
  "@matchmaker/delivery": { dir: "packages/delivery", circle: "3 adapters", allowed: ["@matchmaker/use-cases"], platform: false },
  "@matchmaker/adapters": {
    dir: "packages/adapters",
    circle: "3-4 adapters",
    allowed: ["@matchmaker/rules", "@matchmaker/use-cases"],
    platform: true,
  },
  "@matchmaker/scraping-sources": {
    dir: "packages/scraping-sources",
    circle: "3-4 adapters",
    allowed: ["@matchmaker/rules", "@matchmaker/use-cases"],
    platform: true,
  },
  // ADR 0009 decision 2: every model port runs on Claude Code headless; the adapters change together with the CLI.
  "@matchmaker/model-runtime-claude-code": {
    dir: "packages/model-runtime-claude-code",
    circle: "3-4 adapters",
    allowed: ["@matchmaker/rules", "@matchmaker/use-cases"],
    platform: true,
  },
  // ADR 0017: document reading (PDF, DOCX, language detection, OCR libraries) is its own adapter package (W2, D9).
  "@matchmaker/documents": {
    dir: "packages/documents",
    circle: "3-4 adapters",
    allowed: ["@matchmaker/rules", "@matchmaker/use-cases"],
    platform: true,
  },
  "@matchmaker/main": {
    dir: "apps/main",
    circle: "4 main",
    platform: true,
    allowed: [
      "@matchmaker/rules",
      "@matchmaker/use-cases",
      "@matchmaker/delivery",
      "@matchmaker/adapters",
      "@matchmaker/scraping-sources",
      "@matchmaker/documents",
      "@matchmaker/model-runtime-claude-code",
    ],
  },
  "@matchmaker/testing-api": {
    dir: "packages/testing-api",
    circle: "tests",
    platform: true,
    // ADR 0017: only the contract suites import @matchmaker/documents; scenario tests script the reader.
    allowed: [
      "@matchmaker/rules",
      "@matchmaker/use-cases",
      "@matchmaker/delivery",
      "@matchmaker/adapters",
      "@matchmaker/main",
      "@matchmaker/documents",
      "@matchmaker/model-runtime-claude-code",
    ],
  },
};

/** Published subpaths beyond ".", and who may import them. */
export const RESTRICTED_SUBPATHS = { "@matchmaker/use-cases/wiring": ["@matchmaker/main"] };

/**
 * Areas inside a package (first folder under src/) and which other areas each may import.
 * Files directly under src/ (index.ts, wiring.ts) are the published surface and are exempt.
 */
export const AREAS = {
  "@matchmaker/model-runtime-claude-code": {
    headless: [],
    onboarding: ["headless"],
    discovery: ["headless"],
    matching: ["headless"],
    tailoring: ["headless"],
  },
  "@matchmaker/rules": {
    shared: [],
    profile: ["shared"],
    jobs: ["shared"],
    matching: ["shared", "profile", "jobs"],
    tailoring: ["shared", "profile", "jobs"],
    spending: ["shared"],
  },
  "@matchmaker/use-cases": {
    shared: [],
    onboarding: ["shared"],
    discovery: ["shared"],
    matching: ["shared"],
    results: ["shared"],
    tailoring: ["shared"],
    monitoring: ["shared"],
    profiles: ["shared"],
    spending: ["shared"],
    operations: ["shared"],
    // ADR 0011: measurement observes other areas' input ports (types only, see TYPE_ONLY_AREA_IMPORTS); nothing imports it.
    measurement: ["shared", "onboarding", "results", "tailoring", "profiles"],
  },
  "@matchmaker/delivery": { results: [], spending: [], "local-only": [], onboarding: [] },
  "@matchmaker/adapters": {
    "in-memory": [],
    system: [],
    work: [],
    narration: [],
    "model-runtime": [],
    "job-sources": [],
    metering: [],
    "data-controls": [],
  },
  // ADR 0017: one area today. A second area (for example rendering/ in Phase 4) is declared here and may not import reading/.
  "@matchmaker/documents": { reading: [] },
};

/**
 * Areas whose imports of other areas (except "shared") must be `import type` (ADR 0011): they may depend on
 * other areas' published contracts, never on their behavior.
 */
export const TYPE_ONLY_AREA_IMPORTS = { "@matchmaker/use-cases": ["measurement"] };
