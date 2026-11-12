import type { Money, SeniorityLevel, WorkMode } from "../shared/vocabulary.ts";

/** Reliability tier of the source (PRD: Job sources). A property of the source, never inferred from its name. */
export type SourceTier = 1 | 2 | 3 | 4;
export type SourceLink = { readonly sourceName: string; readonly tier: SourceTier; readonly url: string; readonly fetchedAt: string };

export type RequirementKind = "must-have" | "nice-to-have";
export type JobRequirement = {
  readonly id: string;
  readonly text: string;
  readonly kind: RequirementKind;
  readonly keywords: readonly string[];
};

export type AuthorizationSignal = {
  readonly kind: "sponsorship-offered" | "authorization-required" | "silent";
  readonly postingText: string | null;
};

/** The common job schema (DS-3) after enrichment (DS-6). Revision increments when the posting text changes. */
export type JobPosting = {
  readonly id: string;
  readonly revision: number;
  readonly employer: string;
  readonly title: string;
  readonly location: string;
  readonly country: string | null;
  readonly workMode: WorkMode | null;
  readonly seniority: SeniorityLevel | null;
  readonly seniorityText: string | null;
  readonly salary: Money | null;
  readonly description: string;
  readonly language: string; // BCP 47, "en" is the only supported language in v1
  readonly postedAt: string; // ISO date
  readonly status: "open" | "closed";
  readonly sources: readonly SourceLink[];
  readonly requirements: readonly JobRequirement[];
  readonly authorization: AuthorizationSignal;
  readonly completeness: {
    readonly responsibilities: boolean;
    readonly requirements: boolean;
    readonly location: boolean;
    readonly employerName: boolean;
  };
  readonly legitimacy: { readonly identifiableEmployer: boolean; readonly asksForPayment: boolean; readonly matchesScamPattern: boolean };
};
