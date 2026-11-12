import type { SpendingGuard } from "../shared/spending-guard.ts";
import type { Clock } from "../shared/ports.ts";
import type { MonitoredPerson, MonitoringRoster, MonitoringSearchRequests } from "./ports.ts";

/**
 * MN-1, MN-4: application policy (would not exist without automation), so it lives here, not in the rules.
 * INTERPRETATION (ADR 0014): with no login, MN-4's "14 days without a login" is 14 days without the owner
 * opening that profile.
 */
export const MONITORING_POLICY = { intervalHours: 12, pauseAfterDaysUnopened: 14 } as const; // ASSUMPTIONS in the PRD

export function isDueForSearch(p: MonitoredPerson, now: Date): boolean {
  const hours = (iso: string) => (now.getTime() - new Date(iso).getTime()) / 3_600_000;
  if (hours(p.lastOpenedAt) > MONITORING_POLICY.pauseAfterDaysUnopened * 24) return false;
  return p.lastSearchAt === null || hours(p.lastSearchAt) >= MONITORING_POLICY.intervalHours;
}

/**
 * Asks for one scheduled search per profile that is due. Monitoring runs only while the app runs (ADR 0016):
 * Main calls this once at start, which is the catch-up run (a profile whose 12 hours passed while the machine was
 * off is due, and gets one search however long the app was off), and then on a timer. When the owner's monthly
 * budget is reached, nothing is requested (AB-3).
 */
export type RunDueMonitoringResponse = { readonly requested: number; readonly pausedByBudget: boolean };
export interface RunDueMonitoring {
  execute(): Promise<RunDueMonitoringResponse>;
}
export class RunDueMonitoringInteractor implements RunDueMonitoring {
  private readonly d: {
    roster: MonitoringRoster;
    searches: MonitoringSearchRequests;
    spending: Pick<SpendingGuard, "monthlyBudgetReached">;
    clock: Clock;
  };
  constructor(dependencies: RunDueMonitoringInteractor["d"]) {
    this.d = dependencies;
  }
  async execute(): Promise<RunDueMonitoringResponse> {
    if (await this.d.spending.monthlyBudgetReached()) return { requested: 0, pausedByBudget: true };
    const now = this.d.clock.now();
    const due = (await this.d.roster.peopleWithMonitoringOn()).filter((p) => isDueForSearch(p, now));
    for (const p of due) await this.d.searches.requestSearch(p.personId, "scheduled");
    return { requested: due.length, pausedByBudget: false };
  }
}
