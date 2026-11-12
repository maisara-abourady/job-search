export type SellingPointTier = "signature" | "strong" | "supporting";
export type SellingPoint = { readonly statement: string; readonly tier: SellingPointTier; readonly evidenceId: string };

/** PRD: Selling-point tier. Three yeses Signature, two Strong, one Supporting. */
export function sellingPointTier(test: {
  quantified: boolean;
  withinLastThreeYears: boolean;
  uncommonForRole: boolean;
}): SellingPointTier | null {
  const yeses = [test.quantified, test.withinLastThreeYears, test.uncommonForRole].filter(Boolean).length;
  if (yeses === 3) return "signature";
  if (yeses === 2) return "strong";
  if (yeses === 1) return "supporting";
  return null; // not a selling point
}

/** A candidate as judged outside the rules: the three tier tests answered, citing one evidence item. */
export type SellingPointCandidate = {
  readonly statement: string;
  readonly evidenceId: string;
  readonly quantified: boolean;
  readonly withinLastThreeYears: boolean;
  readonly uncommonForRole: boolean;
};

/** PRD RP-4: the card shows 5 to 8 points. Fewer than 5 qualifying candidates means fewer points, never invented ones. */
export const SELLING_POINTS_ON_CARD = { min: 5, max: 8 } as const;
const TIER_ORDER: readonly SellingPointTier[] = ["signature", "strong", "supporting"];

/**
 * What a career coach would lead with: every candidate that earns a tier, Signature before Strong before
 * Supporting (in the order given within a tier), at most 8. Candidates with no "yes" are not selling points.
 */
export function selectSellingPoints(candidates: readonly SellingPointCandidate[]): readonly SellingPoint[] {
  const tiered = candidates.flatMap((c) => {
    const tier = sellingPointTier(c);
    return tier === null ? [] : [{ statement: c.statement, tier, evidenceId: c.evidenceId }];
  });
  return TIER_ORDER.flatMap((tier) => tiered.filter((p) => p.tier === tier)).slice(0, SELLING_POINTS_ON_CARD.max);
}
