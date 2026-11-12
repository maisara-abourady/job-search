import { notYetBuilt, type ProfileVersion, type SellingPoint } from "@matchmaker/rules";
import { UseCaseError } from "../shared/errors.ts";
import type { SellingPointLine } from "./intake-resume.ts";
import type { ProfileVersions, RescoreRequests } from "./ports.ts";

/**
 * RP-7, NF-5 (Fix a fact), PF-1..PF-5 (preferences), Flow 7. One use case with one rule:
 * every correction creates a new immutable profile version and asks for a re-score.
 */
/** Request-side shape of the four preference screens (PF-1..PF-4); mapped to the rules' Preferences inside. */
export type PreferencesInput = {
  readonly locations: readonly string[];
  readonly workModes: readonly ("on-site" | "hybrid" | "remote")[];
  readonly authorizedCountries: readonly string[];
  readonly acceptsSponsorship: boolean;
  readonly targetSeniority: readonly string[];
  readonly salaryFloor: { readonly amount: number; readonly currency: string } | null;
};
export type ProfileCorrection =
  | { readonly kind: "fact"; readonly evidenceId: string; readonly newText: string }
  | { readonly kind: "preferences"; readonly preferences: PreferencesInput }
  | { readonly kind: "selling-point"; readonly evidenceId: string; readonly newStatement: string };
export type CorrectProfileRequest = { readonly personId: string; readonly correction: ProfileCorrection };
/** `points` are the card's lines as the new version has them (a correction does not change Resume Strength or its fixes). */
export type CorrectProfileResponse = {
  readonly newVersion: number;
  readonly rescoreRequested: boolean;
  readonly points: readonly SellingPointLine[];
};
export interface CorrectProfile {
  execute(request: CorrectProfileRequest): Promise<CorrectProfileResponse>;
}
export class CorrectProfileInteractor implements CorrectProfile {
  private readonly profiles: ProfileVersions;
  private readonly rescore: RescoreRequests;
  constructor(profiles: ProfileVersions, rescore: RescoreRequests) {
    this.profiles = profiles;
    this.rescore = rescore;
  }
  async execute(request: CorrectProfileRequest): Promise<CorrectProfileResponse> {
    const { personId, correction } = request;
    const current = await this.profiles.active(personId);
    if (current === null) throw new UseCaseError("not-found", `no profile for ${personId}`);
    const points = await this.profiles.sellingPoints(personId);

    const next = this.corrected(current, points, correction);
    await this.profiles.saveNewVersion({ ...next.profile, version: current.version + 1 }, next.points);
    await this.rescore.rescoreAll(personId);
    const proofs = new Map(next.profile.evidence.map((e) => [e.id, e.text]));
    return {
      newVersion: current.version + 1,
      rescoreRequested: true,
      points: next.points.map((p) => ({
        evidenceId: p.evidenceId,
        statement: p.statement,
        tier: p.tier,
        proof: proofs.get(p.evidenceId) ?? "",
      })),
    };
  }

  /** The one rule: a correction changes a copy; the current version stays as it was (ADR 0005). */
  private corrected(
    profile: ProfileVersion,
    points: readonly SellingPoint[],
    correction: ProfileCorrection,
  ): { profile: ProfileVersion; points: readonly SellingPoint[] } {
    switch (correction.kind) {
      case "fact": {
        if (!profile.evidence.some((e) => e.id === correction.evidenceId)) throw notFound(correction.evidenceId);
        const evidence = profile.evidence.map((e) => (e.id === correction.evidenceId ? { ...e, text: correction.newText } : e));
        return { profile: { ...profile, evidence }, points };
      }
      case "selling-point": {
        if (!points.some((p) => p.evidenceId === correction.evidenceId)) throw notFound(correction.evidenceId);
        const changed = points.map((p) => (p.evidenceId === correction.evidenceId ? { ...p, statement: correction.newStatement } : p));
        return { profile, points: changed };
      }
      case "preferences":
        return notYetBuilt("PF-1..PF-5: preferences (Phase 3)");
    }
  }
}

function notFound(evidenceId: string): UseCaseError {
  return new UseCaseError("not-found", `no evidence ${evidenceId} on the active profile`);
}
