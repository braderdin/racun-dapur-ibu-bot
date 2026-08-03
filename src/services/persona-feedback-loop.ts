// Persona Feedback Loop Service
// Ingest click analytics and conversion feedback back into Upstash Vector embeddings as positive reinforcement training data for the copywriting engine

import { Redis } from "@upstash/redis";
import { OpenAI } from "openai";

interface UserPersona {
  userId: string;
  platform: "x" | "facebook";
  category: "kitchen" | "baby" | "skincare";
  persona: {
    tone: "formal" | "casual" | "urgent" | "friendly";
    language: "bm" | "en";
    culturalContext: string[];
    preferences: {
      contentType: "hook" | "cta" | "cultural";
      emojiUsage: "minimal" | "moderate" | "heavy";
      length: "short" | "medium" | "long";
      callToActionStyle:
        "direct" | "storytelling" | "educational" | "emotional";
    };
    behavior: {
      clickThroughRate: number;
      conversionRate: number;
      engagementTime: number;
      contentPreference: string[];
    };
  };
  feedbackHistory: {
    timestamp: number;
    interactionType: "click" | "conversion" | "dwell" | "scroll";
    contentType: "hook" | "cta" | "cultural";
    platform: "x" | "facebook";
    category: "kitchen" | "baby" | "skincare";
    engagement: number;
    converted: boolean;
    timeToConvert: number;
    culturalRelevance: number;
    content?: string;
  }[];
  createdAt: number;
  updatedAt: number;
}

interface PersonaEmbedding {
  id: string;
  userId: string;
  persona: UserPersona["persona"];
  embedding: number[];
  feedbackScore: number;
  sampleContent: {
    hook?: string;
    cta?: string;
    cultural?: string;
  };
  performance: {
    clicks: number;
    conversions: number;
    ctr: number;
    lastUpdated: number;
  };
  createdAt: number;
  updatedAt: number;
}

interface FeedbackData {
  userId: string;
  platform: "x" | "facebook";
  category: "kitchen" | "baby" | "skincare";
  interactionType: "click" | "conversion" | "dwell" | "scroll";
  contentType: "hook" | "cta" | "cultural";
  engagement: number;
  converted: boolean;
  timeToConvert: number;
  culturalRelevance: number;
  contentId?: string;
  content?: string;
}

interface TelegramRatingCallback {
  dealId: string;
  rating: "positive" | "negative";
  userId: string;
  chatId: string;
  messageId: string;
  generatedCopyX?: string;
  generatedCopyFb?: string;
  timestamp: number;
}

class PersonaFeedbackLoop {
  private redis: Redis;
  private openai: OpenAI;
  private personaIndex: Map<string, UserPersona>;
  private embeddingIndex: Map<string, PersonaEmbedding>;

  constructor() {
    this.redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });

    this.openai = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.OPENROUTER_BASE_URL,
    });

    this.personaIndex = new Map();
    this.embeddingIndex = new Map();
    this.loadPersonaIndex();
  }

  private async loadPersonaIndex(): Promise<void> {
    try {
      const keys = await this.redis.keys("persona:*");
      for (const key of keys) {
        const persona = await this.redis.get(key);
        if (persona) {
          const parsedPersona = JSON.parse(persona as string);
          this.personaIndex.set(parsedPersona.userId, parsedPersona);
        }
      }
    } catch (error) {
      console.error("Error loading persona index:", error);
    }
  }

  async ingestFeedback(feedback: FeedbackData): Promise<void> {
    try {
      const userId = feedback.userId;
      let persona = this.personaIndex.get(userId);

      if (!persona) {
        persona = {
          userId,
          platform: feedback.platform,
          category: feedback.category,
          persona: {
            tone: "casual",
            language: feedback.platform === "x" ? "en" : "bm",
            culturalContext: [],
            preferences: {
              contentType: "hook",
              emojiUsage: "moderate",
              length: "short",
              callToActionStyle: "direct",
            },
            behavior: {
              clickThroughRate: 0,
              conversionRate: 0,
              engagementTime: 0,
              contentPreference: [],
            },
          },
          feedbackHistory: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
      }

      persona.feedbackHistory.push({
        timestamp: Date.now(),
        interactionType: feedback.interactionType,
        contentType: feedback.contentType,
        platform: feedback.platform,
        category: feedback.category,
        engagement: feedback.engagement,
        converted: feedback.converted,
        timeToConvert: feedback.timeToConvert,
        culturalRelevance: feedback.culturalRelevance,
      });

      persona.updatedAt = Date.now();

      await this.updatePersonaBehavior(persona);
      await this.updatePersonaEmbedding(persona);

      await this.redis.setex(
        `persona:${userId}`,
        3600,
        JSON.stringify(persona),
      );
      this.personaIndex.set(userId, persona);
    } catch (error) {
      console.error("Error ingesting feedback:", error);
    }
  }

  private async updatePersonaBehavior(persona: UserPersona): Promise<void> {
    const recentFeedback = persona.feedbackHistory.slice(-50);

    const toneCounts: Record<string, number> = {};
    const contentTypeCounts: Record<string, number> = {};
    const platformCounts: Record<string, number> = {};
    const categoryCounts: Record<string, number> = {};
    const conversionCounts: Record<string, number> = {};

    for (const feedback of recentFeedback) {
      toneCounts[persona.persona.tone] =
        (toneCounts[persona.persona.tone] || 0) + 1;
      contentTypeCounts[feedback.contentType] =
        (contentTypeCounts[feedback.contentType] || 0) + 1;
      platformCounts[feedback.platform] =
        (platformCounts[feedback.platform] || 0) + 1;
      categoryCounts[feedback.category] =
        (categoryCounts[feedback.category] || 0) + 1;

      if (feedback.converted) {
        conversionCounts[feedback.contentType] =
          (conversionCounts[feedback.contentType] || 0) + 1;
      }
    }

    const totalFeedback = recentFeedback.length;

    if (totalFeedback > 0) {
      persona.persona.tone =
        (Object.entries(toneCounts).sort(
          (a, b) => b[1] - a[1],
        )[0]?.[0] as any) || persona.persona.tone;

      persona.persona.language =
        platformCounts["x"] > platformCounts["facebook"] ? "en" : "bm";

      persona.persona.preferences.contentType =
        (Object.entries(contentTypeCounts).sort(
          (a, b) => b[1] - a[1],
        )[0]?.[0] as any) || persona.persona.preferences.contentType;

      persona.persona.preferences.emojiUsage =
        persona.persona.behavior.contentPreference.includes("emoji")
          ? "heavy"
          : persona.persona.behavior.contentPreference.includes("minimal")
            ? "minimal"
            : "moderate";

      persona.persona.preferences.length =
        persona.persona.behavior.contentPreference.includes("long")
          ? "long"
          : persona.persona.behavior.contentPreference.includes("short")
            ? "short"
            : "medium";

      persona.persona.preferences.callToActionStyle =
        persona.persona.behavior.contentPreference.includes("storytelling")
          ? "storytelling"
          : persona.persona.behavior.contentPreference.includes("educational")
            ? "educational"
            : "direct";

      persona.persona.behavior.clickThroughRate =
        (recentFeedback.filter((f) => f.interactionType === "click").length /
          totalFeedback) *
        100;
      persona.persona.behavior.conversionRate =
        (recentFeedback.filter((f) => f.converted).length / totalFeedback) *
        100;
      persona.persona.behavior.engagementTime =
        recentFeedback.reduce((sum, f) => sum + f.engagement, 0) /
        totalFeedback;

      persona.persona.behavior.contentPreference = Object.entries(
        conversionCounts,
      ).sort((a, b) => b[1] - a[1])[0]?.[0]
        ? [Object.entries(conversionCounts).sort((a, b) => b[1] - a[1])[0]?.[0]]
        : [];
    }
  }

  private async updatePersonaEmbedding(persona: UserPersona): Promise<void> {
    try {
      const embeddingText = this.buildEmbeddingText(persona);
      const embeddingResponse = await this.openai.embeddings.create({
        model: "text-embedding-3-small",
        input: embeddingText,
        dimensions: 1536,
      });

      const embedding = embeddingResponse.data[0].embedding;

      const personaEmbedding: PersonaEmbedding = {
        id: `persona_embedding:${persona.userId}:${Date.now()}`,
        userId: persona.userId,
        persona: persona.persona,
        embedding,
        feedbackScore: this.calculateFeedbackScore(persona),
        sampleContent: this.extractSampleContent(persona),
        performance: {
          clicks: persona.feedbackHistory.filter(
            (f) => f.interactionType === "click",
          ).length,
          conversions: persona.feedbackHistory.filter((f) => f.converted)
            .length,
          ctr:
            (persona.feedbackHistory.filter((f) => f.converted).length /
              persona.feedbackHistory.length) *
              100 || 0,
          lastUpdated: Date.now(),
        },
        createdAt: persona.createdAt,
        updatedAt: Date.now(),
      };

      await this.redis.setex(
        `persona_embedding:${personaEmbedding.id}`,
        86400,
        JSON.stringify(personaEmbedding),
      );
      this.embeddingIndex.set(personaEmbedding.id, personaEmbedding);

      await this.redis.zadd("persona_embeddings", {
        score: personaEmbedding.feedbackScore,
        member: personaEmbedding.id,
      });
    } catch (error) {
      console.error("Error updating persona embedding:", error);
    }
  }

  private buildEmbeddingText(persona: UserPersona): string {
    const components = [
      `Tone: ${persona.persona.tone}`,
      `Language: ${persona.persona.language}`,
      `Content Type Preference: ${persona.persona.preferences.contentType}`,
      `Emoji Usage: ${persona.persona.preferences.emojiUsage}`,
      `Length Preference: ${persona.persona.preferences.length}`,
      `Call to Action Style: ${persona.persona.preferences.callToActionStyle}`,
      `Click Through Rate: ${persona.persona.behavior.clickThroughRate.toFixed(2)}%`,
      `Conversion Rate: ${persona.persona.behavior.conversionRate.toFixed(2)}%`,
      `Engagement Time: ${persona.persona.behavior.engagementTime.toFixed(2)}s`,
      `Content Preferences: ${persona.persona.behavior.contentPreference.join(", ")}`,
      `Cultural Context: ${persona.persona.culturalContext.join(", ")}`,
    ];

    return components.join(" | ");
  }

  private calculateFeedbackScore(persona: UserPersona): number {
    const recentFeedback = persona.feedbackHistory.slice(-20);

    if (recentFeedback.length === 0) return 0.5;

    const conversionScore =
      (recentFeedback.filter((f) => f.converted).length /
        recentFeedback.length) *
      0.4;
    const engagementScore =
      (recentFeedback.reduce((sum, f) => sum + f.engagement, 0) /
        recentFeedback.length /
        10) *
      0.3;
    const culturalScore =
      (recentFeedback.reduce((sum, f) => sum + f.culturalRelevance, 0) /
        recentFeedback.length) *
      0.3;

    return conversionScore + engagementScore + culturalScore;
  }

  private extractSampleContent(
    persona: UserPersona,
  ): PersonaEmbedding["sampleContent"] {
    const sample: PersonaEmbedding["sampleContent"] = {};

    const hooks = persona.feedbackHistory
      .filter((f) => f.contentType === "hook" && f.converted)
      .map((f) => f.content)
      .filter(Boolean);

    const ctas = persona.feedbackHistory
      .filter((f) => f.contentType === "cta" && f.converted)
      .map((f) => f.content)
      .filter(Boolean);

    const cultural = persona.feedbackHistory
      .filter((f) => f.contentType === "cultural" && f.converted)
      .map((f) => f.content)
      .filter(Boolean);

    if (hooks.length > 0) {
      sample.hook = hooks[Math.floor(Math.random() * hooks.length)];
    }

    if (ctas.length > 0) {
      sample.cta = ctas[Math.floor(Math.random() * ctas.length)];
    }

    if (cultural.length > 0) {
      sample.cultural = cultural[Math.floor(Math.random() * cultural.length)];
    }

    return sample;
  }

  async getUserPersona(userId: string): Promise<UserPersona | null> {
    try {
      const cacheKey = `persona:${userId}`;
      const persona = await this.redis.get(cacheKey);

      if (persona) {
        const parsedPersona = JSON.parse(persona as string) as UserPersona;
        this.personaIndex.set(userId, parsedPersona);
        return parsedPersona;
      }

      return null;
    } catch (error) {
      console.error("Error getting user persona:", error);
      return null;
    }
  }

  async searchSimilarPersonas(
    userId: string,
    limit: number = 10,
    minScore: number = 0.7,
  ): Promise<UserPersona[]> {
    try {
      const currentPersona = this.personaIndex.get(userId);
      if (!currentPersona) return [];

      const currentEmbedding = await this.getPersonaEmbedding(userId);
      if (!currentEmbedding) return [];

      const similarEmbeddings = await this.redis.zrange(
        "persona_embeddings",
        0,
        -1,
      );
      const similarPersonas: UserPersona[] = [];

      for (const embeddingId of similarEmbeddings.slice(0, limit * 2)) {
        const embedding = await this.redis.get(
          (embeddingId as string).replace("persona_embedding:", ""),
        );
        if (embedding) {
          const parsedEmbedding = JSON.parse(embedding as string);
          const score = this.calculateCosineSimilarity(
            currentEmbedding.embedding,
            parsedEmbedding.embedding,
          );

          if (score >= minScore) {
            const persona = this.personaIndex.get(parsedEmbedding.userId);
            if (persona) {
              similarPersonas.push(persona);
            }
          }
        }
      }

      similarPersonas.sort(
        (a, b) => (b as any).similarityScore - (a as any).similarityScore,
      );
      return similarPersonas.slice(0, limit);
    } catch (error) {
      console.error("Error searching similar personas:", error);
      return [];
    }
  }

  private async getPersonaEmbedding(
    userId: string,
  ): Promise<PersonaEmbedding | null> {
    try {
      const embeddings = await this.redis.zrange("persona_embeddings", 0, -1);
      for (const embeddingId of embeddings) {
        const embedding = await this.redis.get(
          (embeddingId as string).replace("persona_embedding:", ""),
        );
        if (embedding) {
          const parsedEmbedding = JSON.parse(embedding as string);
          if (parsedEmbedding.userId === userId) {
            return parsedEmbedding;
          }
        }
      }
      return null;
    } catch (error) {
      console.error("Error getting persona embedding:", error);
      return null;
    }
  }

  private calculateCosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) return 0;

    return dotProduct / (normA * normB);
  }

  async getPersonaInsights(userId: string): Promise<any> {
    try {
      const persona = this.personaIndex.get(userId);
      if (!persona) return null;

      const insights = {
        userId,
        platform: persona.platform,
        category: persona.category,
        persona: persona.persona,
        behavior: persona.persona.behavior,
        feedbackStats: {
          totalInteractions: persona.feedbackHistory.length,
          conversionRate: persona.persona.behavior.conversionRate,
          avgEngagement: persona.persona.behavior.engagementTime,
          topContentTypes: this.getTopContentTypes(persona),
          culturalRelevance:
            persona.feedbackHistory.reduce(
              (sum, f) => sum + f.culturalRelevance,
              0,
            ) / persona.feedbackHistory.length || 0,
        },
        recommendations: this.generateRecommendations(persona),
        lastUpdated: persona.updatedAt,
      };

      return insights;
    } catch (error) {
      console.error("Error getting persona insights:", error);
      return null;
    }
  }

  private getTopContentTypes(persona: UserPersona): string[] {
    const contentTypeCounts: Record<string, number> = {};

    for (const feedback of persona.feedbackHistory) {
      contentTypeCounts[feedback.contentType] =
        (contentTypeCounts[feedback.contentType] || 0) + 1;
    }

    return Object.entries(contentTypeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([type]) => type);
  }

  private generateRecommendations(persona: UserPersona): string[] {
    const recommendations: string[] = [];

    if (persona.persona.behavior.conversionRate < 10) {
      recommendations.push("Increase cultural relevance in content");
    }

    if (persona.persona.behavior.clickThroughRate < 5) {
      recommendations.push("Optimize hook content for better engagement");
    }

    if (persona.persona.behavior.engagementTime < 5) {
      recommendations.push("Create more interactive and longer-form content");
    }

    if (persona.persona.preferences.contentType === "hook") {
      recommendations.push("Focus on developing stronger CTAs");
    }

    if (persona.persona.preferences.contentType === "cta") {
      recommendations.push("Enhance cultural storytelling elements");
    }

    return recommendations;
  }

  async cleanupOldPersonas(
    olderThan: number = 30 * 24 * 60 * 60 * 1000,
  ): Promise<void> {
    try {
      const now = Date.now();
      const keysToDelete: string[] = [];

      for (const [userId, persona] of this.personaIndex.entries()) {
        if (now - persona.updatedAt > olderThan) {
          keysToDelete.push(`persona:${userId}`);
        }
      }

      for (const key of keysToDelete) {
        await this.redis.del(key);
        this.personaIndex.delete(key.replace("persona:", ""));
      }
    } catch (error) {
      console.error("Error cleaning up old personas:", error);
    }
  }

  async getPersonaStats(): Promise<any> {
    try {
      const totalPersonas = this.personaIndex.size;
      const totalEmbeddings = await this.redis.zcard("persona_embeddings");

      const platformStats: Record<string, number> = {};
      const categoryStats: Record<string, number> = {};

      for (const persona of this.personaIndex.values()) {
        platformStats[persona.platform] =
          (platformStats[persona.platform] || 0) + 1;
        categoryStats[persona.category] =
          (categoryStats[persona.category] || 0) + 1;
      }

      return {
        totalPersonas,
        totalEmbeddings,
        platformStats,
        categoryStats,
        lastCleanup: Date.now(),
      };
    } catch (error) {
      console.error("Error getting persona stats:", error);
      return null;
    }
  }

  // Process Telegram inline button ratings and store positive hooks in Vector memory
  async processTelegramRating(
    callback: TelegramRatingCallback,
  ): Promise<boolean> {
    try {
      if (callback.rating === "positive") {
        // Store positive copywriting hook into Upstash Vector for reinforcement
        await this.storePositiveHookToVector(callback);
      } else if (callback.rating === "negative") {
        // Log negative pattern into Redis to avoid similar structures
        await this.logNegativePattern(callback);
      }

      // Update deal rating in Redis
      await this.redis.hset(`deal_rating:${callback.dealId}`, {
        rating: callback.rating,
        timestamp: callback.timestamp,
        userId: callback.userId,
      });
      await this.redis.expire(`deal_rating:${callback.dealId}`, 86400 * 7);

      return true;
    } catch (error) {
      console.error("Error processing Telegram rating:", error);
      return false;
    }
  }

  // Store positive hook into Upstash Vector for RAG reinforcement
  private async storePositiveHookToVector(
    callback: TelegramRatingCallback,
  ): Promise<void> {
    try {
      const hookText =
        callback.generatedCopyX || callback.generatedCopyFb || "";
      if (!hookText) return;

      // Create embedding for the positive hook
      const embeddingResponse = await this.openai.embeddings.create({
        model: "text-embedding-3-small",
        input: hookText,
        dimensions: 1536,
      });

      const embedding = embeddingResponse.data[0].embedding;

      // Store in Vector with metadata
      const vectorEntry = {
        id: `positive_hook:${callback.dealId}:${Date.now()}`,
        dealId: callback.dealId,
        embedding,
        content: hookText,
        rating: "positive",
        userId: callback.userId,
        createdAt: Date.now(),
      };

      await this.redis.setex(
        `vector_hook:${vectorEntry.id}`,
        86400 * 30, // 30 days retention
        JSON.stringify(vectorEntry),
      );

      // Add to positive hooks sorted set for ranking
      await this.redis.zadd("positive_hooks_ranking", {
        score: 1.0,
        member: vectorEntry.id,
      });
    } catch (error) {
      console.error("Error storing positive hook to vector:", error);
    }
  }

  // Log negative pattern to avoid similar structures
  private async logNegativePattern(
    callback: TelegramRatingCallback,
  ): Promise<void> {
    try {
      const negativePattern = {
        dealId: callback.dealId,
        content: callback.generatedCopyX || callback.generatedCopyFb || "",
        userId: callback.userId,
        timestamp: Date.now(),
      };

      await this.redis.lpush(
        "negative_patterns",
        JSON.stringify(negativePattern),
      );
      await this.redis.ltrim("negative_patterns", 0, 99); // Keep last 100
      await this.redis.expire("negative_patterns", 86400 * 30);
    } catch (error) {
      console.error("Error logging negative pattern:", error);
    }
  }

  // Get top positive hooks for RAG
  async getTopPositiveHooks(limit: number = 10): Promise<string[]> {
    try {
      const hookIds = await this.redis.zrevrange(
        "positive_hooks_ranking",
        0,
        limit - 1,
      );
      const hooks: string[] = [];

      for (const hookId of hookIds) {
        const hook = await this.redis.get(`vector_hook:${hookId}`);
        if (hook) {
          const parsed = JSON.parse(hook as string);
          hooks.push(parsed.content);
        }
      }

      return hooks;
    } catch (error) {
      console.error("Error getting top positive hooks:", error);
      return [];
    }
  }
}

export { PersonaFeedbackLoop };
export type {
  UserPersona,
  PersonaEmbedding,
  FeedbackData,
  TelegramRatingCallback,
};
