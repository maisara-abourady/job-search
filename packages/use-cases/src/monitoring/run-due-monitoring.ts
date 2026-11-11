import type { Clock } from "../shared/ports.ts";
import type { MonitoredUser, MonitoringRoster, MonitoringSearchRequests } from "./ports.ts";

/** MN-1, MN-4: application policy (would not exist without automation), so it lives here, not in the rules. */
export const MONITORING_POLICY = { intervalHours: 12, pauseAfterDaysWithoutLogin: 14 } as const; // ASSUMPTIONS in the PRD

export function isDueForSearch(u: MonitoredUser, now: Date): boolean {
  const hours = (iso: string) => (now.getTime() - new Date(iso).getTime()) / 3_600_000;
  if (hours(u.lastLoginAt) > MONITORING_POLICY.pauseAfterDaysWithoutLogin * 24) return false;
  return u.lastSearchAt === null || hours(u.lastSearchAt) >= MONITORING_POLICY.intervalHours;
}

export interface RunDueMonitoring {
  execute(): Promise<{ readonly requested: number }>;
}
export class RunDueMonitoringInteractor implements RunDueMonitoring {
  private readonly roster: MonitoringRoster;
  private readonly searches: MonitoringSearchRequests;
  private readonly clock: Clock;
  constructor(roster: MonitoringRoster, searches: MonitoringSearchRequests, clock: Clock) {
    this.roster = roster;
    this.searches = searches;
    this.clock = clock;
  }
  async execute(): Promise<{ readonly requested: number }> {
    const now = this.clock.now();
    const due = (await this.roster.usersWithMonitoringOn()).filter((u) => isDueForSearch(u, now));
    for (const u of due) await this.searches.requestSearch(u.userId, "scheduled");
    return { requested: due.length };
  }
}
