/*
 * Custom Affiliate Link Masking & Anti-Shadowban Engine
 * Generates clean domain shortlinks (/r/:code),
 * appends UTM analytics parameters, and masks direct affiliate
 * redirects to protect social channel reach.
 *
 * Phase 8: Autonomous AI Curation Engine
 * All credentials read from environment variables — no hardcoded secrets.
 */

import { Env } from "../types/env";
import { CONSTANTS } from "../config/constants";
import { logger } from "../utils/logger";
import { customAlphabet } from "nanoid";
import { createHash } from "crypto";

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface CloakedLink {
  shortCode: string;
  shortUrl: string;
  originalAffiliateUrl: string;
  utmParams: Record<string, string>;
  maskedUrl: string;
  createdAt: string;
  expiresAt?: string;
  clickCount: number;
  platform: "lazada" | "shopee";
}

export interface CloakConfig {
  domain: string;
  pathPrefix: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmTerm: string;
  utmContent: string;
  shortCodeLength: number;
  defaultExpiryDays: number;
  enableClickTracking: boolean;
  enableGeoRedirect: boolean;
}

export interface CloakResult {
  success: boolean;
  cloakedLink?: CloakedLink;
  error?: string;
}

export interface LinkAnalytics {
  shortCode: string;
  totalClicks: number;
  uniqueVisitors: number;
  platform: "lazada" | "shopee";
  topReferrers: Array<{ source: string; count: number }>;
  geoDistribution: Record<string, number>;
  conversionRate: number;
}

// ---------------------------------------------------------------------------
// Default Configuration
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: CloakConfig = {
  domain: "", // Empty string - falls back to original affiliate URL when not configured
  pathPrefix: "/r/",
  utmSource: "racun_dapur_ibu",
  utmMedium: "social",
  utmCampaign: "dual_channel_posting",
  utmTerm: "affiliate",
  utmContent: "cloaked_link",
  shortCodeLength: 8,
  defaultExpiryDays: 30,
  enableClickTracking: true,
  enableGeoRedirect: false,
};

// ---------------------------------------------------------------------------
// Link Cloaker Service
// ---------------------------------------------------------------------------

export class LinkCloaker {
  private config: CloakConfig;
  private env: Env;
  private nanoid: ReturnType<typeof customAlphabet>;
  private linkStore: Map<string, CloakedLink>;

  constructor(env: Env, config?: Partial<CloakConfig>) {
    this.env = env;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.nanoid = customAlphabet(
      "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
      this.config.shortCodeLength,
    );
    this.linkStore = new Map();

    logger.info(
      "LinkCloaker initialized",
      {
        domain: this.config.domain,
        pathPrefix: this.config.pathPrefix,
        shortCodeLength: this.config.shortCodeLength,
      },
      "LinkCloaker",
    );
  }

  // -----------------------------------------------------------------------
  // Generate a cloaked shortlink
  // -----------------------------------------------------------------------

  async cloakLink(
    affiliateUrl: string,
    productName: string,
    platform: "lazada" | "shopee",
    options?: {
      expiryDays?: number;
      utmContent?: string;
      customCode?: string;
    },
  ): Promise<CloakResult> {
    try {
      // Validate affiliate URL
      if (!this.isValidAffiliateUrl(affiliateUrl)) {
        return { success: false, error: "Invalid affiliate URL" };
      }

      // Generate or use custom short code
      const shortCode = options?.customCode || this.nanoid();

      // Check for collision
      if (this.linkStore.has(shortCode)) {
        return { success: false, error: "Short code already exists" };
      }

      // Build UTM parameters
      const utmParams = this.buildUtmParams(options?.utmContent);

      // Build masked URL (affiliate URL is hidden from the user)
      const maskedUrl = this.buildMaskedUrl(shortCode, utmParams);

      // Build the cloaked link object
      // If no domain is configured, fall back to original affiliate URL
      const shortUrl = this.config.domain
        ? `https://${this.config.domain}${this.config.pathPrefix}${shortCode}`
        : affiliateUrl;

      const cloakedLink: CloakedLink = {
        shortCode,
        shortUrl,
        originalAffiliateUrl: affiliateUrl,
        utmParams,
        maskedUrl,
        createdAt: new Date().toISOString(),
        expiresAt: options?.expiryDays
          ? new Date(
              Date.now() + options.expiryDays * 24 * 60 * 60 * 1000,
            ).toISOString()
          : undefined,
        clickCount: 0,
        platform,
      };

      // Store the link
      this.linkStore.set(shortCode, cloakedLink);

      // Store in Redis for persistence (if available)
      await this.persistToCache(shortCode, cloakedLink);

      logger.info(
        "Link cloaked successfully",
        {
          shortCode,
          platform,
          productName,
        },
        "LinkCloaker",
      );

      return { success: true, cloakedLink };
    } catch (error) {
      logger.error(
        "Failed to cloak link",
        {
          error: error instanceof Error ? error.message : String(error),
        },
        "LinkCloaker",
      );
      return { success: false, error: "Internal error" };
    }
  }

  // -----------------------------------------------------------------------
  // Resolve a cloaked shortlink to the original affiliate URL
  // -----------------------------------------------------------------------

  async resolveLink(shortCode: string): Promise<CloakResult> {
    // Check in-memory store first
    let link = this.linkStore.get(shortCode);

    // Fall back to cache (Redis)
    if (!link) {
      const cachedLink = await this.retrieveFromCache(shortCode);
      if (cachedLink) {
        link = cachedLink;
      }
    }

    if (!link) {
      return { success: false, error: "Short link not found" };
    }

    // TypeScript narrowing - link is guaranteed to be CloakedLink here
    const cloakedLink: CloakedLink = link;

    // Check expiry
    if (cloakedLink.expiresAt && new Date(cloakedLink.expiresAt) < new Date()) {
      return { success: false, error: "Short link has expired" };
    }

    // Increment click count
    cloakedLink.clickCount++;
    this.linkStore.set(shortCode, cloakedLink);

    // Record click analytics asynchronously (non-blocking)
    this.recordClickAnalytics(shortCode, cloakedLink);

    return { success: true, cloakedLink };
  }

  // -----------------------------------------------------------------------
  // Batch cloak multiple links
  // -----------------------------------------------------------------------

  async cloakLinksBatch(
    links: Array<{
      affiliateUrl: string;
      productName: string;
      platform: "lazada" | "shopee";
    }>,
  ): Promise<Array<CloakResult>> {
    const results = await Promise.all(
      links.map((link) =>
        this.cloakLink(link.affiliateUrl, link.productName, link.platform),
      ),
    );

    return results;
  }

  // -----------------------------------------------------------------------
  // Get analytics for a cloaked link
  // -----------------------------------------------------------------------

  async getLinkAnalytics(shortCode: string): Promise<LinkAnalytics | null> {
    const link = this.linkStore.get(shortCode);
    if (!link) return null;

    return {
      shortCode: link.shortCode,
      totalClicks: link.clickCount,
      uniqueVisitors: link.clickCount, // Simplified — would use visitor IDs in production
      platform: link.platform,
      topReferrers: [], // Would be populated from analytics DB
      geoDistribution: {}, // Would be populated from geo-IP data
      conversionRate: 0, // Would be computed from conversion tracking
    };
  }

  // -----------------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------------

  private isValidAffiliateUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === "https:" && parsed.hostname.length > 0;
    } catch {
      return false;
    }
  }

  private buildUtmParams(utmContent?: string): Record<string, string> {
    return {
      utm_source: this.config.utmSource,
      utm_medium: this.config.utmMedium,
      utm_campaign: this.config.utmCampaign,
      utm_term: this.config.utmTerm,
      utm_content: utmContent || this.config.utmContent,
    };
  }

  private buildMaskedUrl(
    shortCode: string,
    utmParams: Record<string, string>,
  ): string {
    const baseUrl = `https://${this.config.domain}${this.config.pathPrefix}${shortCode}`;
    const queryString = new URLSearchParams(utmParams).toString();
    return `${baseUrl}?${queryString}`;
  }

  private async persistToCache(
    shortCode: string,
    link: CloakedLink,
  ): Promise<void> {
    try {
      // In production, this stores the link in Upstash Redis
      // with TTL matching the expiry or default 30 days
      const ttlSeconds = link.expiresAt
        ? Math.max(
            1,
            Math.floor(
              (new Date(link.expiresAt).getTime() - Date.now()) / 1000,
            ),
          )
        : this.config.defaultExpiryDays * 24 * 60 * 60;

      logger.debug(
        "Persisting link to cache",
        {
          shortCode,
          ttlSeconds,
        },
        "LinkCloaker",
      );
    } catch (error) {
      logger.warn(
        "Cache persistence failed, continuing with in-memory store",
        {
          error: error instanceof Error ? error.message : String(error),
        },
        "LinkCloaker",
      );
    }
  }

  private async retrieveFromCache(
    shortCode: string,
  ): Promise<CloakedLink | null> {
    try {
      // In production, this retrieves from Upstash Redis
      logger.debug("Retrieving link from cache", { shortCode }, "LinkCloaker");
      return null; // Cache miss — would return cached value in production
    } catch {
      return null;
    }
  }

  private async recordClickAnalytics(
    shortCode: string,
    link: CloakedLink,
  ): Promise<void> {
    try {
      // In production, this logs click data to analytics pipeline
      logger.debug(
        "Recording click analytics",
        {
          shortCode,
          clickCount: link.clickCount,
        },
        "LinkCloaker",
      );
    } catch (error) {
      logger.warn(
        "Failed to record click analytics",
        {
          error: error instanceof Error ? error.message : String(error),
        },
        "LinkCloaker",
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Factory helper
// ---------------------------------------------------------------------------

export function createLinkCloaker(env: Env): LinkCloaker {
  return new LinkCloaker(env, {
    domain: env.CLOAK_DOMAIN || "", // Empty string - falls back to original affiliate URL
    utmSource: env.CLOAK_UTM_SOURCE || "racun_dapur_ibu",
    utmCampaign: env.CLOAK_UTM_CAMPAIGN || "dual_channel_posting",
    defaultExpiryDays: parseInt(env.CLOAK_EXPIRY_DAYS || "30", 10),
  });
}
