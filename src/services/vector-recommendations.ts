/*
 * Upstash Vector Product Recommendation Engine
 * Semantic recommendation service querying Upstash Vector
 * to display "Related Kitchen Deals You Might Like"
 * based on product embedding similarity scores.
 *
 * Phase 8: Autonomous AI Curation Engine
 * All credentials read from environment variables — no hardcoded secrets.
 */

import { Env } from "../types/env";
import { CONSTANTS } from "../config/constants";
import { logger } from "../utils/logger";
import { ProductItem } from "../types/product";
import { UpstashVectorService } from "./upstash-vector";

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface Recommendation {
  productId: string;
  productName: string;
  imageUrl: string;
  affiliateUrl: string;
  platform: "lazada" | "shopee";
  price: number;
  discountPercent: number;
  similarityScore: number;
  rank: number;
  reason: string;
}

export interface RecommendationQuery {
  productId: string;
  productName: string;
  category: string;
  embeddingVector?: number[];
  topK: number;
  similarityThreshold: number;
}

export interface RecommendationResult {
  queryProductId: string;
  recommendations: Recommendation[];
  totalQueried: number;
  processingTimeMs: number;
  cacheHit: boolean;
}

export interface RecommendationConfig {
  topK: number;
  similarityThreshold: number;
  cacheTTLSeconds: number;
  minSimilarityScore: number;
  maxRecommendationsPerCategory: number;
  enableCategoryBoost: boolean;
}

// ---------------------------------------------------------------------------
// Default Configuration
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: RecommendationConfig = {
  topK: 5,
  similarityThreshold: 0.7,
  cacheTTLSeconds: 3600,
  minSimilarityScore: 0.5,
  maxRecommendationsPerCategory: 10,
  enableCategoryBoost: true,
};

// ---------------------------------------------------------------------------
// Vector Recommendations Service
// ---------------------------------------------------------------------------

export class VectorRecommendationsService {
  private config: RecommendationConfig;
  private env: Env;
  private vectorService: UpstashVectorService;
  private cache: Map<string, RecommendationResult> = new Map();

  constructor(
    env: Env,
    vectorService: UpstashVectorService,
    config?: Partial<RecommendationConfig>,
  ) {
    this.env = env;
    this.vectorService = vectorService;
    this.config = { ...DEFAULT_CONFIG, ...config };

    logger.info(
      "VectorRecommendationsService initialized",
      {
        topK: this.config.topK,
        similarityThreshold: this.config.similarityThreshold,
        cacheTTLSeconds: this.config.cacheTTLSeconds,
      },
      "VectorRecommendationsService",
    );
  }

  // -----------------------------------------------------------------------
  // Get recommendations for a product
  // -----------------------------------------------------------------------

  async getRecommendations(
    product: ProductItem,
    allProducts: ProductItem[],
  ): Promise<RecommendationResult> {
    const startTime = Date.now();
    const cacheKey = `recs:${product.id}`;

    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached) {
      logger.debug(
        "Cache hit for recommendations",
        {
          productId: product.id,
        },
        "VectorRecommendationsService",
      );

      return { ...cached, processingTimeMs: Date.now() - startTime };
    }

    // Build query
    const query: RecommendationQuery = {
      productId: product.id,
      productName: product.title,
      category: this.inferCategory(product),
      topK: this.config.topK,
      similarityThreshold: this.config.similarityThreshold,
    };

    // Query Upstash Vector for similar products
    let vectorResults: Array<{
      id: string;
      title: string;
      similarity: number;
    }> = [];

    try {
      vectorResults = await this.vectorService.searchSimilar(product, 0.7);
    } catch (error) {
      logger.warn(
        "Vector query failed, falling back to category-based",
        {
          error: error instanceof Error ? error.message : String(error),
        },
        "VectorRecommendationsService",
      );
    }

    // Build recommendations
    const recommendations = this.buildRecommendations(
      product,
      allProducts,
      vectorResults,
    );

    const result: RecommendationResult = {
      queryProductId: product.id,
      recommendations,
      totalQueried: allProducts.length,
      processingTimeMs: Date.now() - startTime,
      cacheHit: false,
    };

    // Cache the result
    this.cache.set(cacheKey, result);

    // Set cache expiry
    setTimeout(() => {
      this.cache.delete(cacheKey);
    }, this.config.cacheTTLSeconds * 1000);

    logger.info(
      "Recommendations generated",
      {
        productId: product.id,
        recommendationCount: recommendations.length,
        processingTimeMs: result.processingTimeMs,
      },
      "VectorRecommendationsService",
    );

    return result;
  }

  // -----------------------------------------------------------------------
  // Get trending recommendations (for homepage)
  // -----------------------------------------------------------------------

  async getTrendingRecommendations(
    allProducts: ProductItem[],
    limit?: number,
  ): Promise<RecommendationResult> {
    const startTime = Date.now();
    const topK = limit || this.config.topK;

    // Score all products by trending signals
    const scored = allProducts.map((product) => {
      const score = this.computeTrendingScore(product);
      return { product, score };
    });

    // Sort by score descending and take top K
    scored.sort((a, b) => b.score - a.score);
    const topProducts = scored.slice(0, topK);

    const recommendations: Recommendation[] = topProducts.map(
      (item, index) => ({
        productId: item.product.id,
        productName: item.product.title,
        imageUrl: item.product.imageUrl,
        affiliateUrl: item.product.affiliateUrl,
        platform: this.inferPlatform(item.product),
        price: this.parsePrice(item.product.price),
        discountPercent: this.parseDiscount(item.product.discountRate),
        similarityScore: item.score,
        rank: index + 1,
        reason: "Trending in your area",
      }),
    );

    const result: RecommendationResult = {
      queryProductId: "trending",
      recommendations,
      totalQueried: allProducts.length,
      processingTimeMs: Date.now() - startTime,
      cacheHit: false,
    };

    return result;
  }

  // -----------------------------------------------------------------------
  // Clear cache
  // -----------------------------------------------------------------------

  clearCache(): void {
    this.cache.clear();
    logger.info(
      "Recommendation cache cleared",
      {},
      "VectorRecommendationsService",
    );
  }

  // -----------------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------------

  private buildRecommendations(
    queryProduct: ProductItem,
    allProducts: ProductItem[],
    vectorResults: Array<{ id: string; title: string; similarity: number }>,
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];
    const queryCategory = this.inferCategory(queryProduct);
    const queryPrice = this.parsePrice(queryProduct.price);

    // Create a map of vector results for quick lookup
    const vectorMap = new Map(vectorResults.map((r) => [r.id, r.similarity]));

    for (const product of allProducts) {
      // Skip the query product itself
      if (product.id === queryProduct.id) continue;

      // Get similarity score from vector results
      const similarity = vectorMap.get(product.id) || 0;

      // Filter by minimum similarity threshold
      if (similarity < this.config.minSimilarityScore) continue;

      // Category boost
      let boost = 1.0;
      if (this.config.enableCategoryBoost) {
        const productCategory = this.inferCategory(product);
        if (productCategory === queryCategory) {
          boost = 1.3;
        }
      }

      // Price proximity boost (products within 50% price range)
      const productPrice = this.parsePrice(product.price);
      if (queryPrice > 0 && productPrice > 0) {
        const priceRatio =
          Math.min(productPrice, queryPrice) /
          Math.max(productPrice, queryPrice);
        if (priceRatio > 0.5) {
          boost *= 1.1;
        }
      }

      const adjustedScore = similarity * boost;

      recommendations.push({
        productId: product.id,
        productName: product.title,
        imageUrl: product.imageUrl,
        affiliateUrl: product.affiliateUrl,
        platform: this.inferPlatform(product),
        price: productPrice,
        discountPercent: this.parseDiscount(product.discountRate),
        similarityScore: Math.round(adjustedScore * 100) / 100,
        rank: 0, // Will be set after sorting
        reason: this.generateReason(similarity, queryCategory, product),
      });
    }

    // Sort by adjusted score descending
    recommendations.sort((a, b) => b.similarityScore - a.similarityScore);

    // Assign ranks and limit to top K
    return recommendations
      .slice(0, this.config.topK)
      .map((rec, index) => ({ ...rec, rank: index + 1 }));
  }

  private computeTrendingScore(product: ProductItem): number {
    let score = 0;

    // Discount boost
    const discount = this.parseDiscount(product.discountRate);
    score += Math.min(30, discount);

    // Rating boost
    const rating = parseFloat(product.rating || "0");
    score += rating * 5;

    // Sales volume boost
    const soldCount = parseInt(product.soldCount || "0", 10);
    if (soldCount > 100) score += 15;
    if (soldCount > 500) score += 10;

    // Flash sale boost
    const title = product.title.toLowerCase();
    if (title.includes("flash sale") || title.includes("promo")) {
      score += 20;
    }

    return Math.min(100, score);
  }

  private inferCategory(product: ProductItem): string {
    const title = product.title.toLowerCase();
    const description = (product as any).product_description || "";

    if (
      title.includes("airfryer") ||
      title.includes("kuali") ||
      title.includes("periuk") ||
      title.includes("pembakar")
    ) {
      return "kitchen";
    }
    if (
      title.includes("bayi") ||
      title.includes("baby") ||
      title.includes("anak")
    ) {
      return "baby";
    }
    if (
      title.includes("skincare") ||
      title.includes("kecantikan") ||
      title.includes("rambut")
    ) {
      return "skincare";
    }
    return "kitchen"; // Default
  }

  private inferPlatform(product: ProductItem): "lazada" | "shopee" {
    const url = product.affiliateUrl.toLowerCase();
    if (url.includes("lazada")) return "lazada";
    if (url.includes("shopee")) return "shopee";
    return "lazada";
  }

  private parsePrice(priceStr?: string): number {
    if (!priceStr) return 0;
    const cleaned = priceStr.replace(/[^0-9.]/g, "");
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }

  private parseDiscount(discountStr?: string): number {
    if (!discountStr) return 0;
    const cleaned = discountStr.replace(/[^0-9.]/g, "");
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }

  private generateReason(
    similarity: number,
    queryCategory: string,
    product: ProductItem,
  ): string {
    const reasons: string[] = [];

    if (similarity > 0.8) reasons.push("Similar to your selection");
    if (similarity > 0.9) reasons.push("Very similar product");

    const category = this.inferCategory(product);
    if (category === queryCategory) reasons.push("Same category");

    const discount = this.parseDiscount(product.discountRate);
    if (discount > 30) reasons.push(`High discount ${discount}%`);

    if (reasons.length === 0) reasons.push("You might like this");

    return reasons.join(" — ");
  }
}

// ---------------------------------------------------------------------------
// Factory helper
// ---------------------------------------------------------------------------

export function createVectorRecommendationsService(
  env: Env,
  vectorService: UpstashVectorService,
): VectorRecommendationsService {
  return new VectorRecommendationsService(env, vectorService, {
    topK: parseInt(env.RECOMMENDATIONS_TOP_K || "5", 10),
    similarityThreshold: parseFloat(env.RECOMMENDATIONS_SIMILARITY || "0.7"),
    cacheTTLSeconds: parseInt(env.RECOMMENDATIONS_CACHE_TTL || "3600", 10),
    enableCategoryBoost: env.RECOMMENDATIONS_CATEGORY_BOOST !== "false",
  });
}
