import type { JobPosting, KeywordPresence, ProfileVersion, ResumeDocument, ScoringProfile } from "@matchmaker/rules";

export interface TailoringSources {
  activeProfileVersion(userId: string): Promise<ProfileVersion | null>;
  sourceResume(userId: string): Promise<ResumeDocument | null>;
  posting(postingId: string): Promise<JobPosting | null>;
  /** Keywords the user already confirmed or denied; confirmed ones are never asked again (Flow 4 step 3). */
  keywordAnswers(userId: string): Promise<readonly { keyword: string; has: boolean; whereUsed: string | null }[]>;
  saveKeywordAnswer(userId: string, answer: { keyword: string; has: boolean; whereUsed: string | null }): Promise<void>;
}
/** Synonym presence needs judgment; exact presence is decided by the rules. */
export interface KeywordMatcher {
  presence(resume: ResumeDocument, keyword: string): Promise<KeywordPresence>;
}
/** A model rewrites; the TailoringGuard in the rules decides whether the result may be shown. */
export interface ResumeWriter {
  rewrite(input: { profile: ScoringProfile; source: ResumeDocument; posting: JobPosting; confirmedKeywords: readonly { keyword: string; whereUsed: string }[] }): Promise<ResumeDocument>;
}
/** TR-5: ATS-safe single-column PDF and DOCX. */
export interface ResumeRenderer {
  render(resume: ResumeDocument, format: "pdf" | "docx"): Promise<Uint8Array>;
}
export type TailoredResumeRecord = {
  readonly id: string;
  readonly userId: string;
  readonly postingId: string;
  readonly profileVersionKey: string;
  readonly resume: ResumeDocument;
  readonly coverageBefore: number;
  readonly coverageAfter: number;
  readonly addedKeywords: readonly string[];
};
export interface TailoredResumes {
  save(record: TailoredResumeRecord): Promise<void>;
  byId(id: string): Promise<TailoredResumeRecord | null>;
}
export interface GeneratedFiles {
  put(userId: string, name: string, bytes: Uint8Array): Promise<{ fileRef: string }>;
}
