import type { ListResults, RecordJobDecision } from "@matchmaker/use-cases";
import { presentResults } from "./results-presenter.ts";
import type { ResultsViewModel } from "./results-view-model.ts";

/**
 * Framework-free controller. A web framework's route handler (a humble object in the local web Main, deferred)
 * refuses non-local requests (acceptsLocalRequest, AB-5), passes the open profile's id, calls this, and serializes
 * the view model. There is no authentication (ADR 0014). It never reaches storage or a model directly.
 */
export class ResultsController {
  private readonly listResults: ListResults;
  private readonly recordDecision: RecordJobDecision;
  constructor(listResults: ListResults, recordDecision: RecordJobDecision) {
    this.listResults = listResults;
    this.recordDecision = recordDecision;
  }
  async show(openPersonId: string): Promise<ResultsViewModel> {
    return presentResults(await this.listResults.execute({ personId: openPersonId }));
  }
  async decide(openPersonId: string, postingId: string, decision: "applied" | "dismissed"): Promise<void> {
    await this.recordDecision.execute({ personId: openPersonId, postingId, decision });
  }
}
