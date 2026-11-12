import type {
  Credential,
  Evidence,
  EvidencedSkill,
  ProfileVersion,
  ResumeStrengthRatios,
  RoleHeld,
  ScoringProfile,
  SellingPoint,
  SellingPointCandidate,
  SeniorityLevel,
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
  sellingPointCandidates(resume: StructuredResume): Promise<readonly SellingPointCandidate[]>;
  strengthRatios(resume: StructuredResume): Promise<{ ratios: ResumeStrengthRatios; topFixes: readonly string[] }>;
}
/** IN-1, IN-2: adaptive questions from gaps and ambiguities. */
export type InterviewQuestion = {
  readonly id: string;
  readonly text: string;
  readonly topic:
    | "unlisted-skills"
    | "unquantified-achievements"
    | "scope"
    | "target-roles"
    | "roles-to-avoid"
    | "projects-and-education"
    | "target-field";
};
export type InterviewTurn = { readonly question: InterviewQuestion; readonly answer: string | null };
export interface Interviewer {
  nextQuestion(profile: ScoringProfile, transcript: readonly InterviewTurn[]): Promise<InterviewQuestion | null>;
  evidenceFrom(turn: InterviewTurn): Promise<readonly Evidence[]>;
}

/** RP-8: every upload is kept as its own version; nothing is overwritten. */
export interface ResumeFiles {
  store(personId: string, upload: ResumeUpload): Promise<{ resumeId: string; version: number }>;
  /** The original as uploaded, or null if this person has no such resume (tailoring and export read it back). */
  original(personId: string, resumeId: string): Promise<ResumeUpload | null>;
}
export interface ProfileVersions {
  active(personId: string): Promise<ProfileVersion | null>;
  /** Saves a new immutable version and makes it active. */
  saveNewVersion(profile: ProfileVersion, sellingPoints: readonly SellingPoint[]): Promise<void>;
  sellingPoints(personId: string): Promise<readonly SellingPoint[]>;
}
export interface InterviewTranscripts {
  transcript(personId: string): Promise<readonly InterviewTurn[]>;
  append(personId: string, turn: InterviewTurn): Promise<void>;
}

/** Onboarding asks for work it does not do itself. Main wires these to discovery and matching. */
export interface SearchRequests {
  requestSearch(personId: string, trigger: "onboarding" | "manual"): Promise<void>;
}
export interface RescoreRequests {
  rescoreAll(personId: string): Promise<void>;
}
