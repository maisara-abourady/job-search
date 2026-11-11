/** Marks a rule or use case whose structure is fixed but whose body is still to be written. */
export function notYetBuilt(requirementId: string): never {
  throw new Error(`Not yet built: ${requirementId}`);
}
