import { postingIdentityKey, type JobPosting, type MatchJudgments, type ProfileVersion, type Verdict } from "@matchmaker/rules";
import type { CaseResult, Evaluation } from "../evaluation.ts";
import { inMemoryDetails } from "../in-memory-details.ts";

/**
 * The harness's own check: three scoring cases with a scripted judge, so the runner, reports and threshold are
 * exercised without keys or spend. `--break=<caseId>` expects the wrong verdict for that case (to see a failure).
 */
const profile: ProfileVersion = {
  personId: "sample-person", profileId: "sample-profile", version: 1, roles: [], skills: [], credentials: [], languages: ["en"],
  evidence: [
    { id: "ev-sql", source: "resume-line", text: "Built SQL reporting for 40 stores" },
    { id: "ev-ts", source: "resume-line", text: "Led a TypeScript migration of 200k lines" },
    { id: "ev-lead", source: "interview-answer", text: "Managed a team of 6" },
  ],
  inferredSeniority: "senior",
  preferences: {
    locations: ["Berlin"], workModes: ["hybrid", "remote"], authorizedCountries: ["DE"], acceptsSponsorship: false,
    targetSeniority: ["senior", "lead-or-staff"], salaryFloor: null,
  },
  personal: { name: "Sample Person", photoRef: null, age: null, gender: null, nationality: null, maritalStatus: null },
};

const posting = (id: string, o: Partial<JobPosting> = {}): JobPosting => ({
  id, revision: 1, employer: "Acme", title: "Senior Engineer", location: "Berlin", country: "DE", workMode: "hybrid",
  seniority: "senior", seniorityText: "Senior", salary: null, description: "Build things.", language: "en",
  postedAt: "2026-11-10T00:00:00.000Z", status: "open",
  sources: [{ sourceName: "greenhouse", tier: 1, url: `https://boards.greenhouse.io/acme/${id}`, fetchedAt: "2026-11-10T00:00:00.000Z" }],
  requirements: [
    { id: "r-sql", text: "SQL", kind: "must-have", keywords: ["SQL"] },
    { id: "r-ts", text: "TypeScript", kind: "must-have", keywords: ["TypeScript"] },
    { id: "r-lead", text: "Team leadership", kind: "must-have", keywords: ["leadership"] },
    { id: "r-cloud", text: "Cloud infrastructure", kind: "must-have", keywords: ["AWS"] },
  ],
  authorization: { kind: "authorization-required", postingText: "Must be authorized to work in Germany" },
  completeness: { responsibilities: true, requirements: true, location: true, employerName: true },
  legitimacy: { identifiableEmployer: true, asksForPayment: false, matchesScamPattern: false },
  ...o,
});

const met = (requirementId: string, evidenceId: string) => ({ requirementId, judgment: "met" as const, evidenceIds: [evidenceId], closableByUser: true });
const strong: MatchJudgments = {
  requirements: [met("r-sql", "ev-sql"), met("r-ts", "ev-ts"), met("r-lead", "ev-lead"), met("r-cloud", "ev-ts")],
  experienceRelevance: 0.9, skillsAndTools: 0.9, scopeAlignment: 0.8,
};
const cases: readonly { id: string; posting: JobPosting; judgment: MatchJudgments; expected: Verdict }[] = [
  { id: "strong-evidenced-match", posting: posting("job-strong"), judgment: strong, expected: "apply" },
  {
    id: "uncited-requirement", posting: posting("job-uncited"), expected: "stretch",
    judgment: { ...strong, requirements: strong.requirements.map((r) => (r.requirementId === "r-cloud" ? { ...r, evidenceIds: ["not-in-profile"] } : r)) },
  },
  { id: "authorization-gate", posting: posting("job-us", { country: "US", location: "New York" }), judgment: strong, expected: "not-a-fit" },
];
const OTHER: Record<Verdict, Verdict> = { apply: "not-a-fit", stretch: "apply", "not-a-fit": "apply" };

const sample: Evaluation = {
  name: "sample",
  description: "Harness self-check: scripted judge, three scoring cases, every case must pass",
  configure(options) {
    const judgments = new Map(cases.map((c) => [c.posting.id, c.judgment]));
    const { details, store } = inMemoryDetails({
      judge: { judge: async (_p, job) => judgments.get(job.id) ?? strong },
    });
    return {
      details,
      async run(app) {
        await store.add({ personId: profile.personId, displayName: "Sample", createdAt: "2026-11-11T09:00:00.000Z" });
        await store.saveNewVersion(profile, []);
        for (const c of cases) await store.save(c.posting, postingIdentityKey(c.posting));
        await app.useCases.scoreJobs.execute({ personId: profile.personId, runId: null, postingIds: cases.map((c) => c.posting.id), cutAtPrefilter: [] });
        const rows = await store.currentResults(profile.personId);
        return cases.map((c): CaseResult => {
          const expected = options["break"] === c.id ? OTHER[c.expected] : c.expected;
          const actual = rows.find((r) => r.postingId === c.posting.id)?.assessment.verdict ?? "missing";
          return { id: c.id, passed: actual === expected, detail: `expected ${expected}, got ${actual}` };
        });
      },
    };
  },
  threshold(results) {
    const passed = results.filter((r) => r.passed).length;
    return { passed: passed === results.length, summary: `${passed}/${results.length} cases passed (threshold: all)` };
  },
};
export default sample;
