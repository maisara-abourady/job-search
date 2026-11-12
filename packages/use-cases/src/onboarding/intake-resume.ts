import {
  initialPreferences,
  resumeStrength,
  selectSellingPoints,
  suggestedSeniorityBand,
  type ProfileVersion,
  type SellingPointTier,
} from "@matchmaker/rules";
import { UseCaseError } from "../shared/errors.ts";
import type { SpendAttribution } from "../shared/metering.ts";
import type { Clock, IdGenerator } from "../shared/ports.ts";
import type { SpendingGuard } from "../shared/spending-guard.ts";
import type { DocumentReader, ProfileVersions, ResumeAnalyst, ResumeFiles, ResumeUpload, SearchRequests } from "./ports.ts";

/**
 * Application policy for intake: the upload limit and the one language v1 reads (PRD RP-1, "not in English").
 * Text too short for the reader to tell its language ("und") is read: refusing a brief resume would be worse than
 * letting the analyst read it (W21).
 */
export const INTAKE_POLICY = {
  maxUploadBytes: 10 * 1024 * 1024,
  supportedLanguage: "en",
  readUndeterminedLanguage: true,
  fixesOnCard: 3,
} as const;

/** Flow 1 steps 1 to 3; RP-1..RP-6, RP-8. Searching starts as soon as the resume parses (principle 5). */
export type IntakeResumeRequest = {
  readonly personId: string;
  readonly upload: ResumeUpload;
  /** The owner said yes to spending past the monthly budget (ADR 0015 §5, "ask first"). */
  readonly overBudgetConfirmed?: boolean;
};
/** One line of the card. `evidenceId` names the line when the person corrects it (CorrectProfile). */
export type SellingPointLine = {
  readonly evidenceId: string;
  readonly statement: string;
  readonly tier: SellingPointTier;
  readonly proof: string;
};
export type SellingPointsCard = {
  readonly points: readonly SellingPointLine[];
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
  /** On demand and uncapped: asks first once the monthly budget is reached (ADR 0015 §5). */
  readonly spending: SpendingGuard;
  /** Reader (OCR) and analyst spend is charged with purpose "intake" (ADR 0010). */
  readonly spend: SpendAttribution;
  readonly clock: Clock;
  readonly ids: IdGenerator;
};

export class IntakeResumeInteractor implements IntakeResume {
  private readonly d: IntakeResumeDependencies;
  constructor(dependencies: IntakeResumeDependencies) {
    this.d = dependencies;
  }

  async execute(request: IntakeResumeRequest): Promise<IntakeResumeResponse> {
    const { personId, upload } = request;
    if (sizeOf(upload) > INTAKE_POLICY.maxUploadBytes) {
      throw new UseCaseError("invalid-input", `the upload is larger than ${INTAKE_POLICY.maxUploadBytes / 1024 / 1024} MB`);
    }
    // On demand, never counted against a daily cap (W8: the guard is asked before anything is spent or stored).
    await this.d.spending.beforeOnDemand(personId, null, request.overBudgetConfirmed === true);
    return this.d.spend.charge({ personId, runId: null, purpose: "intake" }, () => this.intake(personId, upload));
  }

  private async intake(personId: string, upload: ResumeUpload): Promise<IntakeResumeResponse> {
    await this.d.files.store(personId, upload); // RP-8: every original is kept, even one that cannot be read
    const read = await this.d.reader.read(upload);
    if (read.outcome === "unreadable") return { outcome: "needs-pasted-text" };
    if (!isSupportedLanguage(read.language)) return { outcome: "unsupported-language", language: read.language };

    const resume = await this.d.analyst.structure(read.text);
    const [candidates, strength] = await Promise.all([
      this.d.analyst.sellingPointCandidates(resume),
      this.d.analyst.strengthRatios(resume),
    ]);
    // Nothing is invented: a candidate must cite evidence the resume holds.
    const proofs = new Map(resume.evidence.map((e) => [e.id, e.text]));
    const points = selectSellingPoints(candidates.filter((c) => proofs.has(c.evidenceId)));

    const previous = await this.d.profiles.active(personId);
    const profile: ProfileVersion = {
      profileId: previous?.profileId ?? this.d.ids.next("profile"),
      personId,
      version: (previous?.version ?? 0) + 1,
      roles: resume.roles,
      skills: resume.skills,
      credentials: resume.credentials,
      languages: resume.languages,
      evidence: resume.evidence,
      inferredSeniority: resume.inferredSeniority,
      // A re-upload keeps the person's answers; a first intake starts from defaults that invent nothing.
      preferences: previous?.preferences ?? initialPreferences(suggestedSeniorityBand(resume.inferredSeniority)),
      personal: resume.personal,
    };
    await this.d.profiles.saveNewVersion(profile, points);
    await this.d.searches.requestSearch(personId, "onboarding");

    return {
      outcome: "parsed",
      card: {
        points: points.map((p) => ({
          evidenceId: p.evidenceId,
          statement: p.statement,
          tier: p.tier,
          proof: proofs.get(p.evidenceId) ?? "",
        })),
        resumeStrength: resumeStrength(strength.ratios).total,
        topFixes: strength.topFixes.slice(0, INTAKE_POLICY.fixesOnCard),
        suggestedSeniority: resume.inferredSeniority,
      },
    };
  }
}

function sizeOf(upload: ResumeUpload): number {
  return upload.bytes?.byteLength ?? utf8Length(upload.text ?? "");
}
function utf8Length(text: string): number {
  let bytes = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
  }
  return bytes;
}
/** Readers report ISO 639-1 codes, sometimes with a region ("en-GB"). */
function isSupportedLanguage(language: string): boolean {
  if (language === "und") return INTAKE_POLICY.readUndeterminedLanguage;
  return language.toLowerCase().split(/[-_]/)[0] === INTAKE_POLICY.supportedLanguage;
}
