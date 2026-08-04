/**
 * Edge Affiliate Link Shortener & Cloaker Engine
 * Converts long e-commerce affiliate links into clean domain shortlinks
 * (/r/:code) with UTM tracking parameters and Upstash Redis
 * Edge Caching (<15ms 302 redirects).
 */

import { Redis } from "@upstash/redis";
import { Env } from "../types/env";

export interface ShortLinkConfig {
  domain: string;
  pathPrefix: string;
  codeLength: number;
  ttlSeconds: number;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
}

export interface ShortLinkData {
  code: string;
  originalUrl: string;
  utmParams: Record<string, string>;
  createdAt: number;
  expiresAt: number;
  clicks: number;
  platform: "lazada" | "shopee" | "web";
  productId: string;
}

export interface ShortLinkResult {
  success: boolean;
  shortUrl?: string;
  code?: string;
  error?: string;
}

export interface ClickAnalytics {
  code: string;
  timestamp: number;
  ip: string;
  userAgent: string;
  referer: string;
  country?: string;
  device?: string;
}

export class EdgeLinkShortener {
  private redis: Redis;
  private config: ShortLinkConfig;
  private env: Env;

  constructor(env: Env, config?: Partial<ShortLinkConfig>) {
    this.env = env;
    this.redis = new Redis({
      url: env.UPSTASH_REDIS_REST_URL || process.env.UPSTASH_REDIS_REST_URL,
      token:
        env.UPSTASH_REDIS_REST_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
    });

    this.config = {
      // Use Vercel app domain as shortlink domain since we don't own a custom domain
      domain: env.SHORTLINK_DOMAIN || "racun-dapur-ibu.vercel.app",
      pathPrefix: "/r/",
      codeLength: 8,
      ttlSeconds: 30 * 24 * 60 * 60, // 30 days
      utmSource: "racun_dapur_ibu",
      utmMedium: "affiliate",
      utmCampaign: "auto",
      ...config,
    };
  }

  /**
   * Create a short affiliate link with UTM tracking
   * @param originalUrl - Long affiliate URL
   * @param platform - Platform (lazada, shopee, web)
   * @param productId - Product identifier
   * @param customUtmParams - Optional custom UTM parameters
   * @returns Short link result with DIRECT affiliate URL (no Vercel shortlink)
   */
  async createShortLink(
    originalUrl: string,
    platform: "lazada" | "shopee" | "web",
    productId: string,
    customUtmParams?: Record<string, string>,
  ): Promise<ShortLinkResult> {
    try {
      // Validate URL
      if (!this.isValidUrl(originalUrl)) {
        return { success: false, error: "Invalid original URL" };
      }

      // Generate unique code for tracking
      const code = await this.generateUniqueCode();

      // Build UTM parameters
      const utmParams = this.buildUtmParams(
        platform,
        productId,
        customUtmParams,
      );

      // Create short link data for analytics tracking
      const shortLinkData: ShortLinkData = {
        code,
        originalUrl,
        utmParams,
        createdAt: Date.now(),
        expiresAt: Date.now() + this.config.ttlSeconds * 1000,
        clicks: 0,
        platform,
        productId,
      };

      // Store in Redis with TTL for analytics tracking
      const key = `shortlink:${code}`;
      await this.redis.setex(
        key,
        this.config.ttlSeconds,
        JSON.stringify(shortLinkData),
      );

      // Also store reverse mapping for lookup
      const reverseKey = `shortlink:reverse:${this.hashUrl(originalUrl)}`;
      await this.redis.setex(reverseKey, this.config.ttlSeconds, code);

      // Build final URL with UTM parameters appended to original affiliate URL
      // DIRECT AFFILIATE LINK MANDATE: Return raw affiliate URL with UTM params, NOT Vercel shortlink
      const finalUrl = this.buildFinalUrl(originalUrl, utmParams);

      return {
        success: true,
        shortUrl: finalUrl, // Return direct affiliate URL with UTM tracking
        code,
      };
    } catch (error) {
      console.error("Error creating short link:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Resolve short code to original URL with analytics tracking
   * @param code - Short code
   * @param clickData - Click analytics data
   * @returns Original URL or null
   */
  async resolveShortLink(
    code: string,
    clickData?: Partial<ClickAnalytics>,
  ): Promise<string | null> {
    try {
      const key = `shortlink:${code}`;
      const data = await this.redis.get(key);

      if (!data) {
        return null;
      }

      const shortLink: ShortLinkData = JSON.parse(data as string);

      // Check expiration
      if (Date.now() > shortLink.expiresAt) {
        await this.redis.del(key);
        return null;
      }

      // Increment click count
      shortLink.clicks++;
      await this.redis.setex(
        key,
        this.config.ttlSeconds,
        JSON.stringify(shortLink),
      );

      // Track click analytics asynchronously
      if (clickData) {
        this.trackClickAnalytics(code, clickData).catch(console.error);
      }

      // Build final URL with UTM parameters
      return this.buildFinalUrl(shortLink.originalUrl, shortLink.utmParams);
    } catch (error) {
      console.error("Error resolving short link:", error);
      return null;
    }
  }

  /**
   * Get short link analytics
   * @param code - Short code
   * @returns Analytics data or null
   */
  async getAnalytics(code: string): Promise<ShortLinkData | null> {
    try {
      const key = `shortlink:${code}`;
      const data = await this.redis.get(key);

      if (!data) {
        return null;
      }

      return JSON.parse(data as string);
    } catch (error) {
      console.error("Error getting analytics:", error);
      return null;
    }
  }

  /**
   * Create multiple short links in batch
   * @param links - Array of link data
   * @returns Array of results
   */
  async createBatchShortLinks(
    links: Array<{
      originalUrl: string;
      platform: "lazada" | "shopee" | "web";
      productId: string;
      customUtmParams?: Record<string, string>;
    }>,
  ): Promise<ShortLinkResult[]> {
    const results: ShortLinkResult[] = [];

    for (const link of links) {
      const result = await this.createShortLink(
        link.originalUrl,
        link.platform,
        link.productId,
        link.customUtmParams,
      );
      results.push(result);

      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    return results;
  }

  /**
   * Delete expired short links (cleanup)
   * @returns Number of deleted links
   */
  async cleanupExpiredLinks(): Promise<number> {
    try {
      // This would require scanning keys, which is not efficient in Redis
      // In production, use a separate cleanup job with SCAN
      return 0;
    } catch (error) {
      console.error("Error cleaning up expired links:", error);
      return 0;
    }
  }

  /**
   * Generate unique short code
   * @returns Unique code
   */
  private async generateUniqueCode(): Promise<string> {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let code: string;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      code = "";
      for (let i = 0; i < this.config.codeLength; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      const key = `shortlink:${code}`;
      const exists = await this.redis.exists(key);

      if (!exists) {
        return code;
      }

      attempts++;
    } while (attempts < maxAttempts);

    // Fallback: use timestamp-based code
    return `x${Date.now().toString(36).slice(-6)}`;
  }

  /**
   * Build UTM parameters
   * @param platform - Platform
   * @param productId - Product ID
   * @param customParams - Custom parameters
   * @returns UTM parameters object
   */
  private buildUtmParams(
    platform: string,
    productId: string,
    customParams?: Record<string, string>,
  ): Record<string, string> {
    const utmParams: Record<string, string> = {
      utm_source: this.config.utmSource,
      utm_medium: this.config.utmMedium,
      utm_campaign: `${this.config.utmCampaign}_${platform}`,
      utm_content: productId,
      utm_term: platform,
    };

    if (customParams) {
      Object.assign(utmParams, customParams);
    }

    return utmParams;
  }

  /**
   * Build final URL with UTM parameters
   * @param originalUrl - Original URL
   * @param utmParams - UTM parameters
   * @returns Final URL with UTM
   */
  private buildFinalUrl(
    originalUrl: string,
    utmParams: Record<string, string>,
  ): string {
    try {
      const url = new URL(originalUrl);

      // Append UTM parameters
      Object.entries(utmParams).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });

      return url.toString();
    } catch (error) {
      console.error("Error building final URL:", error);
      return originalUrl;
    }
  }

  /**
   * Track click analytics
   * @param code - Short code
   * @param clickData - Click data
   */
  private async trackClickAnalytics(
    code: string,
    clickData: Partial<ClickAnalytics>,
  ): Promise<void> {
    try {
      const analyticsKey = `analytics:clicks:${code}`;
      const analytics: ClickAnalytics = {
        code,
        timestamp: Date.now(),
        ip: clickData.ip || "unknown",
        userAgent: clickData.userAgent || "unknown",
        referer: clickData.referer || "direct",
        country: clickData.country,
        device: clickData.device,
      };

      // Store in sorted set by timestamp for time-series queries
      await this.redis.zadd(analyticsKey, {
        score: analytics.timestamp,
        member: JSON.stringify(analytics),
      });

      // Set TTL for analytics (90 days)
      await this.redis.expire(analyticsKey, 90 * 24 * 60 * 60);
    } catch (error) {
      console.error("Error tracking click analytics:", error);
    }
  }

  /**
   * Hash URL for reverse lookup
   * @param url - URL to hash
   * @returns Hash string
   */
  private hashUrl(url: string): string {
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Validate URL format
   * @param url - URL to validate
   * @returns True if valid
   */
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get shortener statistics
   * @returns Statistics object
   */
  async getStats(): Promise<any> {
    try {
      // This is a simplified version - in production use SCAN
      return {
        domain: this.config.domain,
        pathPrefix: this.config.pathPrefix,
        codeLength: this.config.codeLength,
        ttlDays: this.config.ttlSeconds / (24 * 60 * 60),
      };
    } catch (error) {
      console.error("Error getting stats:", error);
      return null;
    }
  }
}
