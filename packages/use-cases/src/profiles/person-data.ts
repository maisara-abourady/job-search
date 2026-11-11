import { UseCaseError } from "../shared/errors.ts";
import type { People, PersonDataVault } from "./ports.ts";

/** AB-4, Flow 8 step 2, Privacy 2: export or delete everything kept for one person, for example when a friend asks. */
export interface ExportPersonData {
  execute(request: { personId: string }): Promise<{ readonly archive: Uint8Array }>;
}
export interface DeletePerson {
  execute(request: { personId: string }): Promise<void>;
}

export class ExportPersonDataInteractor implements ExportPersonData {
  private readonly d: { people: Pick<People, "personOf">; vault: PersonDataVault };
  constructor(dependencies: ExportPersonDataInteractor["d"]) {
    this.d = dependencies;
  }
  async execute(r: { personId: string }): Promise<{ readonly archive: Uint8Array }> {
    if ((await this.d.people.personOf(r.personId)) === null) throw new UseCaseError("not-found", r.personId);
    return { archive: await this.d.vault.exportAll(r.personId) };
  }
}

export class DeletePersonInteractor implements DeletePerson {
  private readonly d: { people: Pick<People, "personOf">; vault: PersonDataVault };
  constructor(dependencies: DeletePersonInteractor["d"]) {
    this.d = dependencies;
  }
  async execute(r: { personId: string }): Promise<void> {
    if ((await this.d.people.personOf(r.personId)) === null) throw new UseCaseError("not-found", r.personId);
    // HAND-OFF (P6): wait for or cancel this person's queued background work first, so nothing is written after erasure.
    await this.d.vault.eraseAll(r.personId);
  }
}
