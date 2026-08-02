import { Env } from "../types/env";
import { RedisService } from "../services/redis";

export class LazadaLinkCloaker {
  private redis: RedisService;
  private env: Env;
  private baseDomain: string;
  private utmSource: string;
  private utmCampaign: string;

  constructor(env: Env) {
    this.env = env;
    this.redis = new RedisService(env);
    this.baseDomain = env.CLOAK_DOMAIN || "r.racundapuribu.com";
    this.utmSource = env.CLOAK_UTM_SOURCE || "lazada";
    this.utmCampaign = env.CLOAK_UTM_CAMPAIGN || "live-fetcher";
  }

  /**
   * Generate short cloaked affiliate link for Lazada products
   * @param lazadaProductId - Lazada product ID
   * @param lazadaAffiliateUrl - Original Lazada affiliate URL
   * @param productTitle - Product title for tracking
   * @returns Short cloaked link with tracking parameters
   */
  async generateCloakedLink(
    lazadaProductId: string,
    lazadaAffiliateUrl: string,
    productTitle: string,
  ): Promise<string> {
    try {
      if (!lazadaProductId || !lazadaAffiliateUrl) {
        throw new Error("Missing required parameters for link cloaking");
      }

      // Generate unique short code
      const shortCode = await this.generateShortCode(lazadaProductId);

      // Build cloaked URL with tracking parameters
      const cloakedUrl = this.buildCloakedUrl(
        shortCode,
        lazadaProductId,
        lazadaAffiliateUrl,
        productTitle,
      );

      // Store mapping in Redis for analytics
      await this.storeLinkMapping(
        shortCode,
        lazadaProductId,
        lazadaAffiliateUrl,
        productTitle,
      );

      console.log(
        `Generated cloaked link: ${cloakedUrl} for product ${lazadaProductId}`,
      );
      return cloakedUrl;
    } catch (error) {
      console.error("Error generating cloaked link:", error);
      throw error;
    }
  }

  /**
   * Generate unique short code for product
   * @param productId - Lazada product ID
   * @returns Short code
   */
  private async generateShortCode(productId: string): Promise<string> {
    // Check if link already exists in Redis
    const existingCode = await this.redis.get(`cloak:${productId}`);
    if (existingCode) {
      return existingCode;
    }

    // Generate new short code
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 8);
    const shortCode = `lz-${productId.substring(0, 6)}-${timestamp}-${randomPart}`;

    // Store mapping in Redis with 5-day TTL (432000 seconds)
    await this.redis.setEx(`cloak:${productId}`, shortCode, 432000);
    await this.redis.setEx(`reverse:${shortCode}`, productId, 432000);

    return shortCode;
  }

  /**
   * Build cloaked URL with tracking parameters
   * @param shortCode - Short code
   * @param productId - Lazada product ID
   * @param affiliateUrl - Original affiliate URL
   * @param productTitle - Product title
   * @returns Complete cloaked URL
   */
  private buildCloakedUrl(
    shortCode: string,
    productId: string,
    affiliateUrl: string,
    productTitle: string,
  ): string {
    const baseUrl = `https://${this.baseDomain}/${shortCode}`;

    // Build UTM parameters
    const utmParams = new URLSearchParams({
      utm_source: this.utmSource,
      utm_medium: "affiliate",
      utm_campaign: this.utmCampaign,
      utm_content: productId,
      utm_term: encodeURIComponent(productTitle.substring(0, 50)), // Limit title length
    });

    // Add original affiliate link as redirect parameter
    utmParams.set("redirect", encodeURIComponent(affiliateUrl));

    return `${baseUrl}?${utmParams.toString()}`;
  }

  /**
   * Store link mapping in Redis for analytics
   * @param shortCode - Short code
   * @param productId - Lazada product ID
   * @param affiliateUrl - Original affiliate URL
   * @param productTitle - Product title
   */
  private async storeLinkMapping(
    shortCode: string,
    productId: string,
    affiliateUrl: string,
    productTitle: string,
  ): Promise<void> {
    const mapping = {
      shortCode,
      productId,
      affiliateUrl,
      productTitle,
      createdAt: Date.now(),
      source: "lazada",
      campaign: this.utmCampaign,
    };

    // Store in Redis with 5-day TTL
    await this.redis.setEx(
      `link:${shortCode}`,
      JSON.stringify(mapping),
      432000,
    );

    // Add to product index for quick lookup using a simple key-value approach
    // Since RedisService doesn't have sadd/expire, we'll use a comma-separated list
    const indexKey = `product:${productId}:links`;
    const existingLinks = await this.redis.get(indexKey);
    const updatedLinks = existingLinks
      ? `${existingLinks},${shortCode}`
      : shortCode;
    await this.redis.setEx(indexKey, updatedLinks, 432000);
  }

  /**
   * Resolve cloaked link to original affiliate URL
   * @param shortCode - Short code
   * @returns Original affiliate URL or null if not found
   */
  async resolveLink(shortCode: string): Promise<string | null> {
    try {
      const productId = await this.redis.get(`reverse:${shortCode}`);
      if (!productId) {
        return null;
      }

      const mappingStr = await this.redis.get(`link:${shortCode}`);
      if (!mappingStr) {
        return null;
      }

      const mapping = JSON.parse(mappingStr);
      return mapping.affiliateUrl;
    } catch (error) {
      console.error("Error resolving cloaked link:", error);
      return null;
    }
  }

  /**
   * Get analytics data for a specific product
   * @param productId - Lazada product ID
   * @returns Analytics data including click count, etc.
   */
  async getProductAnalytics(productId: string): Promise<any> {
    try {
      const indexKey = `product:${productId}:links`;
      const linksStr = await this.redis.get(indexKey);
      if (!linksStr) {
        return null;
      }

      const shortCodes = linksStr.split(",").filter(Boolean);
      if (shortCodes.length === 0) {
        return null;
      }

      const analytics = {
        productId,
        shortCodes,
        totalLinks: shortCodes.length,
        createdAt: Date.now(),
        source: "lazada",
        campaign: this.utmCampaign,
      };

      return analytics;
    } catch (error) {
      console.error("Error getting product analytics:", error);
      return null;
    }
  }

  /**
   * Validate short code format
   * @param shortCode - Short code to validate
   * @returns True if format is valid
   */
  private isValidShortCode(shortCode: string): boolean {
    if (!shortCode) return false;

    // Validate format: lz-{productId}-{timestamp}-{random}
    const pattern = /^lz-[a-zA-Z0-9-]+-[a-zA-Z0-9]+-[a-zA-Z0-9]+$/;
    return pattern.test(shortCode);
  }

  /**
   * Generate affiliate link from product data
   * @param productData - Product data from Lazada API
   * @returns Cloaked affiliate link
   */
  async generateAffiliateLink(productData: any): Promise<string> {
    try {
      const lazadaProductId = productData.lazadaProductId || productData.id;
      const lazadaAffiliateUrl =
        productData.lazadaAffiliateLink || productData.affiliateUrl;
      const productTitle = productData.title || "Unknown Product";

      if (!lazadaProductId || !lazadaAffiliateUrl) {
        throw new Error(
          "Missing required product data for affiliate link generation",
        );
      }

      return await this.generateCloakedLink(
        lazadaProductId,
        lazadaAffiliateUrl,
        productTitle,
      );
    } catch (error) {
      console.error("Error generating affiliate link:", error);
      throw error;
    }
  }

  /**
   * Batch generate cloaked links for multiple products
   * @param products - Array of product data
   * @returns Array of cloaked links
   */
  async generateBatchLinks(products: any[]): Promise<string[]> {
    try {
      const results: string[] = [];

      // Process products in parallel with rate limiting
      const promises = products.map(async (product) => {
        try {
          const cloakedLink = await this.generateAffiliateLink(product);
          results.push(cloakedLink);

          // Add small delay to respect rate limits
          await new Promise((resolve) => setTimeout(resolve, 100));
        } catch (error) {
          console.error(
            `Failed to generate link for product ${product.id}:`,
            error,
          );
          // Continue with other products
        }
      });

      await Promise.all(promises);
      return results;
    } catch (error) {
      console.error("Error generating batch links:", error);
      return [];
    }
  }
}
