import assert from "node:assert/strict";
import { InMemoryProductEventLog, InMemorySpendLedger, InMemoryStore, InMemoryUsageLedger, JsonArchiveVault } from "@matchmaker/adapters";
import { profileVersionKey } from "@matchmaker/rules";
import { aJobPosting, aProfile } from "../src/builders.ts";
import {
  aSearchRun, aSpendRecord, aStoredMatch, matchRecordsContract, monitoringRosterContract, monthlyBudgetContract, peopleContract,
  personDataVaultContract, postingCatalogContract, profileVersionsContract, resultsReadModelContract, sourceSwitchesContract,
  spendLedgerContract, usageLedgerContract, type VaultUnderTest,
} from "./storage-contracts.ts";

// The in-memory fakes against the storage contracts. Phase 3 runs the same suites against the local database.
const store = () => new InMemoryStore();
postingCatalogContract("InMemoryStore", store);
profileVersionsContract("InMemoryStore", store);
matchRecordsContract("InMemoryStore", store);
resultsReadModelContract("InMemoryStore", store);
peopleContract("InMemoryStore", store);
monitoringRosterContract("InMemoryStore", store);
monthlyBudgetContract("InMemoryStore", store);
sourceSwitchesContract("InMemoryStore", store);
usageLedgerContract("InMemoryUsageLedger", () => new InMemoryUsageLedger());
spendLedgerContract("InMemorySpendLedger", () => new InMemorySpendLedger());

// ---------- every store that holds a person's data ----------
const at = "2026-11-11T09:00:00.000Z";

async function seedStore(s: InMemoryStore, personId: string): Promise<string[]> {
  const name = `name-of-${personId}`;
  const evidence = `evidence-of-${personId}`;
  const posting = aJobPosting({ id: `job-for-${personId}`, title: `title-for-${personId}` });
  const profile = aProfile({ personId, evidence: [{ id: "ev-1", source: "resume-line", text: evidence }] });
  await s.add({ personId, displayName: name, createdAt: at });
  await s.saveNewVersion(profile, []);
  await s.save(posting, posting.id);
  await s.saveMatch(aStoredMatch({ personId, profileVersionKey: profileVersionKey(profile), postingId: posting.id }));
  await s.record(aSearchRun({ runId: `run-of-${personId}`, personId }));
  return [name, evidence, `run-of-${personId}`];
}
async function seedUsage(u: InMemoryUsageLedger, personId: string): Promise<string[]> {
  await u.record(personId, "onDemandSearches", new Date(at));
  return [personId];
}
async function seedSpend(l: InMemorySpendLedger, personId: string): Promise<string[]> {
  await l.append(aSpendRecord({ personId, runId: `spend-run-of-${personId}`, amountMicros: 5_000 }));
  return [`spend-run-of-${personId}`];
}
async function seedEvents(e: InMemoryProductEventLog, personId: string): Promise<string[]> {
  e.record({ name: "job-marked-applied", personId, at, postingId: `applied-job-of-${personId}` });
  return [`applied-job-of-${personId}`];
}
/** Spend is the owner's bill: erasing a person keeps the amounts with personId null (ADR 0014). */
const spendKept = (ledger: InMemorySpendLedger) => async (personId: string) => {
  assert.equal(await ledger.spentBy(personId, "0000", "9999"), 0);
  assert.equal(await ledger.totalSpent("0000", "9999"), 10_000, "both people's spend still counts toward the owner's total");
  assert.ok(ledger.recorded().some((r) => r.personId === null && r.runId === `spend-run-of-${personId}`));
};

personDataVaultContract("InMemoryStore", (): VaultUnderTest => {
  const s = new InMemoryStore();
  return { vault: s, seed: (id) => seedStore(s, id) };
});
personDataVaultContract("InMemoryUsageLedger", (): VaultUnderTest => {
  const u = new InMemoryUsageLedger();
  return { vault: u, seed: (id) => seedUsage(u, id) };
});
personDataVaultContract("InMemorySpendLedger", (): VaultUnderTest => {
  const l = new InMemorySpendLedger();
  return { vault: l, seed: (id) => seedSpend(l, id), afterErase: spendKept(l) };
});
personDataVaultContract("InMemoryProductEventLog", (): VaultUnderTest => {
  const e = new InMemoryProductEventLog();
  return { vault: e, seed: (id) => seedEvents(e, id) };
});
personDataVaultContract("JsonArchiveVault over the in-memory stores", (): VaultUnderTest => {
  const [s, u, l, e] = [new InMemoryStore(), new InMemoryUsageLedger(), new InMemorySpendLedger(), new InMemoryProductEventLog()];
  const vault = new JsonArchiveVault([
    { section: "profile", vault: s }, { section: "dailyUsage", vault: u }, { section: "spend", vault: l }, { section: "productEvents", vault: e },
  ]);
  return {
    vault,
    // The archive names the person at its top level, so its markers are each part's own content, not the id.
    seed: async (id) => {
      await seedUsage(u, id); // its only marker is the id, which the archive header always carries; afterErase checks it
      return [...(await seedStore(s, id)), ...(await seedSpend(l, id)), ...(await seedEvents(e, id))];
    },
    afterErase: async (id) => {
      await spendKept(l)(id);
      assert.equal(await u.usedToday(id, "onDemandSearches", new Date(at)), 0, "the usage part was erased too");
    },
  };
});
