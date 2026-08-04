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

interface TwitterMediaUploadResponse {
  media_id_string: string;
  media_id: number;
  size: number;
  expires_after_secs: number;
  image: {
    image_type: string;
    w: number;
    h: number;
  };
}

interface TwitterTweetResponse {
  data: {
    id: string;
    text: string;
    edit_history_tweet_ids: string[];
  };
  errors?: Array<{
    code: number;
    message: string;
  }>;
}

interface TwitterErrorResponse {
  errors: Array<{
    code: number;
    message: string;
  }>;
}

export class TwitterService {
  private bearerToken: string;
  private apiKey: string;
  private apiSecret: string;
  private accessToken: string;
  private accessTokenSecret: string;
  private env: Env | undefined;

  constructor(env?: Env) {
    this.env = env;
    this.bearerToken = env?.X_BEARER_TOKEN || env?.TWITTER_API_KEY || "";
    this.apiKey = env?.TWITTER_API_KEY || "";
    this.apiSecret = env?.TWITTER_API_SECRET || "";
    this.accessToken = env?.TWITTER_ACCESS_TOKEN || "";
    this.accessTokenSecret = env?.TWITTER_ACCESS_SECRET || "";
  }

  /**
   * Generate OAuth 1.0a signature for media upload
   */
  private generateOAuthSignature(
    method: string,
    url: string,
    params: Record<string, string>,
    tokenSecret: string = "",
  ): string {
    const crypto = require("crypto");

    // Normalize parameters
    const normalizedParams = Object.keys(params)
      .sort()
      .map(
        (key) =>
          `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`,
      )
      .join("&");

    // Create signature base string
    const signatureBaseString = `${method.toUpperCase()}&${encodeURIComponent(url)}&${encodeURIComponent(normalizedParams)}`;

    // Create signing key
    const signingKey = `${encodeURIComponent(this.apiSecret)}&${encodeURIComponent(tokenSecret)}`;

    // Generate HMAC-SHA1 signature
    const signature = crypto
      .createHmac("sha1", signingKey)
      .update(signatureBaseString)
      .digest("base64");

    return signature;
  }

  /**
   * Build OAuth 1.0a Authorization header
   */
  private buildOAuthHeader(
    method: string,
    url: string,
    params: Record<string, string>,
    tokenSecret: string = "",
  ): string {
    const oauthParams: Record<string, string> = {
      oauth_consumer_key: this.apiKey,
      oauth_nonce: Math.random().toString(36).substring(2, 15),
      oauth_signature_method: "HMAC-SHA1",
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_token: this.accessToken,
      oauth_version: "1.0",
      ...params,
    };

    const signature = this.generateOAuthSignature(
      method,
      url,
      oauthParams,
      tokenSecret,
    );
    oauthParams.oauth_signature = signature;

    const authHeader = Object.keys(oauthParams)
      .sort()
      .map(
        (key) =>
          `${encodeURIComponent(key)}="${encodeURIComponent(oauthParams[key])}"`,
      )
      .join(", ");

    return `OAuth ${authHeader}`;
  }

  /**
   * Upload media to Twitter (images)
   * @param imageUrl - Image URL to upload
   * @returns Media ID string
   */
  private async uploadMedia(imageUrl: string): Promise<string> {
    // Fetch image from URL
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image: ${imageResponse.statusText}`);
    }
    const imageBuffer = await imageResponse.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString("base64");

    const url = "https://upload.twitter.com/1.1/media/upload.json";
    const params = {
      media_data: base64Image,
      media_category: "tweet_image",
    };

    const authHeader = this.buildOAuthHeader(
      "POST",
      url,
      params,
      this.accessTokenSecret,
    );

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(params).toString(),
    });

    const data = (await response.json()) as
      TwitterMediaUploadResponse | TwitterErrorResponse;

    if (!response.ok || "errors" in data) {
      const errorMsg =
        "errors" in data
          ? data.errors.map((e) => e.message).join(", ")
          : `HTTP ${response.status}: ${response.statusText}`;
      throw new Error(`Twitter media upload failed: ${errorMsg}`);
    }

    return data.media_id_string;
  }

  /**
   * Post tweet to Twitter API v2
   * @param text - Tweet text
   * @param mediaIds - Optional array of media IDs
   * @param inReplyToTweetId - Optional tweet ID to reply to
   * @returns Tweet ID
   */
  private async postTweetToApi(
    text: string,
    mediaIds?: string[],
    inReplyToTweetId?: string,
  ): Promise<string> {
    const url = "https://api.twitter.com/2/tweets";

    const body: Record<string, any> = {
      text,
    };

    if (mediaIds && mediaIds.length > 0) {
      body.media = { media_ids: mediaIds };
    }

    if (inReplyToTweetId) {
      body.reply = { in_reply_to_tweet_id: inReplyToTweetId };
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.bearerToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = (await response.json()) as
      TwitterTweetResponse | TwitterErrorResponse;

    if (
      !response.ok ||
      ("errors" in data && data.errors && data.errors.length > 0)
    ) {
      const errorMsg =
        "errors" in data && data.errors
          ? data.errors.map((e) => e.message).join(", ")
          : `HTTP ${response.status}: ${response.statusText}`;
      throw new Error(`Twitter API error: ${errorMsg}`);
    }

    // Type guard: data is TwitterTweetResponse here
    return (data as TwitterTweetResponse).data.id;
  }

  /**
   * Menghantar 2-Tweet Thread:
   * Tweet 1 (Utama): Hook + Gambar HD (Tanpa Link - Reach Tinggi)
   * Tweet 2 (Reply): Auto-Reply Link Affiliate
   */
  async postAffiliateThread(
    copy: GeneratedCopy,
    imageUrl: string,
    affiliateUrl: string,
  ): Promise<boolean> {
    try {
      console.log("[X Bot] Hantar Tweet 1 (Hook & Gambar)...");

      if (!this.bearerToken) {
        throw new Error("Twitter Bearer Token not configured");
      }

      // Upload media first
      console.log("[X Bot] Uploading media to Twitter...");
      const mediaId = await this.uploadMedia(imageUrl);
      console.log(`[X Bot] Media uploaded successfully: ${mediaId}`);

      // Post Tweet 1 with media
      console.log("[X Bot] Posting Tweet 1 via X API v2...");
      const tweet1Id = await this.postTweetToApi(copy.hook, [mediaId]);
      console.log(`[X Bot] Tweet 1 Berjaya! ID: ${tweet1Id}`);

      // Post Tweet 2 (reply with affiliate link)
      console.log("[X Bot] Hantar Tweet 2 (Auto-Reply Link Affiliate)...");
      const tweet2Text = `${copy.cta}\n${affiliateUrl}`;
      const tweet2Id = await this.postTweetToApi(
        tweet2Text,
        undefined,
        tweet1Id,
      );
      console.log(`[X Bot] Tweet 2 Berjaya! ID: ${tweet2Id}`);

      console.log(
        `[X Bot] Thread Rasmi Berjaya Dihantar untuk @RacunDapurIbu!`,
      );
      return true;
    } catch (error) {
      console.error("X API Error posting thread:", error);
      throw error; // Re-throw to let caller handle
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
      if (!this.bearerToken) {
        throw new Error("Twitter Bearer Token not configured");
      }

      console.log(
        "[X Bot] Posting tweet with media via X API v2:",
        text.substring(0, 50),
      );

      // Upload media
      const mediaId = await this.uploadMedia(imageUrl);

      // Post tweet with media
      const tweetId = await this.postTweetToApi(text, [mediaId]);

      return {
        success: true,
        tweetId,
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
      if (!this.bearerToken) {
        throw new Error("Twitter Bearer Token not configured");
      }

      console.log("[X Bot] Posting tweet via X API v2:", text.substring(0, 50));

      let mediaIds: string[] | undefined;
      if (options?.mediaUrls && options.mediaUrls.length > 0) {
        mediaIds = [];
        for (const mediaUrl of options.mediaUrls) {
          const mediaId = await this.uploadMedia(mediaUrl);
          mediaIds.push(mediaId);
        }
      }

      const tweetId = await this.postTweetToApi(
        text,
        mediaIds,
        inReplyToTweetId,
      );

      return {
        success: true,
        tweetId,
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
      if (!this.bearerToken) {
        throw new Error("Twitter Bearer Token not configured");
      }

      console.log(
        "[X Bot] Posting reply via X API v2 to tweet:",
        inReplyToTweetId,
      );

      const tweetId = await this.postTweetToApi(
        text,
        undefined,
        inReplyToTweetId,
      );

      return {
        success: true,
        tweetId,
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
