import type { Person } from "@matchmaker/rules";
import type { PeopleForSpending } from "../shared/spending-guard.ts";

/** The owner's list of people (AB-1). One implementation per store; nothing here knows how it is kept. */
export interface People extends PeopleForSpending {
  add(person: Person): Promise<void>;
  personOf(personId: string): Promise<Person | null>;
  all(): Promise<readonly Person[]>;
  rename(personId: string, displayName: string): Promise<void>;
  /** When the owner last opened this profile; monitoring pauses for profiles left unopened (MN-4, ADR 0014). */
  recordOpened(personId: string, at: string): Promise<void>;
}

/**
 * AB-4, Privacy 2: every store that holds a person's data takes part; Main composes them into one vault.
 * `eraseAll` removes the person's records and files. Spend records are kept with their personId set to null,
 * because they are the owner's bill and hold no personal data (ADR 0014).
 */
export interface PersonDataVault {
  exportAll(personId: string): Promise<Uint8Array>;
  eraseAll(personId: string): Promise<void>;
}
