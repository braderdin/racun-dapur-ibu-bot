// AI Hallucination Guard Service
// Real-time validator that cross-checks AI-generated copywriting against raw e-commerce product data
// Blocks hallucinated numbers or fake deals before output

import { Redis } from "@upstash/redis";

export interface ProductData {
  id: string;
  title: string;
  price: number;
  discountPrice: number;
  discountPercent: number;
  originalPrice: number;
  currency: "RM" | "USD" | "SGD";
  category: "kitchen" | "baby" | "skincare";
  brand: string;
  sellerRating: number;
  stockStatus: "in_stock" | "out_of_stock" | "limited";
  affiliateLink: string;
  imageUrls: string[];
  createdAt: number;
  updatedAt: number;
}

export interface HallucinationAuditResult {
  isValid: boolean;
  score: number; // 0.0 to 1.0 confidence score
  issues: string[];
  warnings: string[];
  correctedCopy?: string;
  retryNeeded: boolean;
}

export interface PriceValidationResult {
  isValid: boolean;
  detectedPrice?: number;
  detectedDiscount?: number;
  confidence: number;
}

export class AiHallucinationGuard {
  private redis: Redis;
  private readonly THRESHOLD = 0.85;
  private readonly RETRY_THRESHOLD = 0.7;

  constructor() {
    this.redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }

  /**
   * Validate price consistency between AI copy and actual product data
   * Detects if AI generated prices match the real product prices
   */
  async validatePriceConsistency(
    copy: string,
    realPrice: number,
    discountPrice: number,
    currency: string = "RM",
  ): Promise<PriceValidationResult> {
    const issues: string[] = [];
    let confidence = 1.0;

    // Extract potential price mentions from copy
    const pricePatterns = [
      new RegExp(`\\b(RM\\s?\\d+(?:\\.\\d{1,2})?)\\b`, "gi"),
      new RegExp(`\\b(\\d+(?:\\.\\d{1,2})?)\\s*(?:ringgit|RM)\\b`, "gi"),
      new RegExp(
        `\\bdiska?d?\\s+sebaga?i?\\s+RM?\\s?(\\d+(?:\\.\\d{1,2})?)\\b`,
        "gi",
      ),
      new RegExp(`\\bhemat\\s+RM?\\s?(\\d+(?:\\.\\d{1,2})?)\\b`, "gi"),
    ];

    const detectedPrices: number[] = [];
    for (const pattern of pricePatterns) {
      const matches = copy.matchAll(pattern);
      for (const match of matches) {
        const priceStr = match[0].replace(/[^\d.]/g, "");
        const price = parseFloat(priceStr);
        if (!isNaN(price) && price > 0) {
          detectedPrices.push(price);
        }
      }
    }

    // Check if detected prices match real prices
    const tolerance = 0.05; // 5% tolerance
    let priceMatch = false;
    let discountMatch = false;

    for (const detected of detectedPrices) {
      const priceDiff = Math.abs(detected - realPrice) / realPrice;
      const discountDiff = Math.abs(detected - discountPrice) / discountPrice;

      if (priceDiff <= tolerance) {
        priceMatch = true;
      }
      if (discountDiff <= tolerance) {
        discountMatch = true;
      }
    }

    if (!priceMatch && detectedPrices.length > 0) {
      issues.push(
        `AI mentioned price(s) ${detectedPrices.join(", ")} do not match actual price ${currency} ${realPrice}`,
      );
      confidence -= 0.3;
    }

    if (!discountMatch && detectedPrices.length > 0) {
      issues.push(
        `AI discount price does not match actual discount price ${currency} ${discountPrice}`,
      );
      confidence -= 0.2;
    }

    return {
      isValid: confidence >= this.THRESHOLD,
      detectedPrice: detectedPrices[0],
      detectedDiscount: detectedPrices.find((_, i) => i > 0),
      confidence,
    };
  }

  /**
   * Detect invented or fake promotional offers
   * Flags claims like "50% OFF" when actual discount is different
   */
  async detectInventedPromos(copy: string): Promise<{
    isValid: boolean;
    issues: string[];
    confidence: number;
  }> {
    const issues: string[] = [];
    let confidence = 1.0;

    // Extract discount percentages
    const discountPatterns = [
      /(\d+(?:\.\d+)?)\s*%?\s*off/gi,
      /diska?d?\s+(\d+(?:\.\d+)?)\s*%?/gi,
      /hemat\s+(\d+(?:\.\d+)?)\s*%?/gi,
    ];

    const detectedDiscounts: number[] = [];
    for (const pattern of discountPatterns) {
      const matches = copy.matchAll(pattern);
      for (const match of matches) {
        const discount = parseFloat(match[1]);
        if (!isNaN(discount) && discount > 0 && discount <= 100) {
          detectedDiscounts.push(discount);
        }
      }
    }

    // Check for suspiciously high discounts
    for (const discount of detectedDiscounts) {
      if (discount > 90) {
        issues.push(
          `AI claims ${discount}% discount - suspiciously high, likely hallucinated`,
        );
        confidence -= 0.4;
      }
    }

    // Check for round numbers that seem fake
    const roundNumbers = detectedDiscounts.filter((d) => d % 10 === 0);
    if (
      roundNumbers.length > 0 &&
      roundNumbers.length === detectedDiscounts.length
    ) {
      issues.push(
        `AI uses only round discount numbers (${roundNumbers.join(", ")}%) - may be fabricated`,
      );
      confidence -= 0.2;
    }

    return {
      isValid: confidence >= this.THRESHOLD,
      issues,
      confidence,
    };
  }

  /**
   * Full copy integrity audit against product data
   * Returns audit score and recommendations
   */
  async auditCopyIntegrity(
    copy: string,
    product: ProductData,
  ): Promise<HallucinationAuditResult> {
    const issues: string[] = [];
    const warnings: string[] = [];
    let totalScore = 1.0;

    // Validate price consistency
    const priceValidation = await this.validatePriceConsistency(
      copy,
      product.price,
      product.discountPrice,
      product.currency,
    );

    if (!priceValidation.isValid) {
      issues.push(...priceValidation.issues);
      totalScore -= (1 - priceValidation.confidence) * 0.4;
    }

    // Detect invented promos
    const promoValidation = await this.detectInventedPromos(copy);
    if (!promoValidation.isValid) {
      issues.push(...promoValidation.issues);
      totalScore -= (1 - promoValidation.confidence) * 0.3;
    }

    // Check for brand name accuracy
    const brandRegex = new RegExp(product.brand, "i");
    if (!brandRegex.test(copy)) {
      warnings.push(`Brand name "${product.brand}" not mentioned in copy`);
      totalScore -= 0.05;
    }

    // Check for category relevance
    const categoryKeywords: Record<string, string[]> = {
      kitchen: ["dapur", "masak", "kotak makan", "dapur anak", "dapur ibu"],
      baby: ["bayi", "anak", "bayi dan ibu", "perlengkapan bayi"],
      skincare: ["kulit", "care", "beauty", "wajah", "badan"],
    };

    const keywords = categoryKeywords[product.category] || [];
    const hasCategoryKeyword = keywords.some((kw) =>
      copy.toLowerCase().includes(kw),
    );
    if (!hasCategoryKeyword) {
      warnings.push(
        `Copy may lack category-specific keywords for ${product.category}`,
      );
      totalScore -= 0.05;
    }

    // Check for affiliate link presence in reply/comment
    if (!copy.includes(product.affiliateLink) && product.affiliateLink) {
      warnings.push("Affiliate link not detected in copy");
      totalScore -= 0.1;
    }

    // Ensure score is within bounds
    const finalScore = Math.max(0, Math.min(1, totalScore));

    // Determine if retry is needed
    const retryNeeded = finalScore < this.RETRY_THRESHOLD;

    return {
      isValid: finalScore >= this.THRESHOLD,
      score: finalScore,
      issues,
      warnings,
      retryNeeded,
    };
  }

  /**
   * Cache audit result for rate limiting
   */
  private async cacheAuditResult(
    productId: string,
    result: HallucinationAuditResult,
  ): Promise<void> {
    const key = `hallucination_audit:${productId}:${Date.now()}`;
    await this.redis.setex(key, 3600, JSON.stringify(result)); // 1 hour TTL
  }

  /**
   * Get recent audit history for a product
   */
  async getAuditHistory(
    productId: string,
  ): Promise<HallucinationAuditResult[]> {
    const key = `hallucination_audit_history:${productId}`;
    const results = await this.redis.lrange(key, 0, 9);
    return results.map((r) => JSON.parse(r) as HallucinationAuditResult);
  }

  /**
   * Add audit result to history
   */
  private async addToAuditHistory(
    productId: string,
    result: HallucinationAuditResult,
  ): Promise<void> {
    const key = `hallucination_audit_history:${productId}`;
    await this.redis.lpush(key, JSON.stringify(result));
    await this.redis.ltrim(key, 0, 49); // Keep last 50 audits
    await this.redis.expire(key, 86400); // 24 hour TTL
  }
}

// Singleton instance
let guardInstance: AiHallucinationGuard | null = null;

export function getHallucinationGuard(): AiHallucinationGuard {
  if (!guardInstance) {
    guardInstance = new AiHallucinationGuard();
  }
  return guardInstance;
}
