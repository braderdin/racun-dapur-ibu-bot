// Vector Deduplication Sentinel
// Perform Cosine Similarity checks (>0.85 threshold) in Upstash Vector to reject semantically identical products from being posted within 7 days

import { Redis } from "@upstash/redis";
import { OpenAI } from "openai";

interface ProductVector {
  id: string;
  productId: string;
  category: "kitchen" | "baby" | "skincare";
  features: number[];
  embedding: number[];
  postedAt: number;
  lastPosted: number;
  similarityScore: number;
  metadata: {
    name: string;
    price: number;
    discount: number;
    stock: number;
    rating: number;
    images: string[];
  };
}

interface DeduplicationResult {
  isDuplicate: boolean;
  similarityScore: number;
  duplicateProductId?: string;
  duplicatePostedAt?: number;
  suggestedAlternative?: string;
}

interface SimilarityThreshold {
  category: "kitchen" | "baby" | "skincare";
  threshold: number;
  timeWindow: number; // in milliseconds
}

class VectorDedupSentinel {
  private redis: Redis;
  private openai: OpenAI;
  private similarityThresholds: SimilarityThreshold[];
  private vectorIndex: Map<string, ProductVector>;

  constructor() {
    this.redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });

    this.openai = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.OPENROUTER_BASE_URL,
    });

    this.similarityThresholds = [
      {
        category: "kitchen",
        threshold: 0.85,
        timeWindow: 7 * 24 * 60 * 60 * 1000,
      }, // 7 days
      {
        category: "baby",
        threshold: 0.85,
        timeWindow: 7 * 24 * 60 * 60 * 1000,
      },
      {
        category: "skincare",
        threshold: 0.9,
        timeWindow: 3 * 24 * 60 * 60 * 1000,
      }, // 3 days (stricter for skincare)
    ];

    this.vectorIndex = new Map();
    this.loadVectorIndex();
  }

  private async loadVectorIndex(): Promise<void> {
    try {
      const keys = await this.redis.keys("product_vector:*");
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

  async generateProductEmbedding(
    productId: string,
    metadata: any,
  ): Promise<number[]> {
    try {
      const embeddingText = this.buildEmbeddingText(productId, metadata);
      const embeddingResponse = await this.openai.embeddings.create({
        model: "text-embedding-3-small",
        input: embeddingText,
        dimensions: 1536,
      });

      return embeddingResponse.data[0].embedding;
    } catch (error) {
      console.error("Error generating product embedding:", error);
      return [];
    }
  }

  private buildEmbeddingText(productId: string, metadata: any): string {
    const components = [
      `Product ID: ${productId}`,
      `Category: ${metadata.category}`,
      `Name: ${metadata.name}`,
      `Price: ${metadata.price}`,
      `Discount: ${metadata.discount}%`,
      `Stock: ${metadata.stock}`,
      `Rating: ${metadata.rating}`,
      `Images: ${metadata.images.length}`,
      `Features: ${metadata.features?.join(", ") || "none"}`,
    ];

    return components.join(" | ");
  }

  async storeProductVector(vector: ProductVector): Promise<void> {
    try {
      const key = `product_vector:${vector.id}`;
      await this.redis.setex(key, 604800, JSON.stringify(vector)); // 7 days TTL
      this.vectorIndex.set(vector.id, vector);

      await this.redis.zadd("category_vectors", {
        score: vector.similarityScore,
        member: `category:${vector.category}:${vector.id}`,
      });
    } catch (error) {
      console.error("Error storing product vector:", error);
    }
  }

  async checkForDuplicates(
    productId: string,
    category: "kitchen" | "baby" | "skincare",
    metadata: any,
  ): Promise<DeduplicationResult> {
    try {
      const threshold = this.similarityThresholds.find(
        (t) => t.category === category,
      );
      if (!threshold) {
        return { isDuplicate: false, similarityScore: 0 };
      }

      const now = Date.now();
      const timeWindowStart = now - threshold.timeWindow;

      const similarVectors = await this.searchSimilarVectors(
        category,
        threshold.threshold,
      );

      for (const vector of similarVectors) {
        if (vector.postedAt < timeWindowStart) {
          continue; // Outside time window
        }

        const similarity = vector.similarityScore;
        if (similarity >= threshold.threshold) {
          return {
            isDuplicate: true,
            similarityScore: similarity,
            duplicateProductId: vector.productId,
            duplicatePostedAt: vector.postedAt,
            suggestedAlternative: this.generateAlternativeSuggestion(
              vector.metadata,
              metadata,
            ),
          };
        }
      }

      return { isDuplicate: false, similarityScore: 0 };
    } catch (error) {
      console.error("Error checking for duplicates:", error);
      return { isDuplicate: false, similarityScore: 0 };
    }
  }

  private async searchSimilarVectors(
    category: "kitchen" | "baby" | "skincare",
    minSimilarity: number,
  ): Promise<ProductVector[]> {
    try {
      const categoryKeys = await this.redis.zrange(
        `category:${category}`,
        0,
        -1,
      );
      const similarVectors: ProductVector[] = [];

      for (const key of categoryKeys) {
        const vector = await this.redis.get(key.replace("category:", ""));
        if (vector) {
          const parsedVector = JSON.parse(vector as string);
          if (parsedVector.similarityScore >= minSimilarity) {
            similarVectors.push(parsedVector);
          }
        }
      }

      similarVectors.sort((a, b) => b.similarityScore - a.similarityScore);
      return similarVectors;
    } catch (error) {
      console.error("Error searching similar vectors:", error);
      return [];
    }
  }

  private generateAlternativeSuggestion(
    existing: any,
    newProduct: any,
  ): string {
    const alternatives = [
      `Try similar products with different features: ${existing.features.join(", ")} vs ${newProduct.features.join(", ")}`,
      `Consider different price range: ${existing.price} vs ${newProduct.price}`,
      `Explore other categories: ${existing.category} vs ${newProduct.category}`,
      `Check stock availability: ${existing.stock} vs ${newProduct.stock}`,
    ];

    return alternatives[Math.floor(Math.random() * alternatives.length)];
  }

  async updateProductVector(
    productId: string,
    category: "kitchen" | "baby" | "skincare",
    metadata: any,
    posted: boolean = false,
  ): Promise<void> {
    try {
      const existingVector = this.vectorIndex.get(`product:${productId}`);

      if (existingVector) {
        existingVector.lastPosted = Date.now();
        if (posted) {
          existingVector.postedAt = Date.now();
        }
        existingVector.metadata = { ...existingVector.metadata, ...metadata };

        await this.storeProductVector(existingVector);
      } else {
        const embedding = await this.generateProductEmbedding(
          productId,
          metadata,
        );

        const newVector: ProductVector = {
          id: `product:${productId}`,
          productId,
          category,
          features: metadata.features || [],
          embedding,
          postedAt: posted ? Date.now() : 0,
          lastPosted: Date.now(),
          similarityScore: 0.5, // Default similarity
          metadata: {
            name: metadata.name,
            price: metadata.price,
            discount: metadata.discount,
            stock: metadata.stock,
            rating: metadata.rating,
            images: metadata.images,
          },
        };

        await this.storeProductVector(newVector);
      }
    } catch (error) {
      console.error("Error updating product vector:", error);
    }
  }

  async getDuplicateStats(
    category?: "kitchen" | "baby" | "skincare",
  ): Promise<any> {
    try {
      const stats: any = {};

      for (const threshold of this.similarityThresholds) {
        if (category && threshold.category !== category) continue;

        const categoryKeys = await this.redis.zrange(
          `category:${threshold.category}`,
          0,
          -1,
        );
        const vectors: ProductVector[] = [];

        for (const key of categoryKeys.slice(0, 100)) {
          const vector = await this.redis.get(key.replace("category:", ""));
          if (vector) {
            vectors.push(JSON.parse(vector as string));
          }
        }

        const withinTimeWindow = vectors.filter((v) => {
          const timeWindowStart = Date.now() - threshold.timeWindow;
          return v.postedAt > timeWindowStart && v.postedAt > 0;
        });

        const duplicates = withinTimeWindow.filter(
          (v) => v.similarityScore >= threshold.threshold,
        );

        stats[`${threshold.category}_duplicates`] = {
          totalVectors: vectors.length,
          withinTimeWindow: withinTimeWindow.length,
          duplicates: duplicates.length,
          threshold: threshold.threshold,
          timeWindowDays: threshold.timeWindow / (24 * 60 * 60 * 1000),
        };
      }

      return stats;
    } catch (error) {
      console.error("Error getting duplicate stats:", error);
      return null;
    }
  }

  async cleanupOldVectors(
    olderThan: number = 30 * 24 * 60 * 60 * 1000,
  ): Promise<void> {
    try {
      const now = Date.now();
      const keysToDelete: string[] = [];

      for (const [id, vector] of this.vectorIndex.entries()) {
        if (now - vector.lastPosted > olderThan) {
          keysToDelete.push(`product_vector:${id}`);
        }
      }

      for (const key of keysToDelete) {
        await this.redis.del(key);
        this.vectorIndex.delete(key.replace("product_vector:", ""));
      }
    } catch (error) {
      console.error("Error cleaning up old vectors:", error);
    }
  }

  async getSimilarityThresholds(): Promise<SimilarityThreshold[]> {
    return this.similarityThresholds;
  }

  async updateSimilarityThreshold(
    category: "kitchen" | "baby" | "skincare",
    threshold: number,
    timeWindow: number,
  ): Promise<void> {
    for (let i = 0; i < this.similarityThresholds.length; i++) {
      if (this.similarityThresholds[i].category === category) {
        this.similarityThresholds[i] = { category, threshold, timeWindow };
        break;
      }
    }
  }

  async getVectorCount(): Promise<number> {
    return this.vectorIndex.size;
  }

  async getRecentVectors(limit: number = 10): Promise<ProductVector[]> {
    try {
      const keys = await this.redis.keys("product_vector:*");
      const vectors: ProductVector[] = [];

      for (const key of keys.slice(0, 100)) {
        const vector = await this.redis.get(key);
        if (vector) {
          vectors.push(JSON.parse(vector as string));
        }
      }

      vectors.sort((a, b) => b.lastPosted - a.lastPosted);
      return vectors.slice(0, limit);
    } catch (error) {
      console.error("Error getting recent vectors:", error);
      return [];
    }
  }
}

export {
  VectorDedupSentinel,
  ProductVector,
  DeduplicationResult,
  SimilarityThreshold,
};
