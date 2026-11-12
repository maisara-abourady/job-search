import { performance } from "node:perf_hooks";
import type { Clock } from "@matchmaker/use-cases";
export class SystemClock implements Clock { now(): Date { return new Date(performance.timeOrigin + performance.now()); } }
