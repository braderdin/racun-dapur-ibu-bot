// Vector RAG Copywriting Service
// Query Upstash Vector for top-performing Malaysian marketing hooks by product category to inject into OpenRouter AI prompts

import { Redis } from "@upstash/redis";
import { OpenAI } from "openai";
import { Env } from "../types/env";

interface MarketingHook {
  id: string;
  category: "kitchen" | "baby" | "skincare";
  hook: string;
  performance: {
    clicks: number;
    conversions: number;
    ctr: number;
    lastUsed: number;
    totalImpressions: number;
  };
  context: {
    productType?: string;
    priceRange?: string;
    season?: string;
    culturalRelevance?: number;
  };
  createdAt: number;
  updatedAt: number;
  relevanceScore?: number;
}

interface RAGContext {
  category: "kitchen" | "baby" | "skincare";
  productType?: string;
  priceRange?: string;
  season?: string;
  userProfile?: {
    language: "bm" | "en";
    preferences: string[];
    purchasePower: "low" | "medium" | "high";
  };
}

export interface GeneratedCopy {
  hook: string;
  body: string[];
  cta: string;
  hashtags: string[];
  threadTarget: "single-tweet" | "thread-2";
  platform: "lazada" | "shopee";
  confidence: number;
  fallbackChainUsed: "none" | "tier-1" | "tier-2" | "tier-3" | "emergency";
  // Twitter thread specific properties (for backward compatibility)
  tweetHook?: string;
  tweetReply?: string;
  culturalAdaptation?: string;
  metadata?: {
    category: string;
    season: string;
    priceRange: string;
    culturalScore: number;
  };
}

export class VectorRAGCopywriter {
  private redis: Redis;
  private openai: OpenAI;
  private env: Env;
  private openRouterService: any; // OpenRouterService instance

  constructor(env: Env) {
    this.env = env;
    this.redis = new Redis({
      url: env.UPSTASH_REDIS_REST_URL || process.env.UPSTASH_REDIS_REST_URL,
      token:
        env.UPSTASH_REDIS_REST_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
    });

    this.openai = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY || "sk-dummy-key-cloudflare-proxy",
      baseURL:
        process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
      // Disable automatic retries to handle errors explicitly
      maxRetries: 0,
    });

    // Initialize OpenRouterService for better error handling
    try {
      const { OpenRouterService } = require("./openrouter");
      this.openRouterService = new OpenRouterService({
        model: process.env.OPENROUTER_MODEL || "openrouter/free",
      });
    } catch (e) {
      console.warn(
        "[VectorRAG] OpenRouterService not available, using direct OpenAI client",
      );
    }
  }

  async storeMarketingHook(hook: MarketingHook): Promise<void> {
    try {
      const key = `hook:${hook.id}`;
      await this.redis.setex(key, 86400, JSON.stringify(hook));

      await this.redis.zadd(`category_hooks:${hook.category}`, {
        score: hook.performance.ctr,
        member: hook.id,
      });

      await this.redis.zadd(`performance_hooks`, {
        score: hook.performance.ctr,
        member: hook.id,
      });
    } catch (error) {
      console.error("Error storing marketing hook:", error);
    }
  }

  async getTopMarketingHooks(
    category: "kitchen" | "baby" | "skincare",
    limit: number = 10,
    minScore: number = 0.5,
  ): Promise<MarketingHook[]> {
    try {
      const hookIds = await this.redis.zrange(
        `category_hooks:${category}`,
        0,
        -1,
      );
      const hooks: MarketingHook[] = [];

      for (const hookId of hookIds.slice(0, limit * 2)) {
        const hook = await this.redis.get(`hook:${hookId}`);
        if (hook) {
          const parsedHook = JSON.parse(hook as string);
          if (parsedHook.performance.ctr >= minScore) {
            hooks.push(parsedHook);
          }
        }
      }

      hooks.sort((a, b) => b.performance.ctr - a.performance.ctr);
      return hooks.slice(0, limit);
    } catch (error) {
      console.error("Error getting top marketing hooks:", error);
      return [];
    }
  }

  async searchRelevantHooks(context: RAGContext): Promise<MarketingHook[]> {
    try {
      const categoryKey = `category_hooks:${context.category}`;
      const allHookIds = await this.redis.zrange(categoryKey, 0, -1);
      const relevantHooks: MarketingHook[] = [];

      for (const hookId of allHookIds) {
        const hook = await this.redis.get(`hook:${hookId}`);
        if (hook) {
          const parsedHook = JSON.parse(hook as string);

          let relevanceScore = parsedHook.performance.ctr;

          if (context.productType && parsedHook.context.productType) {
            if (context.productType === parsedHook.context.productType) {
              relevanceScore *= 1.2;
            }
          }

          if (context.priceRange && parsedHook.context.priceRange) {
            if (context.priceRange === parsedHook.context.priceRange) {
              relevanceScore *= 1.1;
            }
          }

          if (context.season && parsedHook.context.season) {
            if (context.season === parsedHook.context.season) {
              relevanceScore *= 1.15;
            }
          }

          if (
            context.userProfile?.language === "bm" &&
            parsedHook.context.culturalRelevance
          ) {
            relevanceScore *= parsedHook.context.culturalRelevance;
          }

          if (relevanceScore >= 0.5) {
            relevantHooks.push({ ...parsedHook, relevanceScore });
          }
        }
      }

      relevantHooks.sort(
        (a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0),
      );
      return relevantHooks.slice(0, 5);
    } catch (error) {
      console.error("Error searching relevant hooks:", error);
      return [];
    }
  }

  async generateCopyWithRAG(
    productInfo: {
      category: "kitchen" | "baby" | "skincare";
      productType?: string;
      priceRange?: string;
      season?: string;
    },
    platform: "x" | "facebook",
    userProfile?: RAGContext["userProfile"],
  ): Promise<GeneratedCopy> {
    try {
      const ragContext: RAGContext = {
        category: productInfo.category,
        productType: productInfo.productType,
        priceRange: productInfo.priceRange,
        season: productInfo.season,
        userProfile,
      };

      const relevantHooks = await this.searchRelevantHooks(ragContext);

      const systemPrompt = this.buildSystemPrompt(
        productInfo,
        platform,
        userProfile,
        relevantHooks,
      );
      const userPrompt = this.buildUserPrompt(
        productInfo,
        platform,
        relevantHooks,
      );

      // Use OpenRouterService if available for better error handling and fallback
      if (this.openRouterService) {
        try {
          const productForOpenRouter = {
            name: productInfo.productType || `${productInfo.category} product`,
            description: userPrompt,
            price: productInfo.priceRange || "affordable",
            category: productInfo.category,
            rating: 4.5,
            platform: platform === "x" ? "lazada" : "shopee",
          };

          const result =
            await this.openRouterService.generateCopy(productForOpenRouter);

          // Convert OpenRouter GeneratedCopy to VectorRAG GeneratedCopy
          return {
            hook: result.hook,
            body: result.body,
            cta: result.cta,
            hashtags: result.hashtags,
            threadTarget: result.threadTarget,
            platform: platform === "x" ? "lazada" : "shopee",
            confidence: result.confidence,
            fallbackChainUsed: result.fallbackChainUsed,
            culturalAdaptation: result.facebookCopy || "",
            metadata: {
              category: productInfo.category,
              season: productInfo.season ?? "all",
              priceRange: productInfo.priceRange ?? "all",
              culturalScore: userProfile?.language === "bm" ? 0.9 : 0.7,
            },
          };
        } catch (openRouterError) {
          console.warn(
            "[VectorRAG] OpenRouterService failed, falling back to direct OpenAI:",
            openRouterError,
          );
        }
      }

      // Fallback to direct OpenAI client with timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error("OpenRouter API timeout after 25s")),
          25000,
        );
      });

      // Race the API call against the timeout
      const response = await Promise.race([
        this.openai.chat.completions.create({
          model:
            process.env.OPENROUTER_MODEL ||
            this.env?.OPENROUTER_MODEL ||
            "openrouter/free",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          max_tokens: 500,
          temperature: 0.7,
          // Remove response_format to avoid empty choices array issue with some models
        }),
        timeoutPromise,
      ]);

      // Handle empty choices array gracefully - fallback to default template
      if (!response.choices || response.choices.length === 0) {
        console.warn(
          "[VectorRAG] OpenAI returned empty choices array, using fallback copy",
        );
        return this.getFallbackCopy(productInfo, platform);
      }

      let content = response.choices[0].message.content ?? "{}";

      // Safe JSON parsing fallback - handle Markdown code blocks
      let result: any;
      try {
        // Try to extract JSON from markdown code blocks if present
        const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
        if (jsonMatch) {
          content = jsonMatch[1];
        }
        result = JSON.parse(content);
      } catch (parseError) {
        console.warn(
          "[VectorRAG] JSON parse failed, using fallback:",
          parseError,
        );
        return this.getFallbackCopy(productInfo, platform);
      }

      const generatedCopy: GeneratedCopy = {
        hook: result.hook ?? "",
        body: result.body ?? [],
        cta: result.cta ?? "",
        hashtags: result.hashtags ?? [],
        threadTarget: result.threadTarget ?? "thread-2",
        platform: platform === "x" ? "lazada" : "shopee",
        confidence: result.confidence ?? 0.8,
        fallbackChainUsed: "none",
        culturalAdaptation: result.culturalAdaptation ?? "",
        metadata: {
          category: productInfo.category,
          season: productInfo.season ?? "all",
          priceRange: productInfo.priceRange ?? "all",
          culturalScore: userProfile?.language === "bm" ? 0.9 : 0.7,
        },
      };

      // Safe optional chaining with fallback - prevent TypeError when relevantHooks is empty
      const firstHookId = relevantHooks?.[0]?.id;
      if (firstHookId) {
        await this.updateHookPerformance(firstHookId, generatedCopy);
      }

      return generatedCopy;
    } catch (error) {
      console.error("Error generating copy with RAG:", error);
      return this.getFallbackCopy(productInfo, platform);
    }
  }

  private buildSystemPrompt(
    productInfo: any,
    platform: string,
    userProfile?: any,
    relevantHooks?: MarketingHook[],
  ): string {
    const basePrompt = `You are a Malaysian marketing copywriter specializing in affiliate marketing for ${productInfo.category} products. Generate compelling, culturally relevant copy that drives conversions.

Key Requirements:
- Use warm, friendly Malaysian tone (Bahasa Malaysia)
- Focus on value proposition and trust building
- Include clear affiliate CTA
- Keep under 280 characters for X, 500 characters for Facebook
- Include relevant emojis (but not excessive)
- Emphasize quality, affordability, and reliability

Platform Guidelines:
- X: Direct, punchy, thread-friendly
- Facebook: Storytelling, relationship-focused

Cultural Adaptations:
- Reference local festivals, weather, and lifestyle
- Use appropriate honorifics and respect
- Consider Malaysian purchasing behavior

Hook Integration:
- Incorporate proven marketing hooks from similar products
- Adapt hooks for cultural relevance
- Maintain authenticity while driving conversions

Response Format:
Return JSON with: hook, cta, culturalAdaptation, confidence (0-1)

Current Context:
- Category: ${productInfo.category}
- Platform: ${platform}
- Season: ${productInfo.season || "all"}
- Price Range: ${productInfo.priceRange || "all"}

${userProfile ? `- User Profile: Language=${userProfile.language}, Preferences=${userProfile.preferences.join(", ")}` : ""}

${relevantHooks && relevantHooks.length > 0 ? `- Proven Hooks: ${relevantHooks.map((h) => h.hook).join(", ")}` : ""}`;

    return basePrompt;
  }

  private buildUserPrompt(
    productInfo: any,
    platform: string,
    relevantHooks: MarketingHook[],
  ): string {
    const hookContext =
      relevantHooks && relevantHooks.length > 0
        ? `Use these proven hooks as inspiration: ${relevantHooks.map((h) => h.hook).join(", ")}`
        : "Generate fresh hooks based on product category and platform.";

    return `Generate marketing copy for a ${productInfo.category} product (${productInfo.productType || "general"} category) priced at ${productInfo.priceRange || "affordable range"} for ${platform} platform.

${hookContext}

Requirements:
1. Hook: Start with attention-grabbing opening (max 30 words)
2. CTA: Clear affiliate link call-to-action (max 20 words)
3. Cultural Adaptation: Local relevance and cultural connection
4. Confidence: Your confidence level (0-1)

Focus on ${productInfo.season || "year-round"} relevance and ${platform === "x" ? "thread engagement" : "relationship building"}.

Return JSON format only.`;
  }

  private getFallbackCopy(
    productInfo: any,
    platform: "x" | "facebook",
  ): GeneratedCopy {
    const fallbacks = {
      kitchen: {
        x: {
          hook: "Racun Dapur Ibu: Peralatan dapur berkualiti untuk keluarga bahagia!",
          cta: "Klik sini untuk dapatkan harga terbaik hari ini! 🔥",
          culturalAdaptation:
            "Menggunakan istilah Malaysia yang familiar dan hangat.",
        },
        facebook: {
          hook: "Keluarga Malaysia sayang peralatan dapur yang berkualiti!",
          cta: "Dapatkan sekarang dan buat masakan lebih menyenangkan! 💕",
          culturalAdaptation:
            "Cerita tentang pentingnya keluarga dan kebahagiaan di dapur.",
        },
      },
      baby: {
        x: {
          hook: "Baby Racer: Keselamatan & gaya untuk si kecil!",
          cta: "Perlindungan terbaik untuk senyum si kecil! 👶",
          culturalAdaptation: "Menggunakan istilah penjagaan anak Malaysia.",
        },
        facebook: {
          hook: "Ibu bapa Malaysia prihatin tentang keselamatan bayi!",
          cta: "Dapatkan sekarang untuk masa depan si kecil yang lebih cerah! 🌟",
          culturalAdaptation:
            "Cerita tentang tanggungjawab dan kasih sayang ibu bapa.",
        },
      },
      skincare: {
        x: {
          hook: "Kecantikan Semulajadi: Rahsia kulit licin & bersinar!",
          cta: "Dapatkan kulit impian anda hari ini! ✨",
          culturalAdaptation:
            "Menggunakan kecantikan sebagai kebanggaan diri Malaysia.",
        },
        facebook: {
          hook: "Kecantikan Malaysia: Rahsia kulit sihat & bersinar!",
          cta: "Raih keyakinan diri dengan produk berkualiti! 💆‍♀️",
          culturalAdaptation:
            "Cerita tentang kecantikan tradisional dan moden Malaysia.",
        },
      },
    };

    const category = productInfo.category as keyof typeof fallbacks;
    const platformConfig = fallbacks[category][platform];

    return {
      hook: platformConfig.hook,
      body: [],
      cta: platformConfig.cta,
      hashtags: [],
      threadTarget: "thread-2",
      platform: platform === "x" ? "lazada" : "shopee",
      confidence: 0.6,
      fallbackChainUsed: "emergency",
      culturalAdaptation: platformConfig.culturalAdaptation,
      metadata: {
        category: productInfo.category,
        season: productInfo.season || "all",
        priceRange: productInfo.priceRange || "all",
        culturalScore: 0.8,
      },
    };
  }

  private async updateHookPerformance(
    hookId: string,
    generatedCopy: GeneratedCopy,
  ): Promise<void> {
    try {
      const hook = await this.redis.get(`hook:${hookId}`);
      if (hook) {
        const parsedHook = JSON.parse(hook as string);
        parsedHook.performance.clicks++;
        parsedHook.performance.totalImpressions++;
        parsedHook.performance.ctr =
          parsedHook.performance.clicks /
          parsedHook.performance.totalImpressions;
        parsedHook.updatedAt = Date.now();

        await this.redis.setex(
          `hook:${hookId}`,
          86400,
          JSON.stringify(parsedHook),
        );
      }
    } catch (error) {
      console.error("Error updating hook performance:", error);
    }
  }

  async getCopyPerformanceStats(
    category?: "kitchen" | "baby" | "skincare",
  ): Promise<any> {
    try {
      const stats: any = {};

      for (const cat of ["kitchen", "baby", "skincare"]) {
        if (category && cat !== category) continue;

        const hookIds = await this.redis.zrange(`category_hooks:${cat}`, 0, -1);
        const hooks: MarketingHook[] = [];

        for (const hookId of hookIds) {
          const hook = await this.redis.get(`hook:${hookId}`);
          if (hook) {
            hooks.push(JSON.parse(hook as string));
          }
        }

        const totalClicks = hooks.reduce(
          (sum, h) => sum + h.performance.clicks,
          0,
        );
        const totalImpressions = hooks.reduce(
          (sum, h) => sum + h.performance.totalImpressions,
          0,
        );
        const avgCTR =
          totalImpressions > 0 ? totalClicks / totalImpressions : 0;

        stats[cat] = {
          totalHooks: hooks.length,
          totalClicks,
          totalImpressions,
          averageCTR: avgCTR,
          // FIX: Add empty check before accessing [0] to prevent TypeError
          topHook:
            hooks.length > 0
              ? hooks.sort((a, b) => b.performance.ctr - a.performance.ctr)[0]
              : null,
        };
      }

      return stats;
    } catch (error) {
      console.error("Error getting copy performance stats:", error);
      return null;
    }
  }

  async cleanupOldHooks(
    olderThan: number = 30 * 24 * 60 * 60 * 1000,
  ): Promise<void> {
    try {
      const now = Date.now();
      const keysToDelete: string[] = [];

      for (const category of ["kitchen", "baby", "skincare"]) {
        const hookIds = await this.redis.zrange(
          `category_hooks:${category}`,
          0,
          -1,
        );
        for (const hookId of hookIds) {
          const hook = await this.redis.get(`hook:${hookId}`);
          if (hook) {
            const parsedHook = JSON.parse(hook as string);
            if (now - parsedHook.updatedAt > olderThan) {
              keysToDelete.push(`hook:${hookId}`);
            }
          }
        }
      }

      for (const key of keysToDelete) {
        await this.redis.del(key);
      }
    } catch (error) {
      console.error("Error cleaning up old hooks:", error);
    }
  }
}

export type { MarketingHook, RAGContext };
