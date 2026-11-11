import { notYetBuilt } from "@matchmaker/rules";
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
export type CorrectProfileRequest = { readonly userId: string; readonly correction: ProfileCorrection };
export type CorrectProfileResponse = { readonly newVersion: number; readonly rescoreRequested: boolean };
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
  async execute(_request: CorrectProfileRequest): Promise<CorrectProfileResponse> {
    void this.profiles;
    void this.rescore;
    return notYetBuilt("RP-7, NF-5, PF-1..PF-5: profile correction");
  }
}
