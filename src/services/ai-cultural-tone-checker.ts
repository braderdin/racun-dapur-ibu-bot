/**
 * AI Cultural Tone Checker Service
 * Phase 19: Deep AI Cultural Tone Tuning
 *
 * Local Malaysian Malay tone validator ensuring friendly household copywriting
 * ("sis", "mami", "kuali anti-lengkat") with cultural fit scoring (0.0 to 1.0)
 * and blocking stiff translations.
 */

import { z } from "zod";

// Zod schema for tone validation result
export const ToneValidationSchema = z.object({
  score: z.number().min(0).max(1),
  keywordsFound: z.array(z.string()),
  suggestion: z.string(),
  flaggedWords: z.array(z.string()),
  isCulturallyFit: z.boolean(),
});

export type ToneValidationResult = z.infer<typeof ToneValidationSchema>;

// Authentic "Racun Dapur Ibu" Malaysian Malay keywords
const MALAYSIAN_HOUSEHOLD_KEYWORDS = [
  // Family & Care Terms
  "ibu",
  "mami",
  "adik",
  "kakak",
  "kakip",
  "sapu",
  "tukar",
  "kuali",
  "kotak makan",
  "pinggan",
  "senduk",
  "sendok",
  "garpu",
  "pisau",
  "cukur",
  "memotong",
  "menggiling",
  "mengupas",
  "mencampur",

  // Kitchen & Cooking Terms
  "dapur",
  "masak",
  "memasak",
  "kawal",
  "api",
  "kompor",
  "magnetik",
  "kecil",
  "besar",
  "panas",
  "dingin",
  "lecek",
  "kacau",
  "kacau",

  // Product-Specific Terms
  "anti-lengkat",
  "lengkap",
  "set",
  "pasangan",
  "guna",
  "tahan",
  "berkesan",
  "berkualitas",
  "mesra",
  "mesra",
  "senang",
  "mudah",

  // Emotional & Relatable Terms
  "syukur",
  "teruja",
  "gembira",
  "senang",
  "lega",
  "tenang",
  "selesa",
  "nyaman",
  "rasa",
  "rasa",
  "lelah",
  "kembali",

  // Affordability Terms
  "murah",
  "diskaun",
  "special",
  "jual",
  "beli",
  "hemat",
  "bajet",
  "ringkas",
  "berkesan",
  "tikar",
  "lengkap",
];

// Foreign/English slang to filter out (stiff translations)
const FOREIGN_SLANG_BLACKLIST = [
  // Common stiff translation patterns
  "awesome",
  "amazing",
  "incredible",
  "fantastic",
  "brilliant",
  "perfect",
  "excellent",
  "outstanding",
  "super",
  "ultra",
  "premium",
  "deluxe",
  "pro",
  "advanced",
  "enhanced",
  "revolutionary",
  "innovative",
  "cutting-edge",
  "state-of-the-art",
  "guarantee",
  "warranty",
  "certified",
  "authentic",
  "genuine",
  "limited edition",
  "exclusive",
  "special offer",
  "deal",
  "click here",
  "shop now",
  "buy now",
  "order today",
  "discount",
  "sale",
  "off",
  "reduced",
  "clearance",
  "free shipping",
  "fast delivery",
  "express",
  "overnight",
  "new",
  "latest",
  "updated",
  "improved",
  "upgraded",
  "best seller",
  "top rated",
  "customer favorite",
  "popular",
  "trending",
  "viral",
  "hot",
  "cool",
  "fire",
];

// Cultural tone patterns (regex patterns for authentic Malay expressions)
const CULTURAL_TONE_PATTERNS = [
  // Family-oriented expressions
  /\b(ayah|ibu|mami|adik|kakak)\b/i,
  // Kitchen/household context
  /\b(dapur|kuali|pinggan|senduk|sendok|garpu)\b/i,
  // Emotional/relatable expressions
  /\b(syukur|teruja|gembira|senang|lega|tenang|selesa|nyaman)\b/i,
  // Affordability focus
  /\b(murah|diskaun|hemat|bajet|ringkas)\b/i,
  // Action-oriented household terms
  /\b(masak|memasak|kawal|api|kompor|upas|kacau|campur)\b/i,
];

// Minimum required keywords for cultural fit
const MIN_KEYWORD_THRESHOLD = 3;

// Score thresholds
const CULTURAL_FIT_THRESHOLD = 0.6;
const HIGH_FIT_THRESHOLD = 0.8;

/**
 * Evaluate Malaysian tone of copywriting
 * Returns cultural fit score and suggestions
 */
export function evaluateMalaysianTone(copy: string): ToneValidationResult {
  const normalizedCopy = copy.toLowerCase();

  // Find keywords present in the copy
  const keywordsFound: string[] = [];
  for (const keyword of MALAYSIAN_HOUSEHOLD_KEYWORDS) {
    if (normalizedCopy.includes(keyword)) {
      keywordsFound.push(keyword);
    }
  }

  // Find flagged foreign slang
  const flaggedWords: string[] = [];
  for (const slang of FOREIGN_SLANG_BLACKLIST) {
    if (normalizedCopy.includes(slang)) {
      flaggedWords.push(slang);
    }
  }

  // Calculate cultural fit score
  const keywordScore = Math.min(
    keywordsFound.length / MIN_KEYWORD_THRESHOLD,
    1,
  );
  const flaggedPenalty = flaggedWords.length > 0 ? 0.3 : 0;
  const patternMatchScore =
    CULTURAL_TONE_PATTERNS.filter((pattern) => pattern.test(copy)).length /
    CULTURAL_TONE_PATTERNS.length;

  let score =
    (keywordScore * 0.5 + patternMatchScore * 0.5) * (1 - flaggedPenalty);
  score = Math.max(0, Math.min(1, score));

  // Determine if culturally fit
  const isCulturallyFit = score >= CULTURAL_FIT_THRESHOLD;

  // Generate suggestion
  let suggestion = "";
  if (!isCulturallyFit) {
    suggestion = generateToneSuggestion(keywordsFound, flaggedWords, copy);
  } else if (score < HIGH_FIT_THRESHOLD) {
    suggestion =
      "Add more authentic Malay household terms for better cultural resonance.";
  } else {
    suggestion = "Copywriting has strong cultural fit. Ready for posting.";
  }

  return {
    score,
    keywordsFound,
    suggestion,
    flaggedWords,
    isCulturallyFit,
  };
}

/**
 * Filter foreign slang from copy
 * Returns clean copy with flag count
 */
export function filterForeignSlang(copy: string): {
  cleanCopy: string;
  flagCount: number;
} {
  let cleanCopy = copy;
  let flagCount = 0;

  for (const slang of FOREIGN_SLANG_BLACKLIST) {
    const regex = new RegExp(`\\b${slang}\\b`, "gi");
    if (regex.test(cleanCopy)) {
      flagCount++;
      // Replace with placeholder or remove
      cleanCopy = cleanCopy.replace(regex, "");
    }
  }

  // Clean up extra whitespace
  cleanCopy = cleanCopy.replace(/\s+/g, " ").trim();

  return { cleanCopy, flagCount };
}

/**
 * Generate tone improvement suggestion
 */
function generateToneSuggestion(
  keywordsFound: string[],
  flaggedWords: string[],
  copy: string,
): string {
  const suggestions: string[] = [];

  if (flaggedWords.length > 0) {
    suggestions.push(
      `Hindari gaya 'Western' seperti "${flaggedWords.slice(0, 3).join(", ")}". Gunakan nada lebih mesra rumah tangga.`,
    );
  }

  if (keywordsFound.length < MIN_KEYWORD_THRESHOLD) {
    const missingKeywords = MALAYSIAN_HOUSEHOLD_KEYWORDS.filter(
      (k) => !keywordsFound.includes(k),
    ).slice(0, 5);
    suggestions.push(
      `Tambahkan istilah seperti "${missingKeywords.join(", ")}" untuk nada yang lebih autentik.`,
    );
  }

  if (copy.length < 50) {
    suggestions.push(
      "Tambahkan detail produk atau manfaat untuk membaca yang lebih menarik.",
    );
  }

  return suggestions.join(" | ");
}

/**
 * Batch validate multiple copy texts
 */
export function batchValidateTone(copies: string[]): ToneValidationResult[] {
  return copies.map((copy) => evaluateMalaysianTone(copy));
}

/**
 * Get cultural fit percentage for reporting
 */
export function getCulturalFitPercentage(
  results: ToneValidationResult[],
): number {
  if (results.length === 0) return 0;
  const fitCount = results.filter((r) => r.isCulturallyFit).length;
  return (fitCount / results.length) * 100;
}

/**
 * Calculate average tone score
 */
export function getAverageToneScore(results: ToneValidationResult[]): number {
  if (results.length === 0) return 0;
  const total = results.reduce((sum, r) => sum + r.score, 0);
  return total / results.length;
}

// Export default for convenience
export default {
  evaluateMalaysianTone,
  filterForeignSlang,
  batchValidateTone,
  getCulturalFitPercentage,
  getAverageToneScore,
  MALAYSIAN_HOUSEHOLD_KEYWORDS,
  FOREIGN_SLANG_BLACKLIST,
};
