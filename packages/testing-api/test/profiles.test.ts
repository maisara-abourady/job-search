import assert from "node:assert/strict";
import { test } from "node:test";
import { MatchmakerTestingApi } from "@matchmaker/testing-api";

// ADR 0014: one profile per person, managed by the owner; no sign-up, login or passwords (AB-1, AB-2, AB-4).

test("the owner creates, renames and lists profiles; a profile needs a name", async () => {
  const api = new MatchmakerTestingApi();
  const ana = await api.createProfile("  Ana  ");
  const me = await api.createProfile("Me");
  await api.renameProfile(ana.personId, "Ana B.");

  assert.deepEqual(
    (await api.profiles()).map((p) => p.displayName),
    ["Ana B.", "Me"],
  );
  assert.equal((await api.openProfile(me.personId)).displayName, "Me");
  await assert.rejects(api.createProfile("   "), { code: "invalid-input" });
  await assert.rejects(api.openProfile("nobody"), { code: "not-found" });
});

test("each profile's results are its own", async () => {
  const api = new MatchmakerTestingApi();
  const ana = await api.givenPerson("Ana");
  const ben = await api.givenPerson("Ben");
  await api.givenProfile(ana);
  await api.givenProfile(ben);
  const job = await api.givenPosting();

  await api.scorePostings(ana, [job.id]);

  assert.equal((await api.results(ana)).notAFitCount + (await api.results(ana)).stretch.length + (await api.results(ana)).apply.length, 1);
  const bens = await api.results(ben);
  assert.equal(bens.apply.length + bens.stretch.length + bens.notAFitCount, 0, "Ben never sees Ana's matches (AB-2)");
});

test("export holds one person's data; delete removes it and keeps the owner's spend total", async () => {
  const api = new MatchmakerTestingApi();
  const ana = await api.givenPerson("Ana");
  const ben = await api.givenPerson("Ben");
  await api.givenProfile(ana);
  await api.givenProfile(ben);
  api.judgeCosts(700);
  const job = await api.givenPosting();
  await api.scorePostings(ana, [job.id]);
  await api.scorePostings(ben, [job.id]);

  const archive = await api.exportProfile(ana);
  assert.equal((archive["profile"] as { person: { displayName: string } }).person.displayName, "Ana");
  assert.equal((archive["spend"] as unknown[]).length, 1, "only Ana's spend");

  await api.deleteProfile(ana);

  assert.deepEqual(
    (await api.profiles()).map((p) => p.displayName),
    ["Ben"],
  );
  await assert.rejects(api.exportProfile(ana), { code: "not-found" });
  assert.equal((await api.results(ana)).notAFitCount, 0);
  assert.deepEqual(api.productEvents(ana), []);
  const cost = await api.runningCost();
  assert.equal(cost.totalMicros, 1_400, "the bill is still the bill");
  assert.equal(cost.otherMicros, 700, "Ana's spend no longer names her");
  assert.equal(api.unattributedSpendMicros(), 0);
});
