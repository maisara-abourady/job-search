/** Ports every area may use. Owned by the use cases; implemented in adapters; wired in Main. */
export interface Clock {
  now(): Date;
}
export interface IdGenerator {
  next(prefix: string): string;
}
