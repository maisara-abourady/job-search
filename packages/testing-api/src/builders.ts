import type { JobPosting, ProfileVersion } from "@matchmaker/rules";
import type { Enrichment, FoundPosting } from "@matchmaker/use-cases";

/** Sensible defaults so a test states only what it is about. */
export function aProfile(o: Partial<ProfileVersion> & { personId: string }): ProfileVersion {
  return {
    profileId: `profile-${o.personId}`,
    version: 1,
    roles: [],
    skills: [],
    credentials: [],
    languages: ["en"],
    evidence: [
      { id: "ev-sql", source: "resume-line", text: "Built SQL reporting for 40 stores" },
      { id: "ev-ts", source: "resume-line", text: "Led a TypeScript migration of 200k lines" },
      { id: "ev-lead", source: "interview-answer", text: "Managed a team of 6" },
    ],
    inferredSeniority: "senior",
    preferences: {
      locations: ["Berlin"],
      workModes: ["hybrid", "remote"],
      authorizedCountries: ["DE"],
      acceptsSponsorship: false,
      targetSeniority: ["senior", "lead-or-staff"],
      salaryFloor: null,
    },
    personal: { name: "Test Person", photoRef: null, age: null, gender: null, nationality: null, maritalStatus: null },
    ...o,
  };
}

export function aJobPosting(o: Partial<JobPosting> & { id: string }): JobPosting {
  return {
    revision: 1,
    employer: "Acme",
    title: "Senior Engineer",
    location: "Berlin",
    country: "DE",
    workMode: "hybrid",
    seniority: "senior",
    seniorityText: "Senior",
    salary: null,
    description: "Build things.",
    language: "en",
    postedAt: "2026-11-10T00:00:00.000Z",
    status: "open",
    sources: [
      { sourceName: "greenhouse", tier: 1, url: `https://boards.greenhouse.io/acme/${o.id}`, fetchedAt: "2026-11-10T00:00:00.000Z" },
    ],
    requirements: [
      { id: "r-sql", text: "SQL", kind: "must-have", keywords: ["SQL"] },
      { id: "r-ts", text: "TypeScript", kind: "must-have", keywords: ["TypeScript"] },
      { id: "r-lead", text: "Team leadership", kind: "must-have", keywords: ["leadership"] },
      { id: "r-cloud", text: "Cloud infrastructure", kind: "must-have", keywords: ["AWS"] },
      { id: "r-go", text: "Go", kind: "nice-to-have", keywords: ["Go"] },
    ],
    authorization: { kind: "authorization-required", postingText: "Must be authorized to work in Germany" },
    completeness: { responsibilities: true, requirements: true, location: true, employerName: true },
    legitimacy: { identifiableEmployer: true, asksForPayment: false, matchesScamPattern: false },
    ...o,
  };
}

export function enrichmentOf(_found: FoundPosting): Enrichment {
  const { requirements, seniority, seniorityText, authorization, salary, workMode, country, language, completeness, legitimacy } =
    aJobPosting({ id: "x" });
  return { requirements, seniority, seniorityText, authorization, salary, workMode, country, language, completeness, legitimacy };
}
