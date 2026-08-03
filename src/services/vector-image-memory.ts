// Vector Image Memory Service
// Store high-performing image feature vectors and CTR performance metadata in Upstash Vector for AI visual preference learning

import { Redis } from "@upstash/redis";
import { OpenAI } from "openai";
import { resolve } from "path";
import { readFileSync } from "fs";

interface ImageFeatureVector {
  id: string;
  productId: string;
  imageUrl: string;
  category: "kitchen" | "baby" | "skincare";
  features: number[];
  ctrScore: number;
  metadata: {
    width?: number;
    height?: number;
    format?: string;
    size?: number;
    background?: string;
    trustCues?: boolean;
    aspectRatio?: number;
    clarity?: number;
  };
  performance: {
    clicks: number;
    conversions: number;
    ctr: number;
    lastClicked: number;
    totalViews: number;
  };
  createdAt: number;
  updatedAt: number;
}

interface VectorSearchResult {
  vector: ImageFeatureVector;
  score: number;
}

interface VisualPreferenceProfile {
  category: "kitchen" | "baby" | "skincare";
  featureWeights: number[];
  preferredBackgrounds: string[];
  preferredAspectRatios: number[];
  preferredClarity: number;
  trustCuePreference: number;
  confidence: number;
}

class VectorImageMemory {
  private redis: Redis;
  private openai: OpenAI;
  private workerPool: any[];
  private vectorIndex: Map<string, ImageFeatureVector>;

  constructor() {
    this.redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });

    this.openai = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.OPENROUTER_BASE_URL,
    });

    this.workerPool = [];
    this.vectorIndex = new Map();
    this.initializeWorkerPool();
    this.loadVectorIndex();
  }

  private initializeWorkerPool(): void {
    const numWorkers = 4;
    for (let i = 0; i < numWorkers; i++) {
      const worker = new (require("worker_threads").Worker)(
        resolve(__dirname, "./vector-worker.js"),
      );
      this.workerPool.push(worker);
    }
  }

  private async loadVectorIndex(): Promise<void> {
    try {
      const keys = await this.redis.keys("vector:*");
      for (const key of keys) {
        const vector = await this.redis.get(key);
        if (vector) {
          const parsedVector = JSON.parse(vector as string);
          this.vectorIndex.set(parsedVector.id, parsedVector);
        }
      }
    } catch (error) {
      console.error("Error loading vector index:", error);
    }
  }

  async generateImageFeatures(
    imageUrl: string,
    metadata?: any,
  ): Promise<number[]> {
    try {
      const worker =
        this.workerPool[Math.floor(Math.random() * this.workerPool.length)];
      const result = await worker.runMain(
        "generateFeatures",
        imageUrl,
        metadata,
      );
      return result.data;
    } catch (error) {
      console.error("Error generating image features:", error);
      return [];
    }
  }

  async extractImageFeatures(
    imageUrl: string,
    metadata?: any,
  ): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: "text-embedding-3-small",
        input: imageUrl,
        dimensions: 1536,
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error("Error extracting image features:", error);
      return [];
    }
  }

  async storeImageVector(vector: ImageFeatureVector): Promise<void> {
    try {
      const key = `vector:${vector.id}`;
      await this.redis.setex(key, 86400, JSON.stringify(vector));
      this.vectorIndex.set(vector.id, vector);

      await this.redis.zadd("category_index", {
        score: vector.ctrScore,
        member: `category:${vector.category}:${vector.id}`,
      });

      await this.redis.zadd("performance_index", {
        score: vector.performance.ctr,
        member: `performance:${vector.id}`,
      });
    } catch (error) {
      console.error("Error storing image vector:", error);
    }
  }

  async searchSimilarImages(
    features: number[],
    category?: "kitchen" | "baby" | "skincare",
    limit: number = 10,
    minScore: number = 0.7,
  ): Promise<VectorSearchResult[]> {
    try {
      let searchResults: VectorSearchResult[] = [];

      if (category) {
        const categoryKeys = await this.redis.zrange(
          `category:${category}`,
          0,
          -1,
        );
        for (const key of categoryKeys) {
          const vector = await this.redis.get(
            (key as string).replace("category:", ""),
          );
          if (vector) {
            const parsedVector = JSON.parse(vector as string);
            const score = this.calculateCosineSimilarity(
              features,
              parsedVector.features,
            );
            if (score >= minScore) {
              searchResults.push({ vector: parsedVector, score });
            }
          }
        }
      } else {
        const allKeys = await this.redis.keys("vector:*");
        for (const key of allKeys) {
          const vector = await this.redis.get(key);
          if (vector) {
            const parsedVector = JSON.parse(vector as string);
            const score = this.calculateCosineSimilarity(
              features,
              parsedVector.features,
            );
            if (score >= minScore) {
              searchResults.push({ vector: parsedVector, score });
            }
          }
        }
      }

      searchResults.sort((a, b) => b.score - a.score);
      return searchResults.slice(0, limit);
    } catch (error) {
      console.error("Error searching similar images:", error);
      return [];
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

  async updatePerformance(
    vectorId: string,
    click: boolean = false,
  ): Promise<void> {
    try {
      const vector = this.vectorIndex.get(vectorId);
      if (!vector) return;

      vector.performance.totalViews++;
      if (click) {
        vector.performance.clicks++;
        vector.performance.conversions++;
        vector.performance.ctr =
          vector.performance.clicks / vector.performance.totalViews;
        vector.performance.lastClicked = Date.now();
      }

      vector.updatedAt = Date.now();

      await this.storeImageVector(vector);
    } catch (error) {
      console.error("Error updating performance:", error);
    }
  }

  async getVisualPreferenceProfile(
    category: "kitchen" | "baby" | "skincare",
  ): Promise<VisualPreferenceProfile> {
    try {
      const profileKey = `profile:${category}`;
      let profile = await this.redis.get(profileKey);

      if (profile) {
        return JSON.parse(profile as string) as VisualPreferenceProfile;
      }

      const similarVectors = await this.searchSimilarImages(
        [],
        category,
        100,
        0.5,
      );

      if (similarVectors.length === 0) {
        return this.createDefaultProfile(category);
      }

      const analyzedProfile = await this.analyzePreferenceProfile(
        similarVectors.map((r) => r.vector),
        category,
      );

      await this.redis.setex(profileKey, 3600, JSON.stringify(analyzedProfile));

      return analyzedProfile;
    } catch (error) {
      console.error("Error getting visual preference profile:", error);
      return this.createDefaultProfile(category);
    }
  }

  private createDefaultProfile(
    category: "kitchen" | "baby" | "skincare",
  ): VisualPreferenceProfile {
    return {
      category,
      featureWeights: new Array(1536).fill(0),
      preferredBackgrounds: ["clean"],
      preferredAspectRatios: [1.0],
      preferredClarity: 80,
      trustCuePreference: 1.0,
      confidence: 0.1,
    };
  }

  private async analyzePreferenceProfile(
    vectors: ImageFeatureVector[],
    category: "kitchen" | "baby" | "skincare",
  ): Promise<VisualPreferenceProfile> {
    const featureWeights = new Array(1536).fill(0);
    const backgroundCounts: Record<string, number> = {};
    const aspectRatioCounts: Record<number, number> = {};
    let totalClarity = 0;
    let trustCueCount = 0;

    for (const vector of vectors) {
      for (let i = 0; i < vector.features.length && i < 1536; i++) {
        featureWeights[i] += vector.features[i] * vector.performance.ctr;
      }

      if (vector.metadata.background) {
        backgroundCounts[vector.metadata.background] =
          (backgroundCounts[vector.metadata.background] || 0) +
          vector.performance.ctr;
      }

      if (vector.metadata.aspectRatio) {
        aspectRatioCounts[vector.metadata.aspectRatio] =
          (aspectRatioCounts[vector.metadata.aspectRatio] || 0) +
          vector.performance.ctr;
      }

      if (vector.metadata.clarity) {
        totalClarity += vector.metadata.clarity * vector.performance.ctr;
      }

      if (vector.metadata.trustCues) {
        trustCueCount += vector.performance.ctr;
      }
    }

    const totalWeight = vectors.reduce((sum, v) => sum + v.performance.ctr, 0);

    if (totalWeight === 0) {
      return this.createDefaultProfile(category);
    }

    for (let i = 0; i < 1536; i++) {
      featureWeights[i] /= totalWeight;
    }

    const preferredBackgrounds = Object.entries(backgroundCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([bg]) => bg);

    const preferredAspectRatios = Object.entries(aspectRatioCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([ratio]) => parseFloat(ratio));

    const preferredClarity = totalClarity / totalWeight;
    const trustCuePreference = trustCueCount / totalWeight;

    const confidence = Math.min(totalWeight / 100, 1.0);

    return {
      category,
      featureWeights,
      preferredBackgrounds,
      preferredAspectRatios,
      preferredClarity,
      trustCuePreference,
      confidence,
    };
  }

  async getTopPerformingImages(
    category?: "kitchen" | "baby" | "skincare",
    limit: number = 10,
  ): Promise<ImageFeatureVector[]> {
    try {
      let results: ImageFeatureVector[] = [];

      if (category) {
        const categoryKeys = await this.redis.zrange(
          `category:${category}`,
          0,
          -1,
        );
        for (const key of categoryKeys.slice(0, limit * 2)) {
          const vector = await this.redis.get(
            (key as string).replace("category:", ""),
          );
          if (vector) {
            results.push(JSON.parse(vector as string));
          }
        }
      } else {
        const allKeys = await this.redis.keys("vector:*");
        for (const key of allKeys.slice(0, limit * 2)) {
          const vector = await this.redis.get(key);
          if (vector) {
            results.push(JSON.parse(vector as string));
          }
        }
      }

      results.sort((a, b) => b.performance.ctr - a.performance.ctr);
      return results.slice(0, limit);
    } catch (error) {
      console.error("Error getting top performing images:", error);
      return [];
    }
  }

  async cleanupOldVectors(
    olderThan: number = 7 * 24 * 60 * 60 * 1000,
  ): Promise<void> {
    try {
      const now = Date.now();
      const keysToDelete: string[] = [];

      for (const [id, vector] of this.vectorIndex.entries()) {
        if (now - vector.createdAt > olderThan) {
          keysToDelete.push(`vector:${id}`);
        }
      }

      for (const key of keysToDelete) {
        await this.redis.del(key);
        this.vectorIndex.delete(key.replace("vector:", ""));
      }
    } catch (error) {
      console.error("Error cleaning up old vectors:", error);
    }
  }

  async getMemoryStats(): Promise<any> {
    try {
      const totalVectors = await this.redis.zcard("performance_index");
      const categoryStats: Record<string, number> = {};

      for (const category of ["kitchen", "baby", "skincare"]) {
        const count = await this.redis.zcard(`category:${category}`);
        categoryStats[category] = count;
      }

      return {
        totalVectors,
        categoryStats,
        indexSize: this.vectorIndex.size,
        lastCleanup: Date.now(),
      };
    } catch (error) {
      console.error("Error getting memory stats:", error);
      return null;
    }
  }
}

export { VectorImageMemory };
export type { ImageFeatureVector, VectorSearchResult, VisualPreferenceProfile };
