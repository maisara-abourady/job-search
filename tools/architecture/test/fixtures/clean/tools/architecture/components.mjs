// A minimal architecture map for the checker's own tests: four circles, areas in use-cases and adapters.
export const COMPONENTS = {
  "@matchmaker/rules": { dir: "packages/rules", circle: "1 entities", allowed: [], platform: false },
  "@matchmaker/use-cases": { dir: "packages/use-cases", circle: "2 use cases", allowed: ["@matchmaker/rules"], platform: false },
  "@matchmaker/adapters": {
    dir: "packages/adapters",
    circle: "3-4 adapters",
    allowed: ["@matchmaker/rules", "@matchmaker/use-cases"],
    platform: true,
  },
  "@matchmaker/main": {
    dir: "apps/main",
    circle: "4 main",
    platform: true,
    allowed: ["@matchmaker/rules", "@matchmaker/use-cases", "@matchmaker/adapters"],
  },
};
export const RESTRICTED_SUBPATHS = { "@matchmaker/use-cases/wiring": ["@matchmaker/main"] };
export const AREAS = {
  "@matchmaker/use-cases": { shared: [], alpha: ["shared"], beta: ["shared"] },
  "@matchmaker/adapters": { storage: [], clock: [] },
};
export const TYPE_ONLY_AREA_IMPORTS = {};
