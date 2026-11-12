import assert from "node:assert/strict";
import { test } from "node:test";
import { aCandidate, aResumeUpload, aStrengthAnswer, aStructuredResume, MatchmakerTestingApi } from "@matchmaker/testing-api";

// UC-1, UC-2: resume intake and profile correction (Flow 1 steps 1 to 3, Flow 7). Fictional people and resumes only.

async function aProfileOwner(name = "Dana") {
  const api = new MatchmakerTestingApi();
  const { personId } = await api.createProfile(name);
  return { api, personId };
}

test("a readable English resume becomes a card of tiered points with their proofs and a Resume Strength", async () => {
  const { api, personId } = await aProfileOwner();
  api.analystWillSay({
    candidates: [
      aCandidate("ev-3", 1, "Wrote store reporting"),
      aCandidate("ev-2", 2, "Built a shared data-quality service"),
      aCandidate("ev-1", 3, "Cut pipeline time by 89%"),
      aCandidate("ev-1", 2, "Owns the nightly pipeline"),
      aCandidate("ev-2", 1, "Python"),
      aCandidate("ev-3", 0, "Knows SQL"),
    ],
    strength: aStrengthAnswer({
      ratios: { impactEvidence: 1, skillsDepth: 0.5, clarityAndStructure: 0.75, careerTrajectory: 0.4, atsReadability: 0.2 },
    }),
  });

  const response = await api.intake(personId, aResumeUpload());

  assert.equal(response.outcome, "parsed");
  if (response.outcome !== "parsed") return;
  const { card } = response;
  assert.deepEqual(
    card.points.map((p) => [p.tier, p.statement]),
    [
      ["signature", "Cut pipeline time by 89%"],
      ["strong", "Built a shared data-quality service"],
      ["strong", "Owns the nightly pipeline"],
      ["supporting", "Wrote store reporting"],
      ["supporting", "Python"],
    ],
    "Signature, then Strong, then Supporting; a candidate with no yes is not on the card",
  );
  assert.equal(card.points[0]?.proof, "Cut nightly pipeline time from 6 hours to 40 minutes");
  assert.equal(card.points[3]?.proof, "Wrote SQL reporting for 40 stores");
  assert.equal(card.resumeStrength, 30 + 10 + 15 + 6 + 3);
  assert.deepEqual(card.topFixes, ["Quantify the 2019 migration", "Add a skills section", "Shorten the summary"]);
  assert.equal(card.suggestedSeniority, "senior");

  const [saved] = api.profileVersions(personId);
  assert.equal(saved?.version, 1);
  assert.deepEqual(saved?.preferences.targetSeniority, ["senior", "lead-or-staff"]);
  assert.deepEqual(saved?.preferences.authorizedCountries, [], "work authorization is never invented");
  assert.equal(saved?.preferences.acceptsSponsorship, false);
  assert.equal((await api.sellingPoints(personId)).length, 5);
});

test("the card keeps at most eight points, and shows only what qualifies when fewer than five do", async () => {
  const { api, personId } = await aProfileOwner();
  api.analystWillSay({ candidates: Array.from({ length: 11 }, (_, i) => aCandidate("ev-1", 2, `Point ${i}`)) });
  const many = await api.intake(personId, aResumeUpload());
  assert.equal(many.outcome === "parsed" && many.card.points.length, 8);

  api.analystWillSay({ candidates: [aCandidate("ev-1", 1), aCandidate("ev-2", 0), aCandidate("ev-2", 2), aCandidate("ev-3", 3)] });
  const few = await api.intake(personId, aResumeUpload());
  assert.equal(few.outcome === "parsed" && few.card.points.length, 3);
});

test("a candidate citing evidence the resume does not hold is not a selling point", async () => {
  const { api, personId } = await aProfileOwner();
  api.analystWillSay({ candidates: [aCandidate("ev-1", 3), aCandidate("ev-invented", 3, "Ran a company of 500")] });
  const response = await api.intake(personId, aResumeUpload());
  assert.deepEqual(response.outcome === "parsed" && response.card.points.map((p) => p.statement), ["Point on ev-1"]);
});

test("with no work history the profile targets entry level", async () => {
  const { api, personId } = await aProfileOwner();
  api.analystWillSay({ structured: aStructuredResume({ roles: [], inferredSeniority: null }) });
  const response = await api.intake(personId, aResumeUpload());
  assert.equal(response.outcome === "parsed" && response.card.suggestedSeniority, null);
  assert.deepEqual(api.profileVersions(personId)[0]?.preferences.targetSeniority, ["entry"]);
});

test("an unreadable document asks for pasted text and saves no profile", async () => {
  const { api, personId } = await aProfileOwner();
  api.documentWillRead("scan.pdf", { outcome: "unreadable" });
  assert.deepEqual(await api.intake(personId, aResumeUpload({ fileName: "scan.pdf" })), { outcome: "needs-pasted-text" });
  assert.equal(api.profileVersions(personId).length, 0);
  assert.equal(api.searchesRequested().length, 0);

  const pasted = await api.intake(personId, { kind: "text", fileName: "pasted.txt", bytes: null, text: "Pasted fictional resume" });
  assert.equal(pasted.outcome, "parsed");
  assert.deepEqual(api.analystReceived, ["Pasted fictional resume"]);
});

test("a resume not in English is refused with its language and requests no search", async () => {
  const { api, personId } = await aProfileOwner();
  api.documentWillRead("cv.pdf", { outcome: "read", text: "Ingénieure de données", language: "fr" });
  assert.deepEqual(await api.intake(personId, aResumeUpload({ fileName: "cv.pdf" })), {
    outcome: "unsupported-language",
    language: "fr",
  });
  assert.equal(api.profileVersions(personId).length, 0);
  assert.equal(api.searchesRequested().length, 0);
  assert.deepEqual(api.analystReceived, [], "the analyst is not asked");
});

test("an upload over 10 MB is refused before anything is stored", async () => {
  const { api, personId } = await aProfileOwner();
  const tooBig = aResumeUpload({ bytes: new Uint8Array(10 * 1024 * 1024 + 1) });
  await assert.rejects(api.intake(personId, tooBig), { code: "invalid-input" });
  assert.deepEqual(await api.storedResumes(personId), []);
});

test("a second upload creates version 2, keeps version 1 and its preferences, and both originals", async () => {
  const { api, personId } = await aProfileOwner();
  await api.intake(personId, aResumeUpload({ fileName: "first.pdf" }));
  api.analystWillSay({ structured: aStructuredResume({ inferredSeniority: "lead-or-staff" }) });
  await api.intake(personId, aResumeUpload({ fileName: "second.pdf" }));

  const [v1, v2] = api.profileVersions(personId);
  assert.equal(v1?.version, 1);
  assert.equal(v1?.inferredSeniority, "senior", "version 1 is unchanged");
  assert.equal(v2?.version, 2);
  assert.equal(v2?.profileId, v1?.profileId);
  assert.equal(v2?.inferredSeniority, "lead-or-staff");
  assert.deepEqual(v2?.preferences, v1?.preferences, "a re-upload keeps the preferences");
  assert.deepEqual(
    (await api.storedResumes(personId)).map((r) => [r.version, r.fileName]),
    [
      [1, "first.pdf"],
      [2, "second.pdf"],
    ],
  );
});

test("each successful intake requests exactly one onboarding search", async () => {
  const { api, personId } = await aProfileOwner();
  await api.intake(personId, aResumeUpload());
  assert.deepEqual(api.searchesRequested(), [{ personId, trigger: "onboarding" }]);
});

test("past the monthly budget intake asks first; intake never counts against a daily cap", async () => {
  const { api, personId } = await aProfileOwner();
  await api.setMonthlyBudget(1_000_000);
  api.analystCosts(1_000_000);
  await api.intake(personId, aResumeUpload({ fileName: "first.pdf" })); // spends the whole budget

  await assert.rejects(api.intake(personId, aResumeUpload({ fileName: "second.pdf" })), { code: "monthly-budget-reached" });
  assert.equal((await api.storedResumes(personId)).length, 1, "a refused intake stores nothing");

  for (let i = 0; i < 4; i++) {
    const response = await api.intake(personId, aResumeUpload(), { overBudgetConfirmed: true });
    assert.equal(response.outcome, "parsed");
  }
});

test("intake for an unknown profile is not found", async () => {
  const api = new MatchmakerTestingApi();
  await assert.rejects(api.intake("nobody", aResumeUpload()), { code: "not-found" });
});

test("the analyst's spend is charged to the profile as intake, none unattributed", async () => {
  const { api, personId } = await aProfileOwner();
  api.analystCosts(25_000);
  await api.intake(personId, aResumeUpload());
  assert.equal(await api.spentBy(personId), 25_000);
  assert.equal(api.unattributedSpendMicros(), 0);
  assert.deepEqual(api.spendPurposes(personId), ["intake"]);
});

test("the analyst receives only the document's text; personal details stay on the stored profile", async () => {
  const { api, personId } = await aProfileOwner();
  api.documentWillRead("resume.pdf", { outcome: "read", text: "Fictional resume text", language: "en-GB" });
  await api.intake(personId, aResumeUpload());
  assert.deepEqual(api.analystReceived, ["Fictional resume text"]);
  assert.equal(api.profileVersions(personId)[0]?.personal.name, "Dana Example");
});

// ---------- CorrectProfile: facts and selling points (RP-7, Flow 7, ADR 0005) ----------

test("correcting a fact makes a new active version, leaves the old one unchanged, and requests one re-score", async () => {
  const { api, personId } = await aProfileOwner();
  await api.intake(personId, aResumeUpload());

  const response = await api.correct(personId, { kind: "fact", evidenceId: "ev-3", newText: "Wrote SQL reporting for 45 stores" });

  assert.deepEqual(response, { newVersion: 2, rescoreRequested: true });
  const [v1, v2] = api.profileVersions(personId);
  assert.equal(v1?.evidence.find((e) => e.id === "ev-3")?.text, "Wrote SQL reporting for 40 stores");
  assert.equal(v2?.evidence.find((e) => e.id === "ev-3")?.text, "Wrote SQL reporting for 45 stores");
  assert.deepEqual(api.rescoresRequested(), [personId]);
  assert.deepEqual(
    api.productEvents(personId).map((e) => e.name),
    ["profile-created", "fact-fixed"],
  );
  await api.backgroundWorkSettled();
});

test("correcting a selling point changes its statement and keeps its proof", async () => {
  const { api, personId } = await aProfileOwner();
  api.analystWillSay({ candidates: [aCandidate("ev-1", 3, "Made the pipeline faster"), aCandidate("ev-2", 2)] });
  await api.intake(personId, aResumeUpload());

  await api.correct(personId, { kind: "selling-point", evidenceId: "ev-1", newStatement: "Cut nightly pipeline time by 89%" });

  const points = await api.sellingPoints(personId);
  assert.deepEqual(points[0], { statement: "Cut nightly pipeline time by 89%", tier: "signature", evidenceId: "ev-1" });
  assert.equal(points.length, 2);
  assert.equal(
    api
      .profileVersions(personId)
      .at(-1)
      ?.evidence.find((e) => e.id === "ev-1")?.text,
    aStructuredResume().evidence[0]?.text,
  );
  await api.backgroundWorkSettled();
});

test("a correction naming unknown evidence, or for a profile with no resume, is not found and creates no version", async () => {
  const { api, personId } = await aProfileOwner();
  await assert.rejects(api.correct(personId, { kind: "fact", evidenceId: "ev-1", newText: "x" }), { code: "not-found" });
  await api.intake(personId, aResumeUpload());
  await assert.rejects(api.correct(personId, { kind: "fact", evidenceId: "ev-unknown", newText: "x" }), { code: "not-found" });
  await assert.rejects(api.correct(personId, { kind: "selling-point", evidenceId: "ev-unknown", newStatement: "x" }), {
    code: "not-found",
  });
  assert.equal(api.profileVersions(personId).length, 1);
  assert.deepEqual(api.rescoresRequested(), []);
});
