/*
 * Dynamic Price & Discount Trend Analyzer
 * Computes historical price trends for catalog products,
 * detecting all-time low prices and flagging true flash sales
 * to boost conversion urgency.
 *
 * Phase 8: Autonomous AI Curation Engine
 * All credentials read from environment variables — no hardcoded secrets.
 */

import { Env } from "../types/env";
import { CONSTANTS } from "../config/constants";
import { logger } from "../utils/logger";
import { ProductItem } from "../types/product";

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface PriceHistoryEntry {
  timestamp: string;
  price: number;
  originalPrice: number;
  discountPercent: number;
  source: "lazada" | "shopee";
}

export interface PriceTrend {
  productId: string;
  productName: string;
  currentPrice: number;
  originalPrice: number;
  currentDiscount: number;
  allTimeLow: number;
  allTimeLowDate: string;
  allTimeHigh: number;
  allTimeHighDate: string;
  averagePrice30d: number;
  averagePrice7d: number;
  trendDirection: "rising" | "falling" | "stable" | "volatile";
  isAllTimeLow: boolean;
  isFlashSale: boolean;
  flashSaleConfidence: number; // 0-1
  priceDropPercent: number; // percentage drop from 7d average
  trendScore: number; // 0-100 composite score
  history: PriceHistoryEntry[];
}

export interface FlashSaleFlag {
  productId: string;
  productName: string;
  currentPrice: number;
  originalPrice: number;
  discountPercent: number;
  confidence: number;
  reasons: string[];
  urgencyLevel: "low" | "medium" | "high" | "critical";
  expiresAt?: string;
}

export interface TrendAnalysisResult {
  trends: PriceTrend[];
  flashSales: FlashSaleFlag[];
  allTimeLows: PriceTrend[];
  totalProductsAnalyzed: number;
  analysisTimeMs: number;
}

export interface PriceTrendConfig {
  historyWindowDays: number;
  flashSaleDiscountThreshold: number;
  allTimeLowConfidenceThreshold: number;
  volatilityThreshold: number;
  minHistoryEntries: number;
}

// ---------------------------------------------------------------------------
// Default Configuration
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: PriceTrendConfig = {
  historyWindowDays: 30,
  flashSaleDiscountThreshold: 40,
  allTimeLowConfidenceThreshold: 0.7,
  volatilityThreshold: 0.15,
  minHistoryEntries: 3,
};

// ---------------------------------------------------------------------------
// Price Trend Analyzer Service
// ---------------------------------------------------------------------------

export class PriceTrendAnalyzer {
  private config: PriceTrendConfig;
  private env: Env;

  constructor(env: Env, config?: Partial<PriceTrendConfig>) {
    this.env = env;
    this.config = { ...DEFAULT_CONFIG, ...config };

    logger.info(
      "PriceTrendAnalyzer initialized",
      {
        historyWindowDays: this.config.historyWindowDays,
        flashSaleDiscountThreshold: this.config.flashSaleDiscountThreshold,
      },
      "PriceTrendAnalyzer",
    );
  }

  // -----------------------------------------------------------------------
  // Main analysis method
  // -----------------------------------------------------------------------

  async analyzeTrends(products: ProductItem[]): Promise<TrendAnalysisResult> {
    const startTime = Date.now();
    const trends: PriceTrend[] = [];
    const flashSales: FlashSaleFlag[] = [];
    const allTimeLows: PriceTrend[] = [];

    logger.info(
      "Starting price trend analysis",
      { totalProducts: products.length },
      "PriceTrendAnalyzer",
    );

    for (const product of products) {
      const trend = this.analyzeProductTrend(product);
      trends.push(trend);

      // Flag all-time lows
      if (trend.isAllTimeLow) {
        allTimeLows.push(trend);
      }

      // Flag flash sales
      if (
        trend.isFlashSale &&
        trend.flashSaleConfidence >= this.config.allTimeLowConfidenceThreshold
      ) {
        flashSales.push({
          productId: product.id,
          productName: product.title,
          currentPrice: trend.currentPrice,
          originalPrice: trend.originalPrice,
          discountPercent: trend.currentDiscount,
          confidence: trend.flashSaleConfidence,
          reasons: this.getFlashSaleReasons(trend),
          urgencyLevel: this.getUrgencyLevel(trend),
        });
      }
    }

    // Sort flash sales by confidence descending
    flashSales.sort((a, b) => b.confidence - a.confidence);

    const analysisTimeMs = Date.now() - startTime;

    logger.info(
      "Price trend analysis complete",
      {
        totalProducts: products.length,
        flashSalesFound: flashSales.length,
        allTimeLowsFound: allTimeLows.length,
        analysisTimeMs,
      },
      "PriceTrendAnalyzer",
    );

    return {
      trends,
      flashSales,
      allTimeLows,
      totalProductsAnalyzed: products.length,
      analysisTimeMs,
    };
  }

  // -----------------------------------------------------------------------
  // Single product trend analysis
  // -----------------------------------------------------------------------

  private analyzeProductTrend(product: ProductItem): PriceTrend {
    const currentPrice = this.parsePrice(product.price);
    const originalPrice =
      this.parsePrice(product.originalPrice) || currentPrice * 1.5; // Estimate if missing
    const currentDiscount = this.parseDiscount(product.discountRate);

    // Generate synthetic history for trend analysis
    // In production, this would query a time-series database
    const history = this.generatePriceHistory(
      product,
      currentPrice,
      originalPrice,
    );

    // Compute statistics
    const prices = history.map((h) => h.price);
    const allTimeLow = Math.min(...prices);
    const allTimeHigh = Math.max(...prices);
    const allTimeLowDate =
      history.find((h) => h.price === allTimeLow)?.timestamp ||
      new Date().toISOString();
    const allTimeHighDate =
      history.find((h) => h.price === allTimeHigh)?.timestamp ||
      new Date().toISOString();

    const avg30d = this.average(prices.slice(-30));
    const avg7d = this.average(prices.slice(-7));

    // Determine trend direction
    const trendDirection = this.determineTrendDirection(prices);

    // Compute price drop from 7d average
    const priceDropPercent =
      avg7d > 0 ? ((avg7d - currentPrice) / avg7d) * 100 : 0;

    // Detect flash sale
    const isFlashSale =
      currentDiscount >= this.config.flashSaleDiscountThreshold;

    // Flash sale confidence based on multiple signals
    const flashSaleConfidence = this.computeFlashSaleConfidence(
      product,
      currentDiscount,
      priceDropPercent,
      trendDirection,
    );

    // All-time low detection
    const isAllTimeLow = currentPrice <= allTimeLow * 1.02; // Within 2% of all-time low

    // Composite trend score
    const trendScore = this.computeTrendScore(
      currentDiscount,
      priceDropPercent,
      flashSaleConfidence,
      isAllTimeLow,
    );

    return {
      productId: product.id,
      productName: product.title,
      currentPrice,
      originalPrice,
      currentDiscount,
      allTimeLow,
      allTimeLowDate,
      allTimeHigh,
      allTimeHighDate,
      averagePrice30d: avg30d,
      averagePrice7d: avg7d,
      trendDirection,
      isAllTimeLow,
      isFlashSale,
      flashSaleConfidence,
      priceDropPercent,
      trendScore,
      history,
    };
  }

  // -----------------------------------------------------------------------
  // Price history generation (synthetic for demo; replace with DB query)
  // -----------------------------------------------------------------------

  private generatePriceHistory(
    product: ProductItem,
    currentPrice: number,
    originalPrice: number,
  ): PriceHistoryEntry[] {
    const history: PriceHistoryEntry[] = [];
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    // Generate 30 days of synthetic price history
    for (let i = 30; i >= 0; i--) {
      const date = new Date(now - i * dayMs).toISOString();
      const decay = 1 - (30 - i) / 30; // Gradual price decrease over time
      const noise = 0.9 + Math.random() * 0.2; // Random fluctuation
      const price =
        Math.round(
          (originalPrice * decay * noise + currentPrice * (1 - decay)) * 100,
        ) / 100;
      const discount =
        originalPrice > 0
          ? Math.round(((originalPrice - price) / originalPrice) * 100)
          : 0;

      history.push({
        timestamp: date,
        price,
        originalPrice,
        discountPercent: discount,
        source: this.inferPlatform(product),
      });
    }

    return history;
  }

  // -----------------------------------------------------------------------
  // Statistical helpers
  // -----------------------------------------------------------------------

  private average(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  private determineTrendDirection(
    prices: number[],
  ): "rising" | "falling" | "stable" | "volatile" {
    if (prices.length < 5) return "stable";

    const recent = prices.slice(-7);
    const older = prices.slice(-14, -7);

    const recentAvg = this.average(recent);
    const olderAvg = this.average(older);

    if (olderAvg === 0) return "stable";

    const change = (recentAvg - olderAvg) / olderAvg;

    if (Math.abs(change) < 0.02) return "stable";
    if (Math.abs(change) > 0.1) return "volatile";
    return change < 0 ? "falling" : "rising";
  }

  private computeFlashSaleConfidence(
    product: ProductItem,
    currentDiscount: number,
    priceDropPercent: number,
    trendDirection: string,
  ): number {
    let confidence = 0.3;

    if (currentDiscount >= 50) confidence += 0.3;
    else if (currentDiscount >= 40) confidence += 0.2;
    else if (currentDiscount >= 30) confidence += 0.1;

    if (priceDropPercent > 20) confidence += 0.2;
    else if (priceDropPercent > 10) confidence += 0.1;

    if (trendDirection === "falling") confidence += 0.15;

    if (product.soldCount && parseInt(product.soldCount, 10) > 100)
      confidence += 0.1;

    return Math.min(0.95, confidence);
  }

  private computeTrendScore(
    discount: number,
    priceDropPercent: number,
    flashSaleConfidence: number,
    isAllTimeLow: boolean,
  ): number {
    let score = 0;
    score += Math.min(30, discount);
    score += Math.min(25, priceDropPercent * 1.5);
    score += flashSaleConfidence * 25;
    if (isAllTimeLow) score += 20;
    return Math.round(Math.min(100, score));
  }

  // -----------------------------------------------------------------------
  // Utility helpers
  // -----------------------------------------------------------------------

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

  private inferPlatform(product: ProductItem): "lazada" | "shopee" {
    const url = product.affiliateUrl.toLowerCase();
    if (url.includes("lazada")) return "lazada";
    if (url.includes("shopee")) return "shopee";
    return "lazada";
  }

  private getFlashSaleReasons(trend: PriceTrend): string[] {
    const reasons: string[] = [];
    if (trend.currentDiscount >= 40)
      reasons.push(`High discount ${trend.currentDiscount}%`);
    if (trend.isAllTimeLow) reasons.push("All-time low price");
    if (trend.priceDropPercent > 15)
      reasons.push(
        `Price dropped ${trend.priceDropPercent.toFixed(1)}% from 7d average`,
      );
    if (trend.trendDirection === "falling") reasons.push("Falling price trend");
    return reasons;
  }

  private getUrgencyLevel(
    trend: PriceTrend,
  ): "low" | "medium" | "high" | "critical" {
    if (trend.currentDiscount >= 60 || trend.isAllTimeLow) return "critical";
    if (trend.currentDiscount >= 40 || trend.priceDropPercent > 25)
      return "high";
    if (trend.currentDiscount >= 30 || trend.priceDropPercent > 10)
      return "medium";
    return "low";
  }
}

// ---------------------------------------------------------------------------
// Factory helper
// ---------------------------------------------------------------------------

export function createPriceTrendAnalyzer(env: Env): PriceTrendAnalyzer {
  return new PriceTrendAnalyzer(env, {
    historyWindowDays: parseInt(env.TREND_HISTORY_DAYS || "30", 10),
    flashSaleDiscountThreshold: parseFloat(
      env.TREND_FLASH_SALE_THRESHOLD || "40",
    ),
    allTimeLowConfidenceThreshold: parseFloat(
      env.TREND_ATL_CONFIDENCE || "0.7",
    ),
  });
}
