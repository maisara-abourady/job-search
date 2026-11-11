import { notYetBuilt } from "@matchmaker/rules";
import type { AccessGuard } from "../shared/access-guard.ts";
import type { SpendAttribution } from "../shared/metering.ts";
import type { IdGenerator } from "../shared/ports.ts";
import type { GeneratedFiles, KeywordMatcher, ResumeRenderer, ResumeWriter, TailoredResumes, TailoringSources } from "./ports.ts";

/** Flow 4; TR-1..TR-5. Three steps of one dance: ask about missing keywords, generate, export. */
export type MissingKeywordsResponse = { readonly toConfirm: readonly string[] };
export type ConfirmedKeywords = { readonly have: readonly { keyword: string; whereUsed: string }[]; readonly dontHave: readonly string[] };
export type TailoredResumeResponse =
  | {
      readonly outcome: "generated";
      readonly tailoredResumeId: string;
      readonly coverageBefore: number;
      readonly coverageAfter: number;
      readonly diff: readonly { readonly kind: "added" | "removed" | "kept"; readonly text: string }[];
      readonly addedKeywords: readonly string[];
    }
  | { readonly outcome: "rejected-by-guard"; readonly violations: readonly string[] };
export interface TailorResume {
  missingKeywords(request: { userId: string; postingId: string }): Promise<MissingKeywordsResponse>;
  generate(request: { userId: string; postingId: string; confirmed: ConfirmedKeywords }): Promise<TailoredResumeResponse>;
  export(request: { userId: string; tailoredResumeId: string; format: "pdf" | "docx" }): Promise<{ fileRef: string }>;
}
export type TailorResumeDependencies = {
  readonly sources: TailoringSources;
  readonly matcher: KeywordMatcher;
  readonly writer: ResumeWriter;
  readonly renderer: ResumeRenderer;
  readonly resumes: TailoredResumes;
  readonly files: GeneratedFiles;
  readonly access: AccessGuard;
  /** Matcher and writer spend is charged with purpose "tailoring" (ADR 0010). */
  readonly spend: SpendAttribution;
  readonly ids: IdGenerator;
};
export class TailorResumeInteractor implements TailorResume {
  private readonly d: TailorResumeDependencies;
  constructor(dependencies: TailorResumeDependencies) {
    this.d = dependencies;
  }
  async missingKeywords(_r: { userId: string; postingId: string }): Promise<MissingKeywordsResponse> {
    void this.d;
    return notYetBuilt("TR-2: missing keywords to confirm");
  }
  async generate(_r: { userId: string; postingId: string; confirmed: ConfirmedKeywords }): Promise<TailoredResumeResponse> {
    // access.requireAccess(userId, "tailoredResumes"); writer.rewrite(); checkTailoredResume() must return no
    // violations or the result is rejected (and retried by the adapter at most once); keywordCoverage() before and after.
    return notYetBuilt("TR-1, TR-3, TR-4: generate tailored resume");
  }
  async export(_r: { userId: string; tailoredResumeId: string; format: "pdf" | "docx" }): Promise<{ fileRef: string }> {
    return notYetBuilt("TR-5: export");
  }
}
