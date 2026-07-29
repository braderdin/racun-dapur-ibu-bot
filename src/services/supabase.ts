import { Env, ProductItem } from "../types/env";
import { CONSTANTS } from "../config/constants";
import { logger } from "../utils/logger";

export class SupabaseService {
  private url: string;
  private serviceKey: string;
  private anonKey: string;

  constructor(env: Env) {
    this.url = env.SUPABASE_URL || "";
    this.serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || "";
    this.anonKey = env.SUPABASE_ANON_KEY || "";

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
}
