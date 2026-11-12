import assert from "node:assert/strict";
import { test } from "node:test";
import type { RoleHeld } from "@matchmaker/rules";
import { compareResume, compareRoles, type ExpectedResume, sameMonth, sameSkill } from "../eval/parsing/compare.ts";

// The comparison rules of the parsing evaluation (P1-T11), on fictional resumes.
const role = (o: Partial<RoleHeld>): RoleHeld => ({
  employer: "Northwind Analytics",
  title: "Data Engineer",
  start: "2021-03",
  end: null,
  achievementEvidenceIds: [],
  ...o,
});
const expected: ExpectedResume = {
  id: "fictional",
  roles: [
    { employers: ["Northwind Analytics GmbH"], titles: ["Data Engineer"], start: "2021-03", end: null },
    { employers: ["Contoso"], titles: ["Analyst & Engineer"], start: "2019", end: "2021-02" },
    { employers: ["Student Club"], titles: ["President"], start: "2017", end: "2018", optional: true },
  ],
  skills: { required: ["Node.js|NodeJS", "SQL", "Python"], optional: ["Microservices"] },
};

test("roles match on employer, title and months, ignoring case, punctuation and legal suffixes; a bare year matches any month", () => {
  assert.deepEqual(
    compareRoles(expected.roles, [
      role({}),
      role({ employer: "contoso", title: "Analyst and Engineer", start: "2019-06", end: "2021-02" }),
    ]),
    [],
  );
});

test("a wrong month, a missing role and a left-over role are each reported", () => {
  const mismatches = compareRoles(expected.roles, [
    role({ start: "2021-04" }),
    role({ employer: "Fabrikam", title: "Intern", start: "2016-01", end: "2016-06" }),
  ]);
  assert.equal(mismatches.length, 4);
  assert.match(mismatches.join("\n"), /role differs: expected Data Engineer/);
  assert.match(mismatches.join("\n"), /missing role: Analyst & Engineer at Contoso/);
  assert.match(mismatches.join("\n"), /unexpected role: Intern at Fabrikam/);
});

test("skills: recall on required, precision on required plus optional, spellings and plurals forgiven", () => {
  const c = compareResume(
    expected,
    [role({}), role({ employer: "Contoso", title: "Analyst & Engineer", start: "2019-01", end: "2021-02" })],
    ["NodeJS", "sql", "Microservice", "Golf"],
  );
  assert.equal(c.rolesExact, true);
  assert.deepEqual(c.missedSkills, ["Python"]);
  assert.deepEqual(c.unexpectedSkills, ["Golf"]);
  assert.equal(c.skillRecall, 2 / 3);
  assert.equal(c.skillPrecision, 3 / 4);
  assert.equal(c.passed, false);
});

test("helpers: months and skill names", () => {
  assert.ok(sameMonth("2023", "2023-11"));
  assert.ok(!sameMonth("2023-10", "2023-11"));
  assert.ok(sameSkill("Node.js", "NodeJS"));
  assert.ok(!sameSkill("Java", "JavaScript"));
  assert.ok(!sameSkill(".NET", ".NET Core"));
  assert.ok(sameSkill("RMN", "Retail Media Networks (RMN)"));
  assert.ok(sameSkill("Retail Media Networks", "Retail Media Networks (RMN)"));
});
