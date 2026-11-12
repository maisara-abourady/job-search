import { notYetBuilt } from "@matchmaker/rules";
import type { SpendAttribution } from "../shared/metering.ts";
import type { InterviewTranscripts, Interviewer, ProfileVersions, RescoreRequests } from "./ports.ts";

/** IN-1..IN-5. The UI and the interview dance one question at a time (use-case boundary, §12.2). */
export type InterviewStepRequest =
  | { readonly personId: string; readonly action: "start" | "end" }
  | { readonly personId: string; readonly action: "answer"; readonly questionId: string; readonly answer: string }
  | { readonly personId: string; readonly action: "skip"; readonly questionId: string };
export type InterviewStepResponse =
  | { readonly state: "asking"; readonly questionId: string; readonly question: string; readonly number: number; readonly ofAtMost: number }
  | { readonly state: "finished"; readonly answered: number };
export interface ConductInterview {
  execute(request: InterviewStepRequest): Promise<InterviewStepResponse>;
}
export const INTERVIEW_POLICY = { minQuestions: 5, maxQuestions: 7 } as const;
export class ConductInterviewInteractor implements ConductInterview {
  private readonly d: {
    interviewer: Interviewer;
    transcripts: InterviewTranscripts;
    profiles: ProfileVersions;
    rescore: RescoreRequests;
    /** Interviewer spend is charged with purpose "interview" (ADR 0010). */
    spend: SpendAttribution;
  };
  constructor(dependencies: ConductInterviewInteractor["d"]) {
    this.d = dependencies;
  }
  async execute(_request: InterviewStepRequest): Promise<InterviewStepResponse> {
    void this.d;
    // On each answer: evidence tagged "interview-answer" (IN-4) goes into a new profile version; on finish: rescoreAll.
    return notYetBuilt("IN-1..IN-5: AI interview");
  }
}
