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
    // Use X_* prefixed env vars as primary, with TWITTER_* as fallbacks
    // Note: Env type has X_BEARER_TOKEN, TWITTER_API_KEY, TWITTER_API_SECRET, etc.
    this.bearerToken = env?.X_BEARER_TOKEN || env?.TWITTER_API_KEY || "";
    this.apiKey = env?.X_CONSUMER_KEY || env?.TWITTER_API_KEY || "";
    this.apiSecret =
      env?.X_CONSUMER_KEY_SECRET || env?.TWITTER_API_SECRET || "";
    this.accessToken = env?.X_ACCESS_TOKEN || env?.TWITTER_ACCESS_TOKEN || "";
    this.accessTokenSecret =
      env?.X_ACCESS_TOKEN_SECRET || env?.TWITTER_ACCESS_SECRET || "";

    // Debug log for credential verification (without exposing secrets)
    console.log("[X Bot] Credentials check:", {
      hasBearerToken: !!this.bearerToken,
      hasApiKey: !!this.apiKey,
      hasApiSecret: !!this.apiSecret,
      hasAccessToken: !!this.accessToken,
      hasAccessTokenSecret: !!this.accessTokenSecret,
    });
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
   * Upload media to Twitter (images) using OAuth 1.0a
   * @param imageUrl - Image URL to upload
   * @returns Media ID string or null if upload fails
   */
  private async uploadMedia(imageUrl: string): Promise<string | null> {
    // Fallback image URL (public domain kitchen image from Unsplash)
    const FALLBACK_IMAGE_URL =
      "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&h=600&fit=crop&auto=format";

    // Try to fetch the original image first
    let imageBuffer: ArrayBuffer;
    let fetchSuccess = false;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const imageResponse = await fetch(imageUrl, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (imageResponse.ok) {
        imageBuffer = await imageResponse.arrayBuffer();
        fetchSuccess = true;
      } else {
        console.warn(
          `[X Bot] Failed to fetch image (${imageResponse.status}), trying fallback...`,
        );
      }
    } catch (fetchError) {
      console.warn(
        `[X Bot] Error fetching image: ${fetchError instanceof Error ? fetchError.message : "Unknown error"}, trying fallback...`,
      );
    }

    // If original image failed, try fallback image
    if (!fetchSuccess) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        const fallbackResponse = await fetch(FALLBACK_IMAGE_URL, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (fallbackResponse.ok) {
          imageBuffer = await fallbackResponse.arrayBuffer();
          fetchSuccess = true;
          console.log("[X Bot] Using fallback image from Unsplash");
        } else {
          console.warn(
            `[X Bot] Fallback image also failed (${fallbackResponse.status})`,
          );
        }
      } catch (fallbackError) {
        console.warn(
          `[X Bot] Error fetching fallback image: ${fallbackError instanceof Error ? fallbackError.message : "Unknown error"}`,
        );
      }
    }

    // If both original and fallback failed, return null to indicate text-only tweet
    if (!fetchSuccess) {
      console.warn(
        "[X Bot] All image sources failed, will post text-only tweet",
      );
      return null;
    }

    const base64Image = Buffer.from(imageBuffer!).toString("base64");

    const url = "https://upload.twitter.com/1.1/media/upload.json";

    // Use application/x-www-form-urlencoded with base64 media_data to avoid multipart OAuth issues
    const body = new URLSearchParams();
    body.append("media_data", base64Image);
    body.append("media_category", "tweet_image");

    const authHeader = this.buildOAuthHeader(
      "POST",
      url,
      { media_category: "tweet_image" },
      this.accessTokenSecret,
    );

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      });

      const responseText = await response.text();
      let data: any;
      try {
        data = JSON.parse(responseText);
      } catch {
        console.warn(
          `[X Bot] Non-JSON response from Twitter media upload (${response.status}): ${responseText.substring(0, 100)}`,
        );
        return null;
      }

      if (!response.ok || "errors" in data) {
        const errorMsg =
          "errors" in data
            ? data.errors.map((e: { message: string }) => e.message).join(", ")
            : `HTTP ${response.status}: ${response.statusText}`;
        console.warn(`[X Bot] Twitter media upload failed: ${errorMsg}`);

        // Handle specific auth errors
        if (response.status === 401 || response.status === 403) {
          console.warn(
            "[X Bot] OAuth authentication failed for media upload - check credentials",
          );
        }
        return null;
      }

      return data.media_id_string;
    } catch (error) {
      console.error("[X Bot] Twitter media upload exception:", error);
      return null;
    }
  }

  /**
   * Post tweet to Twitter API v2 using OAuth 1.0a (user context)
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

    // Use OAuth 1.0a for user-context tweet posting (more reliable than Bearer token)
    const authHeader = this.buildOAuthHeader(
      "POST",
      url,
      {}, // No additional params for JSON body
      this.accessTokenSecret,
    );

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: authHeader,
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

      // Handle HTTP 402 (Payment Required) - free tier limitation
      if (response.status === 402) {
        console.warn(
          "[X Bot] Twitter API free tier limitation (HTTP 402) - cannot post tweets",
        );
        throw new Error(
          "Twitter API free tier does not allow posting tweets (HTTP 402). Skipping Twitter posting.",
        );
      }

      // Handle HTTP 401/403 - authentication issues
      if (response.status === 401 || response.status === 403) {
        console.warn(
          "[X Bot] Twitter API authentication failed - check OAuth credentials",
        );
        throw new Error(
          `Twitter API authentication failed (HTTP ${response.status}): ${errorMsg}`,
        );
      }

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

      // Upload media first (with fallback handling)
      console.log("[X Bot] Uploading media to Twitter...");
      const mediaId = await this.uploadMedia(imageUrl);

      let tweet1Id: string;

      if (mediaId) {
        console.log(`[X Bot] Media uploaded successfully: ${mediaId}`);

        // Post Tweet 1 with media
        console.log("[X Bot] Posting Tweet 1 via X API v2...");
        tweet1Id = await this.postTweetToApi(copy.hook, [mediaId]);
        console.log(`[X Bot] Tweet 1 Berjaya! ID: ${tweet1Id}`);
      } else {
        // Fallback: Post text-only tweet if image upload failed
        console.log(
          "[X Bot] Image upload failed, posting text-only Tweet 1...",
        );
        tweet1Id = await this.postTweetToApi(copy.hook);
        console.log(`[X Bot] Text-only Tweet 1 Berjaya! ID: ${tweet1Id}`);
      }

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

      // Upload media (with fallback handling)
      const mediaId = await this.uploadMedia(imageUrl);

      let tweetId: string;

      if (mediaId) {
        // Post tweet with media
        tweetId = await this.postTweetToApi(text, [mediaId]);
      } else {
        // Fallback: Post text-only tweet if image upload failed
        console.log("[X Bot] Image upload failed, posting text-only tweet...");
        tweetId = await this.postTweetToApi(text);
      }

      return {
        success: true,
        tweetId,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      console.error("Error posting tweet with media:", errorMsg);

      // Handle HTTP 402 (Payment Required) - free tier limitation
      if (errorMsg.includes("402") || errorMsg.includes("Payment Required")) {
        return {
          success: false,
          error:
            "Twitter API free tier does not allow posting tweets (HTTP 402). Skipping Twitter posting.",
        };
      }

      return {
        success: false,
        error: errorMsg,
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
          if (mediaId) {
            mediaIds.push(mediaId);
          }
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
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      console.error("Error posting tweet:", errorMsg);

      // Handle HTTP 402 (Payment Required) - free tier limitation
      if (errorMsg.includes("402") || errorMsg.includes("Payment Required")) {
        return {
          success: false,
          error:
            "Twitter API free tier does not allow posting tweets (HTTP 402). Skipping Twitter posting.",
        };
      }

      return {
        success: false,
        error: errorMsg,
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
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      console.error("Error posting reply:", errorMsg);

      // Handle HTTP 402 (Payment Required) - free tier limitation
      if (errorMsg.includes("402") || errorMsg.includes("Payment Required")) {
        return {
          success: false,
          error:
            "Twitter API free tier does not allow posting tweets (HTTP 402). Skipping Twitter posting.",
        };
      }

      return {
        success: false,
        error: errorMsg,
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
