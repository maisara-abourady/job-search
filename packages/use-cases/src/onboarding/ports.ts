import type {
  Credential, Evidence, EvidencedSkill, ProfileVersion, ResumeStrengthRatios, RoleHeld, ScoringProfile, SellingPoint, SeniorityLevel,
} from "@matchmaker/rules";

export type ResumeUpload = {
  readonly kind: "pdf" | "docx" | "text" | "linkedin-pdf";
  readonly fileName: string;
  readonly bytes: Uint8Array | null; // null when kind is "text"
  readonly text: string | null;
};
/** RP-1, RP-3: text extraction including OCR for image-only PDFs. */
export type ReadDocumentResult =
  | { readonly outcome: "read"; readonly text: string; readonly language: string }
  | { readonly outcome: "unreadable" };
export interface DocumentReader {
  read(upload: ResumeUpload): Promise<ReadDocumentResult>;
}
/** RP-2, RP-4, RP-5, RP-6: judgment-backed analysis of resume text. */
export type StructuredResume = {
  readonly roles: readonly RoleHeld[];
  readonly skills: readonly EvidencedSkill[];
  readonly credentials: readonly Credential[];
  readonly languages: readonly string[];
  readonly evidence: readonly Evidence[];
  readonly inferredSeniority: SeniorityLevel | null;
  readonly personal: ProfileVersion["personal"];
};
export interface ResumeAnalyst {
  structure(text: string): Promise<StructuredResume>;
  /** Selling-point candidates with the three tier tests answered; the rules assign the tier. */
  sellingPointCandidates(resume: StructuredResume): Promise<readonly { statement: string; evidenceId: string; quantified: boolean; withinLastThreeYears: boolean; uncommonForRole: boolean }[]>;
  strengthRatios(resume: StructuredResume): Promise<{ ratios: ResumeStrengthRatios; topFixes: readonly string[] }>;
}
/** IN-1, IN-2: adaptive questions from gaps and ambiguities. */
export type InterviewQuestion = { readonly id: string; readonly text: string; readonly topic: "unlisted-skills" | "unquantified-achievements" | "scope" | "target-roles" | "roles-to-avoid" | "projects-and-education" | "target-field" };
export type InterviewTurn = { readonly question: InterviewQuestion; readonly answer: string | null };
export interface Interviewer {
  nextQuestion(profile: ScoringProfile, transcript: readonly InterviewTurn[]): Promise<InterviewQuestion | null>;
  evidenceFrom(turn: InterviewTurn): Promise<readonly Evidence[]>;
}

export interface ResumeFiles {
  store(userId: string, upload: ResumeUpload): Promise<{ resumeId: string; version: number }>;
}
export interface ProfileVersions {
  active(userId: string): Promise<ProfileVersion | null>;
  /** Saves a new immutable version and makes it active. */
  saveNewVersion(profile: ProfileVersion, sellingPoints: readonly SellingPoint[]): Promise<void>;
  sellingPoints(userId: string): Promise<readonly SellingPoint[]>;
}
export interface InterviewTranscripts {
  transcript(userId: string): Promise<readonly InterviewTurn[]>;
  append(userId: string, turn: InterviewTurn): Promise<void>;
}

/** Onboarding asks for work it does not do itself. Main wires these to discovery and matching. */
export interface SearchRequests {
  requestSearch(userId: string, trigger: "onboarding" | "manual"): Promise<void>;
}
export interface RescoreRequests {
  rescoreAll(userId: string): Promise<void>;
}
