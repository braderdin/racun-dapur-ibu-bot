/*
 * Automated E-Commerce Deal Curation & Filter Engine
 * Fetches, filters, and ranks raw product deals based on:
 *   - Discount percentage (>30% threshold)
 *   - Stock availability
 *   - Seller rating
 *   - Price thresholds
 * Before passing to anti-repeat filters (Vector Dedup / Redis TTL).
 *
 * Phase 8: Autonomous AI Curation Engine
 * All credentials read from environment variables — no hardcoded secrets.
 */

import { Env } from "../types/env";
import { CONSTANTS } from "../config/constants";
import { logger } from "../utils/logger";
import { ProductItem } from "../types/product";
import { UpstashVectorService } from "./upstash-vector";
import { RedisService } from "./redis";

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface DealFilterCriteria {
  minDiscountPercent: number;
  maxPrice?: number;
  minRating?: number;
  inStockOnly: boolean;
  platforms: ("lazada" | "shopee")[];
  categories?: string[];
}

export interface DealRankScore {
  productId: string;
  title: string;
  score: number;
  discountPercent: number;
  price: number;
  rating: number;
  platform: "lazada" | "shopee";
  reason: string[];
}

export interface CuratedDeal extends DealRankScore {
  affiliateUrl: string;
  imageUrl: string;
  sellerName?: string;
  stockStatus: "in_stock" | "low_stock" | "out_of_stock";
  isFlashSale: boolean;
  flashSaleEnd?: string;
}

export interface DealCurationResult {
  deals: CuratedDeal[];
  totalRaw: number;
  filteredCount: number;
  duplicateSkipped: number;
  processingTimeMs: number;
}

export interface DealCuratorConfig {
  minDiscountPercent: number;
  maxPrice?: number;
  minRating: number;
  inStockOnly: boolean;
  platforms: ("lazada" | "shopee")[];
  categories?: string[];
  priceFloor?: number;
  antiRepeatTtlSeconds: number;
  maxDealsPerRun: number;
}

// ---------------------------------------------------------------------------
// Default Configuration
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: DealCuratorConfig = {
  minDiscountPercent: 30,
  minRating: 3.5,
  inStockOnly: true,
  platforms: ["lazada", "shopee"],
  antiRepeatTtlSeconds: 432000, // 5 days — matches Redis anti-repeat TTL
  maxDealsPerRun: 50,
};

// ---------------------------------------------------------------------------
// Deal Curator Service
// ---------------------------------------------------------------------------

export class DealCuratorService {
  private config: DealCuratorConfig;
  private env: Env;
  private vectorDedup: UpstashVectorService;
  private redisService: RedisService;

  constructor(
    env: Env,
    vectorDedup: UpstashVectorService,
    redisService: RedisService,
    config?: Partial<DealCuratorConfig>,
  ) {
    this.env = env;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.vectorDedup = vectorDedup;
    this.redisService = redisService;

    logger.info(
      "DealCuratorService initialized",
      {
        minDiscountPercent: this.config.minDiscountPercent,
        minRating: this.config.minRating,
        platforms: this.config.platforms,
        maxDealsPerRun: this.config.maxDealsPerRun,
      },
      "DealCuratorService",
    );
  }

  // -----------------------------------------------------------------------
  // Main orchestration method
  // -----------------------------------------------------------------------

  async curateDeals(rawDeals: ProductItem[]): Promise<DealCurationResult> {
    const startTime = Date.now();
    const totalRaw = rawDeals.length;
    const curatedDeals: CuratedDeal[] = [];
    let duplicateSkipped = 0;

    logger.info(
      "Starting deal curation pipeline",
      { totalRaw },
      "DealCuratorService",
    );

    for (const deal of rawDeals) {
      // Anti-repeat check via Redis TTL
      const cacheKey = `deal:curated:${deal.id}`;
      const alreadySeen = await this.redisService.get(cacheKey);
      if (alreadySeen) {
        duplicateSkipped++;
        logger.debug(
          "Skipping duplicate deal",
          { productId: deal.id },
          "DealCuratorService",
        );
        continue;
      }

      // Step 1: Filter by discount threshold
      const discountPercent = this.parseDiscountPercent(deal.discountRate);
      if (discountPercent < this.config.minDiscountPercent) {
        logger.debug(
          "Filtered out — discount below threshold",
          { productId: deal.id, discountPercent },
          "DealCuratorService",
        );
        continue;
      }

      // Step 2: Filter by price threshold
      if (this.config.maxPrice !== undefined) {
        const price = this.parsePrice(deal.price);
        if (price > this.config.maxPrice) {
          logger.debug(
            "Filtered out — price exceeds max",
            { productId: deal.id, price },
            "DealCuratorService",
          );
          continue;
        }
      }

      // Step 3: Filter by price floor
      if (this.config.priceFloor !== undefined) {
        const price = this.parsePrice(deal.price);
        if (price < this.config.priceFloor) {
          logger.debug(
            "Filtered out — price below floor",
            { productId: deal.id, price },
            "DealCuratorService",
          );
          continue;
        }
      }

      // Step 4: Filter by seller rating
      const rating = this.parseRating(deal.rating);
      if (rating < this.config.minRating) {
        logger.debug(
          "Filtered out — rating below minimum",
          { productId: deal.id, rating },
          "DealCuratorService",
        );
        continue;
      }

      // Step 5: Filter by stock availability
      const stockStatus = this.inferStockStatus(deal);
      if (this.config.inStockOnly && stockStatus === "out_of_stock") {
        logger.debug(
          "Filtered out — out of stock",
          { productId: deal.id },
          "DealCuratorService",
        );
        continue;
      }

      // Step 6: Semantic dedup check via Upstash Vector
      const vectorResults = await this.vectorDedup.searchSimilar(deal, 0.85);
      if (vectorResults.length > 0) {
        duplicateSkipped++;
        logger.debug(
          "Skipping semantically duplicate deal",
          { productId: deal.id, matches: vectorResults.length },
          "DealCuratorService",
        );
        continue;
      }

      // Step 7: Determine if flash sale
      const isFlashSale = this.detectFlashSale(deal);

      // Step 8: Compute rank score
      const rankScore = this.computeRankScore(
        deal,
        discountPercent,
        rating,
        stockStatus,
        isFlashSale,
      );

      // Step 9: Mark as seen in Redis (anti-repeat TTL)
      await this.redisService.setEx(
        cacheKey,
        "1",
        this.config.antiRepeatTtlSeconds,
      );

      curatedDeals.push({
        productId: deal.id,
        title: deal.title,
        score: rankScore.score,
        discountPercent,
        price: this.parsePrice(deal.price),
        rating,
        platform: this.inferPlatform(deal),
        reason: rankScore.reasons,
        affiliateUrl: deal.affiliateUrl,
        imageUrl: deal.imageUrl,
        sellerName: deal.title.split(" ")[0],
        stockStatus,
        isFlashSale,
      });

      // Early exit if we have enough deals
      if (curatedDeals.length >= this.config.maxDealsPerRun) {
        logger.info(
          "Reached max deals per run limit",
          { count: curatedDeals.length },
          "DealCuratorService",
        );
        break;
      }
    }

    // Sort by composite score descending
    curatedDeals.sort((a, b) => b.score - a.score);

    const processingTimeMs = Date.now() - startTime;

    logger.info(
      "Deal curation pipeline complete",
      {
        totalRaw,
        filteredCount: curatedDeals.length,
        duplicateSkipped,
        processingTimeMs,
      },
      "DealCuratorService",
    );

    return {
      deals: curatedDeals,
      totalRaw,
      filteredCount: curatedDeals.length,
      duplicateSkipped,
      processingTimeMs,
    };
  }

  // -----------------------------------------------------------------------
  // Filter helpers
  // -----------------------------------------------------------------------

  private parseDiscountPercent(discountRate?: string): number {
    if (!discountRate) return 0;
    const cleaned = discountRate.replace(/[^0-9.]/g, "");
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }

  private parsePrice(priceStr?: string): number {
    if (!priceStr) return 0;
    const cleaned = priceStr.replace(/[^0-9.]/g, "");
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }

  private parseRating(ratingStr?: string): number {
    if (!ratingStr) return 0;
    const parsed = parseFloat(ratingStr);
    return isNaN(parsed) ? 0 : parsed;
  }

  private inferStockStatus(
    deal: ProductItem,
  ): "in_stock" | "low_stock" | "out_of_stock" {
    const soldCount = parseInt(deal.soldCount || "0", 10);
    if (soldCount > 1000) return "low_stock";
    if (
      deal.title.toLowerCase().includes("habis") ||
      deal.title.toLowerCase().includes("sold out")
    ) {
      return "out_of_stock";
    }
    return "in_stock";
  }

  private inferPlatform(deal: ProductItem): "lazada" | "shopee" {
    const url = deal.affiliateUrl.toLowerCase();
    if (url.includes("lazada")) return "lazada";
    if (url.includes("shopee")) return "shopee";
    return "lazada";
  }

  private detectFlashSale(deal: ProductItem): boolean {
    const title = deal.title.toLowerCase();
    const flashKeywords = [
      "flash sale",
      "flash deal",
      "promo hari ini",
      "diskaun terhad",
      "limited time",
      "sekarang",
    ];
    return flashKeywords.some((kw) => title.includes(kw));
  }

  // -----------------------------------------------------------------------
  // Ranking algorithm
  // -----------------------------------------------------------------------

  private computeRankScore(
    deal: ProductItem,
    discountPercent: number,
    rating: number,
    stockStatus: string,
    isFlashSale: boolean,
  ): { score: number; reasons: string[] } {
    const reasons: string[] = [];
    let score = 0;

    // Discount weight: 0-40 points
    const discountScore = Math.min(40, (discountPercent / 100) * 40);
    score += discountScore;
    if (discountPercent >= 50)
      reasons.push(`High discount ${discountPercent}%`);

    // Rating weight: 0-25 points
    const ratingScore = (rating / 5) * 25;
    score += ratingScore;
    if (rating >= 4.5) reasons.push(`Top rating ${rating}`);

    // Flash sale urgency: +15 points
    if (isFlashSale) {
      score += 15;
      reasons.push("Flash sale detected");
    }

    // Stock urgency: +10 points for low stock
    if (stockStatus === "low_stock") {
      score += 10;
      reasons.push("Low stock — urgency signal");
    }

    // Platform bonus: +5 for Lazada (primary platform)
    const platform = this.inferPlatform(deal);
    if (platform === "lazada") {
      score += 5;
      reasons.push("Lazada primary platform");
    }

    // Price accessibility: +5 for sub-RM50 deals
    const price = this.parsePrice(deal.price);
    if (price > 0 && price < 50) {
      score += 5;
      reasons.push(`Budget-friendly RM${price.toFixed(2)}`);
    }

    return { score: Math.round(score * 100) / 100, reasons };
  }

  // -----------------------------------------------------------------------
  // Public method for E2E orchestrator compatibility
  // -----------------------------------------------------------------------

  async curateProduct(productId: string): Promise<DealCurationResult> {
    // This is a simplified version for E2E pipeline - in production would fetch from API
    const mockProduct: ProductItem = {
      id: productId,
      title: "Sample Product",
      price: "99.99",
      originalPrice: "149.99",
      discountRate: "33%",
      imageUrl: "https://example.com/image.jpg",
      affiliateUrl: "https://example.com/affiliate",
      rating: "4.5",
      soldCount: "100",
      category: "kitchen",
      name: "Sample Product",
      stock: "50",
      description: "Sample product description",
      platform: "lazada",
      explanation: "Sample explanation",
    };

    return this.curateDeals([mockProduct]);
  }
}

// ---------------------------------------------------------------------------
// Factory helper — creates a pre-configured curator from environment
// ---------------------------------------------------------------------------

export function createDealCurator(
  env: Env,
  vectorDedup: UpstashVectorService,
  redisService: RedisService,
): DealCuratorService {
  return new DealCuratorService(env, vectorDedup, redisService, {
    minDiscountPercent: parseFloat(env.DEAL_MIN_DISCOUNT_PERCENT || "30"),
    maxPrice: env.DEAL_MAX_PRICE ? parseFloat(env.DEAL_MAX_PRICE) : undefined,
    minRating: parseFloat(env.DEAL_MIN_RATING || "3.5"),
    inStockOnly: env.DEAL_IN_STOCK_ONLY !== "false",
    platforms: (env.DEAL_PLATFORMS || "lazada,shopee").split(",") as (
      "lazada" | "shopee"
    )[],
    maxDealsPerRun: parseInt(env.DEAL_MAX_PER_RUN || "50", 10),
  });
}
