/**
 * Background work in the same process (decoupling mode: source-level, ADR 0001). Lets intake return
 * before the search finishes (principle 5). Replaced by a real queue and worker process when the trigger
 * in docs/architecture/deferred.md fires; the use cases' request ports do not change.
 */
export class InProcessWorkQueue {
  private readonly pending = new Set<Promise<void>>();
  private readonly onError: (task: string, error: unknown) => void;
  constructor(onError: (task: string, error: unknown) => void) {
    this.onError = onError;
  }
  run(task: string, work: () => Promise<unknown>): void {
    const p: Promise<void> = Promise.resolve()
      .then(work)
      .then(() => undefined, (e: unknown) => this.onError(task, e))
      .finally(() => this.pending.delete(p));
    this.pending.add(p);
  }
  /** For tests and graceful shutdown. */
  async drain(): Promise<void> {
    while (this.pending.size > 0) await Promise.all([...this.pending]);
  }
}
