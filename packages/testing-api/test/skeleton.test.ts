import assert from "node:assert/strict";
import { test } from "node:test";
import { MatchmakerTestingApi } from "@matchmaker/testing-api";

// ADR 0008: the testing API is a Main configuration; background failures, switches and errors reach tests intact.

test("a background search that fails makes backgroundWorkSettled reject, naming the task", async () => {
  const api = new MatchmakerTestingApi();
  const ana = await api.givenPerson("Ana");
  await api.givenProfile(ana);
  api.searchPlannerFails("planner is down");

  await api.onboardingSearch(ana);

  await assert.rejects(api.backgroundWorkSettled(), (e: Error) => {
    assert.match(e.message, new RegExp(`search:${ana}`));
    assert.match(e.message, /planner is down/);
    return true;
  });
  assert.deepEqual(api.searchesRequested(), [{ personId: ana, trigger: "onboarding" }]);
  await api.backgroundWorkSettled(); // a failure is reported once
});

test("an onboarding search goes through Main's request port and the background queue", async () => {
  const api = new MatchmakerTestingApi();
  const ana = await api.givenPerson("Ana");
  await api.givenProfile(ana);
  api.sourceReturns("board-a", 1, [{ title: "Platform Engineer" }]);

  await api.onboardingSearch(ana);
  await api.backgroundWorkSettled();

  assert.equal(api.lastSearchRun()?.trigger, "onboarding");
  assert.deepEqual(api.searchesRequested(), [{ personId: ana, trigger: "onboarding" }]);
});

test("a source switched off is not asked and not listed as failed", async () => {
  const api = new MatchmakerTestingApi();
  const ana = await api.givenPerson("Ana");
  await api.givenProfile(ana);
  api.sourceReturns("board-a", 1, [{ title: "Platform Engineer" }]);
  api.sourceFails("board-b", 1);

  await api.switchSource("board-b", false);
  await api.searchNow(ana);

  assert.equal(api.sourcesQueried().includes("board-b"), false);
  assert.equal(api.lastSearchRun()?.failedSources.includes("board-b"), false);
});

test("use-case error codes reach the test unchanged", async () => {
  const api = new MatchmakerTestingApi();
  const ana = await api.givenPerson("Ana");
  await api.givenProfile(ana);
  for (let i = 0; i < 3; i++) await api.searchNow(ana);
  await assert.rejects(api.searchNow(ana), { code: "daily-cap-reached" });

  const ben = await api.givenPerson("Ben");
  await api.givenProfile(ben);
  await api.setMonthlyBudget(1_000_000);
  api.sourceReturns("aggregator-a", 3, [{ title: "Engineer" }], 1_000_000);
  await api.searchNow(ben);
  await assert.rejects(api.searchNow(ben), { code: "monthly-budget-reached" });
});
