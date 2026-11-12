import { franc } from "franc-min";

/** franc reports ISO 639-3; the port speaks ISO 639-1. Languages outside this table are reported in 639-3, which is never "en". */
const ISO_639_1: Record<string, string> = {
  eng: "en",
  fra: "fr",
  deu: "de",
  spa: "es",
  por: "pt",
  ita: "it",
  nld: "nl",
  pol: "pl",
  ron: "ro",
  rus: "ru",
  ukr: "uk",
  tur: "tr",
  arb: "ar",
  cmn: "zh",
  jpn: "ja",
  kor: "ko",
  hin: "hi",
  ind: "id",
  vie: "vi",
  swe: "sv",
};

/**
 * The language a resume is written in, or "und" when the text is too short to tell. What to accept is the use
 * case's policy (ADR 0017 decision 4, W21); this only reports.
 */
export function detectLanguage(text: string): string {
  const code = franc(text, { minLength: 20 });
  return code === "und" ? "und" : (ISO_639_1[code] ?? code);
}
