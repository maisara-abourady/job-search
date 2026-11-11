/**
 * Monitoring runs only while the app runs (ADR 0016). The ticker is the humble timer: it runs the task once at
 * start, which is the catch-up for anything missed while the machine was off, then every `everyMs`. It holds no
 * policy: whether anyone is due, and whether the budget allows it, is decided by RunDueMonitoring.
 * A tick never overlaps the previous one; a failing tick is reported and the next one still runs.
 */
export class IntervalTicker {
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private readonly onError: (error: unknown) => void;
  constructor(onError: (error: unknown) => void) {
    this.onError = onError;
  }
  start(task: () => Promise<unknown>, everyMs: number, options: { keepProcessAlive: boolean } = { keepProcessAlive: true }): void {
    if (this.timer !== null) return;
    const tick = async () => {
      if (this.running) return;
      this.running = true;
      try {
        await task();
      } catch (e) {
        this.onError(e);
      } finally {
        this.running = false;
      }
    };
    void tick();
    this.timer = setInterval(() => void tick(), everyMs);
    if (!options.keepProcessAlive) this.timer.unref();
  }
  stop(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }
}
