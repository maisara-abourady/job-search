import type { Clock, IdGenerator } from "@matchmaker/use-cases";
import { randomUUID } from "node:crypto";

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
export class RandomIds implements IdGenerator {
  next(prefix: string): string {
    return `${prefix}_${randomUUID()}`;
  }
}
