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
