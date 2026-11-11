import type { ListResults, RecordJobDecision } from "@matchmaker/use-cases";
import { presentResults } from "./results-presenter.ts";
import type { ResultsViewModel } from "./results-view-model.ts";

/**
 * Framework-free controller. A web framework's route handler (a humble object in apps/web, deferred)
 * authenticates, calls this, and serializes the view model. It never reaches storage or a model directly.
 */
export class ResultsController {
  private readonly listResults: ListResults;
  private readonly recordDecision: RecordJobDecision;
  constructor(listResults: ListResults, recordDecision: RecordJobDecision) {
    this.listResults = listResults;
    this.recordDecision = recordDecision;
  }
  async show(authenticatedUserId: string): Promise<ResultsViewModel> {
    return presentResults(await this.listResults.execute({ userId: authenticatedUserId }));
  }
  async decide(authenticatedUserId: string, postingId: string, decision: "applied" | "dismissed"): Promise<void> {
    await this.recordDecision.execute({ userId: authenticatedUserId, postingId, decision });
  }
}
