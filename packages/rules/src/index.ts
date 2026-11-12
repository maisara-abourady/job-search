/**
 * @matchmaker/rules: the Critical Business Rules of job matchmaking (Entities circle).
 * Depends on nothing. Knows nothing of use cases, models, sources, storage or the web.
 */
export * from "./shared/vocabulary.ts";
export * from "./shared/not-yet-built.ts";

export * from "./profile/person.ts";
export * from "./profile/profile.ts";
export * from "./profile/scoring-profile.ts";
export * from "./profile/selling-points.ts";
export * from "./profile/resume-strength.ts";
export * from "./profile/preference-defaults.ts";

export * from "./jobs/job-posting.ts";
export * from "./jobs/duplicates.ts";

export * from "./matching/gates.ts";
export * from "./matching/judgments.ts";
export * from "./matching/scores.ts";
export * from "./matching/verdict.ts";

export * from "./tailoring/keyword-coverage.ts";
export * from "./tailoring/tailoring-guard.ts";

export * from "./spending/monthly-budget.ts";
