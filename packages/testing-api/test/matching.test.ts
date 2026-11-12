import assert from "node:assert/strict";
import { test } from "node:test";
import { MatchmakerTestingApi } from "@matchmaker/testing-api";

// Business rules verified through the testing API: no web framework, no server, no database, no model.

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

test("a strong, evidenced match is Apply and shows first in the Apply tab", async () => {
  const api = new MatchmakerTestingApi();
  const u1 = await api.givenPerson("Ana");
  await api.givenProfile(u1);
  const job = await api.givenPosting();
  api.judgeWillSay(job.id, strongJudgment);

  await api.scorePostings(u1, [job.id]);

  const screen = await api.resultsScreen(u1);
  assert.equal(screen.tabs[0]?.countLabel, "1");
  assert.equal(screen.applyCards[0]?.verdictLabel, "Apply");
  assert.equal(api.feed.length, 1, "results stream as they are scored");
});

test("a Met judgment that cites no evidence counts as Missing, so the job is only Within reach", async () => {
  const api = new MatchmakerTestingApi();
  const u1 = await api.givenPerson("Ana");
  await api.givenProfile(u1);
  const job = await api.givenPosting();
  api.judgeWillSay(job.id, {
    ...strongJudgment,
    requirements: strongJudgment.requirements.map((r) => (r.requirementId === "r-cloud" ? { ...r, evidenceIds: ["not-in-profile"] } : r)),
  });

  await api.scorePostings(u1, [job.id]);

  const screen = await api.resultsScreen(u1);
  assert.equal(screen.applyCards.length, 0);
  assert.equal(screen.emptyApplyHeading !== null, true, "an empty Apply tab is never blank");
  assert.equal(screen.withinReachCards[0]?.verdictLabel, "Within reach");
  assert.match(screen.withinReachCards[0]?.distanceLine ?? "", /from Apply: confirm or build "Cloud infrastructure"/);
});

test("a failed authorization gate is Not a fit without asking the model", async () => {
  const api = new MatchmakerTestingApi();
  const u1 = await api.givenPerson("Ana");
  await api.givenProfile(u1);
  const job = await api.givenPosting({ country: "US", location: "New York" });

  await api.scorePostings(u1, [job.id]);

  assert.deepEqual(api.judgeCalls, []);
  const results = await api.results(u1);
  assert.equal(results.notAFitCount, 1);
});

test("the same profile version and posting revision are never judged twice", async () => {
  const api = new MatchmakerTestingApi();
  const u1 = await api.givenPerson("Ana");
  await api.givenProfile(u1);
  const job = await api.givenPosting();
  api.judgeWillSay(job.id, strongJudgment);

  await api.scorePostings(u1, [job.id]);
  const second = await api.scorePostings(u1, [job.id]);

  assert.equal(second.reused, 1);
  assert.equal(api.judgeCalls.length, 1);
});
