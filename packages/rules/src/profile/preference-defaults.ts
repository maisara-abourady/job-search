import { SENIORITY_LADDER, type SeniorityBand, type SeniorityLevel } from "../shared/vocabulary.ts";
import type { Preferences } from "./profile.ts";

/**
 * PF-3: the level the resume shows plus the next one up, because people reasonably aim one step higher.
 * No work history suggests entry level (edge case "No work history").
 */
export function suggestedSeniorityBand(inferred: SeniorityLevel | null): SeniorityBand {
  if (inferred === null) return ["entry"];
  const next = SENIORITY_LADDER[SENIORITY_LADDER.indexOf(inferred) + 1];
  return next === undefined ? [inferred] : [inferred, next];
}

/**
 * Preferences before the person has answered the preference screens (PF-1 to PF-5): soft preferences empty,
 * no salary floor, and work authorization never invented (no countries, no sponsorship) until PF-2 is answered.
 */
export function initialPreferences(suggestedBand: SeniorityBand): Preferences {
  return {
    locations: [],
    workModes: [],
    authorizedCountries: [],
    acceptsSponsorship: false,
    targetSeniority: suggestedBand,
    salaryFloor: null,
  };
}
