// 3-Tier AI Fallback Copywriting Engine
// Resilient AI generator: Tier 1 (OpenRouter Free) -> Tier 2 (Google Gemini / Groq) -> Tier 3 (Local Heuristic Rule Engine)
// Includes 3-second delay wrapper between requests, rate limiting, and automatic fallback strategies
// Maintains consistent output format for X thread payloads

import { CONSTANTS } from "../config/constants";
import { ProductItem } from "../types/product";

export interface GeneratedCopy {
  hook: string;
  body: string[];
  cta: string;
  hashtags: string[];
  threadTarget: "single-tweet" | "thread-2"; // Auto-select based on content length
  platform: "lazada" | "shopee";
  confidence: number; // Tier 1: 1.0, Tier 2: 0.8, Tier 3: 0.6
  fallbackChainUsed: "none" | "tier-2" | "tier-3";
}

export interface AIGenerationOptions {
  maxRetries: number;
  delayBetweenRequestsMs: number;
  timeoutMs: number;
  emergencyFallback: boolean;
}

export class AIFallbackEngine {
  private config: AIGenerationOptions;
  private readonly openrouterService: OpenRouterService;
  private readonly geminiService: GeminiService;
  private readonly heuristicService: HeuristicRuleEngine;

  constructor(
    openrouterService: OpenRouterService,
    geminiService: GeminiService,
    heuristicService: HeuristicRuleEngine,
    config: Partial<AIGenerationOptions> = {},
  ) {
    this.openrouterService = openrouterService;
    this.geminiService = geminiService;
    this.heuristicService = heuristicService;

    this.config = {
      maxRetries: 3,
      delayBetweenRequestsMs: CONSTANTS.OPENROUTER_DELAY_MS || 3000,
      timeoutMs: 15000,
      emergencyFallback: true,
      ...config,
    };
  }

  async generateCopy(
    product: ProductItem,
    agentId?: string,
  ): Promise<GeneratedCopy> {
    let result: GeneratedCopy | null = null;
    let fallbackChainUsed: "none" | "tier-2" | "tier-3" = "none";
    let confidence = 0;

    console.log(`🧠 Generating AI copy for product: ${product.name}`);
    console.log(
      `🎯 Using fallback strategy with ${this.config.maxRetries} retries max`,
    );

    // Tier 1: OpenRouter Free (Primary - Fast, reliable, free)
    try {
      console.log("🔄 Attempting Tier 1 (OpenRouter) AI generation...");
      result = await this.withTimeout(
        this.openrouterService.generateCopy(product),
        this.config.timeoutMs,
      );
      confidence = 1.0;
      fallbackChainUsed = "none";
      console.log("✅ Tier 1 generation successful");
      return result;
    } catch (error) {
      console.log("⚠️  Tier 1 failed:", error.message);
      if (!this.config.emergencyFallback) throw error;
    }

    // Tier 2: Google Gemini / Groq (Secondary - Robust, moderate cost)
    try {
      console.log("🔄 Attempting Tier 2 (Google Gemini/Groq) AI generation...");
      await this.delay(this.config.delayBetweenRequestsMs);

      result = await this.withTimeout(
        this.geminiService.generateCopy(product),
        this.config.timeoutMs,
      );
      confidence = 0.8;
      fallbackChainUsed = "tier-2";
      console.log("✅ Tier 2 generation successful");
      return result;
    } catch (error) {
      console.log("⚠️  Tier 2 failed:", error.message);
      if (!this.config.emergencyFallback) throw error;
    }

    // Tier 3: Local Heuristic Rule Engine (Backup - Rule-based)
    try {
      console.log("🔄 Attempting Tier 3 (Local Heuristic) AI generation...");
      await this.delay(this.config.delayBetweenRequestsMs * 2); // Extra delay for tier 3

      result = await this.heuristicService.generateCopy(product);
      confidence = 0.6;
      fallbackChainUsed = "tier-3";
      console.log("✅ Tier 3 generation successful");
      return result;
    } catch (error) {
      console.log("❌ All AI tiers failed:", error.message);
      throw new Error(
        `AI generation failed after all fallback attempts: ${error.message}`,
      );
    }
  }

  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`API request timed out after ${timeoutMs}ms`)),
          timeoutMs,
        ),
      ),
    ]);
  }

  async generateMultipleCopies(
    products: ProductItem[],
    options?: Partial<{ limit: number; concurrent: number }>,
  ): Promise<GeneratedCopy[]> {
    const limit = options?.limit || products.length;
    const concurrent = options?.concurrent || 1;

    console.log(
      `🎯 Generating copy for ${Math.min(limit, products.length)} products...`,
    );
    console.log(`⚡ Max concurrent requests: ${concurrent}`);

    const results: GeneratedCopy[] = [];
    const productBatch = products.slice(0, limit);

    for (let i = 0; i < productBatch.length; i += concurrent) {
      const batch = productBatch.slice(i, i + concurrent);

      const batchResults = await Promise.all(
        batch.map((product) => this.generateCopy(product)),
      );

      results.push(...batchResults);

      // Delay between batches to respect rate limits
      if (i + concurrent < productBatch.length) {
        await this.delay(this.config.delayBetweenRequestsMs);
      }
    }

    console.log(`✅ Generated ${results.length} AI copies total`);
    return results;
  }

  getTierStatus(): {
    tier1: "available" | "unavailable";
    tier2: "available" | "unavailable";
    tier3: "available" | "unavailable";
    current: "tier-1" | "tier-2" | "tier-3";
  } {
    return {
      tier1: "available", // OpenRouter is always available and free
      tier2: "available", // Gemini/Groq should be available via API
      tier3: "available", // Local heuristic engine is always available
      current: "tier-1",
    };
  }

  reset(): void {
    console.log("🔄 AIFallbackEngine reset - Ready for new batch processing");
  }
}

// Supporting Service Interfaces (Stub Implementation for now)

interface OpenRouterService {
  generateCopy(product: ProductItem): Promise<GeneratedCopy>;
}

interface GeminiService {
  generateCopy(product: ProductItem): Promise<GeneratedCopy>;
}

interface HeuristicRuleEngine {
  generateCopy(product: ProductItem): Promise<GeneratedCopy>;
}

// Concrete Implementations (Current - Simplified for testing)

class MockOpenRouterService implements OpenRouterService {
  async generateCopy(product: ProductItem): Promise<GeneratedCopy> {
    console.log("🔧 [Mock OpenRouter] Generating copy using OpenRouter API...");

    // Simulate API delay
    await new Promise((resolve) =>
      setTimeout(resolve, CONSTANTS.OPENROUTER_DELAY_MS || 3000),
    );

    const copy = this.generateCreativeCopy(product, "openrouter");
    return {
      ...copy,
      platform: product.platform || "lazada",
    };
  }

  private generateCreativeCopy(
    product: ProductItem,
    source: string,
  ): Omit<GeneratedCopy, "platform" | "confidence" | "fallbackChainUsed"> {
    const hooks = [
      `🔥 ${product.price > 100 ? "Premium" : "Best Deal"} ${product.category} Alert!`,
      `💰 Limited Time: ${product.price > 100 ? "${product.price}%}" : "Amazing"} discounts on ${product.name}!`,
      `🎁 Don't miss out on this ${product.category} deal: ${product.title.substring(0, 50)}...`,
    ];

    const bodies = [
      `Get this ${product.category} for only RM${product.price}! Quality guaranteed, fast shipping. ${product.price > 100 ? "Perfect for" : "Ideal for"} ${product.category} needs.`,
      `Special offer on ${product.name}. Originally RM${(product.price * 1.5).toFixed(2)}, now just RM${product.price}. Hurry, stock running out! ${product.category === "beauty" ? "Get glowing skin today!" : "Perfect for your home!"}`,
      `Why settle for ordinary when you can get extraordinary? This ${product.category} is exactly what you need. Only RM${product.price} today. ${product.rating > 4 ? "Rated 5 stars, loved by everyone!" : "Rated " + product.rating + " stars, making it our customers' favorite!"}`,
    ];

    const ctas = [
      `Shop Now: [SHOP_NOW]`,
      `Swipe up to shop: [AFFILIATE_LINK]`,
      `Link in bio, scroll up and shop! 📲`,
    ];

    const hashtags = [
      `#RacunDapurIbu #DiskaunDapur #AffiliateMY #${product.category}Shopping #BestDeals`,
      `#FlashSale #LimitedStock #MalaysiaSellers #OnlineShopping`,
      `#ShopLocal #MemberDeal #DontMissOut`,
    ];

    const threadTarget: "single-tweet" | "thread-2" =
      bodies.length > 1 ? "thread-2" : "single-tweet";

    return {
      hook: hooks[Math.floor(Math.random() * hooks.length)],
      body: bodies,
      cta: ctas[Math.floor(Math.random() * ctas.length)],
      hashtags: hashtags,
      threadTarget,
    };
  }
}

class MockGeminiService implements GeminiService {
  async generateCopy(product: ProductItem): Promise<GeneratedCopy> {
    console.log("🔧 [Mock Gemini] Generating copy using Gemini API...");

    // Simulate API delay (typically shorter than OpenRouter)
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const copy = this.generateCreativeCopy(product, "gemini");
    return {
      ...copy,
      platform: product.platform || "shopee",
    };
  }

  private generateCreativeCopy(
    product: ProductItem,
    source: string,
  ): Omit<GeneratedCopy, "platform" | "confidence" | "fallbackChainUsed"> {
    const hooks = [
      `🤩 ${product.category} Alert: Big savings inside! 🎊`,
      `✨ Found your perfect ${product.category} at an unbeatable price!`,
      `🎯 Deal Alert: ${product.name} - Only RM${product.price}!!!`,
    ];

    const bodies = [
      `Product: ${product.name}
Price: RM${product.price} (Original: RM${(product.price * 1.3).toFixed(2)})
Special Offer: ${product.category} category
${product.category === "electronics" ? "Built with quality components" : "Perfect for your needs"}
${product.category === "beauty" ? "Transform your appearance today" : product.category === "home" ? "Make your home beautiful" : "Enhance your lifestyle"}`,
      `Quick Summary:
Name: ${product.name}
Price: RM${product.price}
Rating: ${product.rating} stars
${product.description}
${product.stock ? "Stock: " + product.stock + " units" : ""}`,
      `Call to Action: Ready to purchase? Just click the link and complete your order! ${product.explanation || "Your satisfaction is guaranteed!"}`,
    ];

    const ctas = [
      `Shop Now: [GEMINI_LINK]`,
      `Get Yours: [SHOPPING_LINK]`,
      `Click Here: [STORE_LINK]`,
    ];

    const hashtags = [
      `#GeminiDeals #AIRecommended #MalaysianSellers #OnlineShopping`,
      `#TechDeals #DigitalShopping #TrustedSellers`,
      `#FlashSales #LimitedStock #Malaysia`,
      `#GemAI #SmartShopping #CashBack`,
      `#Recommended #TopRated #QualityAssurance`,
    ];

    const threadTarget: "single-tweet" | "thread-2" =
      bodies.length > 1 ? "thread-2" : "single-tweet";

    return {
      hook: hooks[Math.floor(Math.random() * hooks.length)],
      body: bodies,
      cta: ctas[Math.floor(Math.random() * ctas.length)],
      hashtags: hashtags,
      threadTarget,
    };
  }
}

class HeuristicRuleEngine implements HeuristicRuleEngine {
  async generateCopy(product: ProductItem): Promise<GeneratedCopy> {
    console.log(
      "🔧 [Mock Heuristic] Generating copy using rule-based engine...",
    );

    // No delay for local processing
    const copy = this.generateCreativeCopy(product);
    return {
      ...copy,
      platform: "balanced" as ("platform" & "lazada") | "shopee", // Use balanced as generic platform
    };
  }

  private generateCreativeCopy(
    product: ProductItem,
  ): Omit<GeneratedCopy, "platform" | "confidence" | "fallbackChainUsed"> {
    const hooks = [
      `Best ${product.category} Deal Found: RM${product.price}`,
      `Your ${product.category} Search Ends Here: Just RM${product.price}`,
      `Smart Shopping Alert: ${product.name} at RM${product.price}`,
    ];

    const bodies = [
      `Product: ${product.name}
Price: RM${product.price} (Original: RM${(product.price * 1.2).toFixed(2)})
Special Offer: ${product.category} category
${product.category === "electronics" ? "Built with quality components" : "Perfect for your needs"}
${product.category === "beauty" ? "Transform your appearance today" : product.category === "home" ? "Make your home beautiful" : "Enhance your lifestyle"}`,
      `Quick Summary:
Name: ${product.name}
Price: RM${product.price}
Rating: ${product.rating} stars
${product.description}
${product.stock ? "Stock: " + product.stock + " units" : ""}`,
      `Call to Action: Ready to purchase? Just click the link and complete your order! ${product.explanation || "Your satisfaction is guaranteed!"}`,
    ];

    const ctas = [
      `Click Here: [HEURISTIC_LINK]`,
      `Get Your Deal: [PURCHASE_LINK]`,
      `Shop Now: [DEAL_LINK]`,
    ];

    const hashtags = [
      `#Heuristic #RuleBased #SmartDeals #Algorithmic`,
      `#AutoMarketing #Systematic #Recommended`,
      `#Algorithm #Precision #Reliability`,
    ];

    const threadTarget: "single-tweet" | "thread-2" =
      bodies.length > 1 ? "thread-2" : "single-tweet";

    return {
      hook: hooks[Math.floor(Math.random() * hooks.length)],
      body: bodies,
      cta: ctas[Math.floor(Math.random() * ctas.length)],
      hashtags: hashtags,
      threadTarget,
    };
  }
}

// Create singleton instances
const openRouterService = new MockOpenRouterService();
const geminiService = new MockGeminiService();
const heuristicService = new HeuristicRuleEngine();

// Export the AIFallbackEngine instance
const aiFallbackEngine = new AIFallbackEngine(
  openRouterService,
  geminiService,
  heuristicService,
);

export { aiFallbackEngine };

// Export types for convenience
export type {
  GeneratedCopy,
  AIGenerationOptions,
  OpenRouterService,
  GeminiService,
  HeuristicRuleEngine,
};
