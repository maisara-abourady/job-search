import assert from "node:assert/strict";
import { test } from "node:test";
import { MatchmakerTestingApi } from "@matchmaker/testing-api";

// ADR 0010: spend is reported by the details that spend it and charged by the use case that caused it.

test("a search run's cost is the aggregator and model spend it caused, all of it charged to the profile", async () => {
  const api = new MatchmakerTestingApi();
  const u1 = await api.givenPerson("Ana");
  await api.givenProfile(u1);
  api.sourceReturns("aggregator-a", 3, [{ title: "Platform Engineer" }], 1_000).judgeCosts(500);

  const run = await api.searchNow(u1);

  // One unique job is "very few", so the run widens and calls the paid source twice; the one job is judged once.
  assert.deepEqual(run.widenedTo, ["adjacent role"]);
  assert.equal(run.costMicros, 2 * 1_000 + 500);
  assert.equal(api.lastSearchRun()?.costMicros, 2_500, "the SearchRun record logs its cost");
  assert.equal(await api.spentBy(u1), 2_500, "feeds spend per profile (AB-3)");
  assert.equal(api.unattributedSpendMicros(), 0, "no spend escapes attribution");
});

test("re-scoring outside a search is charged to the profile but to no run", async () => {
  const api = new MatchmakerTestingApi();
  const u1 = await api.givenPerson("Ana");
  await api.givenProfile(u1);
  const job = await api.givenPosting();
  api.judgeCosts(700);

  await api.scorePostings(u1, [job.id]);

  assert.equal(await api.spentBy(u1), 700);
  assert.equal(api.unattributedSpendMicros(), 0);
});

test("two profiles searching at the same time are each charged only their own spend", async () => {
  const api = new MatchmakerTestingApi();
  const u1 = await api.givenPerson("Ana");
  const u2 = await api.givenPerson("Ben");
  for (const u of [u1, u2]) await api.givenProfile(u);
  api.sourceReturns("aggregator-a", 3, [{ title: "Platform Engineer" }], 1_000);

  const [a, b] = await Promise.all([api.searchNow(u1), api.searchNow(u2)]);

  assert.equal(a.costMicros, 2_000);
  assert.equal(b.costMicros, 2_000);
  assert.equal(await api.spentBy(u1), 2_000);
  assert.equal(await api.spentBy(u2), 2_000);
});
