import assert from "node:assert/strict";
import { test } from "node:test";
import { MatchmakerTestingApi } from "@matchmaker/testing-api";

// ADR 0015: per-profile daily caps and one optional monthly budget bound the owner's running cost (AB-3).

test("a profile gets three on-demand searches a day; the next day it gets three more", async () => {
  const api = new MatchmakerTestingApi();
  const ana = await api.givenPerson("Ana");
  const ben = await api.givenPerson("Ben");
  await api.givenProfile(ana);
  await api.givenProfile(ben);

  for (let i = 0; i < 3; i++) await api.searchNow(ana);
  await assert.rejects(api.searchNow(ana), { code: "daily-cap-reached" });
  await api.searchNow(ben); // caps are per profile

  api.atTime("2026-11-12T09:00:00.000Z");
  await api.searchNow(ana);
});

test("when the monthly budget is spent, on-demand searches ask first and monitoring pauses until next month", async () => {
  const api = new MatchmakerTestingApi();
  const ana = await api.givenPerson("Ana");
  await api.givenProfile(ana);
  await api.setMonthlyBudget(2_000_000);
  api.sourceReturns("aggregator-a", 3, [{ title: "Platform Engineer" }], 1_000_000);

  await api.searchNow(ana); // widens, so two paid calls: $2.00 spent

  await assert.rejects(api.searchNow(ana), { code: "monthly-budget-reached" });
  await api.searchNow(ana, { overBudgetConfirmed: true });

  api.atTime("2026-11-12T09:00:00.000Z");
  assert.deepEqual(await api.appStarts(), { requested: 0, pausedByBudget: true });
  const screen = await api.runningCostScreen();
  assert.equal(screen.budgetReached, true);
  assert.equal(screen.totalLine, "Total: $4.00");
  assert.equal(screen.budgetLine, "Monthly budget: $2.00");
  assert.match(screen.pausedNotice ?? "", /monitoring is paused/);

  api.atTime("2026-12-01T09:00:00.000Z");
  await api.openProfile(ana);
  assert.deepEqual(await api.appStarts(), { requested: 1, pausedByBudget: false }, "a new month lifts the pause");
});

test("the running-cost panel shows spend per profile for the month", async () => {
  const api = new MatchmakerTestingApi();
  const ana = await api.givenPerson("Ana");
  const ben = await api.givenPerson("Ben");
  await api.givenProfile(ana);
  await api.givenProfile(ben);
  api.judgeCosts(1_250_000);
  const job = await api.givenPosting();
  await api.scorePostings(ana, [job.id]);
  api.atTime("2026-12-02T09:00:00.000Z");
  await api.scorePostings(ben, [job.id]);

  const november = await api.runningCost("2026-11-15T00:00:00.000Z");
  assert.deepEqual(november.perPerson.map((p) => [p.displayName, p.spentMicros]), [["Ana", 1_250_000], ["Ben", 0]]);
  assert.equal(november.budget, "no-budget");
  const screen = await api.runningCostScreen();
  assert.equal(screen.monthLabel, "December 2026");
  assert.deepEqual(screen.rows, [{ name: "Ana", amount: "$0.00" }, { name: "Ben", amount: "$1.25" }]);
  await assert.rejects(api.setMonthlyBudget(0), { code: "invalid-input" });
});
