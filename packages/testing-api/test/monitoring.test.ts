import assert from "node:assert/strict";
import { test } from "node:test";
import { MatchmakerTestingApi } from "@matchmaker/testing-api";

// ADR 0016: monitoring runs only while the app runs; a run missed while it was off happens at the next start.

test("at start, a profile whose 12 hours passed while the app was off gets one catch-up search", async () => {
  const api = new MatchmakerTestingApi();
  const ana = await api.givenPerson("Ana");
  await api.givenProfile(ana);
  assert.deepEqual(await api.appStarts(), { requested: 0, pausedByBudget: false }, "monitoring starts after the first search");
  await api.searchNow(ana);

  api.atTime("2026-11-11T15:00:00.000Z");
  assert.equal((await api.appStarts()).requested, 0, "not due after 6 hours");

  api.atTime("2026-11-13T22:00:00.000Z"); // off for more than two days
  assert.equal((await api.appStarts()).requested, 1, "one catch-up search, not one per missed interval");
  assert.equal(api.lastSearchRun()?.trigger, "scheduled");
  assert.equal((await api.appStarts()).requested, 0);
});

test("a profile the owner has not opened for 14 days is not searched until it is opened again", async () => {
  const api = new MatchmakerTestingApi();
  const ana = await api.givenPerson("Ana");
  await api.givenProfile(ana);
  await api.searchNow(ana);

  api.atTime("2026-11-26T10:00:00.000Z");
  assert.equal((await api.appStarts()).requested, 0);
  await api.openProfile(ana);
  assert.equal((await api.appStarts()).requested, 1);
});
