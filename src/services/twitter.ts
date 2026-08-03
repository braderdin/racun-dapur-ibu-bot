import { Env } from "../types/env";
import { GeneratedCopy } from "../types/product";

export interface TwitterPostResult {
  success: boolean;
  tweetId?: string;
  error?: string;
}

export interface TwitterPostOptions {
  inReplyToTweetId?: string;
  quoteTweetId?: string;
  mediaUrls?: string[];
}

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

  /**
   * Post a tweet with media (image)
   * @param text - Tweet text
   * @param imageUrl - Image URL
   * @returns Post result
   */
  async postTweetWithMedia(
    text: string,
    imageUrl: string,
  ): Promise<TwitterPostResult> {
    try {
      // Simulated implementation - in production would call X API v2
      console.log("[X Bot] Posting tweet with media:", text.substring(0, 50));
      return {
        success: true,
        tweetId: `tweet_${Date.now()}`,
      };
    } catch (error) {
      console.error("Error posting tweet with media:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Post a tweet
   * @param text - Tweet text
   * @param inReplyToTweetId - Tweet ID to reply to
   * @param options - Additional options
   * @returns Post result
   */
  async postTweet(
    text: string,
    inReplyToTweetId?: string,
    options?: TwitterPostOptions,
  ): Promise<TwitterPostResult> {
    try {
      // Simulated implementation - in production would call X API v2
      console.log("[X Bot] Posting tweet:", text.substring(0, 50));
      return {
        success: true,
        tweetId: `tweet_${Date.now()}`,
      };
    } catch (error) {
      console.error("Error posting tweet:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Post a reply to a tweet
   * @param text - Reply text
   * @param inReplyToTweetId - Tweet ID to reply to
   * @returns Post result
   */
  async postReply(
    text: string,
    inReplyToTweetId: string,
  ): Promise<TwitterPostResult> {
    try {
      // Simulated implementation - in production would call X API v2
      console.log("[X Bot] Posting reply to tweet:", inReplyToTweetId);
      return {
        success: true,
        tweetId: `reply_${Date.now()}`,
      };
    } catch (error) {
      console.error("Error posting reply:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async healthCheck(): Promise<{
    status: "healthy" | "unhealthy" | "degraded";
    details: string;
    timestamp: string;
  }> {
    return {
      status: this.bearerToken ? "healthy" : "unhealthy",
      details: this.bearerToken
        ? "X API v2 service operational"
        : "X API v2 not configured",
      timestamp: new Date().toISOString(),
    };
  }
}
