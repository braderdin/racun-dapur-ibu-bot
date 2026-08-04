/*
 * Dual-Poster Service
 * Main orchestrator for dual-channel posting (X + Facebook)
 * Integrates Facebook Graph API with X API v2
 * Implements comprehensive workflow: Image Processing -> Social Media Posting -> Database Logging
 * Follows 3-tier error handling with OpenRouter AI fallback
 * Designed for RM0 cost with Cloudflare Workers + Supabase + Upstash Redis
 */

import { RedisService } from "./redis";
import { SupabaseService } from "./supabase";
import { B2StorageService } from "./b2-storage";
import { ImageProcessor } from "../utils/image-processor";
import { OpenRouterService } from "./openrouter";
import { GeneratedCopy } from "../types/product";
import { FacebookService } from "./facebook";
import { TwitterService } from "./twitter";
import { TelegramNotifierService } from "./telegram-notifier";

// Dual-Posting Configuration
export interface DualPostConfig {
  enableFacebookPosting: boolean;
  enableTwitterPosting: boolean;
  maxPostAttempts: number;
  retryDelayMs: number;
  timeoutMs: number;
  requireBothPlatforms: boolean;
}

// Processed Deal Data Structure
export interface ProcessedDeal {
  id: string;
  title: string;
  description: string;
  price: number;
  imageUrl: string;
  category: string;
  rating: number;
  platform: "lazada" | "shopee";
  sourceUrl: string;
  affiliateLink: string;
  commissionRate: number;
  expirationDate: string;
  seller: string;
  stock: number;
  createdAt: Date;
  body?: string[];
  cta?: string;
  hashtags?: string[];
}

// Dual-Posting Result
export interface DualPostResult {
  twitter?: {
    success: boolean;
    postId?: string;
    error?: string;
  };
  facebook?: {
    success: boolean;
    postId?: string;
    commentId?: string;
    error?: string;
  };
  overallSuccess: boolean;
  processedAt: Date;
}

// Main Dual-Poster Service Class
export class DualPosterService {
  private redisService: RedisService;
  private supabaseService: SupabaseService;
  private b2StorageService: B2StorageService;
  private imageProcessor: ImageProcessor;
  private openRouterService: OpenRouterService;
  private facebookService: FacebookService;
  private twitterService: TwitterService;
  private config: DualPostConfig;

  constructor(
    redisService: RedisService,
    supabaseService: SupabaseService,
    b2StorageService: B2StorageService,
    imageProcessor: ImageProcessor,
    config: DualPostConfig = {
      enableFacebookPosting: true,
      enableTwitterPosting: true,
      maxPostAttempts: 3,
      retryDelayMs: 2000,
      timeoutMs: 30000,
      requireBothPlatforms: false, // Allow partial success
    },
  ) {
    this.redisService = redisService;
    this.supabaseService = supabaseService;
    this.b2StorageService = b2StorageService;
    this.imageProcessor = imageProcessor;
    this.config = config;

    // Initialize services with dependency injection
    this.openRouterService = new OpenRouterService();
    this.facebookService = new FacebookService();
    this.twitterService = new TwitterService();
  }

  // Main method: Execute dual-channel posting pipeline
  async executeDualPost(
    deal: ProcessedDeal,
    env: any,
  ): Promise<DualPostResult> {
    const startTime = Date.now();
    console.log(
      `🚀 Starting dual-channel posting pipeline for deal: ${deal.id}`,
    );

    // Initialize result object
    const result: DualPostResult = {
      twitter: undefined,
      facebook: undefined,
      overallSuccess: false,
      processedAt: new Date(),
    };

    try {
      // Check Redis anti-repeat protection
      const isDuplicate = await this.checkAntiRepeat(deal.id);
      if (isDuplicate) {
        console.log(`⚠️ Deal ${deal.id} already posted, skipping`);
        return {
          twitter: { success: false, error: "Already posted" },
          facebook: { success: false, error: "Already posted" },
          overallSuccess: false,
          processedAt: new Date(),
        };
      }

      // Generate dual-platform copy (X and Facebook)
      console.log(`📝 Generating AI copy for dual-platform posting...`);
      const dualCopy = await this.openRouterService.generateDualCopy(deal);

      // Process and upload image to B2 Storage
      console.log(`🖼️ Processing image for deal: ${deal.id}`);
      const processedImage = await this.processImageForSocial(deal);

      // Execute parallel posting to X and Facebook (if enabled)
      console.log(`🚀 Executing parallel posting to social media platforms...`);

      const postingPromises: Promise<any>[] = [];

      if (this.config.enableTwitterPosting) {
        postingPromises.push(
          this.twitterService
            .postAffiliateThread(
              dualCopy.twitterCopy as import("../types/product").GeneratedCopy,
              processedImage.webpUrl,
              deal.affiliateLink,
            )
            .then((twitterResult) => {
              result.twitter = {
                success: twitterResult,
                postId: twitterResult ? "posted" : undefined,
                error: twitterResult ? undefined : "Failed to post to X",
              };
            }),
        );
      }

      if (this.config.enableFacebookPosting) {
        // Prepare Facebook-specific data
        const facebookCopy = dualCopy.facebookCopy || dualCopy.twitterCopy;
        if (!facebookCopy) {
          throw new Error("No Facebook copy available");
        }

        postingPromises.push(
          this.executeFacebookPost(
            deal,
            facebookCopy,
            processedImage,
            env,
          ).then((facebookResult) => {
            result.facebook = {
              success: facebookResult.success,
              postId: facebookResult.postId,
              commentId: facebookResult.commentId,
              error: facebookResult.error,
            };
          }),
        );
      }

      // Wait for all posting attempts to complete
      await Promise.allSettled(postingPromises);

      // Determine overall success
      const twitterSuccess =
        result.twitter?.success || !this.config.enableTwitterPosting;
      const facebookSuccess =
        result.facebook?.success || !this.config.enableFacebookPosting;
      result.overallSuccess = this.config.requireBothPlatforms
        ? twitterSuccess && facebookSuccess
        : twitterSuccess || facebookSuccess;

      // Log to database regardless of success/failure
      await this.logDualPost(deal, result);

      // Set Redis anti-repeat cache
      await this.setAntiRepeat(deal.id, result);

      // Send Telegram audit notification
      if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
        try {
          const telegram = new TelegramNotifierService(
            env.TELEGRAM_BOT_TOKEN,
            env.TELEGRAM_CHAT_ID,
          );

          await telegram.sendAuditReport({
            productTitle: deal.title,
            price: `RM ${deal.price}`,
            discount: `${deal.commissionRate || 0}%`,
            platform: deal.platform === "lazada" ? "Lazada" : "Shopee",
            imageUrl: processedImage.webpUrl || deal.imageUrl,
            shortlinkUrl: deal.affiliateLink,
            twitterCopy: dualCopy.twitterCopy?.body?.join(" ") || "",
            facebookCopy: dualCopy.facebookCopy?.body?.join(" ") || "",
            twitterPostUrl: result.twitter?.postId
              ? `https://x.com/i/status/${result.twitter.postId}`
              : undefined,
            facebookPostUrl: result.facebook?.postId
              ? `https://facebook.com/${result.facebook.postId}`
              : undefined,
          });
        } catch (telegramError) {
          console.warn(
            `⚠️ Telegram notification failed: ${telegramError instanceof Error ? telegramError.message : String(telegramError)}`,
          );
        }
      }

      console.log(`✅ Dual-post pipeline completed for deal ${deal.id}`);
      console.log(
        `   X Status: ${result.twitter?.success ? "SUCCESS" : "FAILED"}, Facebook Status: ${result.facebook?.success ? "SUCCESS" : "FAILED"}`,
      );

      return result;
    } catch (error) {
      console.error(
        `❌ Dual-post pipeline failed for deal ${deal.id}: ${error instanceof Error ? error.message : String(error)}`,
      );

      // Log failure to database
      await this.logDualPost(
        deal,
        result,
        error instanceof Error ? error.message : String(error),
      );

      // Determine retry strategy
      if (this.isRetryableError(error)) {
        console.log(
          `🔄 Error retryable, will retry after ${this.config.retryDelayMs}ms`,
        );
        await this.delayRequest(this.config.retryDelayMs);
        return await this.executeDualPost(deal, env); // Recursive retry
      }

      // Non-retryable error
      result.overallSuccess = false;
      return result;
    }
  }

  // Execute Facebook posting with comprehensive error handling
  private async executeFacebookPost(
    deal: ProcessedDeal,
    copy: any,
    image: any,
    env: any,
  ): Promise<any> {
    try {
      // Generate Facebook-specific affiliate comment
      const affiliateComment = this.generateAffiliateComment(deal);

      // Post to Facebook with story and comment
      const facebookResult = await this.facebookService.publishPhotoWithStory(
        deal.id,
        deal.platform,
        deal.title,
        deal.description,
        deal.price,
        image?.webpUrl || deal.imageUrl,
        deal.category,
        deal.rating,
        deal.affiliateLink,
        deal.expirationDate,
        env.FACEBOOK_PAGE_ACCESS_TOKEN,
        env.FACEBOOK_PAGE_ID,
      );

      // Add affiliate comment if Facebook posting succeeded
      let commentId: string | undefined;
      if (facebookResult.success && facebookResult.postId) {
        const commentResult = await this.facebookService.addAffiliateComment(
          facebookResult.postId,
          affiliateComment,
          env.FACEBOOK_PAGE_ACCESS_TOKEN,
        );

        if (commentResult.success) {
          commentId = commentResult.id;
        }
      }

      return {
        success: facebookResult.success,
        postId: facebookResult.postId || facebookResult.id,
        commentId,
        error: facebookResult.error,
      };
    } catch (error) {
      console.error(
        `❌ Facebook posting failed for deal ${deal.id}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return {
        success: false,
        postId: undefined,
        commentId: undefined,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // Process image for social media posting
  private async processImageForSocial(deal: ProcessedDeal): Promise<any> {
    try {
      const response = await fetch(deal.imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();

      // Process with ImageProcessor (convert to WebP)
      const processedImage = await this.imageProcessor.processImage(
        arrayBuffer,
        {
          convertToWebP: true,
          quality: 0.85,
          maxSizeMB: 10,
        },
      );

      // Upload to B2 Storage
      const storageKey = this.imageProcessor.formatB2StorageKey(
        deal.id,
        deal.platform,
        deal.category,
        "social_post.jpg",
      );

      await this.b2StorageService.uploadProductImage(
        processedImage.buffer,
        deal.id,
        {
          platform: deal.platform,
          category: deal.category,
          originalFileName: "social_post.webp",
        },
      );

      return {
        webpUrl: `https://racun.ibu.my/${storageKey}`, // CDN URL
        buffer: processedImage.buffer,
      };
    } catch (error) {
      console.warn(
        `⚠️ Image processing failed for deal ${deal.id}, using original URL: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Return original URL as fallback
      return {
        webpUrl: deal.imageUrl,
        buffer: undefined,
      };
    }
  }

  // Generate affiliate comment for Facebook
  private generateAffiliateComment(deal: ProcessedDeal): string {
    const shortLink = deal.affiliateLink.includes("?")
      ? deal.affiliateLink.split("?")[0] + "?ref=racun_dapur_ibu"
      : deal.affiliateLink + "?ref=racun_dapur_ibu";

    return `🚀 Special deal alert from Racun Dapur Ibu! ${deal.title} is now available for $${deal.price}. Limited stock - grab yours now! ${shortLink}`;
  }

  // Check Redis anti-repeat cache
  private async checkAntiRepeat(dealId: string): Promise<boolean> {
    try {
      const cacheKey = `deal_posted:${dealId}`;
      const cached = await this.redisService.get(cacheKey);
      return !!cached;
    } catch (error) {
      console.warn(
        `⚠️ Failed to check anti-repeat cache: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false; // If cache fails, assume not posted
    }
  }

  // Set Redis anti-repeat cache
  private async setAntiRepeat(
    dealId: string,
    result: DualPostResult,
  ): Promise<void> {
    try {
      const cacheKey = `deal_posted:${dealId}`;
      await this.redisService.setEx(
        cacheKey,
        JSON.stringify({
          // 5 days TTL
          postedAt: result.processedAt.toISOString(),
          success: result.overallSuccess,
          twitterSuccess: result.twitter?.success || false,
          facebookSuccess: result.facebook?.success || false,
        }),
        432000,
      );
    } catch (error) {
      console.warn(
        `⚠️ Failed to set anti-repeat cache: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Cache failure shouldn't break the flow
    }
  }

  // Log dual-post result to database
  private async logDualPost(
    deal: ProcessedDeal,
    result: DualPostResult,
    errorMessage?: string,
  ): Promise<void> {
    try {
      const logData = {
        productId: deal.id,
        platform: deal.platform,
        postId: result.facebook?.postId,
        commentId: result.facebook?.commentId,
        status: (result.facebook?.success
          ? "published"
          : result.facebook?.error
            ? "failed"
            : "pending") as "published" | "failed" | "pending",
        errorMessage: result.facebook?.error,
        timestamp: new Date().toISOString(),
        source: "dual_poster_service",
      };

      // Log to Supabase
      await this.supabaseService.logFacebookPost(logData);
    } catch (error) {
      console.error(
        `❌ Failed to log dual-post result: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Don't throw - logging failure shouldn't break the main flow
    }
  }

  // Check if error should be retried
  private isRetryableError(error: any): boolean {
    const message = error.message?.toLowerCase() || "";
    const status = error.status || 0;

    return (
      message.includes("timeout") ||
      message.includes("network") ||
      message.includes("rate limit") ||
      message.includes("temporary") ||
      (status >= 500 && status < 600) ||
      status === 429 ||
      status === 503
    );
  }

  // Delay request with timeout
  private async delayRequest(delayMs: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, delayMs);
    });
  }

  // Health check for Dual-Poster service
  async healthCheck(): Promise<{
    status: "healthy" | "unhealthy";
    details: string;
  }> {
    try {
      // Test all dependent services
      const [redisStatus, supabaseStatus, b2Status] = await Promise.all([
        this.redisService
          .healthCheck()
          .then(() => "connected")
          .catch(() => "disconnected"),
        this.supabaseService
          .healthCheck()
          .then(() => "connected")
          .catch(() => "disconnected"),
        this.b2StorageService
          .healthCheck()
          .then(() => "connected")
          .catch(() => "disconnected"),
      ]);

      const allConnected = [redisStatus, supabaseStatus, b2Status].every(
        (status) => status === "connected",
      );

      if (allConnected) {
        return {
          status: "healthy",
          details: `All services connected (Redis: ${redisStatus}, Supabase: ${supabaseStatus}, B2 Storage: ${b2Status})`,
        };
      } else {
        return {
          status: "unhealthy",
          details: `Some services disconnected - Redis: ${redisStatus}, Supabase: ${supabaseStatus}, B2 Storage: ${b2Status}`,
        };
      }
    } catch (error) {
      return {
        status: "unhealthy",
        details: `Health check error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  // Update configuration
  updateConfig(newConfig: Partial<DualPostConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log("🔧 Dual-Poster configuration updated");
  }
}
