import type { JobPosting, ProfileVersion } from "@matchmaker/rules";
import type { Enrichment, FoundPosting, ResumeAnalyst, ResumeUpload, StructuredResume } from "@matchmaker/use-cases";

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

/** A fictional upload; by default a small PDF whose text the scripted reader returns as English. */
export function aResumeUpload(o: Partial<ResumeUpload> = {}): ResumeUpload {
  return { kind: "pdf", fileName: "resume.pdf", bytes: new TextEncoder().encode("Fictional resume of Dana Example"), text: null, ...o };
}

/** A fictional structured resume: two roles, three achievements, two skills, one credential. */
export function aStructuredResume(o: Partial<StructuredResume> = {}): StructuredResume {
  return {
    roles: [
      {
        employer: "Northwind Analytics",
        title: "Senior Data Engineer",
        start: "2022-03",
        end: null,
        achievementEvidenceIds: ["ev-1", "ev-2"],
      },
      { employer: "Contoso Retail", title: "Data Engineer", start: "2018-06", end: "2022-02", achievementEvidenceIds: ["ev-3"] },
    ],
    skills: [
      { name: "SQL", evidenceIds: ["ev-1", "ev-3"] },
      { name: "Python", evidenceIds: ["ev-2"] },
    ],
    credentials: [{ kind: "degree", name: "BSc Computer Science", issuer: "Example University", year: "2018" }],
    languages: ["en"],
    evidence: [
      { id: "ev-1", source: "resume-line", text: "Cut nightly pipeline time from 6 hours to 40 minutes" },
      { id: "ev-2", source: "resume-line", text: "Built a Python data-quality service used by 12 teams" },
      { id: "ev-3", source: "resume-line", text: "Wrote SQL reporting for 40 stores" },
    ],
    inferredSeniority: "senior",
    personal: { name: "Dana Example", photoRef: null, age: null, gender: null, nationality: null, maritalStatus: null },
    ...o,
  };
}

export type SellingPointCandidate = Awaited<ReturnType<ResumeAnalyst["sellingPointCandidates"]>>[number];
export type StrengthAnswer = Awaited<ReturnType<ResumeAnalyst["strengthRatios"]>>;

/** A candidate whose three tier tests are answered; `yeses` picks how many are "yes" (3 Signature, 2 Strong, 1 Supporting, 0 none). */
export function aCandidate(evidenceId: string, yeses: 0 | 1 | 2 | 3, statement = `Point on ${evidenceId}`): SellingPointCandidate {
  return { statement, evidenceId, quantified: yeses >= 1, withinLastThreeYears: yeses >= 2, uncommonForRole: yeses >= 3 };
}

export function aStrengthAnswer(o: Partial<StrengthAnswer> = {}): StrengthAnswer {
  return {
    ratios: { impactEvidence: 0.5, skillsDepth: 0.5, clarityAndStructure: 0.5, careerTrajectory: 0.5, atsReadability: 0.5 },
    topFixes: ["Quantify the 2019 migration", "Add a skills section", "Shorten the summary"],
    ...o,
  };
}
