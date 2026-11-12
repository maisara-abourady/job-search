import assert from "node:assert/strict";
import { test } from "node:test";
import { MatchmakerTestingApi } from "@matchmaker/testing-api";

// ADR 0011: product events are emitted at the input ports, with no analytics vendor anywhere in the use cases.

const strongJudgment = {
  requirements: [
    { requirementId: "r-sql", judgment: "met" as const, evidenceIds: ["ev-sql"], closableByUser: true },
    { requirementId: "r-ts", judgment: "met" as const, evidenceIds: ["ev-ts"], closableByUser: true },
    { requirementId: "r-lead", judgment: "met" as const, evidenceIds: ["ev-lead"], closableByUser: true },
    { requirementId: "r-cloud", judgment: "met" as const, evidenceIds: ["ev-ts"], closableByUser: true },
    { requirementId: "r-go", judgment: "partial" as const, evidenceIds: ["ev-ts"], closableByUser: true },
  ],
  experienceRelevance: 0.9,
  skillsAndTools: 0.9,
  scopeAlignment: 0.8,
};

test("time to first strong match is measurable: profile created, then the first results screen with an Apply verdict", async () => {
  const api = new MatchmakerTestingApi();
  const u1 = await api.givenPerson("Ana", "2026-11-11T09:00:00.000Z");
  await api.givenProfile(u1);
  const job = await api.givenPosting();
  api.judgeWillSay(job.id, strongJudgment);

  api.atTime("2026-11-11T09:03:00.000Z");
  await api.results(u1); // nothing scored yet: no Apply shown
  await api.scorePostings(u1, [job.id]);
  api.atTime("2026-11-11T09:07:00.000Z");
  await api.results(u1);

  const events = api.productEvents(u1);
  const created = events.find((e) => e.name === "profile-created");
  const firstApply = events.find((e) => e.name === "apply-verdict-shown");
  assert.equal(created?.at, "2026-11-11T09:00:00.000Z");
  assert.equal(firstApply?.at, "2026-11-11T09:07:00.000Z");
  const minutes = (Date.parse(firstApply!.at) - Date.parse(created!.at)) / 60_000;
  assert.equal(minutes, 7);
});

test("marking a job applied is a product event; dismissing is not", async () => {
  const api = new MatchmakerTestingApi();
  const u1 = await api.givenPerson("Ana");
  await api.givenProfile(u1);
  const job = await api.givenPosting();
  await api.scorePostings(u1, [job.id]);

  await api.markApplied(u1, job.id);

  assert.deepEqual(
    api.productEvents(u1).map((e) => e.name),
    ["profile-created", "job-marked-applied"],
  );
});
