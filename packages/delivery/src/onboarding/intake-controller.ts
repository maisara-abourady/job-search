import type { CorrectProfile, IntakeResume, ResumeUpload } from "@matchmaker/use-cases";
import type { CorrectedPointsViewModel, OnboardingViewModel } from "./onboarding-view-model.ts";
import { presentAskFirst, presentCorrection, presentIntake } from "./selling-points-presenter.ts";

/**
 * Framework-free, like ResultsController. The route handler passes the open profile's id (chosen on screen; there is
 * no authentication, ADR 0014 §5) and serializes the view model.
 */
export class IntakeController {
  private readonly intake: IntakeResume;
  constructor(intake: IntakeResume) {
    this.intake = intake;
  }
  async upload(openPersonId: string, upload: ResumeUpload, overBudgetConfirmed = false): Promise<OnboardingViewModel> {
    try {
      return presentIntake(await this.intake.execute({ personId: openPersonId, upload, overBudgetConfirmed }));
    } catch (error) {
      if (codeOf(error) === "monthly-budget-reached") return presentAskFirst();
      throw error;
    }
  }
}

/** A corrected line from the card: a fact's text (its proof) or the point's statement. */
export type CorrectedLine = { readonly lineId: string; readonly part: "proof" | "statement"; readonly newText: string };

export class CorrectionController {
  private readonly correctProfile: CorrectProfile;
  constructor(correctProfile: CorrectProfile) {
    this.correctProfile = correctProfile;
  }
  async correct(openPersonId: string, line: CorrectedLine): Promise<CorrectedPointsViewModel> {
    const correction =
      line.part === "proof"
        ? ({ kind: "fact", evidenceId: line.lineId, newText: line.newText } as const)
        : ({ kind: "selling-point", evidenceId: line.lineId, newStatement: line.newText } as const);
    return presentCorrection(await this.correctProfile.execute({ personId: openPersonId, correction }));
  }
}

function codeOf(error: unknown): unknown {
  return typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
}
