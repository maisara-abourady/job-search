/**
 * A person the owner keeps a profile for: the owner themselves or a friend (PRD Data model "Person", AB-1).
 * There is no sign-up, login, email, trial or subscription. Everything else about the person (resumes,
 * profile versions, matches, inbox, tailored resumes, confirmed keywords) is keyed by `personId` (AB-2).
 */
export type Person = {
  readonly personId: string;
  readonly displayName: string;
  readonly createdAt: string;
};

export const DISPLAY_NAME_MAX_LENGTH = 80;

/** The name the owner types for a profile, trimmed; null when it cannot be used. */
export function normalizeDisplayName(name: string): string | null {
  const trimmed = name.trim().replace(/\s+/g, " ");
  return trimmed.length === 0 || trimmed.length > DISPLAY_NAME_MAX_LENGTH ? null : trimmed;
}
