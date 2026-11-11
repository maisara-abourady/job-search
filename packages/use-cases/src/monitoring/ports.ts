export type MonitoredUser = { readonly userId: string; readonly lastSearchAt: string | null; readonly lastLoginAt: string };
export interface MonitoringRoster {
  usersWithMonitoringOn(): Promise<readonly MonitoredUser[]>;
}
export interface MonitoringSearchRequests {
  requestSearch(userId: string, trigger: "scheduled"): Promise<void>;
}
export interface InboxSource {
  lastVisitAt(userId: string): Promise<string | null>;
  recordVisit(userId: string, at: string): Promise<void>;
  matchesSince(userId: string, since: string | null): Promise<readonly { postingId: string; title: string; employer: string; verdict: "apply" | "stretch"; reason: string }[]>;
}
