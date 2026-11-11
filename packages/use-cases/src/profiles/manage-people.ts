import { normalizeDisplayName } from "@matchmaker/rules";
import { UseCaseError } from "../shared/errors.ts";
import type { Clock, IdGenerator } from "../shared/ports.ts";
import type { People } from "./ports.ts";

/** AB-1, Flow 8 step 1: the owner creates, renames, lists and switches between person profiles. No sign-up or login. */
export type CreatePersonRequest = { readonly displayName: string };
export type CreatePersonResponse = { readonly personId: string; readonly displayName: string; readonly createdAt: string };
export interface CreatePerson {
  execute(request: CreatePersonRequest): Promise<CreatePersonResponse>;
}
export type RenamePersonRequest = { readonly personId: string; readonly displayName: string };
export interface RenamePerson {
  execute(request: RenamePersonRequest): Promise<void>;
}
export type PersonSummary = { readonly personId: string; readonly displayName: string; readonly createdAt: string };
export interface ListPeople {
  execute(): Promise<{ readonly people: readonly PersonSummary[] }>;
}
/** Switching to a profile. Everything shown afterwards is that person's alone (AB-2). */
export type OpenPersonRequest = { readonly personId: string };
export interface OpenPerson {
  execute(request: OpenPersonRequest): Promise<PersonSummary>;
}

export class CreatePersonInteractor implements CreatePerson {
  private readonly d: { people: Pick<People, "add">; ids: IdGenerator; clock: Clock };
  constructor(dependencies: CreatePersonInteractor["d"]) {
    this.d = dependencies;
  }
  async execute(request: CreatePersonRequest): Promise<CreatePersonResponse> {
    const displayName = normalizeDisplayName(request.displayName);
    if (displayName === null) throw new UseCaseError("invalid-input", "a profile needs a name");
    const person = { personId: this.d.ids.next("person"), displayName, createdAt: this.d.clock.now().toISOString() };
    await this.d.people.add(person);
    return person;
  }
}

export class RenamePersonInteractor implements RenamePerson {
  private readonly people: Pick<People, "personOf" | "rename">;
  constructor(people: Pick<People, "personOf" | "rename">) {
    this.people = people;
  }
  async execute(request: RenamePersonRequest): Promise<void> {
    const displayName = normalizeDisplayName(request.displayName);
    if (displayName === null) throw new UseCaseError("invalid-input", "a profile needs a name");
    if ((await this.people.personOf(request.personId)) === null) throw new UseCaseError("not-found", request.personId);
    await this.people.rename(request.personId, displayName);
  }
}

export class ListPeopleInteractor implements ListPeople {
  private readonly people: Pick<People, "all">;
  constructor(people: Pick<People, "all">) {
    this.people = people;
  }
  async execute(): Promise<{ readonly people: readonly PersonSummary[] }> {
    const all = await this.people.all();
    return { people: all.map(({ personId, displayName, createdAt }) => ({ personId, displayName, createdAt })) };
  }
}

export class OpenPersonInteractor implements OpenPerson {
  private readonly people: Pick<People, "personOf" | "recordOpened">;
  private readonly clock: Clock;
  constructor(people: Pick<People, "personOf" | "recordOpened">, clock: Clock) {
    this.people = people;
    this.clock = clock;
  }
  async execute(request: OpenPersonRequest): Promise<PersonSummary> {
    const person = await this.people.personOf(request.personId);
    if (person === null) throw new UseCaseError("not-found", request.personId);
    await this.people.recordOpened(person.personId, this.clock.now().toISOString());
    return { personId: person.personId, displayName: person.displayName, createdAt: person.createdAt };
  }
}
