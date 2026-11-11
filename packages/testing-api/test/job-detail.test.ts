import assert from "node:assert/strict";
import { test } from "node:test";
import { MatchmakerTestingApi } from "@matchmaker/testing-api";

// ADR 0012: job detail shows evidence text, resolved from the profile version the match was judged against.

const judgment = {
  requirements: [
    { requirementId: "r-sql", judgment: "met" as const, evidenceIds: ["ev-sql"], closableByUser: true },
    { requirementId: "r-ts", judgment: "met" as const, evidenceIds: ["ev-ts"], closableByUser: true },
    { requirementId: "r-lead", judgment: "met" as const, evidenceIds: ["ev-lead"], closableByUser: true },
    { requirementId: "r-cloud", judgment: "missing" as const, evidenceIds: [], closableByUser: false },
    { requirementId: "r-go", judgment: "partial" as const, evidenceIds: ["ev-ts"], closableByUser: true },
  ],
  experienceRelevance: 0.9, skillsAndTools: 0.9, scopeAlignment: 0.8,
};

test("job detail links each point to capitalize and each judged requirement to its evidence text", async () => {
  const api = new MatchmakerTestingApi();
  await api.givenSignedUpUser("u1");
  await api.givenProfile("u1");
  const job = await api.givenPosting();
  api.judgeWillSay(job.id, judgment);
  await api.scorePostings("u1", [job.id]);

  const detail = await api.jobDetail("u1", job.id);

  assert.deepEqual(detail.pointsToCapitalize[0], { point: "SQL", evidenceText: "Built SQL reporting for 40 stores" });
  assert.deepEqual(detail.gaps, [{ requirement: "Cloud infrastructure", closable: false }, { requirement: "Go", closable: true }]);
  const lead = detail.breakdown.requirementTable.find((r) => r.requirement === "Team leadership");
  assert.equal(lead?.evidenceText, "Managed a team of 6");
  assert.equal(detail.breakdown.requirementTable.find((r) => r.requirement === "Cloud infrastructure")?.evidenceText, null);
});

test("after Fix a fact, detail shows the corrected text only once the job is re-scored on the new version", async () => {
  const api = new MatchmakerTestingApi();
  await api.givenSignedUpUser("u1");
  const v1 = await api.givenProfile("u1");
  const job = await api.givenPosting();
  api.judgeWillSay(job.id, judgment);
  await api.scorePostings("u1", [job.id]);

  await api.givenProfile("u1", { evidence: v1.evidence.map((e) => (e.id === "ev-sql" ? { ...e, text: "Built SQL reporting for 45 stores" } : e)) });
  await assert.rejects(api.jobDetail("u1", job.id), /no result/, "results read only the active version's matches");
  await api.scorePostings("u1", [job.id]);

  assert.equal((await api.jobDetail("u1", job.id)).pointsToCapitalize[0]?.evidenceText, "Built SQL reporting for 45 stores");
});
