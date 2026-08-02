// Lazada Deal Enricher Engine
// Enrich raw Lazada product items with Redis price trend history, discount threshold checks (>30%), and visual rank scores before passing to AI

import { Redis } from "@upstash/redis";
import { AIImageRanker } from "./ai-image-ranker";
import { VectorImageMemory } from "./vector-image-memory";

interface PriceTrend {
  current: number;
  historical: number[];
  trend: "rising" | "falling" | "stable";
  volatility: number;
}

interface DiscountThreshold {
  minimum: number;
  current: number;
  meetsThreshold: boolean;
  savings: number;
}

interface VisualRankScore {
  ctrScore: number;
  clarity: number;
  aspectRatio: number;
  background: "clean" | "busy" | "distracting";
  trustCues: boolean;
}

interface EnrichedProduct {
  productId: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  discount: number;
  stock: number;
  rating: number;
  category: "kitchen" | "baby" | "skincare";
  images: string[];
  affiliateLink: string;
  priceTrend: PriceTrend;
  discountThreshold: DiscountThreshold;
  visualRankScore: VisualRankScore;
  compositeScore: number;
  isFlashSale: boolean;
  confidence: number;
  recommendations: string[];
}

interface RawLazadaProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  discount: number;
  stock: number;
  rating: number;
  category: "kitchen" | "baby" | "skincare";
  images: string[];
  affiliateLink: string;
}

class LazadaDealEnricher {
  private redis: Redis;
  private imageRanker: AIImageRanker;
  private vectorMemory: VectorImageMemory;

  constructor() {
    this.redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });

    this.imageRanker = new AIImageRanker();
    this.vectorMemory = new VectorImageMemory();
  }

  async getPriceTrend(productId: string): Promise<PriceTrend> {
    try {
      const cacheKey = `price_trend:${productId}`;
      let trend = await this.redis.get(cacheKey);

      if (trend) {
        return JSON.parse(trend as string);
      }

      const defaultTrend: PriceTrend = {
        current: 0,
        historical: [],
        trend: "stable",
        volatility: 0,
      };

      await this.redis.setex(cacheKey, 3600, JSON.stringify(defaultTrend));
      return defaultTrend;
    } catch (error) {
      console.error("Error getting price trend:", error);
      return {
        current: 0,
        historical: [],
        trend: "stable",
        volatility: 0,
      };
    }
  }

  async analyzePriceTrend(
    currentPrice: number,
    historicalPrices: number[],
  ): Promise<PriceTrend> {
    if (historicalPrices.length === 0) {
      return {
        current: currentPrice,
        historical: [currentPrice],
        trend: "stable",
        volatility: 0,
      };
    }

    const avgPrice =
      historicalPrices.reduce((a, b) => a + b, 0) / historicalPrices.length;
    const priceChange = currentPrice - avgPrice;
    const percentageChange = (priceChange / avgPrice) * 100;

    let trend: "rising" | "falling" | "stable" = "stable";
    if (percentageChange > 2) trend = "rising";
    else if (percentageChange < -2) trend = "falling";

    const variance =
      historicalPrices.reduce((sum, price) => {
        return sum + Math.pow(price - avgPrice, 2);
      }, 0) / historicalPrices.length;
    const volatility = Math.sqrt(variance);

    const newHistorical = [...historicalPrices, currentPrice];
    if (newHistorical.length > 10) {
      newHistorical.shift();
    }

    return {
      current: currentPrice,
      historical: newHistorical,
      trend,
      volatility,
    };
  }

  async updatePriceTrend(productId: string, price: number): Promise<void> {
    try {
      const trend = await this.getPriceTrend(productId);
      const newTrend = await this.analyzePriceTrend(price, trend.historical);

      await this.redis.setex(
        `price_trend:${productId}`,
        3600,
        JSON.stringify(newTrend),
      );
    } catch (error) {
      console.error("Error updating price trend:", error);
    }
  }

  calculateDiscountThreshold(
    currentPrice: number,
    originalPrice?: number,
  ): DiscountThreshold {
    const minimum = 30; // 30% minimum discount threshold

    let actualDiscount = 0;
    if (originalPrice && originalPrice > 0) {
      actualDiscount = ((originalPrice - currentPrice) / originalPrice) * 100;
    }

    const meetsThreshold = actualDiscount >= minimum;
    const savings = originalPrice ? originalPrice - currentPrice : 0;

    return {
      minimum,
      current: actualDiscount,
      meetsThreshold,
      savings,
    };
  }

  async getVisualRankScore(
    productId: string,
    images: string[],
  ): Promise<VisualRankScore> {
    try {
      const cacheKey = `visual_rank:${productId}`;
      let cachedScore = await this.redis.get(cacheKey);

      if (cachedScore) {
        return JSON.parse(cachedScore as string);
      }

      if (images.length === 0) {
        return {
          ctrScore: 0,
          clarity: 0,
          aspectRatio: 0,
          background: "clean",
          trustCues: false,
        };
      }

      const payload = {
        productId,
        images,
        category: "kitchen" as const,
        price: 0,
        discount: 0,
        stock: 0,
        rating: 0,
      };

      const rankedImage = await this.imageRanker.rankProductImages(payload);

      const score = {
        ctrScore: rankedImage.ctrScore,
        clarity: rankedImage.clarity,
        aspectRatio: rankedImage.aspectRatio,
        background: rankedImage.background,
        trustCues: rankedImage.trustCues,
      };

      await this.redis.setex(cacheKey, 1800, JSON.stringify(score));

      return score;
    } catch (error) {
      console.error("Error getting visual rank score:", error);
      return {
        ctrScore: 0,
        clarity: 0,
        aspectRatio: 0,
        background: "clean",
        trustCues: false,
      };
    }
  }

  async storeVisualPerformance(
    productId: string,
    imageUrl: string,
    ctrScore: number,
  ): Promise<void> {
    try {
      const vector = {
        id: `${productId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        productId,
        imageUrl,
        category: "kitchen" as const,
        features: new Array(1536).fill(0), // Would be populated by actual feature extraction
        ctrScore,
        metadata: {
          clarity: ctrScore * 100,
          aspectRatio: 1.0,
          background: "clean",
          trustCues: true,
        },
        performance: {
          clicks: 0,
          conversions: 0,
          ctr: ctrScore,
          lastClicked: 0,
          totalViews: 100,
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await this.vectorMemory.storeImageVector(vector);
    } catch (error) {
      console.error("Error storing visual performance:", error);
    }
  }

  calculateCompositeScore(
    discountThreshold: DiscountThreshold,
    priceTrend: PriceTrend,
    visualRankScore: VisualRankScore,
  ): number {
    const discountWeight = 0.4;
    const trendWeight = 0.3;
    const visualWeight = 0.3;

    const discountScore = discountThreshold.meetsThreshold
      ? discountThreshold.current
      : discountThreshold.current * 0.5;
    const trendScore =
      priceTrend.trend === "falling"
        ? 80
        : priceTrend.trend === "rising"
          ? 60
          : 40;
    const visualScore = visualRankScore.ctrScore;

    const compositeScore =
      discountScore * discountWeight +
      trendScore * trendWeight +
      visualScore * visualWeight;

    return Math.min(compositeScore, 100);
  }

  async generateRecommendations(
    product: EnrichedProduct,
    similarProducts: EnrichedProduct[],
  ): Promise<string[]> {
    const recommendations: string[] = [];

    if (product.discountThreshold.meetsThreshold) {
      recommendations.push("Flash Sale Alert!");
    }

    if (product.priceTrend.trend === "falling") {
      recommendations.push("Price dropping - buy now!");
    }

    if (product.stock < 10) {
      recommendations.push("Limited stock available");
    }

    if (product.rating >= 4.5) {
      recommendations.push("Highly rated product");
    }

    if (product.visualRankScore.trustCues) {
      recommendations.push("Professional product photography");
    }

    return recommendations;
  }

  async enrichProduct(rawProduct: RawLazadaProduct): Promise<EnrichedProduct> {
    try {
      const priceTrend = await this.getPriceTrend(rawProduct.id);
      await this.updatePriceTrend(rawProduct.id, rawProduct.price);

      const discountThreshold = this.calculateDiscountThreshold(
        rawProduct.price,
        rawProduct.originalPrice,
      );

      const visualRankScore = await this.getVisualRankScore(
        rawProduct.id,
        rawProduct.images,
      );

      if (rawProduct.images.length > 0) {
        await this.storeVisualPerformance(
          rawProduct.id,
          rawProduct.images[0],
          visualRankScore.ctrScore,
        );
      }

      const compositeScore = this.calculateCompositeScore(
        discountThreshold,
        priceTrend,
        visualRankScore,
      );

      const isFlashSale =
        discountThreshold.meetsThreshold && rawProduct.stock < 50;

      const recommendations = await this.generateRecommendations(
        {} as EnrichedProduct,
        [],
      );

      const enriched: EnrichedProduct = {
        productId: rawProduct.id,
        name: rawProduct.name,
        description: rawProduct.description,
        price: rawProduct.price,
        originalPrice: rawProduct.originalPrice,
        discount: rawProduct.discount,
        stock: rawProduct.stock,
        rating: rawProduct.rating,
        category: rawProduct.category,
        images: rawProduct.images,
        affiliateLink: rawProduct.affiliateLink,
        priceTrend,
        discountThreshold,
        visualRankScore,
        compositeScore,
        isFlashSale,
        confidence: compositeScore / 100,
        recommendations,
      };

      return enriched;
    } catch (error) {
      console.error("Error enriching product:", error);
      throw error;
    }
  }

  async enrichBatch(products: RawLazadaProduct[]): Promise<EnrichedProduct[]> {
    const results: EnrichedProduct[] = [];

    for (const product of products) {
      try {
        const enriched = await this.enrichProduct(product);
        results.push(enriched);
      } catch (error) {
        console.error(`Error enriching product ${product.id}:`, error);
      }
    }

    return results;
  }

  async getDealRecommendations(
    category?: "kitchen" | "baby" | "skincare",
    minScore: number = 70,
    limit: number = 20,
  ): Promise<EnrichedProduct[]> {
    try {
      const cacheKey = `deals:${category || "all"}:${minScore}`;
      let cachedDeals = await this.redis.get(cacheKey);

      if (cachedDeals) {
        return JSON.parse(cachedDeals as string);
      }

      const allProducts = await this.redis.keys("product:*");
      const enrichedProducts: EnrichedProduct[] = [];

      for (const key of allProducts.slice(0, 100)) {
        const product = await this.redis.get(key);
        if (product) {
          const rawProduct = JSON.parse(product as string);
          const enriched = await this.enrichProduct(rawProduct);
          if (enriched.compositeScore >= minScore) {
            enrichedProducts.push(enriched);
          }
        }
      }

      enrichedProducts.sort((a, b) => b.compositeScore - a.compositeScore);
      const topDeals = enrichedProducts.slice(0, limit);

      await this.redis.setex(cacheKey, 300, JSON.stringify(topDeals));

      return topDeals;
    } catch (error) {
      console.error("Error getting deal recommendations:", error);
      return [];
    }
  }
}

export { LazadaDealEnricher };
export type { RawLazadaProduct, EnrichedProduct };
