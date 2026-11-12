/**
 * Storage contract suites (X-6): one suite per gateway the use cases own, run against every implementation so the
 * in-memory fakes and the local database (D2) cannot drift apart. Each suite takes a name and a factory; Phase 3
 * calls the same functions with the local database adapter.
 *
 * Suites assert only through the port. Exports are opaque bytes (the format is the adapter's), so vault suites
 * look for distinctive markers in them, never for a particular shape.
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { profileVersionKey, type MatchAssessment, type ProfileVersion, type Verdict } from "@matchmaker/rules";
import type {
  MatchRecords, MonitoringRoster, MonthlyBudgetControl, People, PersonDataVault, PostingCatalog, PostingsForScoring, ProfileVersions,
  ResultsReadModel, SearchRunRecord, SearchRuns, SourceSwitchControl, SpendLedger, SpendRecord, StoredMatch, UsageLedger,
} from "@matchmaker/use-cases";
import { aJobPosting, aProfile } from "../src/builders.ts";

type Factory<T> = () => T | Promise<T>;

// ---------- builders for stored records ----------
export function anAssessment(verdict: Verdict): MatchAssessment {
  return { gates: null, fit: null, confidence: null, quality: null, judgments: [], verdict, primaryReason: null, priority: 0, pointsToApply: null, lever: null };
}
export function aStoredMatch(o: Partial<StoredMatch> & Pick<StoredMatch, "personId" | "profileVersionKey" | "postingId">): StoredMatch {
  return {
    postingRevision: 1, assessment: anAssessment("apply"), narration: { reason: "Strong fit", pointsToCapitalize: [] },
    verdictChangedFrom: null, userState: "new", scoredAt: "2026-11-11T09:00:00.000Z", ...o,
  };
}
export function aSearchRun(o: Partial<SearchRunRecord> & Pick<SearchRunRecord, "runId" | "personId">): SearchRunRecord {
  return {
    trigger: "manual", startedAt: "2026-11-11T09:00:00.000Z", finishedAt: "2026-11-11T09:01:00.000Z", fetched: 0, duplicatesMerged: 0,
    expiredDropped: 0, failedSources: [], widenedTo: [], costMicros: 0, ...o,
  };
}
export function aSpendRecord(o: Partial<SpendRecord>): SpendRecord {
  return { personId: null, runId: null, purpose: "search", category: "model", provider: "test-model", amountMicros: 1_000, at: "2026-11-11T09:00:00.000Z", ...o };
}
const versionOf = (personId: string, version: number, evidenceText = `evidence of ${personId} v${version}`): ProfileVersion =>
  aProfile({ personId, version, evidence: [{ id: "ev-1", source: "resume-line", text: evidenceText }] });

// ---------- PostingCatalog + PostingsForScoring ----------
export function postingCatalogContract(name: string, make: Factory<PostingCatalog & PostingsForScoring>): void {
  describe(`${name}: PostingCatalog and PostingsForScoring`, () => {
    test("save then find round-trips every JobPosting field", async () => {
      const store = await make();
      const posting = aJobPosting({ id: "job-1", revision: 3, workMode: "remote" });
      await store.save(posting, "acme|senior engineer|berlin");
      assert.deepEqual(await store.findByIdentityKey("acme|senior engineer|berlin"), posting);
      assert.deepEqual(await store.postingsByIds(["job-1"]), [posting]);
    });
    test("an unknown identity key finds nothing", async () => {
      const store = await make();
      assert.equal(await store.findByIdentityKey("nobody|nothing|nowhere"), null);
    });
    test("postingsByIds skips unknown ids", async () => {
      const store = await make();
      await store.save(aJobPosting({ id: "job-1" }), "k1");
      assert.deepEqual((await store.postingsByIds(["job-x", "job-1"])).map((p) => p.id), ["job-1"]);
    });
    test("markClosed removes a posting from openPostings", async () => {
      const store = await make();
      await store.save(aJobPosting({ id: "job-1" }), "k1");
      await store.save(aJobPosting({ id: "job-2" }), "k2");
      await store.markClosed("job-1");
      assert.deepEqual((await store.openPostings()).map((p) => p.id), ["job-2"]);
    });
  });
}

// ---------- ProfileVersions ----------
export function profileVersionsContract(name: string, make: Factory<ProfileVersions & PersonDataVault>): void {
  describe(`${name}: ProfileVersions`, () => {
    test("no profile reads null", async () => {
      assert.equal(await (await make()).active("p-1"), null);
    });
    test("saveNewVersion makes the newest version active and keeps earlier ones", async () => {
      const store = await make();
      await store.saveNewVersion(versionOf("p-1", 1, "first-version-marker"), []);
      await store.saveNewVersion(versionOf("p-1", 2, "second-version-marker"), [{ statement: "Led migrations", tier: "strong", evidenceId: "ev-1" }]);
      assert.equal((await store.active("p-1"))?.version, 2);
      assert.equal((await store.sellingPoints("p-1")).length, 1);
      const exported = new TextDecoder().decode(await store.exportAll("p-1"));
      assert.match(exported, /first-version-marker/, "the earlier version is kept");
      assert.match(exported, /second-version-marker/);
    });
    test("versions are kept per person", async () => {
      const store = await make();
      await store.saveNewVersion(versionOf("p-1", 1), []);
      await store.saveNewVersion(versionOf("p-2", 4), []);
      assert.equal((await store.active("p-1"))?.version, 1);
      assert.equal((await store.active("p-2"))?.version, 4);
    });
  });
}

// ---------- MatchRecords ----------
export function matchRecordsContract(name: string, make: Factory<MatchRecords>): void {
  describe(`${name}: MatchRecords`, () => {
    test("findMatch distinguishes profile version and posting revision", async () => {
      const store = await make();
      const v1 = profileVersionKey({ profileId: "profile-p-1", version: 1 });
      const v2 = profileVersionKey({ profileId: "profile-p-1", version: 2 });
      await store.saveMatch(aStoredMatch({ personId: "p-1", profileVersionKey: v1, postingId: "job-1", postingRevision: 1 }));
      assert.ok(await store.findMatch(v1, "job-1", 1));
      assert.equal(await store.findMatch(v2, "job-1", 1), null, "another profile version");
      assert.equal(await store.findMatch(v1, "job-1", 2), null, "another posting revision");
      assert.equal(await store.findMatch(v1, "job-2", 1), null, "another posting");
    });
    test("saveMatch then findMatch round-trips the match", async () => {
      const store = await make();
      const match = aStoredMatch({ personId: "p-1", profileVersionKey: "profile-p-1@1", postingId: "job-1", verdictChangedFrom: "stretch", userState: "applied" });
      await store.saveMatch(match);
      assert.deepEqual(await store.findMatch("profile-p-1@1", "job-1", 1), match);
    });
    test("latestVerdictBefore ignores matches under the given profile version", async () => {
      const store = await make();
      await store.saveMatch(aStoredMatch({ personId: "p-1", profileVersionKey: "profile-p-1@1", postingId: "job-1", assessment: anAssessment("stretch") }));
      await store.saveMatch(aStoredMatch({ personId: "p-1", profileVersionKey: "profile-p-1@2", postingId: "job-1", assessment: anAssessment("apply") }));
      assert.equal(await store.latestVerdictBefore("p-1", "job-1", "profile-p-1@2"), "stretch");
      assert.equal(await store.latestVerdictBefore("p-1", "job-1", "profile-p-1@1"), "apply");
      assert.equal(await store.latestVerdictBefore("p-1", "job-2", "profile-p-1@2"), null);
      assert.equal(await store.latestVerdictBefore("p-2", "job-1", "profile-p-2@1"), null, "another person's matches do not count");
    });
    test("postingIdsScoredFor lists each scored posting once, for that person only", async () => {
      const store = await make();
      await store.saveMatch(aStoredMatch({ personId: "p-1", profileVersionKey: "profile-p-1@1", postingId: "job-1" }));
      await store.saveMatch(aStoredMatch({ personId: "p-1", profileVersionKey: "profile-p-1@2", postingId: "job-1" }));
      await store.saveMatch(aStoredMatch({ personId: "p-2", profileVersionKey: "profile-p-2@1", postingId: "job-2" }));
      assert.deepEqual([...(await store.postingIdsScoredFor("p-1"))].sort(), ["job-1"]);
    });
  });
}

// ---------- ResultsReadModel (needs profiles, postings and matches written through their own gateways) ----------
type ResultsStore = ResultsReadModel & ProfileVersions & PostingCatalog & MatchRecords;
export function resultsReadModelContract(name: string, make: Factory<ResultsStore>): void {
  async function twoVersionsWithMatches(store: ResultsStore) {
    const v1 = versionOf("p-1", 1, "Built SQL reporting (v1 wording)");
    const v2 = versionOf("p-1", 2, "Built SQL reporting for 40 stores (v2 wording)");
    await store.save(aJobPosting({ id: "job-1", title: "Data Engineer" }), "k1");
    await store.save(aJobPosting({ id: "job-2", title: "Platform Engineer" }), "k2");
    await store.saveNewVersion(v1, []);
    await store.saveMatch(aStoredMatch({ personId: "p-1", profileVersionKey: profileVersionKey(v1), postingId: "job-1" }));
    await store.saveNewVersion(v2, []);
    await store.saveMatch(aStoredMatch({ personId: "p-1", profileVersionKey: profileVersionKey(v2), postingId: "job-2" }));
  }
  describe(`${name}: ResultsReadModel`, () => {
    test("currentResults returns only matches for the active profile version", async () => {
      const store = await make();
      await twoVersionsWithMatches(store);
      assert.deepEqual((await store.currentResults("p-1")).map((r) => r.postingId), ["job-2"]);
      assert.deepEqual(await store.currentResults("p-2"), []);
    });
    test("a result row carries the posting's and the match's fields", async () => {
      const store = await make();
      await twoVersionsWithMatches(store);
      const [row] = await store.currentResults("p-1");
      assert.equal(row?.title, "Platform Engineer");
      assert.equal(row?.employer, "Acme");
      assert.equal(row?.assessment.verdict, "apply");
      assert.equal(row?.reason, "Strong fit");
      assert.equal(row?.userState, "new");
      assert.equal(row?.postingOpen, true);
    });
    test("jobDetail returns the evidence of the match's own profile version (ADR 0012)", async () => {
      const store = await make();
      await twoVersionsWithMatches(store);
      const detail = await store.jobDetail("p-1", "job-2");
      assert.deepEqual(detail?.evidence, [{ id: "ev-1", text: "Built SQL reporting for 40 stores (v2 wording)" }]);
    });
    test("jobDetail is null without a match under the active version", async () => {
      const store = await make();
      await twoVersionsWithMatches(store);
      assert.equal(await store.jobDetail("p-1", "job-1"), null, "job-1 was matched only under version 1");
      assert.equal(await store.jobDetail("p-1", "job-9"), null);
      assert.equal(await store.jobDetail("p-2", "job-2"), null);
    });
    test("setUserState changes only that person's result for that posting", async () => {
      const store = await make();
      await twoVersionsWithMatches(store);
      await store.setUserState("p-1", "job-2", "applied");
      assert.equal((await store.currentResults("p-1"))[0]?.userState, "applied");
    });
  });
}

// ---------- People ----------
export function peopleContract(name: string, make: Factory<People>): void {
  const ana = { personId: "p-1", displayName: "Ana", createdAt: "2026-11-11T09:00:00.000Z" };
  describe(`${name}: People`, () => {
    test("add then personOf round-trips", async () => {
      const people = await make();
      await people.add(ana);
      assert.deepEqual(await people.personOf("p-1"), ana);
      assert.equal(await people.exists("p-1"), true);
    });
    test("an unknown person does not exist", async () => {
      const people = await make();
      assert.equal(await people.exists("p-x"), false);
      assert.equal(await people.personOf("p-x"), null);
    });
    test("all lists every person", async () => {
      const people = await make();
      await people.add(ana);
      await people.add({ personId: "p-2", displayName: "Ben", createdAt: "2026-11-11T10:00:00.000Z" });
      assert.deepEqual((await people.all()).map((p) => p.displayName).sort(), ["Ana", "Ben"]);
    });
    test("rename changes only the name", async () => {
      const people = await make();
      await people.add(ana);
      await people.rename("p-1", "Ana Maria");
      assert.deepEqual(await people.personOf("p-1"), { ...ana, displayName: "Ana Maria" });
    });
  });
}

// ---------- MonitoringRoster (with People and SearchRuns, through which its state is written) ----------
export function monitoringRosterContract(name: string, make: Factory<MonitoringRoster & People & SearchRuns>): void {
  describe(`${name}: MonitoringRoster and People.recordOpened`, () => {
    test("a person is listed only after their first search has run", async () => {
      const store = await make();
      await store.add({ personId: "p-1", displayName: "Ana", createdAt: "2026-11-11T08:00:00.000Z" });
      assert.deepEqual(await store.peopleWithMonitoringOn(), []);
      await store.record(aSearchRun({ runId: "run-1", personId: "p-1", startedAt: "2026-11-11T09:00:00.000Z" }));
      assert.deepEqual(await store.peopleWithMonitoringOn(), [
        { personId: "p-1", lastSearchAt: "2026-11-11T09:00:00.000Z", lastOpenedAt: "2026-11-11T08:00:00.000Z" },
      ]);
    });
    test("the roster carries the last search and the last opened time (recordOpened updates it)", async () => {
      const store = await make();
      await store.add({ personId: "p-1", displayName: "Ana", createdAt: "2026-11-11T08:00:00.000Z" });
      await store.record(aSearchRun({ runId: "run-1", personId: "p-1", startedAt: "2026-11-11T09:00:00.000Z" }));
      await store.record(aSearchRun({ runId: "run-2", personId: "p-1", startedAt: "2026-11-11T21:00:00.000Z" }));
      await store.recordOpened("p-1", "2026-11-12T07:30:00.000Z");
      assert.deepEqual(await store.peopleWithMonitoringOn(), [
        { personId: "p-1", lastSearchAt: "2026-11-11T21:00:00.000Z", lastOpenedAt: "2026-11-12T07:30:00.000Z" },
      ]);
    });
  });
}

// ---------- MonthlyBudgetControl ----------
export function monthlyBudgetContract(name: string, make: Factory<MonthlyBudgetControl>): void {
  describe(`${name}: MonthlyBudgetControl`, () => {
    test("an unset budget reads null", async () => {
      assert.equal(await (await make()).monthlyBudget(), null);
    });
    test("set then read round-trips; setting null clears it", async () => {
      const control = await make();
      await control.setMonthlyBudget({ limitMicros: 25_000_000 });
      assert.deepEqual(await control.monthlyBudget(), { limitMicros: 25_000_000 });
      await control.setMonthlyBudget(null);
      assert.equal(await control.monthlyBudget(), null);
    });
  });
}

// ---------- UsageLedger ----------
export function usageLedgerContract(name: string, make: Factory<UsageLedger>): void {
  describe(`${name}: UsageLedger`, () => {
    test("counts per person and per action", async () => {
      const ledger = await make();
      const at = new Date("2026-11-11T09:00:00.000Z");
      await ledger.record("p-1", "onDemandSearches", at);
      await ledger.record("p-1", "onDemandSearches", at);
      await ledger.record("p-1", "tailoredResumes", at);
      await ledger.record("p-2", "onDemandSearches", at);
      assert.equal(await ledger.usedToday("p-1", "onDemandSearches", at), 2);
      assert.equal(await ledger.usedToday("p-1", "tailoredResumes", at), 1);
      assert.equal(await ledger.usedToday("p-2", "tailoredResumes", at), 0);
    });
    test("counts per UTC day: an action at 23:59 UTC does not count the next day", async () => {
      const ledger = await make();
      await ledger.record("p-1", "onDemandSearches", new Date("2026-11-11T23:59:00.000Z"));
      assert.equal(await ledger.usedToday("p-1", "onDemandSearches", new Date("2026-11-11T00:00:00.000Z")), 1);
      assert.equal(await ledger.usedToday("p-1", "onDemandSearches", new Date("2026-11-12T00:00:00.000Z")), 0);
      assert.equal(await ledger.usedToday("p-1", "onDemandSearches", new Date("2026-11-12T00:01:00.000+01:00")), 1, "23:01 UTC on the 11th");
    });
  });
}

// ---------- SpendLedger ----------
export function spendLedgerContract(name: string, make: Factory<SpendLedger>): void {
  describe(`${name}: SpendLedger`, () => {
    test("spentOnRun sums only that run", async () => {
      const ledger = await make();
      await ledger.append(aSpendRecord({ personId: "p-1", runId: "run-1", amountMicros: 1_000 }));
      await ledger.append(aSpendRecord({ personId: "p-1", runId: "run-1", amountMicros: 2_500 }));
      await ledger.append(aSpendRecord({ personId: "p-1", runId: "run-2", amountMicros: 7_000 }));
      await ledger.append(aSpendRecord({ personId: "p-1", runId: null, amountMicros: 9_000 }));
      assert.equal(await ledger.spentOnRun("run-1"), 3_500);
      assert.equal(await ledger.spentOnRun("run-9"), 0);
    });
    test("spentBy and totalSpent respect the half-open period [from, to)", async () => {
      const ledger = await make();
      await ledger.append(aSpendRecord({ personId: "p-1", amountMicros: 1, at: "2026-10-31T23:59:59.999Z" }));
      await ledger.append(aSpendRecord({ personId: "p-1", amountMicros: 10, at: "2026-11-01T00:00:00.000Z" }));
      await ledger.append(aSpendRecord({ personId: "p-2", amountMicros: 100, at: "2026-11-15T00:00:00.000Z" }));
      await ledger.append(aSpendRecord({ personId: null, purpose: "unattributed", amountMicros: 1_000, at: "2026-11-20T00:00:00.000Z" }));
      await ledger.append(aSpendRecord({ personId: "p-1", amountMicros: 10_000, at: "2026-12-01T00:00:00.000Z" }));
      const [from, to] = ["2026-11-01T00:00:00.000Z", "2026-12-01T00:00:00.000Z"];
      assert.equal(await ledger.spentBy("p-1", from, to), 10);
      assert.equal(await ledger.spentBy("p-2", from, to), 100);
      assert.equal(await ledger.totalSpent(from, to), 1_110, "every profile plus unattributed spend");
    });
  });
}

// ---------- SourceSwitchControl ----------
export function sourceSwitchesContract(name: string, make: Factory<SourceSwitchControl>): void {
  describe(`${name}: SourceSwitchControl`, () => {
    test("setEnabled then states round-trips the switch and its reason", async () => {
      const control = await make();
      await control.setEnabled("board-b", false, "broken parser");
      const state = (await control.states()).find((s) => s.sourceName === "board-b");
      assert.equal(state?.enabled, false);
      assert.equal(state?.reason, "broken parser");
    });
    test("states reports each source's real tier", { todo: "Phase 5 (P5-T03): InMemoryStore.setEnabled defaults the tier to 1" }, async () => {
      const control = await make();
      await control.setEnabled("aggregator-a", false, "too costly");
      assert.equal((await control.states()).find((s) => s.sourceName === "aggregator-a")?.tier, 3);
    });
  });
}

// ---------- PersonDataVault ----------
/**
 * A vault under test and how to put one person's data into it. `seed` returns markers: strings that appear in
 * that person's export and must not appear in anyone else's, nor in theirs once erased.
 */
export type VaultUnderTest = {
  readonly vault: PersonDataVault;
  seed(personId: string): Promise<readonly string[]>;
  /** Extra checks once `personId` is erased (for example: spend amounts stay, unlinked from the person). */
  afterErase?(personId: string): Promise<void>;
};
export function personDataVaultContract(name: string, make: Factory<VaultUnderTest>): void {
  const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes);
  describe(`${name}: PersonDataVault`, () => {
    test("export holds only that person's data", async () => {
      const { vault, seed } = await make();
      const ana = await seed("p-ana");
      const ben = await seed("p-ben");
      const exported = text(await vault.exportAll("p-ana"));
      for (const m of ana) assert.ok(exported.includes(m), `export of Ana contains ${m}`);
      for (const m of ben) assert.ok(!exported.includes(m), `export of Ana does not contain Ben's ${m}`);
    });
    test("after eraseAll nothing of the person remains, and another person's data is untouched", async () => {
      const { vault, seed, afterErase } = await make();
      const ana = await seed("p-ana");
      const ben = await seed("p-ben");
      await vault.eraseAll("p-ana");
      const anaAfter = text(await vault.exportAll("p-ana"));
      for (const m of ana) assert.ok(!anaAfter.includes(m), `Ana's ${m} is gone`);
      const benAfter = text(await vault.exportAll("p-ben"));
      for (const m of ben) assert.ok(benAfter.includes(m), `Ben's ${m} remains`);
      await afterErase?.("p-ana");
    });
  });
}
