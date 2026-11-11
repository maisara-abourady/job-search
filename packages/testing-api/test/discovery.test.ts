import assert from "node:assert/strict";
import { test } from "node:test";
import { MatchmakerTestingApi } from "@matchmaker/testing-api";

test("a source that is down never fails the run; duplicates merge; Tier 3 covers a failed Tier 4", async () => {
  const api = new MatchmakerTestingApi();
  await api.givenSignedUpUser("u1");
  await api.givenProfile("u1");
  api
    .sourceReturns("ats-a", 1, [{ title: "Platform Engineer" }, { title: "Data Engineer" }])
    .sourceReturns("board-b", 2, [{ title: "Platform Engineer" }]) // duplicate of ats-a's first
    .sourceFails("scrape-c", 4)
    .sourceReturns("aggregator-d", 3, [{ title: "Backend Engineer" }]);

  const run = await api.searchNow("u1");

  assert.deepEqual(run.failedSources, ["scrape-c"]);
  // Three unique jobs is "very few": the run widens to adjacent titles and fetches again (edge case table).
  assert.deepEqual(run.widenedTo, ["adjacent role"]);
  assert.equal(run.fetched, 8);
  assert.equal(run.duplicatesMerged, 5);
  assert.equal(run.sentToScoring, 3);
});

test("after the trial ends, an on-demand search is refused", async () => {
  const api = new MatchmakerTestingApi();
  await api.givenSignedUpUser("u1", "2026-11-01T09:00:00.000Z");
  await api.givenProfile("u1");
  api.atTime("2026-11-09T09:00:00.000Z"); // day 9

  assert.deepEqual(await api.access("u1"), { state: "paywalled" });
  await assert.rejects(api.searchNow("u1"), /trial ended/);
});
