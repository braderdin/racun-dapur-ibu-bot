/**
 * Dual-Platform Social Posting & Auto-Comment Engine
 * Orchestrates dual-channel posting:
 * - X (Twitter): Tweet 1 (HD Photo + Hook Copy, NO LINK) -> Tweet 2 Auto-Reply (Affiliate Shortlink + CTA)
 * - Facebook Page: Main Post (HD Photo + Storytelling Copy, NO LINK) -> Auto-Comment 1 (Affiliate Shortlink + CTA) with 3-8s anti-spam jitter delay
 */

import { Env } from "../types/env";
import { TwitterService } from "./twitter";
import { FacebookService } from "./facebook";
import { EdgeLinkShortener } from "./edge-link-shortener";
import { VectorRAGCopywriter, GeneratedCopy } from "./vector-rag-copywriter";

export interface SocialPostConfig {
  twitterEnabled: boolean;
  facebookEnabled: boolean;
  antiSpamJitterMinMs: number;
  antiSpamJitterMaxMs: number;
  maxRetries: number;
  retryDelayMs: number;
}

export interface PostData {
  productId: string;
  imageUrl: string;
  xCopy: GeneratedCopy;
  facebookCopy: GeneratedCopy;
  affiliateUrl: string;
  shortCode: string;
  category: string;
}

export interface PostResult {
  success: boolean;
  twitter?: {
    tweet1Id?: string;
    tweet2Id?: string;
    status: "published" | "failed" | "pending";
    error?: string;
    retryCount?: number;
    postedAt?: number;
  };
  facebook?: {
    postId?: string;
    commentId?: string;
    status: "published" | "failed" | "pending";
    error?: string;
    retryCount?: number;
    postedAt?: number;
  };
  timestamp: number;
  platformResults?: {
    twitter: { success: boolean; status: string; error?: string };
    facebook: { success: boolean; status: string; error?: string };
  };
}

export class SocialPosterEngine {
  private env: Env;
  private twitter: TwitterService;
  private facebook: FacebookService;
  private linkShortener: EdgeLinkShortener;
  private copywriter: VectorRAGCopywriter;
  private config: SocialPostConfig;

  constructor(env: Env, config?: Partial<SocialPostConfig>) {
    this.env = env;
    this.twitter = new TwitterService(env);
    this.facebook = new FacebookService(env);
    this.linkShortener = new EdgeLinkShortener(env);
    this.copywriter = new VectorRAGCopywriter(env);

    this.config = {
      twitterEnabled: true,
      facebookEnabled: true,
      antiSpamJitterMinMs: 3000,
      antiSpamJitterMaxMs: 8000,
      maxRetries: 3,
      retryDelayMs: 2000,
      ...config,
    };
  }

  /**
   * Execute dual-channel posting for a product
   * @param postData - Product and copy data
   * @returns Post results for both platforms
   */
  async postToBothPlatforms(postData: PostData): Promise<PostResult> {
    const result: PostResult = {
      success: false,
      timestamp: Date.now(),
    };

    try {
      // Create short affiliate link
      const shortLinkResult = await this.linkShortener.createShortLink(
        postData.affiliateUrl,
        "lazada", // or detect from URL
        postData.productId,
      );

      if (!shortLinkResult.success || !shortLinkResult.shortUrl) {
        throw new Error("Failed to create short affiliate link");
      }

      const shortUrl = shortLinkResult.shortUrl;

      // Execute postings in parallel
      const [twitterResult, facebookResult] = await Promise.allSettled([
        this.config.twitterEnabled
          ? this.postToTwitter(postData, shortUrl)
          : Promise.resolve({ status: "pending" as const }),
        this.config.facebookEnabled
          ? this.postToFacebook(postData, shortUrl)
          : Promise.resolve({ status: "pending" as const }),
      ]);

      // Process Twitter result
      if (twitterResult.status === "fulfilled") {
        result.twitter = twitterResult.value;
      } else {
        result.twitter = {
          status: "failed",
          error: twitterResult.reason?.message || "Twitter posting failed",
        };
      }

      // Process Facebook result
      if (facebookResult.status === "fulfilled") {
        result.facebook = facebookResult.value;
      } else {
        result.facebook = {
          status: "failed",
          error: facebookResult.reason?.message || "Facebook posting failed",
        };
      }

      // Overall success if at least one platform succeeded
      result.success =
        result.twitter?.status === "published" ||
        result.facebook?.status === "published";

      return result;
    } catch (error) {
      console.error("Error in dual-platform posting:", error);
      return {
        success: false,
        twitter: {
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error",
        },
        facebook: {
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error",
        },
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Post to X (Twitter) using 2-tweet thread strategy
   * Soft-fail: Returns skipped status if X API is unconfigured or failing
   * @param postData - Post data
   * @param shortUrl - Short affiliate URL
   * @returns Twitter post result
   */
  private async postToTwitter(
    postData: PostData,
    shortUrl: string,
  ): Promise<PostResult["twitter"]> {
    try {
      // Check if X API credentials are configured
      if (!this.env.X_BEARER_TOKEN && !this.env.X_ACCESS_TOKEN) {
        console.warn(
          "X API credentials not configured, skipping Twitter posting",
        );
        return {
          status: "pending",
          error: "X API credentials not configured - skipped",
        };
      }

      // Tweet 1: Hook + HD Photo (NO LINK)
      const tweet1Text = this.buildTweet1Text(postData.xCopy);
      const tweet1Result = await this.twitter.postTweetWithMedia(
        tweet1Text,
        postData.imageUrl,
      );

      if (!tweet1Result.success || !tweet1Result.tweetId) {
        throw new Error(`Tweet 1 failed: ${tweet1Result.error}`);
      }

      // Small delay before reply
      await this.sleep(1000);

      // Tweet 2: Auto-reply with Affiliate Shortlink + CTA
      const tweet2Text = this.buildTweet2Text(postData.xCopy, shortUrl);
      const tweet2Result = await this.twitter.postReply(
        tweet2Text,
        tweet1Result.tweetId,
      );

      if (!tweet2Result.success) {
        // Tweet 1 succeeded but reply failed - still partial success
        return {
          tweet1Id: tweet1Result.tweetId,
          tweet2Id: undefined,
          status: "published",
          error: `Reply failed: ${tweet2Result.error}`,
          retryCount: 0,
          postedAt: Date.now(),
        };
      }

      return {
        tweet1Id: tweet1Result.tweetId,
        tweet2Id: tweet2Result.tweetId,
        status: "published",
        retryCount: 0,
        postedAt: Date.now(),
      };
    } catch (error) {
      console.error("Error posting to Twitter:", error);
      // Soft-fail: Return skipped status instead of throwing fatal error
      return {
        status: "pending",
        error: error instanceof Error ? error.message : "Unknown error",
        retryCount: 0,
      };
    }
  }

  /**
   * Post to Facebook Page using main post + auto-comment strategy
   * Soft-fail: Returns skipped status if Meta API is unconfigured or failing
   * @param postData - Post data
   * @param shortUrl - Short affiliate URL
   * @returns Facebook post result
   */
  private async postToFacebook(
    postData: PostData,
    shortUrl: string,
  ): Promise<PostResult["facebook"]> {
    try {
      // Check if Meta API credentials are configured
      if (!this.env.META_PAGE_ACCESS_TOKEN && !this.env.META_APP_ID) {
        console.warn(
          "Meta API credentials not configured, skipping Facebook posting",
        );
        return {
          status: "pending",
          error: "Meta API credentials not configured - skipped",
        };
      }

      // Main Post: HD Photo + Storytelling Copy (NO LINK)
      const postText = this.buildFacebookPostText(postData.facebookCopy);
      const postResult = await this.facebook.postToPageWithMedia(
        postText,
        postData.imageUrl,
      );

      if (!postResult.success || !postResult.postId) {
        throw new Error(`Facebook post failed: ${postResult.error}`);
      }

      // Anti-spam jitter delay (3-8 seconds)
      const jitterDelay = this.getRandomJitterDelay();
      await this.sleep(jitterDelay);

      // Auto-Comment 1: Affiliate Shortlink + CTA
      const commentText = this.buildFacebookCommentText(
        postData.facebookCopy,
        shortUrl,
      );
      const commentResult = await this.facebook.postComment(
        postResult.postId,
        commentText,
      );

      if (!commentResult.success) {
        // Post succeeded but comment failed - still partial success
        return {
          postId: postResult.postId,
          commentId: undefined,
          status: "published",
          error: `Comment failed: ${commentResult.error}`,
          retryCount: 0,
          postedAt: Date.now(),
        };
      }

      return {
        postId: postResult.postId,
        commentId: commentResult.commentId,
        status: "published",
        retryCount: 0,
        postedAt: Date.now(),
      };
    } catch (error) {
      console.error("Error posting to Facebook:", error);
      // Soft-fail: Return skipped status instead of throwing fatal error
      return {
        status: "pending",
        error: error instanceof Error ? error.message : "Unknown error",
        retryCount: 0,
      };
    }
  }

  /**
   * Build Tweet 1 text (Hook only, no link)
   * @param copy - Generated X copy
   * @returns Tweet 1 text
   */
  private buildTweet1Text(copy: GeneratedCopy): string {
    return `${copy.hook} ${copy.culturalAdaptation}`;
  }

  /**
   * Build Tweet 2 text (Reply with shortlink + CTA)
   * @param copy - Generated X copy
   * @param shortUrl - Short affiliate URL
   * @returns Tweet 2 text
   */
  private buildTweet2Text(copy: GeneratedCopy, shortUrl: string): string {
    return `${copy.cta} ${shortUrl}`;
  }

  /**
   * Build Facebook main post text (Storytelling, no link)
   * @param copy - Generated Facebook copy
   * @returns Facebook post text
   */
  private buildFacebookPostText(copy: GeneratedCopy): string {
    return `${copy.hook}\n\n${copy.culturalAdaptation}`;
  }

  /**
   * Build Facebook comment text (Shortlink + CTA)
   * @param copy - Generated Facebook copy
   * @param shortUrl - Short affiliate URL
   * @returns Facebook comment text
   */
  private buildFacebookCommentText(
    copy: GeneratedCopy,
    shortUrl: string,
  ): string {
    return `${copy.cta} ${shortUrl}`;
  }

  /**
   * Get random jitter delay for anti-spam
   * @returns Delay in milliseconds
   */
  private getRandomJitterDelay(): number {
    return (
      Math.floor(
        Math.random() *
          (this.config.antiSpamJitterMaxMs -
            this.config.antiSpamJitterMinMs +
            1),
      ) + this.config.antiSpamJitterMinMs
    );
  }

  /**
   * Sleep utility
   * @param ms - Milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Retry failed posting with exponential backoff
   * @param postData - Post data
   * @param attempt - Current attempt number
   * @returns Post result
   */
  async retryPosting(
    postData: PostData,
    attempt: number = 1,
  ): Promise<PostResult> {
    if (attempt > this.config.maxRetries) {
      return {
        success: false,
        twitter: { status: "failed", error: "Max retries exceeded" },
        facebook: { status: "failed", error: "Max retries exceeded" },
        timestamp: Date.now(),
      };
    }

    const delay = this.config.retryDelayMs * Math.pow(2, attempt - 1);
    await this.sleep(delay);

    return this.postToBothPlatforms(postData);
  }

  /**
   * Get posting statistics
   * @returns Statistics object
   */
  async getStats(): Promise<any> {
    return {
      twitterEnabled: this.config.twitterEnabled,
      facebookEnabled: this.config.facebookEnabled,
      antiSpamJitterRange: `${this.config.antiSpamJitterMinMs}-${this.config.antiSpamJitterMaxMs}ms`,
      maxRetries: this.config.maxRetries,
    };
  }
}
