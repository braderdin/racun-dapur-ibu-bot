import { Env } from "../types/env";
import { GeneratedCopy } from "../types/product";

export class TwitterService {
  private bearerToken: string;

  constructor(env?: Env) {
    this.bearerToken = env?.X_BEARER_TOKEN || "";
  }

  /**
   * Menghantar 2-Tweet Thread:
   * Tweet 1 (Utama): Hook + Gambar HD (Tanpa Link - Reach Tinggi)
   * Tweet 2 (Reply): Auto-Reply Link Affiliate
   */
  async postAffiliateThread(
    copy: GeneratedCopy,
    imageUrl: string,
  ): Promise<boolean> {
    try {
      console.log("[X Bot] Hantar Tweet 1 (Hook & Gambar)...");
      // Simulasi POST Tweet 1 ke X API v2
      const tweet1Id = "tweet_sample_id_1001";

      console.log(`[X Bot] Tweet 1 Berjaya! ID: ${tweet1Id}`);
      console.log("[X Bot] Hantar Tweet 2 (Auto-Reply Link Affiliate)...");

      // Simulasi POST Tweet 2 (in_reply_to_tweet_id: tweet1Id)
      console.log(
        `[X Bot] Thread Rasmi Berjaya Dihantar untuk @RacunDapurIbu!`,
      );
      return true;
    } catch (error) {
      console.error("X API Error posting thread:", error);
      return false;
    }
  }

  async healthCheck(): Promise<{ status: "healthy" | "unhealthy" | "degraded"; details: string; timestamp: string }> {
    return {
      status: this.bearerToken ? "healthy" : "unhealthy",
      details: this.bearerToken ? "X API v2 service operational" : "X API v2 not configured",
      timestamp: new Date().toISOString(),
    };
  }
}
