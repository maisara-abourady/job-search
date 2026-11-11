/**
 * A profile monitoring may search for. Monitoring is on once a profile's first search has run (Flow 6 step 1).
 * `lastOpenedAt` is when the owner last opened the profile (there is no login; ADR 0014).
 */
export type MonitoredPerson = { readonly personId: string; readonly lastSearchAt: string | null; readonly lastOpenedAt: string };
export interface MonitoringRoster {
  peopleWithMonitoringOn(): Promise<readonly MonitoredPerson[]>;
}
export interface MonitoringSearchRequests {
  requestSearch(personId: string, trigger: "scheduled"): Promise<void>;
}
export interface InboxSource {
  lastVisitAt(personId: string): Promise<string | null>;
  recordVisit(personId: string, at: string): Promise<void>;
  matchesSince(personId: string, since: string | null): Promise<readonly { postingId: string; title: string; employer: string; verdict: "apply" | "stretch"; reason: string }[]>;
}
