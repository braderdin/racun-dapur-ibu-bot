/*
 * Vector Ad Copy Rotator Service
 * Uses Upstash Vector Cosine distance similarity queries to dynamically rotate
 * copywriting hooks, avoiding ad fatigue across social channels.
 */

import { Env } from "../types/env";
import { logger } from "../utils/logger";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CopyHook {
  id: string;
  text: string;
  category: "hook" | "cta" | "storytelling" | "urgency" | "social_proof";
  platform: "twitter" | "facebook" | "web" | "all";
  tags: string[];
  embeddings?: number[];
  created_at: string;
  usage_count: number;
  last_used_at?: string;
}

export interface CopyHookResponse {
  success: boolean;
  hooks: CopyHook[];
  total_available: number;
  selected_hook: CopyHook | null;
  similarity_score: number;
}

export interface VectorQuery {
  query_text: string;
  category?: string;
  platform?: string;
  top_k?: number;
  min_similarity?: number;
}

export interface VectorSearchResult {
  id: string;
  text: string;
  score: number;
  payload?: Record<string, any>;
}

// ---------------------------------------------------------------------------
// Vector Ad Copy Rotator Service
// ---------------------------------------------------------------------------

export class VectorAdCopyRotator {
  private env: Env;
  private vectorUrl: string;
  private vectorToken: string;
  private readonly DEFAULT_TOP_K = 5;
  private readonly DEFAULT_MIN_SIMILARITY = 0.7;
  private readonly CACHE_TTL = 3600; // 1 hour

  constructor(env: Env) {
    this.env = env;
    this.vectorUrl = env.UPSTASH_VECTOR_REST_URL || "";
    this.vectorToken = env.UPSTASH_VECTOR_REST_TOKEN || "";
  }

  // ---------------------------------------------------------------------------
  // Query similar hooks using vector similarity
  // ---------------------------------------------------------------------------

  async querySimilarHooks(query: VectorQuery): Promise<VectorSearchResult[]> {
    const {
      query_text,
      category,
      platform,
      top_k = this.DEFAULT_TOP_K,
      min_similarity = this.DEFAULT_MIN_SIMILARITY,
    } = query;

    if (!this.vectorUrl || !this.vectorToken) {
      logger.warn("Vector API not configured", {}, "VectorAdCopyRotator");
      return [];
    }

    try {
      // First, we need to get embeddings for the query text
      // Since we're using OpenRouter proxy, we'll use a simplified approach
      const embeddings = await this.getEmbeddings(query_text);

      if (!embeddings || embeddings.length === 0) {
        logger.warn(
          "Failed to get embeddings for query",
          { query_text },
          "VectorAdCopyRotator",
        );
        return [];
      }

      // Query the vector database
      const response = await fetch(`${this.vectorUrl}/query`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.vectorToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          vector: embeddings,
          top_k,
          filter: this.buildFilter(category, platform),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(
          "Vector query failed",
          { error: errorText },
          "VectorAdCopyRotator",
        );
        return [];
      }

      const data: { results?: VectorSearchResult[] } = await response.json();
      const results: VectorSearchResult[] = data.results || [];

      // Filter by minimum similarity
      return results.filter(
        (r: VectorSearchResult) => r.score >= min_similarity,
      );
    } catch (error) {
      logger.error(
        "Error querying vector database",
        { error },
        "VectorAdCopyRotator",
      );
      return [];
    }
  }

  // ---------------------------------------------------------------------------
  // Get embeddings for text
  // ---------------------------------------------------------------------------

  private async getEmbeddings(text: string): Promise<number[]> {
    // Use OpenRouter embedding model via proxy
    const baseUrl = this.env.OPENROUTER_BASE_URL || "";
    const apiKey = this.env.OPENROUTER_API_KEY || "";

    if (!baseUrl || !apiKey) {
      logger.warn(
        "OpenRouter not configured for embeddings",
        {},
        "VectorAdCopyRotator",
      );
      return [];
    }

    try {
      const response = await fetch(`${baseUrl}/embeddings`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "text-embedding-3-small",
          input: text,
        }),
      });

      if (!response.ok) {
        throw new Error(`Embedding API error: ${response.status}`);
      }

      const data: { data?: Array<{ embedding: number[] }> } = await response.json();
      return data.data?.[0]?.embedding || [];
    } catch (error) {
      logger.error(
        "Error getting embeddings",
        { error },
        "VectorAdCopyRotator",
      );
      return [];
    }
  }

  // ---------------------------------------------------------------------------
  // Build filter for vector query
  // ---------------------------------------------------------------------------

  private buildFilter(
    category?: string,
    platform?: string,
  ): Record<string, any> | undefined {
    const filter: Record<string, any> = {};

    if (category) {
      filter.category = category;
    }

    if (platform && platform !== "all") {
      filter.platform = platform;
    }

    return Object.keys(filter).length > 0 ? filter : undefined;
  }

  // ---------------------------------------------------------------------------
  // Get random hook avoiding recent usage
  // ---------------------------------------------------------------------------

  async getRandomHook(
    options: {
      category?: string;
      platform?: string;
      excludeIds?: string[];
      minUsageCount?: number;
      avoidRecent?: boolean;
    } = {},
  ): Promise<CopyHook | null> {
    const { category, platform, excludeIds = [], minUsageCount = 0 } = options;

    // Query for hooks with low usage count
    const query = {
      query_text: category || "general",
      category,
      platform: platform || "all",
      top_k: 10,
    };

    const results = await this.querySimilarHooks(query);

    // Filter out excluded IDs and high usage hooks
    const filtered = results.filter((r) => {
      const isExcluded = excludeIds.includes(r.id);
      const isHighUsage = (r.payload?.usage_count || 0) > minUsageCount;
      return !isExcluded && !isHighUsage;
    });

    if (filtered.length === 0) {
      return null;
    }

    // Return the most similar result
    const selected = filtered[0];
    return {
      id: selected.id,
      text: selected.text,
      category: selected.payload?.category || "hook",
      platform: selected.payload?.platform || "all",
      tags: selected.payload?.tags || [],
      embeddings: selected.payload?.embeddings,
      created_at: selected.payload?.created_at || new Date().toISOString(),
      usage_count: selected.payload?.usage_count || 0,
      last_used_at: selected.payload?.last_used_at,
    };
  }

  // ---------------------------------------------------------------------------
  // Get hook for specific platform with fatigue prevention
  // ---------------------------------------------------------------------------

  async getHookForPlatform(
    platform: "twitter" | "facebook" | "web",
    options: {
      category?: string;
      dealId?: string;
      avoidRecent: boolean;
    } = {},
  ): Promise<CopyHook | null> {
    const { category, dealId, avoidRecent = true } = options;

    // Get recently used hooks for this platform
    const recentKey = `recent_hooks:${platform}`;
    const recentHooks: string[] = avoidRecent
      ? await this.getRecentHooks(recentKey, 5)
      : [];

    // Query for hooks
    const hooks = await this.getRandomHook({
      category,
      platform,
      excludeIds: recentHooks,
      minUsageCount: 5, // Avoid hooks used more than 5 times
    });

    if (hooks) {
      // Record this usage
      await this.recordHookUsage(hooks.id, platform, dealId);
    }

    return hooks;
  }

  // ---------------------------------------------------------------------------
  // Get recent hooks from Redis
  // ---------------------------------------------------------------------------

  private async getRecentHooks(key: string, count: number): Promise<string[]> {
    try {
      const redis = await import("./redis");
      const redisService = new redis.RedisService(this.env);
      const recent = await redisService.get(key);
      return typeof recent === "string" ? JSON.parse(recent) : [];
    } catch {
      return [];
    }
  }

  // ---------------------------------------------------------------------------
  // Record hook usage
  // ---------------------------------------------------------------------------

  private async recordHookUsage(
    hookId: string,
    platform: string,
    dealId?: string,
  ): Promise<void> {
    try {
      const redis = await import("./redis");
      const redisService = new redis.RedisService(this.env);

      // Update usage count in Redis hash
      await redisService.hincrby(`hook:${hookId}`, "usage_count", 1);
      await redisService.hset(
        `hook:${hookId}`,
        "last_used_at",
        new Date().toISOString(),
      );

      // Add to recent hooks list
      const recentKey = `recent_hooks:${platform}`;
      const recent = await redisService.get(recentKey);
      const recentList: string[] =
        typeof recent === "string" ? JSON.parse(recent) : [];

      recentList.unshift(hookId);
      if (dealId) recentList.push(dealId);

      // Keep only last 10
      const trimmed = recentList.slice(0, 10);
      await redisService.set(recentKey, JSON.stringify(trimmed), 86400);
    } catch (error) {
      logger.error(
        "Error recording hook usage",
        { error },
        "VectorAdCopyRotator",
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Health check
  // ---------------------------------------------------------------------------

  async healthCheck(): Promise<{
    status: "healthy" | "degraded" | "unhealthy";
    vectorApi: "up" | "down";
    embeddingApi: "up" | "down";
    timestamp: string;
  }> {
    const vectorApi = this.vectorUrl && this.vectorToken ? "up" : "down";
    const embeddingApi =
      this.env.OPENROUTER_BASE_URL && this.env.OPENROUTER_API_KEY
        ? "up"
        : "down";

    let status: "healthy" | "degraded" | "unhealthy" = "healthy";
    if (vectorApi === "down" || embeddingApi === "down") {
      status = "degraded";
    }

    return {
      status,
      vectorApi,
      embeddingApi,
      timestamp: new Date().toISOString(),
    };
  }
}

// ---------------------------------------------------------------------------
// Singleton instance
// ---------------------------------------------------------------------------

let vectorRotatorInstance: VectorAdCopyRotator | null = null;

export function getVectorAdCopyRotator(env: Env): VectorAdCopyRotator {
  if (!vectorRotatorInstance) {
    vectorRotatorInstance = new VectorAdCopyRotator(env);
  }
  return vectorRotatorInstance;
}
