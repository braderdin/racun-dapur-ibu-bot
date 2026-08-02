/*
 * URL Shortener Service
 * Generates clean short links (/r/:code) redirecting to affiliate URLs
 */

import { customAlphabet } from "nanoid";
import { createHash } from "crypto";
import { RedisService } from "./redis";
import { SupabaseService } from "./supabase";

export interface ShortenerResult {
  shortCode: string;
  shortUrl: string;
  affiliateUrl: string;
  expiresAt?: Date;
}

export class ShortenerService {
  private redisService: RedisService;
  private supabaseService: SupabaseService;
  private shortCodeLength: number = 8;
  private nanoid = customAlphabet(
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
    this.shortCodeLength,
  );

  constructor(redisService: RedisService, supabaseService: SupabaseService) {
    this.redisService = redisService;
    this.supabaseService = supabaseService;
  }

  async generateShortCode(
    affiliateUrl: string,
    productId?: string,
  ): Promise<ShortenerResult> {
    // Check if product already has a short code (anti-duplicate)
    if (productId) {
      const existingCode = await this.redisService.get(`product:${productId}`);
      if (existingCode) {
        const result: ShortenerResult = {
          shortCode: existingCode,
          shortUrl: `https://racun.ibu.my/r/${existingCode}`, // TODO: Use actual domain
          affiliateUrl,
        };
        return result;
      }
    }

    // Generate unique short code
    let shortCode: string;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      shortCode = this.nanoid();
      const exists = await this.redisService.get(`shortcode:${shortCode}`);
      if (!exists) break;
      attempts++;
    } while (attempts < maxAttempts);

    if (attempts >= maxAttempts) {
      throw new Error("Failed to generate unique short code after 10 attempts");
    }

    // Store the mapping
    await this.redisService.setEx(
      `shortcode:${shortCode}`,
      affiliateUrl,
      86400,
    ); // 24 hours
    if (productId) {
      await this.redisService.setEx(`product:${productId}`, shortCode, 86400); // 24 hours
    }

    // Log to database for analytics
    await this.supabaseService.logLinkClick({
      shortCode,
      affiliateUrl,
      productId,
      metadata: { generatedAt: new Date().toISOString() },
    });

    const result: ShortenerResult = {
      shortCode,
      shortUrl: `https://racun.ibu.my/r/${shortCode}`, // TODO: Use actual domain
      affiliateUrl,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    };

    return result;
  }

  async getAffiliateUrl(shortCode: string): Promise<string | null> {
    const affiliateUrl = await this.redisService.get(`shortcode:${shortCode}`);
    return affiliateUrl;
  }

  async incrementClickCount(
    shortCode: string,
    productId?: string,
  ): Promise<void> {
    // Increment in Redis
    await this.redisService.incr(`clicks:${shortCode}`);

    // Log to database
    await this.supabaseService.logLinkClick({
      shortCode,
      affiliateUrl:
        (await this.redisService.get(`shortcode:${shortCode}`)) || "",
      productId,
      metadata: { clickedAt: new Date().toISOString() },
      conversionResult: false, // TODO: Set based on actual conversion tracking
    });
  }

  async getClickStats(
    shortCode: string,
  ): Promise<{ clicks: number; conversions?: number }> {
    const clicks = await this.redisService.get(`clicks:${shortCode}`);
    // TODO: Get conversions from Supabase
    return {
      clicks: parseInt(clicks || "0", 10),
    };
  }
}
