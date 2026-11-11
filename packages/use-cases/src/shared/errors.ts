export class UseCaseError extends Error {
  /**
   * "daily-cap-reached": the profile used today's on-demand allowance (PRD Running cost, daily caps).
   * "monthly-budget-reached": the owner's monthly budget is spent. On-demand actions may be resent with
   * `overBudgetConfirmed: true` once the owner agrees (the UI asks first); scheduled work is not.
   */
  readonly code: "not-found" | "invalid-input" | "daily-cap-reached" | "monthly-budget-reached";
  constructor(code: UseCaseError["code"], message: string) {
    super(message);
    this.code = code;
  }
}
