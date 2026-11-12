import type { ListResultsResponse, ResultCard } from "@matchmaker/use-cases";
import type { ResultCardViewModel, ResultsViewModel } from "./results-view-model.ts";

/**
 * Presentation policy for Flow 2 and the shape of encouragement: verdict first, Stretch shown as
 * "Within reach", a distance and single lever on every Within reach card, copy about the match not the person.
 */
export function presentResults(response: ListResultsResponse): ResultsViewModel {
  const applyEmpty = response.apply.length === 0;
  return {
    tabs: [
      { id: "apply", label: "Apply", countLabel: String(response.apply.length), selected: true },
      { id: "within-reach", label: "Within reach", countLabel: String(response.stretch.length), selected: false },
      { id: "not-a-fit", label: "Not a fit", countLabel: String(response.notAFitCount), selected: false },
    ],
    applyCards: response.apply.map(presentCard),
    withinReachCards: response.stretch.map(presentCard),
    emptyApplyHeading: applyEmpty ? "These are the closest roles so far, and what would move each one to Apply" : null,
    closestCards: response.closestToApply.map(presentCard),
  };
}

const BADGES: Readonly<Record<ResultCard["flags"][number], string>> = {
  "authorization-unknown": "Work authorization not stated",
  "seniority-unknown": "Level not stated",
  "thin-posting": "Thin posting",
};

export function presentCard(card: ResultCard): ResultCardViewModel {
  const label = card.verdict === "apply" ? "Apply" : card.verdict === "stretch" ? "Within reach" : "Not a fit";
  const lever = card.leverRequirement !== null ? `: confirm or build "${card.leverRequirement}"` : "";
  // Fit can already clear Apply while one Missing must-have holds the job back: then it is one step, not N points.
  const distance =
    card.verdict === "apply" || card.pointsToApply === null
      ? null
      : card.pointsToApply > 0
        ? `${card.pointsToApply} points from Apply${lever}`
        : lever !== ""
          ? `One step from Apply${lever}`
          : null;
  return {
    postingId: card.postingId,
    title: card.title,
    subtitle: `${card.employer} · ${card.location}`,
    verdictLabel: label,
    verdictTone: card.verdict === "apply" ? "positive" : card.verdict === "stretch" ? "encouraging" : "neutral",
    reason: card.reason,
    distanceLine: distance,
    badges: card.flags.map((f) => BADGES[f]),
    showChangedFlag: card.verdictChanged,
  };
}
