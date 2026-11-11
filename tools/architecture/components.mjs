/**
 * The architecture as data. The check script enforces it; docs/architecture/README.md explains it.
 * Changing this file is an architectural decision: it needs an ADR.
 */
export const COMPONENTS = {
  "@matchmaker/rules": { dir: "packages/rules", circle: "1 entities", allowed: [], platform: false },
  "@matchmaker/use-cases": { dir: "packages/use-cases", circle: "2 use cases", allowed: ["@matchmaker/rules"], platform: false },
  "@matchmaker/delivery": { dir: "packages/delivery", circle: "3 adapters", allowed: ["@matchmaker/use-cases"], platform: false },
  "@matchmaker/adapters": { dir: "packages/adapters", circle: "3-4 adapters", allowed: ["@matchmaker/rules", "@matchmaker/use-cases"], platform: true },
  "@matchmaker/scraping-sources": { dir: "packages/scraping-sources", circle: "3-4 adapters", allowed: ["@matchmaker/rules", "@matchmaker/use-cases"], platform: true },
  "@matchmaker/main": {
    dir: "apps/main", circle: "4 main", platform: true,
    allowed: ["@matchmaker/rules", "@matchmaker/use-cases", "@matchmaker/delivery", "@matchmaker/adapters", "@matchmaker/scraping-sources"],
  },
  "@matchmaker/testing-api": {
    dir: "packages/testing-api", circle: "tests", platform: true,
    allowed: ["@matchmaker/rules", "@matchmaker/use-cases", "@matchmaker/delivery", "@matchmaker/adapters", "@matchmaker/main"],
  },
};

/** Published subpaths beyond ".", and who may import them. */
export const RESTRICTED_SUBPATHS = { "@matchmaker/use-cases/wiring": ["@matchmaker/main"] };

/**
 * Areas inside a package (first folder under src/) and which other areas each may import.
 * Files directly under src/ (index.ts, wiring.ts) are the published surface and are exempt.
 */
export const AREAS = {
  "@matchmaker/rules": {
    shared: [], profile: ["shared"], jobs: ["shared"], matching: ["shared", "profile", "jobs"],
    tailoring: ["shared", "profile", "jobs"], access: ["shared"],
  },
  "@matchmaker/use-cases": {
    shared: [], onboarding: ["shared"], discovery: ["shared"], matching: ["shared"], results: ["shared"],
    tailoring: ["shared"], monitoring: ["shared"], account: ["shared"], operations: ["shared"],
  },
  "@matchmaker/delivery": { results: [], access: [] },
  "@matchmaker/adapters": { "in-memory": [], system: [], work: [], narration: [], "model-runtime": [], "job-sources": [] },
};
