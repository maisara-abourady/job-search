import type { Money, SeniorityBand, SeniorityLevel, WorkMode } from "../shared/vocabulary.ts";

/** "Nothing is invented": every claim in a profile is backed by one of these sources. */
export type EvidenceSource = "resume-line" | "interview-answer" | "confirmed-keyword";
export type Evidence = { readonly id: string; readonly source: EvidenceSource; readonly text: string };

export type RoleHeld = {
  readonly employer: string;
  readonly title: string;
  readonly start: string; // ISO month, e.g. "2021-04"
  readonly end: string | null; // null = current
  readonly achievementEvidenceIds: readonly string[];
};
export type EvidencedSkill = { readonly name: string; readonly evidenceIds: readonly string[] };
export type Credential = {
  readonly kind: "degree" | "certification";
  readonly name: string;
  readonly issuer: string;
  readonly year: string | null;
};

/** PF-1..PF-4. Location, work mode and salary are soft; authorization and seniority are hard gates. */
export type Preferences = {
  readonly locations: readonly string[];
  readonly workModes: readonly WorkMode[];
  readonly authorizedCountries: readonly string[];
  readonly acceptsSponsorship: boolean;
  readonly targetSeniority: SeniorityBand;
  readonly salaryFloor: Money | null;
};

/** Never reaches a scoring call (PRD: Fairness). See toScoringProfile. */
export type PersonalDetails = {
  readonly name: string | null;
  readonly photoRef: string | null;
  readonly age: number | null;
  readonly gender: string | null;
  readonly nationality: string | null;
  readonly maritalStatus: string | null;
};

/**
 * A profile version is an immutable value (ADR 0005). Any correction, preference change,
 * interview answer or new resume produces a new version; matches are keyed by version.
 */
export type ProfileVersion = {
  readonly profileId: string;
  readonly personId: string;
  readonly version: number;
  readonly roles: readonly RoleHeld[];
  readonly skills: readonly EvidencedSkill[];
  readonly credentials: readonly Credential[];
  readonly languages: readonly string[];
  readonly evidence: readonly Evidence[];
  readonly inferredSeniority: SeniorityLevel | null;
  readonly preferences: Preferences;
  readonly personal: PersonalDetails;
};

export function profileVersionKey(p: Pick<ProfileVersion, "profileId" | "version">): string {
  return `${p.profileId}@${p.version}`;
}

export function evidenceById(profile: Pick<ProfileVersion, "evidence">, id: string): Evidence | undefined {
  return profile.evidence.find((e) => e.id === id);
}
