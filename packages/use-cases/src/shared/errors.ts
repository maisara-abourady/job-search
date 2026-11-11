export class UseCaseError extends Error {
  readonly code: "not-found" | "access-denied" | "fair-use-exceeded" | "invalid-input";
  constructor(code: UseCaseError["code"], message: string) {
    super(message);
    this.code = code;
  }
}
