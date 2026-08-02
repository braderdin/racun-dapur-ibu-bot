// AI Prompt Optimizer
// Build dynamic system prompts for OpenRouter AI based on user click analytics from Redis, tailoring short punchy X copy vs. storytelling Facebook copy

import { Redis } from "@upstash/redis";
import { OpenAI } from "openai";

interface UserAnalytics {
  userId: string;
  platform: "x" | "facebook";
  category: "kitchen" | "baby" | "skincare";
  clickHistory: {
    timestamp: number;
    platform: "x" | "facebook";
    contentType: "hook" | "cta" | "cultural";
    engagement: "click" | "scroll" | "dwell";
    duration: number;
  }[];
  conversionHistory: {
    timestamp: number;
    platform: "x" | "facebook";
    contentType: "hook" | "cta" | "cultural";
    converted: boolean;
    timeToConvert: number;
  }[];
  preferences: {
    tone: "formal" | "casual" | "urgent" | "friendly";
    length: "short" | "medium" | "long";
    emojiUsage: "minimal" | "moderate" | "heavy";
    culturalRelevance: number;
  };
  createdAt: number;
  updatedAt: number;
}

interface OptimizedPrompt {
  systemPrompt: string;
  userPrompt: string;
  platform: "x" | "facebook";
  category: "kitchen" | "baby" | "skincare";
  confidence: number;
  adaptations: {
    tone: string;
    length: string;
    culturalElements: string[];
    callToActionStyle: string;
  };
  performance: {
    expectedCTR: number;
    expectedEngagement: number;
    culturalFit: number;
  };
  createdAt: number;
}

interface PromptTemplate {
  platform: "x" | "facebook";
  category: "kitchen" | "baby" | "skincare";
  tone: "formal" | "casual" | "urgent" | "friendly";
  length: "short" | "medium" | "long";
  emojiUsage: "minimal" | "moderate" | "heavy";
  template: string;
  culturalElements: string[];
  callToActionStyle: string;
}

class AIPromptOptimizer {
  private redis: Redis;
  private openai: OpenAI;
  private promptTemplates: PromptTemplate[];

  constructor() {
    this.redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });

    this.openai = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.OPENROUTER_BASE_URL,
    });

    this.promptTemplates = this.initializePromptTemplates();
  }

  private initializePromptTemplates(): PromptTemplate[] {
    return [
      {
        platform: "x",
        category: "kitchen",
        tone: "casual",
        length: "short",
        emojiUsage: "moderate",
        template: `You are a Malaysian kitchen product expert. Generate punchy, engaging X content that drives immediate action. Use local references and warm tone. Focus on family cooking experiences and practical benefits. Include relevant emojis (2-3). Keep under 280 characters. Return JSON with hook, cta, culturalAdaptation, confidence (0-1).`,
        culturalElements: [
          "family cooking",
          "Malaysian cuisine",
          "kitchen traditions",
          "home cooking",
        ],
        callToActionStyle: "direct, urgent, benefit-focused",
      },
      {
        platform: "x",
        category: "kitchen",
        tone: "urgent",
        length: "short",
        emojiUsage: "heavy",
        template: `URGENT: Limited stock! Malaysian families need this kitchen essential now! 🔥 Don't miss out on the best price! Click for instant savings! 🚨 Flash sale ends soon!`,
        culturalElements: [
          "urgency",
          "limited stock",
          "flash sale",
          "family needs",
        ],
        callToActionStyle: "scarcity-driven, immediate action required",
      },
      {
        platform: "facebook",
        category: "kitchen",
        tone: "friendly",
        length: "medium",
        emojiUsage: "moderate",
        template: `You are a warm Malaysian homemaker sharing kitchen experiences. Create storytelling Facebook content that builds connection and trust. Share family cooking moments, practical tips, and product recommendations. Use personal anecdotes and cultural references. Include 1-2 emojis. Keep under 500 characters. Return JSON with hook, cta, culturalAdaptation, confidence (0-1).`,
        culturalElements: [
          "family bonding",
          "home cooking stories",
          "kitchen traditions",
          "motherhood",
        ],
        callToActionStyle: "relationship-focused, storytelling, trust-building",
      },
      {
        platform: "facebook",
        category: "kitchen",
        tone: "formal",
        length: "medium",
        emojiUsage: "minimal",
        template: `You are a professional kitchen equipment consultant. Generate well-researched, informative Facebook content for serious buyers. Include technical specifications, comparison data, and expert recommendations. Maintain professional tone with cultural respect. Keep under 500 characters. Return JSON with hook, cta, culturalAdaptation, confidence (0-1).`,
        culturalElements: [
          "expert advice",
          "technical specifications",
          "professional recommendations",
          "quality assurance",
        ],
        callToActionStyle: "educational, data-driven, authority-based",
      },
      {
        platform: "x",
        category: "baby",
        tone: "friendly",
        length: "short",
        emojiUsage: "heavy",
        template: `Sweet baby moments! 👶 Malaysian moms love safe, quality baby products! 💕 Protect your little one with trusted brands! Click for baby safety essentials! 🌟 Special offers inside!`,
        culturalElements: [
          "baby safety",
          "Malaysian moms",
          "parenting",
          "baby care",
        ],
        callToActionStyle: "emotional, protective, community-focused",
      },
      {
        platform: "x",
        category: "baby",
        tone: "urgent",
        length: "short",
        emojiUsage: "heavy",
        template: `URGENT: Baby formula shortage! 🏥 Malaysian families desperate for stock! Limited supply! Price hike incoming! Stock up now before it's too late! 🚨 Your baby deserves the best!`,
        culturalElements: [
          "urgency",
          "shortage",
          "family desperation",
          "baby needs",
        ],
        callToActionStyle: "scarcity, fear, immediate protection",
      },
      {
        platform: "facebook",
        category: "baby",
        tone: "friendly",
        length: "medium",
        emojiUsage: "moderate",
        template: `Parenting journey: Sharing our baby care experiences as Malaysian mothers. From newborn essentials to growth milestones, we support each other! 💕 Let's build a caring community for all moms! Join our discussion! 👶`,
        culturalElements: [
          "parenting journey",
          "community support",
          "motherhood",
          "baby growth",
        ],
        callToActionStyle: "community-building, shared experiences, supportive",
      },
      {
        platform: "facebook",
        category: "baby",
        tone: "formal",
        length: "medium",
        emojiUsage: "minimal",
        template: `Expert baby care recommendations for Malaysian families. Based on pediatric research and local health guidelines. Product reviews, safety standards, and purchasing guides. Your baby\'s health matters! 👶`,
        culturalElements: [
          "expert advice",
          "pediatric research",
          "health guidelines",
          "safety standards",
        ],
        callToActionStyle: "educational, authoritative, health-focused",
      },
      {
        platform: "x",
        category: "skincare",
        tone: "casual",
        length: "short",
        emojiUsage: "moderate",
        template: `Glowing skin naturally! 🌸 Malaysian skincare that works! ✨ Fair skin, happy skin! Try our traditional herbal formulas! Click for radiant skin today! 💖`,
        culturalElements: [
          "traditional herbal",
          "fair skin",
          "natural beauty",
          "Malaysian beauty",
        ],
        callToActionStyle: "beauty-focused, natural, confidence-building",
      },
      {
        platform: "x",
        category: "skincare",
        tone: "urgent",
        length: "short",
        emojiUsage: "heavy",
        template: `URGENT: Skin rash outbreak! 🏥 Malaysian skin sensitive! 🔥 Limited stock of our proven skincare! Price hike tomorrow! Stock up now! 🚨 Safe for sensitive skin!`,
        culturalElements: [
          "skin sensitivity",
          "urgent need",
          "limited stock",
          "safety",
        ],
        callToActionStyle: "health emergency, immediate protection, scarcity",
      },
      {
        platform: "facebook",
        category: "skincare",
        tone: "friendly",
        length: "medium",
        emojiUsage: "moderate",
        template: `Skincare journey: Sharing our Malaysian beauty routines! From traditional herbs to modern formulas, we\'ve discovered what works! Let's build a community of beautiful, confident Malaysian women! 💆‍♀️✨`,
        culturalElements: [
          "beauty journey",
          "traditional herbs",
          "modern formulas",
          "confidence",
        ],
        callToActionStyle: "community, shared discovery, empowerment",
      },
      {
        platform: "facebook",
        category: "skincare",
        tone: "formal",
        length: "medium",
        emojiUsage: "minimal",
        template: `Dermatologist-recommended skincare for Malaysian skin types. Clinical studies, ingredient analysis, and personalized recommendations. Safe for tropical climate! Your skin health is our priority! 👩‍⚕️`,
        culturalElements: [
          "dermatologist",
          "clinical studies",
          "tropical climate",
          "skin health",
        ],
        callToActionStyle: "professional, scientific, health-focused",
      },
    ];
  }

  async analyzeUserAnalytics(userId: string): Promise<UserAnalytics> {
    try {
      const cacheKey = `user_analytics:${userId}`;
      let analytics = await this.redis.get(cacheKey);

      if (analytics) {
        return JSON.parse(analytics as string);
      }

      const defaultAnalytics: UserAnalytics = {
        userId,
        platform: "x",
        category: "kitchen",
        clickHistory: [],
        conversionHistory: [],
        preferences: {
          tone: "casual",
          length: "short",
          emojiUsage: "moderate",
          culturalRelevance: 0.8,
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await this.redis.setex(cacheKey, 3600, JSON.stringify(defaultAnalytics));
      return defaultAnalytics;
    } catch (error) {
      console.error("Error analyzing user analytics:", error);
      throw error;
    }
  }

  async updateUserAnalytics(userId: string, interaction: any): Promise<void> {
    try {
      const analytics = await this.analyzeUserAnalytics(userId);

      if (interaction.type === "click") {
        analytics.clickHistory.push({
          timestamp: Date.now(),
          platform: interaction.platform,
          contentType: interaction.contentType,
          engagement: interaction.engagement,
          duration: interaction.duration,
        });
      } else if (interaction.type === "conversion") {
        analytics.conversionHistory.push({
          timestamp: Date.now(),
          platform: interaction.platform,
          contentType: interaction.contentType,
          converted: interaction.converted,
          timeToConvert: interaction.timeToConvert,
        });
      }

      analytics.updatedAt = Date.now();

      await this.redis.setex(
        `user_analytics:${userId}`,
        3600,
        JSON.stringify(analytics),
      );
    } catch (error) {
      console.error("Error updating user analytics:", error);
    }
  }

  analyzeUserPreferences(analytics: UserAnalytics): any {
    const toneCounts: Record<string, number> = {};
    const lengthCounts: Record<string, number> = {};
    const emojiCounts: Record<string, number> = {};
    const platformCounts: Record<string, number> = {};
    const categoryCounts: Record<string, number> = {};

    for (const click of analytics.clickHistory) {
      toneCounts[analytics.preferences.tone] =
        (toneCounts[analytics.preferences.tone] || 0) + 1;
      lengthCounts[analytics.preferences.length] =
        (lengthCounts[analytics.preferences.length] || 0) + 1;
      emojiCounts[analytics.preferences.emojiUsage] =
        (emojiCounts[analytics.preferences.emojiUsage] || 0) + 1;
      platformCounts[click.platform] =
        (platformCounts[click.platform] || 0) + 1;
    }

    for (const conversion of analytics.conversionHistory) {
      categoryCounts[analytics.category] =
        (categoryCounts[analytics.category] || 0) + 1;
    }

    const totalClicks = analytics.clickHistory.length;

    const tonePreference =
      Object.entries(toneCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ||
      analytics.preferences.tone;

    const lengthPreference =
      Object.entries(lengthCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ||
      analytics.preferences.length;

    const emojiPreference =
      Object.entries(emojiCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ||
      analytics.preferences.emojiUsage;

    const platformPreference =
      (Object.entries(platformCounts).sort((a, b) => b[1] - a[1])[0]?.[0] as
        "x" | "facebook") || analytics.platform;

    const categoryPreference =
      (Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0]?.[0] as
        "kitchen" | "baby" | "skincare") || analytics.category;

    const culturalRelevance = analytics.preferences.culturalRelevance;

    return {
      tone: tonePreference,
      length: lengthPreference,
      emojiUsage: emojiPreference,
      platform: platformPreference,
      category: categoryPreference,
      culturalRelevance,
    };
  }

  findMatchingTemplate(preferences: any): PromptTemplate | null {
    const matchingTemplates = this.promptTemplates.filter(
      (template) =>
        template.platform === preferences.platform &&
        template.category === preferences.category &&
        template.tone === preferences.tone &&
        template.length === preferences.length &&
        template.emojiUsage === preferences.emojiUsage,
    );

    if (matchingTemplates.length > 0) {
      return matchingTemplates[0];
    }

    const fallbackTemplates = this.promptTemplates.filter(
      (template) =>
        template.platform === preferences.platform &&
        template.category === preferences.category,
    );

    if (fallbackTemplates.length > 0) {
      return fallbackTemplates[0];
    }

    return null;
  }

  async optimizePrompt(
    userId: string,
    platform: "x" | "facebook",
    category: "kitchen" | "baby" | "skincare",
  ): Promise<OptimizedPrompt> {
    try {
      const analytics = await this.analyzeUserAnalytics(userId);
      const preferences = this.analyzeUserPreferences(analytics);

      const template = this.findMatchingTemplate(preferences);

      if (!template) {
        throw new Error("No matching prompt template found");
      }

      const systemPrompt = this.enhanceSystemPrompt(template, preferences);
      const userPrompt = this.buildUserPrompt(template, preferences);

      const optimization = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are an AI prompt optimization expert. Analyze the user preferences and create optimized prompts. Return JSON with systemPrompt, userPrompt, platform, category, confidence (0-1), and adaptations (tone, length, culturalElements, callToActionStyle).`,
          },
          {
            role: "user",
            content: `Optimize prompt for user with preferences: tone=${preferences.tone}, length=${preferences.length}, emojiUsage=${preferences.emojiUsage}, platform=${preferences.platform}, category=${preferences.category}, culturalRelevance=${preferences.culturalRelevance}. Template: ${template.template}. Return JSON with optimized prompt details.`,
          },
        ],
        response_format: { type: "json_object" },
        max_tokens: 500,
      });

      const result = JSON.parse(optimization.choices[0].message.content || "{}");

      const optimizedPrompt: OptimizedPrompt = {
        systemPrompt: result.systemPrompt || systemPrompt,
        userPrompt: result.userPrompt || userPrompt,
        platform,
        category,
        confidence: result.confidence || 0.8,
        adaptations: {
          tone: result.adaptations?.tone || preferences.tone,
          length: result.adaptations?.length || preferences.length,
          culturalElements:
            result.adaptations?.culturalElements || template.culturalElements,
          callToActionStyle:
            result.adaptations?.callToActionStyle || template.callToActionStyle,
        },
        performance: {
          expectedCTR: result.performance?.expectedCTR || 0.5,
          expectedEngagement: result.performance?.expectedEngagement || 0.6,
          culturalFit:
            result.performance?.culturalFit || preferences.culturalRelevance,
        },
        createdAt: Date.now(),
      };

      await this.cacheOptimizedPrompt(userId, optimizedPrompt);

      return optimizedPrompt;
    } catch (error) {
      console.error("Error optimizing prompt:", error);
      return this.getFallbackPrompt(platform, category);
    }
  }

  private enhanceSystemPrompt(
    template: PromptTemplate,
    preferences: any,
  ): string {
    const culturalContext = template.culturalElements.join(", ");
    const callToActionContext = template.callToActionStyle;

    return `You are a specialized ${template.platform === "x" ? "X" : "Facebook"} marketing copywriter for ${template.category} products. Generate content that matches user preferences: ${preferences.tone} tone, ${preferences.length} length, ${preferences.emojiUsage} emoji usage. Cultural context: ${culturalContext}. Call-to-action style: ${callToActionContext}. Return JSON with hook, cta, culturalAdaptation, confidence (0-1).`;
  }

  private buildUserPrompt(template: PromptTemplate, preferences: any): string {
    return `Generate marketing copy for ${template.category} product on ${template.platform} platform. User preferences: tone=${preferences.tone}, length=${preferences.length}, emojiUsage=${preferences.emojiUsage}, culturalRelevance=${preferences.culturalRelevance}. Template: ${template.template}. Return JSON with optimized content.`;
  }

  private getFallbackPrompt(
    platform: "x" | "facebook",
    category: "kitchen" | "baby" | "skincare",
  ): OptimizedPrompt {
    const fallbackPrompts = {
      x: {
        kitchen: `You are a Malaysian kitchen product expert. Generate punchy, engaging X content that drives immediate action. Use local references and warm tone. Focus on family cooking experiences and practical benefits. Include relevant emojis (2-3). Keep under 280 characters. Return JSON with hook, cta, culturalAdaptation, confidence (0-1).`,
        baby: `You are a baby care expert. Generate urgent, protective X content for Malaysian families. Focus on baby safety and health. Use emotional appeals and community support. Include relevant emojis (3-4). Keep under 280 characters. Return JSON with hook, cta, culturalAdaptation, confidence (0-1).`,
        skincare: `You are a skincare expert. Generate confidence-building X content for Malaysian beauty seekers. Focus on natural beauty and confidence. Use positive affirmations and cultural relevance. Include relevant emojis (2-3). Keep under 280 characters. Return JSON with hook, cta, culturalAdaptation, confidence (0-1).`,
      },
      facebook: {
        kitchen: `You are a warm Malaysian homemaker sharing kitchen experiences. Create storytelling Facebook content that builds connection and trust. Share family cooking moments, practical tips, and product recommendations. Use personal anecdotes and cultural references. Include 1-2 emojis. Keep under 500 characters. Return JSON with hook, cta, culturalAdaptation, confidence (0-1).`,
        baby: `You are a caring Malaysian parent sharing baby care experiences. Create community-focused Facebook content that supports other parents. Share experiences, tips, and product recommendations. Use warm, supportive tone. Include 1-2 emojis. Keep under 500 characters. Return JSON with hook, cta, culturalAdaptation, confidence (0-1).`,
        skincare: `You are a beauty enthusiast sharing Malaysian skincare journey. Create empowering Facebook content that celebrates natural beauty and confidence. Share experiences, tips, and product recommendations. Use positive, uplifting tone. Include 1-2 emojis. Keep under 500 characters. Return JSON with hook, cta, culturalAdaptation, confidence (0-1).`,
      },
    };

    const systemPrompt = fallbackPrompts[platform][category];

    return {
      systemPrompt,
      userPrompt: `Generate marketing copy for ${category} product on ${platform} platform. Return JSON with hook, cta, culturalAdaptation, confidence (0-1).`,
      platform,
      category,
      confidence: 0.7,
      adaptations: {
        tone: "casual",
        length: "short",
        culturalElements: ["Malaysian culture", "local relevance"],
        callToActionStyle: "direct, benefit-focused",
      },
      performance: {
        expectedCTR: 0.4,
        expectedEngagement: 0.5,
        culturalFit: 0.8,
      },
      createdAt: Date.now(),
    };
  }

  private async cacheOptimizedPrompt(
    userId: string,
    prompt: OptimizedPrompt,
  ): Promise<void> {
    try {
      const cacheKey = `optimized_prompt:${userId}:${prompt.platform}:${prompt.category}`;
      await this.redis.setex(cacheKey, 1800, JSON.stringify(prompt));
    } catch (error) {
      console.error("Error caching optimized prompt:", error);
    }
  }

  async getOptimizedPrompt(
    userId: string,
    platform: "x" | "facebook",
    category: "kitchen" | "baby" | "skincare",
  ): Promise<OptimizedPrompt | null> {
    try {
      const cacheKey = `optimized_prompt:${userId}:${platform}:${category}`;
      const cached = await this.redis.get(cacheKey);

      if (cached) {
        return JSON.parse(cached as string);
      }

      return null;
    } catch (error) {
      console.error("Error getting optimized prompt:", error);
      return null;
    }
  }

  async getPromptPerformanceStats(): Promise<any> {
    try {
      const stats: any = {};

      for (const platform of ["x", "facebook"]) {
        for (const category of ["kitchen", "baby", "skincare"]) {
          const cacheKeys = await this.redis.keys(
            `optimized_prompt:*:${platform}:${category}`,
          );
          const prompts: OptimizedPrompt[] = [];

          for (const key of cacheKeys.slice(0, 50)) {
            const prompt = await this.redis.get(key);
            if (prompt) {
              prompts.push(JSON.parse(prompt as string));
            }
          }

          const avgConfidence =
            prompts.reduce((sum, p) => sum + p.confidence, 0) /
              prompts.length || 0;
          const avgExpectedCTR =
            prompts.reduce((sum, p) => sum + p.performance.expectedCTR, 0) /
              prompts.length || 0;

          stats[`${platform}_${category}`] = {
            totalPrompts: prompts.length,
            averageConfidence: avgConfidence,
            averageExpectedCTR: avgExpectedCTR,
            platform,
            category,
          };
        }
      }

      return stats;
    } catch (error) {
      console.error("Error getting prompt performance stats:", error);
      return null;
    }
  }

  async cleanupOldPrompts(
    olderThan: number = 7 * 24 * 60 * 60 * 1000,
  ): Promise<void> {
    try {
      const now = Date.now();
      const keysToDelete: string[] = [];

      for (const platform of ["x", "facebook"]) {
        for (const category of ["kitchen", "baby", "skincare"]) {
          const cacheKeys = await this.redis.keys(
            `optimized_prompt:*:${platform}:${category}`,
          );
          for (const key of cacheKeys) {
            const prompt = await this.redis.get(key);
            if (prompt) {
              const parsedPrompt = JSON.parse(prompt as string);
              if (now - parsedPrompt.createdAt > olderThan) {
                keysToDelete.push(key);
              }
            }
          }
        }
      }

      for (const key of keysToDelete) {
        await this.redis.del(key);
      }
    } catch (error) {
      console.error("Error cleaning up old prompts:", error);
    }
  }
}

export { AIPromptOptimizer };
export type { UserAnalytics, OptimizedPrompt, PromptTemplate };
