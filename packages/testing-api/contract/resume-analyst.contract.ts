/**
 * ResumeAnalyst contract (RP-2, RP-4, RP-5): what any analyst hands inward. Every id a role, skill or candidate
 * cites exists in the evidence; months are YYYY-MM; ratios are within 0..1; at most three fixes; personal details
 * stay in `personal`. When the analyst under test spends money, each call reports one model spend.
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { ResumeAnalyst } from "@matchmaker/use-cases";

export type AnalystUnderTest = {
  readonly analyst: ResumeAnalyst;
  readonly resumeText: string;
  /** Model spends recorded so far, in micros; omit for an analyst that spends nothing. */
  readonly spendRecorded?: () => readonly number[];
};

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export function resumeAnalystContract(name: string, make: () => AnalystUnderTest): void {
  describe(`${name}: ResumeAnalyst`, () => {
    test("a structured resume cites only evidence it holds, with unique ids and YYYY-MM months", async () => {
      const { analyst, resumeText } = make();
      const resume = await analyst.structure(resumeText);
      const ids = resume.evidence.map((e) => e.id);
      assert.equal(new Set(ids).size, ids.length, "evidence ids are unique");
      assert.ok(resume.evidence.every((e) => e.text.trim() !== ""));
      for (const role of resume.roles) {
        assert.match(role.start, MONTH, `${role.title} start`);
        if (role.end !== null) assert.match(role.end, MONTH, `${role.title} end`);
        for (const id of role.achievementEvidenceIds) assert.ok(ids.includes(id), `${role.title} cites ${id}`);
      }
      for (const skill of resume.skills) {
        assert.ok(skill.evidenceIds.length > 0, `${skill.name} is backed by a line`);
        for (const id of skill.evidenceIds) assert.ok(ids.includes(id), `${skill.name} cites ${id}`);
      }
    });
    test("personal details other than the name are not taken, and none reach the evidence", async () => {
      const { analyst, resumeText } = make();
      const resume = await analyst.structure(resumeText);
      const { photoRef, age, gender, nationality, maritalStatus } = resume.personal;
      assert.deepEqual([photoRef, age, gender, nationality, maritalStatus], [null, null, null, null, null]);
      const name = resume.personal.name;
      if (name !== null) for (const e of resume.evidence) assert.ok(!e.text.includes(name), `evidence ${e.id} names the person`);
    });
    test("selling-point candidates cite evidence the resume holds", async () => {
      const { analyst, resumeText } = make();
      const resume = await analyst.structure(resumeText);
      const ids = new Set(resume.evidence.map((e) => e.id));
      const candidates = await analyst.sellingPointCandidates(resume);
      assert.ok(candidates.length > 0);
      for (const c of candidates) {
        assert.ok(ids.has(c.evidenceId), `candidate cites ${c.evidenceId}`);
        assert.ok(c.statement.trim() !== "");
      }
    });
    test("strength ratios are within 0..1 with at most three fixes", async () => {
      const { analyst, resumeText } = make();
      const { ratios, topFixes } = await analyst.strengthRatios(await analyst.structure(resumeText));
      for (const [k, v] of Object.entries(ratios)) assert.ok(v >= 0 && v <= 1, `${k} = ${v}`);
      assert.ok(topFixes.length <= 3 && topFixes.length > 0);
    });
    test("every model call reports its spend (ADR 0010)", async (t) => {
      const under = make();
      if (under.spendRecorded === undefined) return t.skip("this analyst spends nothing");
      const resume = await under.analyst.structure(under.resumeText);
      await under.analyst.sellingPointCandidates(resume);
      await under.analyst.strengthRatios(resume);
      const spends = under.spendRecorded();
      assert.ok(spends.length >= 3, `one spend per call (${spends.length} recorded)`);
      assert.ok(spends.every((m) => Number.isInteger(m) && m > 0));
    });
  });
}
