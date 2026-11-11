import type { ProfileVersion } from "./profile.ts";

declare const scoringProfileBrand: unique symbol;

/**
 * The only profile shape any judge, model or scorer may receive (PRD: Fairness).
 * The brand cannot be forged outside this module, so a port that accepts ScoringProfile
 * cannot be handed a profile that still carries personal details: the compiler enforces it.
 */
export type ScoringProfile = Omit<ProfileVersion, "personal"> & { readonly [scoringProfileBrand]: true };

export function toScoringProfile(profile: ProfileVersion): ScoringProfile {
  const { personal: _personal, ...jobRelevant } = profile;
  // HAND-OFF (Fairness): also redact name, age, gender, nationality and marital-status tokens
  // that leaked into evidence text, before returning.
  return jobRelevant as ScoringProfile;
}
