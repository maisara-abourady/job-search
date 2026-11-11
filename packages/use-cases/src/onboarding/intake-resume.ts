import { notYetBuilt } from "@matchmaker/rules";
import type { Clock, IdGenerator } from "../shared/ports.ts";
import type { DocumentReader, ProfileVersions, ResumeAnalyst, ResumeFiles, ResumeUpload, SearchRequests } from "./ports.ts";

/** Flow 1 steps 1 to 3; RP-1..RP-6, RP-8. Searching starts as soon as the resume parses (principle 5). */
export type IntakeResumeRequest = { readonly userId: string; readonly upload: ResumeUpload };
export type SellingPointsCard = {
  readonly points: readonly { readonly statement: string; readonly tier: "signature" | "strong" | "supporting"; readonly proof: string }[];
  readonly resumeStrength: number;
  readonly topFixes: readonly string[];
  readonly suggestedSeniority: string | null;
};
export type IntakeResumeResponse =
  | { readonly outcome: "parsed"; readonly card: SellingPointsCard }
  | { readonly outcome: "needs-pasted-text" }
  | { readonly outcome: "unsupported-language"; readonly language: string };
export interface IntakeResume {
  execute(request: IntakeResumeRequest): Promise<IntakeResumeResponse>;
}
export type IntakeResumeDependencies = {
  readonly reader: DocumentReader;
  readonly analyst: ResumeAnalyst;
  readonly files: ResumeFiles;
  readonly profiles: ProfileVersions;
  readonly searches: SearchRequests;
  readonly clock: Clock;
  readonly ids: IdGenerator;
};
export class IntakeResumeInteractor implements IntakeResume {
  private readonly d: IntakeResumeDependencies;
  constructor(dependencies: IntakeResumeDependencies) {
    this.d = dependencies;
  }
  async execute(_request: IntakeResumeRequest): Promise<IntakeResumeResponse> {
    void this.d;
    // Steps: store file; read (OCR inside the reader); stop if not English; structure; tier selling points with
    // sellingPointTier(); resumeStrength(); save a new ProfileVersion with inferred defaults; requestSearch("onboarding").
    return notYetBuilt("RP-1..RP-6: resume intake");
  }
}
