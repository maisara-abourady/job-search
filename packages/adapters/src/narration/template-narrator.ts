import type { MatchNarrator, Narration } from "@matchmaker/use-cases";

type NarrationInput = Parameters<MatchNarrator["narrate"]>[0];

/**
 * A deterministic narrator: one plain sentence per verdict, describing the match and never the person.
 * Good enough to ship behind the port; a model-written narrator can replace it without touching scoring.
 */
export class TemplateNarrator implements MatchNarrator {
  async narrate({ posting, assessment }: NarrationInput): Promise<Narration> {
    const reason = (() => {
      switch (assessment.primaryReason) {
        case "work-authorization": return `This role asks for work authorization in ${posting.country ?? "its country"} and does not offer sponsorship.`;
        case "seniority-mismatch": return `This role is at ${posting.seniority ?? "a different"} level, outside the levels you are targeting.`;
        case "missing-must-haves": return "This role asks for several must-haves your profile does not show yet.";
        case "low-overall-fit": return "This role overlaps only partly with your experience.";
        case "low-relevance": return "This role was outside the closest matches to your profile in this search.";
        case "poor-posting": return "This posting is stale, thin, or hard to verify.";
        case "unsupported-language": return "This posting is not in English, which v1 does not support.";
        case null:
          return assessment.verdict === "apply"
            ? `Your experience covers what ${posting.employer} asks for in this role.`
            : `You are close: this role asks for one or two things your profile does not show yet.`;
      }
    })();
    const met = assessment.judgments.filter((j) => j.judgment === "met" && j.evidenceIds.length > 0).slice(0, 3);
    const pointsToCapitalize =
      assessment.verdict === "not-a-fit"
        ? []
        : met.map((j) => ({ point: posting.requirements.find((r) => r.id === j.requirementId)?.text ?? j.requirementId, evidenceId: j.evidenceIds[0]! }));
    return { reason, pointsToCapitalize };
  }
}
