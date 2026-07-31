/*
 * AI Copywriting Storytelling Persona Engine
 * Formats generated copy into warm, authentic Malaysian household language
 * ("Racun Dapur Ibu" tone) tailored for Facebook storytelling and
 * Twitter hook threads.
 *
 * Phase 8: Autonomous AI Curation Engine
 * All credentials read from environment variables — no hardcoded secrets.
 */

import { Env } from "../types/env";
import { CONSTANTS } from "../config/constants";
import { logger } from "../utils/logger";
import { ProductItem } from "../types/product";
import { FallbackResult } from "./ai-fallback-router";
import { HookEntry, HookCategory } from "./vector-rag-hooks";

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export type CopyPlatform = "twitter" | "facebook" | "both";

export interface PersonaToneConfig {
  warmth: number; // 0-1, how casual/friendly
  authenticity: number; // 0-1, Malaysian household authenticity
  urgency: number; // 0-1, conversion urgency level
  storytelling: number; // 0-1, narrative style weight
}

export interface PersonaCopyOutput {
  platform: CopyPlatform;
  hook: string;
  body: string[];
  cta: string;
  hashtags: string[];
  tone: string;
  confidence: number;
}

export interface TwitterThreadOutput {
  tweet1: PersonaCopyOutput;
  tweet2: PersonaCopyOutput;
  threadId?: string;
}

export interface FacebookPostOutput {
  mainPost: PersonaCopyOutput;
  autoComment: PersonaCopyOutput;
  postId?: string;
}

export interface PersonaEngineConfig {
  defaultTone: PersonaToneConfig;
  maxBodyLines: number;
  maxHashtags: number;
  minHookLength: number;
  maxHookLength: number;
  language: "ms" | "en" | "mixed";
  fallbackToHeuristic: boolean;
}

// ---------------------------------------------------------------------------
// Default Malaysian Household Persona ("Racun Dapur Ibu")
// ---------------------------------------------------------------------------

const DEFAULT_TONE: PersonaToneConfig = {
  warmth: 0.85,
  authenticity: 0.9,
  urgency: 0.6,
  storytelling: 0.75,
};

const DEFAULT_CONFIG: PersonaEngineConfig = {
  defaultTone: DEFAULT_TONE,
  maxBodyLines: 4,
  maxHashtags: 5,
  minHookLength: 10,
  maxHookLength: 80,
  language: "ms",
  fallbackToHeuristic: true,
};

// Malaysian kitchen vocabulary for authentic tone
const MALAYSIAN_KITCHEN_VOCAB = [
  "rumah",
  "dapur",
  "masak",
  "makanan",
  "sedap",
  "lezat",
  "nikmat",
  "keluarga",
  "ibu",
  "mertua",
  "suami",
  "anak",
  "rumah tangga",
  "masak malam",
  "sarapan",
  "makan tengah hari",
  "makan malam",
  "resepi",
  "bahan",
  "segar",
  "rumput laut",
  "ikan",
  "ayam",
  "sayur",
  "peralatan",
  "dapur",
  "pembakar",
  "kuali",
  "periuk",
  "talenan",
  "pesta",
  " kenduri",
  "jamuan",
  "selamat makan",
  "nikmat",
];

// ---------------------------------------------------------------------------
// AI Persona Engine Service
// ---------------------------------------------------------------------------

export class AIPersonaEngine {
  private config: PersonaEngineConfig;
  private env: Env;
  private fallbackRouter: any; // AIFallbackRouter type imported dynamically

  constructor(
    env: Env,
    fallbackRouter: any,
    config?: Partial<PersonaEngineConfig>,
  ) {
    this.env = env;
    this.fallbackRouter = fallbackRouter;
    this.config = { ...DEFAULT_CONFIG, ...config };

    logger.info(
      "AIPersonaEngine initialized",
      {
        language: this.config.language,
        maxBodyLines: this.config.maxBodyLines,
        maxHashtags: this.config.maxHashtags,
      },
      "AIPersonaEngine",
    );
  }

  // -----------------------------------------------------------------------
  // Generate Facebook storytelling copy
  // -----------------------------------------------------------------------

  async generateFacebookCopy(
    product: ProductItem,
    hooks: HookEntry[],
    tone?: PersonaToneConfig,
  ): Promise<PersonaCopyOutput> {
    const activeTone = tone || this.config.defaultTone;
    const selectedHooks = this.selectHooksByCategory(hooks, "penceritaan");

    // Build the storytelling hook
    const hook = this.buildStorytellingHook(product, selectedHooks);

    // Build body paragraphs (warm, narrative style)
    const body = this.buildStorytellingBody(product, activeTone);

    // Build CTA with affiliate link placeholder
    const cta = this.buildFacebookCTA(product);

    // Generate hashtags
    const hashtags = this.generateHashtags(product, "facebook");

    const confidence = this.computeConfidence(product, selectedHooks);

    return {
      platform: "facebook",
      hook,
      body,
      cta,
      hashtags,
      tone: "remberdawar-storytelling",
      confidence,
    };
  }

  // -----------------------------------------------------------------------
  // Generate Twitter hook thread copy
  // -----------------------------------------------------------------------

  async generateTwitterThread(
    product: ProductItem,
    hooks: HookEntry[],
    tone?: PersonaToneConfig,
  ): Promise<TwitterThreadOutput> {
    const activeTone = tone || this.config.defaultTone;
    const selectedHooks = this.selectHooksByCategory(hooks, "penjualan");

    // Tweet 1: Visual hook (no link)
    const tweet1 = await this.buildTwitterHookTweet(
      product,
      selectedHooks,
      activeTone,
    );

    // Tweet 2: Auto-reply with affiliate CTA
    const tweet2 = this.buildTwitterReplyTweet(product, activeTone);

    const confidence = this.computeConfidence(product, selectedHooks);

    return {
      tweet1,
      tweet2,
      confidence,
    };
  }

  // -----------------------------------------------------------------------
  // Generate both-platform copy from a single product
  // -----------------------------------------------------------------------

  async generateDualPlatformCopy(
    product: ProductItem,
    hooks: HookEntry[],
    tone?: PersonaToneConfig,
  ): Promise<{ twitter: TwitterThreadOutput; facebook: PersonaCopyOutput }> {
    const [twitter, facebook] = await Promise.all([
      this.generateTwitterThread(product, hooks, tone),
      this.generateFacebookCopy(product, hooks, tone),
    ]);

    return { twitter, facebook };
  }

  // -----------------------------------------------------------------------
  // Format copy with Racun Dapur Ibu signature sign-off
  // -----------------------------------------------------------------------

  formatWithSignature(copy: string, platform: CopyPlatform): string {
    const signature =
      platform === "twitter"
        ? "\n\n— Racun Dapur Ibu 🍳"
        : "\n\n— Racun Dapur Ibu 💛";
    return copy + signature;
  }

  // -----------------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------------

  private selectHooksByCategory(
    hooks: HookEntry[],
    category: HookCategory,
  ): HookEntry[] {
    return hooks
      .filter((h) => h.category === category)
      .sort((a, b) => b.performanceScore - a.performanceScore)
      .slice(0, 3);
  }

  private buildStorytellingHook(
    product: ProductItem,
    hooks: HookEntry[],
  ): string {
    if (hooks.length > 0 && hooks[0].hook) {
      return hooks[0].hook;
    }

    // Fallback heuristic hook
    const title = product.title;
    const fallbackHooks = [
      `Pernah tak rasa macam ni? ${title} ni memang game changer!`,
      `Cerita dulu ni — ${title} ni solusi dapur aku sehari-hari.`,
      `Jangan lepaskan ini! ${title} ni buat hidup lebih senang.`,
      `Aku terkejut dengan ${title} ni — kena cuba!`,
    ];
    return fallbackHooks[Math.floor(Math.random() * fallbackHooks.length)];
  }

  private buildStorytellingBody(
    product: ProductItem,
    tone: PersonaToneConfig,
  ): string[] {
    const lines: string[] = [];

    // Line 1: Personal story opener
    lines.push(
      `Kalau nak cerita, aku memang tak sangka ${product.title} ni boleh ubah cara aku masak sehari-hari.`,
    );

    // Line 2: Product benefit
    const price = this.extractPrice(product.price);
    if (price > 0) {
      lines.push(
        `Harga RM${price.toFixed(2)} ni memang sepadan dengan kualiti yang diberi — nilai terbaik untuk dapur keluarga.`,
      );
    }

    // Line 3: Emotional connection
    lines.push(
      `Setiap kali guna ni, rasa macam ada tenaga tambahan untuk masak untuk keluarga tercinta.`,
    );

    // Line 4: Recommendation
    lines.push(
      `Kalau kau nak kemas dapur dengan satu barang yang paling bermanfaat, ini satu yang patut kau ambil perhatian.`,
    );

    return lines.slice(0, this.config.maxBodyLines);
  }

  private buildFacebookCTA(product: ProductItem): string {
    return `Klik pautan di bawah untuk dapatkan ${product.title} dengan harga terbaik hari ini! Jangan tunda — stok terhad! 🛒`;
  }

  private buildTwitterHookTweet(
    product: ProductItem,
    hooks: HookEntry[],
    tone: PersonaToneConfig,
  ): PersonaCopyOutput {
    const hook =
      hooks.length > 0
        ? hooks[0].hook
        : `Tengok ni! ${product.title} — ini yang dapur kita perlukan.`;

    return {
      platform: "twitter",
      hook,
      body: [product.title],
      cta: "", // No link in Tweet 1 per dual-posting protocol
      hashtags: this.generateHashtags(product, "twitter"),
      tone: "remberdawar-hook",
      confidence: 0.8,
    };
  }

  private buildTwitterReplyTweet(
    product: ProductItem,
    tone: PersonaToneConfig,
  ): PersonaCopyOutput {
    return {
      platform: "twitter",
      hook: `Ini dia pautan untuk ${product.title} — harga istimewa hari ini sahaja!`,
      body: ["Dapatkan sekarang sebelum kehabisan!"],
      cta: "Pautan affiliate di bio 👇",
      hashtags: this.generateHashtags(product, "twitter"),
      tone: "remberdawar-cta",
      confidence: 0.85,
    };
  }

  private generateHashtags(
    product: ProductItem,
    platform: "twitter" | "facebook",
  ): string[] {
    const baseTags = ["#RacunDapurIbu", "#DapurIbu", "#KitchenDeals"];

    const categoryTags: Record<string, string[]> = {
      kitchen: ["#Dapur", "#Masak", "#PeralatanDapur"],
      baby: ["#BarangBayi", "#BabyEssentials", "#IbuMertua"],
      skincare: ["#Kecantikan", "#Skincare", "#RambutSehat"],
    };

    const category = product.title.toLowerCase();
    let tags = [...baseTags];

    if (category.includes("bayi") || category.includes("baby")) {
      tags.push(...(categoryTags.baby || []));
    } else if (
      category.includes("skincare") ||
      category.includes("kecantikan")
    ) {
      tags.push(...(categoryTags.skincare || []));
    } else {
      tags.push(...(categoryTags.kitchen || []));
    }

    return tags.slice(0, this.config.maxHashtags);
  }

  private extractPrice(priceStr?: string): number {
    if (!priceStr) return 0;
    const cleaned = priceStr.replace(/[^0-9.]/g, "");
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }

  private computeConfidence(product: ProductItem, hooks: HookEntry[]): number {
    let confidence = 0.5;

    if (product.title && product.title.length > 5) confidence += 0.1;
    if (product.rating) {
      const rating = parseFloat(product.rating);
      if (rating >= 4) confidence += 0.15;
    }
    if (hooks.length > 0) confidence += 0.15;
    if (product.discountRate) {
      const discount = this.parseDiscount(product.discountRate);
      if (discount >= 30) confidence += 0.1;
    }

    return Math.min(0.95, confidence);
  }

  private parseDiscount(discountStr?: string): number {
    if (!discountStr) return 0;
    const cleaned = discountStr.replace(/[^0-9.]/g, "");
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }
}

// ---------------------------------------------------------------------------
// Factory helper
// ---------------------------------------------------------------------------

export function createAIPersonaEngine(
  env: Env,
  fallbackRouter: any,
): AIPersonaEngine {
  return new AIPersonaEngine(env, fallbackRouter, {
    language: (env.PERSONA_LANGUAGE as "ms" | "en" | "mixed") || "ms",
    maxBodyLines: parseInt(env.PERSONA_MAX_BODY_LINES || "4", 10),
    maxHashtags: parseInt(env.PERSONA_MAX_HASHTAGS || "5", 10),
    fallbackToHeuristic: env.PERSONA_FALLBACK !== "false",
  });
}
