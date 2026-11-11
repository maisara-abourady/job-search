import assert from "node:assert/strict";
import { test } from "node:test";
import { MatchmakerTestingApi } from "@matchmaker/testing-api";

test("a source that is down never fails the run; duplicates merge; Tier 3 covers a failed Tier 4", async () => {
  const api = new MatchmakerTestingApi();
  const u1 = await api.givenPerson("Ana");
  await api.givenProfile(u1);
  api
    .sourceReturns("ats-a", 1, [{ title: "Platform Engineer" }, { title: "Data Engineer" }])
    .sourceReturns("board-b", 2, [{ title: "Platform Engineer" }]) // duplicate of ats-a's first
    .sourceFails("scrape-c", 4)
    .sourceReturns("aggregator-d", 3, [{ title: "Backend Engineer" }]);

  await api.switchSource("scrape-c", true, "read the board's terms; accept the risk");

  const run = await api.searchNow(u1);

  assert.deepEqual(run.failedSources, ["scrape-c"]);
  // Three unique jobs is "very few": the run widens to adjacent titles and fetches again (edge case table).
  assert.deepEqual(run.widenedTo, ["adjacent role"]);
  assert.equal(run.fetched, 8);
  assert.equal(run.duplicatesMerged, 5);
  assert.equal(run.sentToScoring, 3);
});

test("a Tier 4 board is off until the owner turns it on; Tier 3 covers it meanwhile", async () => {
  const api = new MatchmakerTestingApi();
  const u1 = await api.givenPerson("Ana");
  await api.givenProfile(u1);
  api
    .sourceReturns("ats-a", 1, [{ title: "Platform Engineer" }])
    .sourceReturns("scrape-linkedin", 4, [{ title: "Data Engineer" }])
    .sourceReturns("aggregator-d", 3, [{ title: "Backend Engineer" }]);

  await api.searchNow(u1);
  assert.equal(api.sourcesQueried().includes("scrape-linkedin"), false, "never scraped by default (Terms of service)");
  assert.equal(api.sourcesQueried().includes("aggregator-d"), true, "the aggregator carries the scraping for the owner");

  await api.switchSource("scrape-linkedin", true, "read the board's terms; accept the risk");
  await api.searchNow(u1);
  assert.equal(api.sourcesQueried().includes("scrape-linkedin"), true);
});
