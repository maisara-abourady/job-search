import type { ResumeAnalyst, SpendMeter, StructuredResume } from "@matchmaker/use-cases";
import { aCandidate, aStrengthAnswer, aStructuredResume, type SellingPointCandidate, type StrengthAnswer } from "./builders.ts";

/**
 * The testing API's ResumeAnalyst: answers what a test scripted, records the texts it was given, and reports the
 * scripted spend through the meter once per structured resume. The ResumeAnalyst contract runs against it.
 */
export class ScriptedResumeAnalyst implements ResumeAnalyst {
  private script: { structured: StructuredResume; candidates: readonly SellingPointCandidate[]; strength: StrengthAnswer } = {
    structured: aStructuredResume(),
    candidates: [aCandidate("ev-1", 3), aCandidate("ev-2", 2), aCandidate("ev-3", 2), aCandidate("ev-1", 1), aCandidate("ev-2", 1)],
    strength: aStrengthAnswer(),
  };
  private spendMicros = 0;
  readonly received: string[] = [];
  private readonly meter: SpendMeter;
  constructor(meter: SpendMeter) {
    this.meter = meter;
  }
  willSay(o: { structured?: StructuredResume; candidates?: readonly SellingPointCandidate[]; strength?: StrengthAnswer }): this {
    this.script = { ...this.script, ...o };
    return this;
  }
  costs(micros: number): this {
    this.spendMicros = micros;
    return this;
  }
  async structure(text: string): Promise<StructuredResume> {
    this.received.push(text);
    if (this.spendMicros > 0) await this.meter.record({ category: "model", provider: "scripted-analyst", amountMicros: this.spendMicros });
    return this.script.structured;
  }
  async sellingPointCandidates(): Promise<readonly SellingPointCandidate[]> {
    return this.script.candidates;
  }
  async strengthRatios(): Promise<StrengthAnswer> {
    return this.script.strength;
  }
}
