import { verdictOf } from "@matchmaker/rules";
import type { Clock } from "../shared/ports.ts";
export const score = (clock: Clock, s: number): string => `${clock.now().toISOString()} ${verdictOf(s)}`;
