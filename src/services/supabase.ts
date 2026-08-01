import { Env } from "../types/env";
import { ProductItem } from "../types/product";
import { CONSTANTS } from "../config/constants";
import { logger } from "../utils/logger";

export class SupabaseService {
  private url: string;
  private serviceKey: string;
  private anonKey: string;

  constructor(env?: Env) {
    this.url = env?.SUPABASE_URL || "";
    this.serviceKey = env?.SUPABASE_SERVICE_ROLE_KEY || "";
    this.anonKey = env?.SUPABASE_ANON_KEY || "";

    // Validasi konfigurasi
    if (!this.url || !this.serviceKey) {
      logger.warn(
        "Supabase belum dikonfigurasi! Gunakan [SUPABASE_URL] dan [SUPABASE_SERVICE_ROLE_KEY].",
        {},
        "SupabaseService",
      );
    }
  }

  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return {
      status: this.url && this.serviceKey ? "connected" : "disconnected",
      timestamp: new Date().toISOString(),
    };
  }

  async getServiceStatus(): Promise<{
    name: string;
    status: string;
    timestamp: string;
  }> {
    const health = await this.healthCheck();
    return {
      name: "Supabase",
      status: health.status,
      timestamp: health.timestamp,
    };
  }

  async getRecentProducts(limit: number = 50): Promise<any[]> {
    if (!this.url) return [];

    try {
      const url = `${this.url}/rest/v1/posted_products?order=posted_at.desc&select=*&limit=${limit}`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          apikey: this.serviceKey,
          Authorization: `Bearer ${this.serviceKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Supabase API error: ${response.statusText}`);
      }

      const data = (await response.json()) as any[];
      return data;
    } catch (error) {
      logger.error(
        "Error fetching from Supabase:",
        { error },
        "SupabaseService",
      );
      return [];
    }
  }

  async logPostedProduct(
    product: ProductItem,
    tweetId: string,
    replyTweetId: string | null = null,
  ): Promise<void> {
    try {
      if (!this.url || !this.serviceKey) return;

      const productId = `product_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const timestamp = new Date().toISOString();

      const payload = {
        product_id: productId,
        title: product.title,
        price: parseFloat(product.price) || 0,
        original_price: product.originalPrice,
        discount_rate: product.discountRate,
        image_url: product.imageUrl,
        affiliate_url: product.affiliateUrl,
        rating: product.rating,
        sold_count: product.soldCount,
        lazada_product_id: product.id,
        lazada_item_id: product.id,
        tweet_id: tweetId || null,
        reply_tweet_id: replyTweetId || null,
        posted_at: timestamp,
        x_user_id: null,
        x_username: null,
        x_display_name: null,
        copy_used: JSON.stringify({
          tweetHook: product.title,
          tweetReply: product.affiliateUrl,
        }),
        tags_used: [],
        sentiment_score: null,
        image_storage_used: JSON.stringify({
          account: 1,
          bucket: "default",
          object: `${productId}.jpg`,
        }),
      };

      const response = await fetch(`${this.url}/rest/v1/posted_products`, {
        method: "POST",
        headers: {
          apikey: this.serviceKey,
          Authorization: `Bearer ${this.serviceKey}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
          "on-conflict": "merge",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        console.error("Supabase POST error:", await response.text());
      }

      logger.debug(
        "Supabase log success",
        { productId, tweetId },
        "SupabaseService",
      );
    } catch (error) {
      logger.error("Error logging to Supabase:", { error }, "SupabaseService");
    }
  }

  // Facebook-specific logging methods
  async logFacebookPost(data: {
    productId: string;
    platform: "lazada" | "shopee";
    postId?: string;
    commentId?: string;
    status: "published" | "failed" | "pending";
    errorMessage?: string;
    timestamp?: string;
    source?: string;
  }): Promise<void> {
    try {
      if (!this.url || !this.serviceKey) return;

      const payload = {
        product_id: data.productId,
        platform: data.platform,
        fb_post_id: data.postId || null,
        fb_comment_id: data.commentId || null,
        status: data.status,
        error_message: data.errorMessage || null,
        timestamp: data.timestamp || new Date().toISOString(),
        source: data.source || "facebook_graph_api",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        // Include related product info for reference
        lazada_product_id:
          data.platform === "lazada" ? `ref_${data.productId}` : null,
        lazada_item_id:
          data.platform === "lazada" ? `ref_${data.productId}` : null,
        tweet_id: null, // Not applicable for Facebook posts
        reply_tweet_id: null,
        posted_at: new Date().toISOString(),
        x_user_id: null,
        x_username: null,
        x_display_name: null,
        copy_used: JSON.stringify({
          facebookPost: data.postId || null,
          facebookComment: data.commentId || null,
          status: data.status,
          error: data.errorMessage || null,
        }),
        tags_used: [],
        sentiment_score: null,
        image_storage_used: JSON.stringify({
          account: 1, // Default Backblaze B2 account for Facebook posts
          bucket: "facebook-posts",
          object: `${data.productId}_${data.platform}.jpg`,
        }),
      };

      const response = await fetch(`${this.url}/rest/v1/posted_products`, {
        method: "POST",
        headers: {
          apikey: this.serviceKey,
          Authorization: `Bearer ${this.serviceKey}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
          "on-conflict": "merge",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        console.error("Supabase Facebook POST error:", await response.text());
      }

      logger.debug(
        "Supabase Facebook log success",
        { productId: data.productId, postId: data.postId, status: data.status },
        "SupabaseService",
      );
    } catch (error) {
      logger.error(
        "Error logging Facebook post to Supabase:",
        { error },
        "SupabaseService",
      );
    }
  }

  async getFacebookPostLogs(productId?: string): Promise<any[]> {
    try {
      if (!this.url) return [];

      let query =
        "/rest/v1/posted_products?select=*&source=eq.facebook_graph_api";
      if (productId) {
        query += `&product_id=eq.${productId}`;
      }
      query += "&order=created_at.desc";

      const response = await fetch(`${this.url}${query}`, {
        method: "GET",
        headers: {
          apikey: this.serviceKey,
          Authorization: `Bearer ${this.serviceKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Supabase API error: ${response.statusText}`);
      }

      const data = (await response.json()) as any[];
      return data;
    } catch (error) {
      logger.error(
        "Error fetching Facebook post logs from Supabase:",
        { error },
        "SupabaseService",
      );
      return [];
    }
  }

  async getLinkClickAnalytics(
    startDate?: string,
    endDate?: string,
    shortCode?: string,
  ): Promise<any[]> {
    try {
      if (!this.url) return [];

      let query = "/rest/v1/link_clicks?select=*";
      if (startDate) query += `&created_at=gte.${startDate}`;
      if (endDate) query += `&created_at=lte.${endDate}`;
      if (shortCode) query += `&short_code=eq.${shortCode}`;
      query += "&order=created_at.desc";

      const response = await fetch(`${this.url}${query}`, {
        method: "GET",
        headers: {
          apikey: this.serviceKey,
          Authorization: `Bearer ${this.serviceKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Supabase API error: ${response.statusText}`);
      }

      const data = (await response.json()) as any[];
      return data;
    } catch (error) {
      logger.error(
        "Error fetching link click analytics from Supabase:",
        { error },
        "SupabaseService",
      );
      return [];
    }
  }

  async getConversionAnalytics(
    startDate?: string,
    endDate?: string,
    shortCode?: string,
  ): Promise<any[]> {
    try {
      if (!this.url) return [];

      let query = "/rest/v1/conversions?select=*";
      if (startDate) query += `&created_at=gte.${startDate}`;
      if (endDate) query += `&created_at=lte.${endDate}`;
      if (shortCode) query += `&short_code=eq.${shortCode}`;
      query += "&order=created_at.desc";

      const response = await fetch(`${this.url}${query}`, {
        method: "GET",
        headers: {
          apikey: this.serviceKey,
          Authorization: `Bearer ${this.serviceKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Supabase API error: ${response.statusText}`);
      }

      const data = (await response.json()) as any[];
      return data;
    } catch (error) {
      logger.error(
        "Error fetching conversion analytics from Supabase:",
        { error },
        "SupabaseService",
      );
      return [];
    }
  }

  // Analytics methods for EdgeAnalyticsService
  async logClickEvent(clickData: any): Promise<void> {
    try {
      if (!this.url || !this.serviceKey) return;

      const response = await fetch(`${this.url}/rest/v1/link_clicks`, {
        method: "POST",
        headers: {
          apikey: this.serviceKey,
          Authorization: `Bearer ${this.serviceKey}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify(clickData),
      });

      if (!response.ok) {
        console.error("Supabase logClickEvent error:", await response.text());
      }
    } catch (error) {
      logger.error("Error logging click event to Supabase:", { error }, "SupabaseService");
    }
  }

  async getClicks(options: any = {}): Promise<any[]> {
    try {
      if (!this.url) return [];

      let query = "/rest/v1/link_clicks?select=*";
      if (options.startDate) query += `&created_at=gte.${options.startDate}`;
      if (options.endDate) query += `&created_at=lte.${options.endDate}`;
      if (options.shortCode) query += `&short_code=eq.${options.shortCode}`;
      if (options.limit) query += `&limit=${options.limit}`;
      if (options.offset) query += `&offset=${options.offset}`;
      query += "&order=created_at.desc";

      const response = await fetch(`${this.url}${query}`, {
        method: "GET",
        headers: {
          apikey: this.serviceKey,
          Authorization: `Bearer ${this.serviceKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Supabase API error: ${response.statusText}`);
      }

      const data = (await response.json()) as any[];
      return data;
    } catch (error) {
      logger.error("Error fetching clicks from Supabase:", { error }, "SupabaseService");
      return [];
    }
  }

  async getCampaignReports(options: any = {}): Promise<any[]> {
    try {
      if (!this.url) return [];

      let query = "/rest/v1/campaign_reports?select=*";
      if (options.startDate) query += `&created_at=gte.${options.startDate}`;
      if (options.endDate) query += `&created_at=lte.${options.endDate}`;
      if (options.limit) query += `&limit=${options.limit}`;
      query += "&order=created_at.desc";

      const response = await fetch(`${this.url}${query}`, {
        method: "GET",
        headers: {
          apikey: this.serviceKey,
          Authorization: `Bearer ${this.serviceKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Supabase API error: ${response.statusText}`);
      }

      const data = (await response.json()) as any[];
      return data;
    } catch (error) {
      logger.error("Error fetching campaign reports from Supabase:", { error }, "SupabaseService");
      return [];
    }
  }

  async getPopularLinks(options: any = {}): Promise<any[]> {
    try {
      if (!this.url) return [];

      let query = "/rest/v1/popular_links?select=*";
      if (options.limit) query += `&limit=${options.limit}`;
      query += "&order=clicks.desc";

      const response = await fetch(`${this.url}${query}`, {
        method: "GET",
        headers: {
          apikey: this.serviceKey,
          Authorization: `Bearer ${this.serviceKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Supabase API error: ${response.statusText}`);
      }

      const data = (await response.json()) as any[];
      return data;
    } catch (error) {
      logger.error("Error fetching popular links from Supabase:", { error }, "SupabaseService");
      return [];
    }
  }

  async getGeographicDistribution(options: any = {}): Promise<any[]> {
    try {
      if (!this.url) return [];

      let query = "/rest/v1/geographic_distribution?select=*";
      if (options.startDate) query += `&created_at=gte.${options.startDate}`;
      if (options.endDate) query += `&created_at=lte.${options.endDate}`;
      if (options.limit) query += `&limit=${options.limit}`;
      query += "&order=clicks.desc";

      const response = await fetch(`${this.url}${query}`, {
        method: "GET",
        headers: {
          apikey: this.serviceKey,
          Authorization: `Bearer ${this.serviceKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Supabase API error: ${response.statusText}`);
      }

      const data = (await response.json()) as any[];
      return data;
    } catch (error) {
      logger.error("Error fetching geographic distribution from Supabase:", { error }, "SupabaseService");
      return [];
    }
  }

  async cleanupOldClickEvents(olderThanDays: number = 30): Promise<number> {
    try {
      if (!this.url || !this.serviceKey) return 0;

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
      const cutoffISO = cutoffDate.toISOString();

      const response = await fetch(`${this.url}/rest/v1/link_clicks?created_at=lt.${cutoffISO}`, {
        method: "DELETE",
        headers: {
          apikey: this.serviceKey,
          Authorization: `Bearer ${this.serviceKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Supabase API error: ${response.statusText}`);
      }

      // Return number of deleted rows (approximate)
      return 0;
    } catch (error) {
      logger.error("Error cleaning up old click events from Supabase:", { error }, "SupabaseService");
      return 0;
    }
  }
}
