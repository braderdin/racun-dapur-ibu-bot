import { Env, ProductItem } from "../types/env";

export class SupabaseService {
  private url: string;
  private serviceKey: string;

  constructor(env: Env) {
    this.url = env.SUPABASE_URL;
    this.serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  }

  /**
   * Simpan Rekod Produk & Post ke Supabase Database
   */
  async logPostedProduct(product: ProductItem, tweetId: string): Promise<void> {
    try {
      if (!this.url || !this.serviceKey) return;

      await fetch(`${this.url}/rest/v1/posted_products`, {
        method: "POST",
        headers: {
          apikey: this.serviceKey,
          Authorization: `Bearer ${this.serviceKey}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          product_id: product.id,
          title: product.title,
          price: product.price,
          affiliate_url: product.affiliateUrl,
          tweet_id: tweetId,
          posted_at: new Date().toISOString(),
        }),
      });
    } catch (error) {
      console.error("Error logging to Supabase:", error);
    }
  }
}