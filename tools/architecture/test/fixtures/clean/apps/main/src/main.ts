import { SystemClock } from "@matchmaker/adapters";
import { wiredScore } from "@matchmaker/use-cases/wiring";
console.log(wiredScore(new SystemClock(), 0.9));
