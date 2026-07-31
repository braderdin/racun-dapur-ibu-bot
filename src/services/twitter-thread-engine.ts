/*
 * Twitter Thread Orchestrator & Auto-Reply Optimizer
 * Optimized Twitter 2-tweet thread engine:
 *   Tweet 1: Visual hook copywriting with HD WebP photo (no links)
 *   Tweet 2: Auto-Reply containing shortlink affiliate CTA
 *
 * Phase 8: Autonomous AI Curation Engine
 * All credentials read from environment variables — no hardcoded secrets.
 */

import { Env } from "../types/env";
import { CONSTANTS } from "../config/constants";
import { logger } from "../utils/logger";
import { ProductItem } from "../types/product";
import { GeneratedCopy } from "../types/product";

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface TwitterThreadConfig {
  tweet1MaxChars: number;
  tweet2MaxChars: number;
  imageQuality: number;
  imageWidth: number;
  imageHeight: number;
  delayBetweenTweetsMs: number;
  autoReplyDelayMs: number;
  enableThreadOptimization: boolean;
}

export interface TweetResult {
  tweetId: string;
  text: string;
  mediaUrl?: string;
  isReply: boolean;
  inReplyToTweetId?: string;
  publishedAt: string;
  success: boolean;
  error?: string;
}

export interface TwitterThreadResult {
  tweet1: TweetResult;
  tweet2: TweetResult;
  threadId?: string;
  totalLatencyMs: number;
  success: boolean;
}

export interface ThreadOptimizationMetrics {
  hookScore: number;
  visualImpactScore: number;
  ctaEffectiveness: number;
  threadCompletionRate: number;
  engagementPrediction: number;
}

// ---------------------------------------------------------------------------
// Default Configuration
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: TwitterThreadConfig = {
  tweet1MaxChars: 280,
  tweet2MaxChars: 280,
  imageQuality: 0.85,
  imageWidth: 1920,
  imageHeight: 1080,
  delayBetweenTweetsMs: 500,
  autoReplyDelayMs: 3000,
  enableThreadOptimization: true,
};

// ---------------------------------------------------------------------------
// Twitter Thread Engine Service
// ---------------------------------------------------------------------------

export class TwitterThreadEngine {
  private config: TwitterThreadConfig;
  private env: Env;

  constructor(env: Env, config?: Partial<TwitterThreadConfig>) {
    this.env = env;
    this.config = { ...DEFAULT_CONFIG, ...config };

    logger.info(
      "TwitterThreadEngine initialized",
      {
        tweet1MaxChars: this.config.tweet1MaxChars,
        tweet2MaxChars: this.config.tweet2MaxChars,
        delayBetweenTweetsMs: this.config.delayBetweenTweetsMs,
      },
      "TwitterThreadEngine",
    );
  }

  // -----------------------------------------------------------------------
  // Execute the full 2-tweet thread pipeline
  // -----------------------------------------------------------------------

  async executeThread(
    product: ProductItem,
    copy: GeneratedCopy,
    imageUrl: string,
  ): Promise<TwitterThreadResult> {
    const startTime = Date.now();

    logger.info(
      "Starting Twitter thread execution",
      {
        productId: product.id,
        productName: product.title,
      },
      "TwitterThreadEngine",
    );

    // Step 1: Publish Tweet 1 (Hook + HD Photo, no links)
    const tweet1 = await this.publishTweet1(product, copy, imageUrl);

    if (!tweet1.success) {
      logger.error(
        "Tweet 1 failed, aborting thread",
        {
          error: tweet1.error,
        },
        "TwitterThreadEngine",
      );

      return {
        tweet1,
        tweet2: {
          tweetId: "",
          text: "",
          isReply: false,
          publishedAt: new Date().toISOString(),
          success: false,
          error: "Aborted due to Tweet 1 failure",
        },
        totalLatencyMs: Date.now() - startTime,
        success: false,
      };
    }

    // Step 2: Wait for the configured delay
    await this.delay(this.config.delayBetweenTweetsMs);

    // Step 3: Publish Tweet 2 (Auto-Reply with affiliate CTA)
    const tweet2 = await this.publishTweet2(product, copy, tweet1.tweetId);

    const totalLatencyMs = Date.now() - startTime;

    logger.info(
      "Twitter thread execution complete",
      {
        tweet1Success: tweet1.success,
        tweet2Success: tweet2.success,
        totalLatencyMs,
      },
      "TwitterThreadEngine",
    );

    return {
      tweet1,
      tweet2,
      threadId: tweet1.tweetId,
      totalLatencyMs,
      success: tweet1.success && tweet2.success,
    };
  }

  // -----------------------------------------------------------------------
  // Tweet 1: Visual hook with HD WebP photo (no links)
  // -----------------------------------------------------------------------

  private async publishTweet1(
    product: ProductItem,
    copy: GeneratedCopy,
    imageUrl: string,
  ): Promise<TweetResult> {
    const tweet1Text = this.formatTweet1(copy.tweetHook);

    // Enforce character limit
    const truncatedText = this.truncateToLimit(
      tweet1Text,
      this.config.tweet1MaxChars,
    );

    try {
      // In production, this calls the X API v2 to post the tweet
      // with the HD WebP image attached
      logger.info(
        "Publishing Tweet 1",
        {
          textLength: truncatedText.length,
          hasImage: !!imageUrl,
        },
        "TwitterThreadEngine",
      );

      // Simulate API call (replace with actual X API v2 call)
      const tweetId = `tweet_${product.id}_${Date.now()}`;

      return {
        tweetId,
        text: truncatedText,
        mediaUrl: imageUrl,
        isReply: false,
        publishedAt: new Date().toISOString(),
        success: true,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      return {
        tweetId: "",
        text: truncatedText,
        mediaUrl: imageUrl,
        isReply: false,
        publishedAt: new Date().toISOString(),
        success: false,
        error: errorMessage,
      };
    }
  }

  // -----------------------------------------------------------------------
  // Tweet 2: Auto-Reply with shortlink affiliate CTA
  // -----------------------------------------------------------------------

  private async publishTweet2(
    product: ProductItem,
    copy: GeneratedCopy,
    inReplyToTweetId: string,
  ): Promise<TweetResult> {
    const tweet2Text = this.formatTweet2(copy.tweetReply);

    // Enforce character limit
    const truncatedText = this.truncateToLimit(
      tweet2Text,
      this.config.tweet2MaxChars,
    );

    try {
      // In production, this calls the X API v2 to post the reply
      // with in_reply_to_tweet_id set to tweet1's ID
      logger.info(
        "Publishing Tweet 2 (Auto-Reply)",
        {
          inReplyToTweetId,
          textLength: truncatedText.length,
        },
        "TwitterThreadEngine",
      );

      // Simulate API call (replace with actual X API v2 call)
      const tweetId = `reply_${product.id}_${Date.now()}`;

      return {
        tweetId,
        text: truncatedText,
        isReply: true,
        inReplyToTweetId,
        publishedAt: new Date().toISOString(),
        success: true,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      return {
        tweetId: "",
        text: truncatedText,
        isReply: true,
        inReplyToTweetId,
        publishedAt: new Date().toISOString(),
        success: false,
        error: errorMessage,
      };
    }
  }

  // -----------------------------------------------------------------------
  // Formatting helpers
  // -----------------------------------------------------------------------

  private formatTweet1(hook: string): string {
    // Tweet 1 must NOT contain any links per dual-posting protocol
    let text = hook;

    // Strip any URLs from the hook text
    text = text.replace(/https?:\/\/\S+/g, "");

    // Ensure it ends with a strong visual hook
    if (!text.endsWith("!") && !text.endsWith("?") && !text.endsWith("...")) {
      text += "!";
    }

    return text;
  }

  private formatTweet2(cta: string): string {
    // Tweet 2 contains the affiliate CTA
    let text = cta;

    // Ensure the CTA is clear and actionable
    if (
      !text.toLowerCase().includes("link") &&
      !text.toLowerCase().includes("pautan")
    ) {
      text = `Dapatkan sekarang! ${text}`;
    }

    return text;
  }

  private truncateToLimit(text: string, limit: number): string {
    if (text.length <= limit) return text;
    return text.slice(0, limit - 1).trim();
  }

  // -----------------------------------------------------------------------
  // Utility
  // -----------------------------------------------------------------------

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // -----------------------------------------------------------------------
  // Thread optimization metrics
  // -----------------------------------------------------------------------

  computeOptimizationMetrics(
    tweet1: TweetResult,
    tweet2: TweetResult,
  ): ThreadOptimizationMetrics {
    const hookScore = this.estimateHookScore(tweet1.text);
    const visualImpactScore = tweet1.mediaUrl ? 0.9 : 0.3;
    const ctaEffectiveness = this.estimateCTAScore(tweet2.text);
    const threadCompletionRate = tweet1.success && tweet2.success ? 1.0 : 0.5;
    const engagementPrediction =
      (hookScore + visualImpactScore + ctaEffectiveness) / 3;

    return {
      hookScore,
      visualImpactScore,
      ctaEffectiveness,
      threadCompletionRate,
      engagementPrediction,
    };
  }

  private estimateHookScore(text: string): number {
    let score = 0.5;

    // Hook words that drive engagement
    const hookWords = [
      "tengok",
      "lihat",
      "gila",
      "wow",
      "macam ni",
      "game changer",
      "wajib",
      "perlu",
      "best",
      "terbaik",
      "promo",
      "diskaun",
    ];

    const lowerText = text.toLowerCase();
    for (const word of hookWords) {
      if (lowerText.includes(word)) score += 0.1;
    }

    // Questions drive engagement
    if (text.includes("?") || text.includes("?")) score += 0.1;

    // Exclamation marks add energy
    const exclamationCount = (text.match(/!/g) || []).length;
    if (exclamationCount > 0) score += Math.min(0.1, exclamationCount * 0.03);

    return Math.min(1.0, score);
  }

  private estimateCTAScore(text: string): number {
    let score = 0.5;

    const ctaWords = [
      "dapatkan",
      "beli",
      "belanja",
      "click",
      "link",
      "pautan",
      "sekarang",
      "sahkan",
      "ambil",
      "daftar",
    ];

    const lowerText = text.toLowerCase();
    for (const word of ctaWords) {
      if (lowerText.includes(word)) score += 0.1;
    }

    return Math.min(1.0, score);
  }
}

// ---------------------------------------------------------------------------
// Factory helper
// ---------------------------------------------------------------------------

export function createTwitterThreadEngine(env: Env): TwitterThreadEngine {
  return new TwitterThreadEngine(env, {
    tweet1MaxChars: parseInt(env.TWITTER_TWEET1_MAX || "280", 10),
    tweet2MaxChars: parseInt(env.TWITTER_TWEET2_MAX || "280", 10),
    delayBetweenTweetsMs: parseInt(env.TWITTER_DELAY_BETWEEN || "500", 10),
    autoReplyDelayMs: parseInt(env.TWITTER_AUTO_REPLY_DELAY || "3000", 10),
  });
}
