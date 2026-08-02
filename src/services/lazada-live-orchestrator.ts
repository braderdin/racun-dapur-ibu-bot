import { Env } from "../types/env";
import { LazadaLiveFetcher } from "./lazada-live-fetcher";
import { LazadaImageProxy } from "../utils/lazada-image-proxy";
import { TwitterCommenter } from "./twitter-commenter";
import { FacebookCommenter } from "./facebook-commenter";
import { TelegramInteractiveAudit } from "./telegram-interactive-audit";
import { RedisService } from "./redis";

export class LazadaLiveOrchestrator {
  private lazadaFetcher: LazadaLiveFetcher;
  private imageProxy: LazadaImageProxy;
  private twitterCommenter: TwitterCommenter;
  private facebookCommenter: FacebookCommenter;
  private telegramAudit: TelegramInteractiveAudit;
  private redis: RedisService;
  private env: Env;

  constructor(env: Env) {
    this.env = env;
    this.lazadaFetcher = new LazadaLiveFetcher(env);
    this.imageProxy = new LazadaImageProxy(env);
    this.twitterCommenter = new TwitterCommenter(env);
    this.facebookCommenter = new FacebookCommenter(env);
    this.telegramAudit = new TelegramInteractiveAudit(env);
    this.redis = new RedisService(env);
  }

  /**
   * Execute complete Lazada live posting pipeline
   * @param lazadaProductId - Lazada product ID to fetch and post
   * @param mainTweetId - Main tweet ID for thread (optional)
   * @param facebookPagePostId - Facebook page post ID (optional)
   * @returns Complete pipeline execution result
   */
  async executeLivePipeline(
    lazadaProductId: string,
    mainTweetId?: string,
    facebookPagePostId?: string,
  ): Promise<any> {
    try {
      console.log(
        `Starting Lazada live pipeline for product ${lazadaProductId}`,
      );

      // Step 1: Fetch live product details from Lazada
      const productData =
        await this.lazadaFetcher.fetchLiveProductDetails(lazadaProductId);
      if (!productData) {
        throw new Error(
          `Failed to fetch product details for ${lazadaProductId}`,
        );
      }

      console.log(`Product fetched: ${productData.title}`);

      // Step 2: Process and upload product image to B2 storage
      let processedImageUrl: string | undefined;
      if (productData.imageUrl) {
        try {
          processedImageUrl = await this.imageProxy.processLazadaImage(
            productData.imageUrl,
            lazadaProductId,
          );
          console.log(`Image processed: ${processedImageUrl}`);
        } catch (error) {
          console.warn(
            "Failed to process image, continuing without image:",
            error,
          );
        }
      }

      // Step 3: Post to Twitter/X (Thread)
      let twitterResult: any = null;
      if (mainTweetId) {
        try {
          twitterResult = await this.twitterCommenter.postReplyTweet(
            mainTweetId,
            productData,
            `Bolehpilih nak grab promo Lazada kat link ni tau! 👇`,
          );
          console.log(`Twitter reply posted: ${twitterResult.tweetId}`);
        } catch (error) {
          console.warn("Failed to post Twitter reply, continuing:", error);
        }
      } else {
        // Post thread if no main tweet ID provided
        try {
          twitterResult = await this.twitterCommenter.postThread(
            productData,
            processedImageUrl,
          );
          console.log(
            `Twitter thread posted with ${twitterResult.tweets.length} tweets`,
          );
        } catch (error) {
          console.warn("Failed to post Twitter thread, continuing:", error);
        }
      }

      // Step 4: Post to Facebook Page
      let facebookResult: any = null;
      if (facebookPagePostId) {
        try {
          facebookResult = await this.facebookCommenter.postComment(
            facebookPagePostId,
            productData,
            `Bolehpilih nak grab promo Lazada kat link ni tau! 👇`,
          );
          console.log(`Facebook comment posted: ${facebookResult.commentId}`);
        } catch (error) {
          console.warn("Failed to post Facebook comment, continuing:", error);
        }
      } else {
        // Post main post if no Facebook post ID provided
        try {
          facebookResult = await this.facebookCommenter.postMainPost(
            productData,
            processedImageUrl,
          );
          console.log(`Facebook Page post published: ${facebookResult.postId}`);
        } catch (error) {
          console.warn(
            "Failed to post Facebook Page content, continuing:",
            error,
          );
        }
      }

      // Step 5: Send Telegram audit notification
      let telegramResult: any = null;
      try {
        telegramResult = await this.telegramAudit.sendVisualAudit(
          {
            platform: "dual",
            postId:
              facebookResult?.postId || mainTweetId || `post_${Date.now()}`, // Use mainTweetId if available
            productTitle: productData.title,
            price: productData.price,
            discountRate: productData.discountRate,
            rating: productData.rating,
            stock: productData.stock,
          },
          {
            commentId: twitterResult?.tweetId || `comment_${Date.now()}`, // Use twitterResult.tweetId if available
            commentText: `Bolehpilih nak grab promo Lazada kat link ni tau! 👇`,
            affiliateLink: productData.affiliateUrl,
            engagement: 0,
          },
          processedImageUrl,
        );
        console.log(`Telegram audit sent: ${telegramResult.messageId}`);
      } catch (error) {
        console.warn("Failed to send Telegram audit, continuing:", error);
      }

      // Step 6: Store pipeline execution in Redis
      await this.storePipelineExecution(
        lazadaProductId,
        productData,
        twitterResult,
        facebookResult,
        telegramResult,
        processedImageUrl,
      );

      console.log(
        `Lazada live pipeline completed successfully for product ${lazadaProductId}`,
      );
      return {
        success: true,
        productId: lazadaProductId,
        productData,
        twitterResult,
        facebookResult,
        telegramResult,
        processedImageUrl,
        timestamp: Date.now(),
        pipelineSteps: [
          "lazada_fetch",
          "image_processing",
          "twitter_post",
          "facebook_post",
          "telegram_audit",
          "redis_storage",
        ],
      };
    } catch (error) {
      console.error("Error executing Lazada live pipeline:", error);
      throw error;
    }
  }

  /**
   * Execute pipeline for multiple products
   * @param productIds - Array of Lazada product IDs
   * @param mainTweetId - Main tweet ID for thread (optional)
   * @param facebookPagePostId - Facebook page post ID (optional)
   * @returns Batch pipeline execution result
   */
  async executeBatchPipeline(
    productIds: string[],
    mainTweetId?: string,
    facebookPagePostId?: string,
  ): Promise<any> {
    try {
      console.log(`Starting batch pipeline for ${productIds.length} products`);

      const results: any[] = [];
      const errors: any[] = [];

      // Process products in parallel with rate limiting
      const promises = productIds.map(async (productId) => {
        try {
          const result = await this.executeLivePipeline(
            productId,
            mainTweetId,
            facebookPagePostId,
          );
          results.push(result);

          // Add delay between products to respect rate limits
          await new Promise((resolve) => setTimeout(resolve, 5000));
        } catch (error) {
          errors.push({
            productId,
            error: (error as Error).message,
          });
        }
      });

      await Promise.all(promises);

      console.log(
        `Batch pipeline completed: ${results.length} successful, ${errors.length} errors`,
      );
      return {
        success: true,
        totalProducts: productIds.length,
        successful: results.length,
        errors: errors.length,
        results,
        errorDetails: errors,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error("Error executing batch pipeline:", error);
      throw error;
    }
  }

  /**
   * Store pipeline execution in Redis
   * @param productId - Product ID
   * @param productData - Product data
   * @param twitterResult - Twitter result
   * @param facebookResult - Facebook result
   * @param telegramResult - Telegram result
   * @param imageUrl - Processed image URL
   */
  private async storePipelineExecution(
    productId: string,
    productData: any,
    twitterResult: any,
    facebookResult: any,
    telegramResult: any,
    imageUrl?: string,
  ): Promise<void> {
    try {
      const pipelineExecution = {
        productId,
        productData,
        twitterResult,
        facebookResult,
        telegramResult,
        imageUrl,
        timestamp: Date.now(),
        status: "completed",
      };

      // Store in Redis with 5-day TTL
      await this.redis.setex(
        `pipeline:${productId}`,
        432000,
        JSON.stringify(pipelineExecution),
      );

      // Add to pipeline index
      await this.redis.sadd("pipeline:executions", productId);
      await this.redis.expire("pipeline:executions", 432000);

      console.log(`Pipeline execution stored for product ${productId}`);
    } catch (error) {
      console.error("Error storing pipeline execution:", error);
    }
  }

  /**
   * Get pipeline execution status
   * @param productId - Product ID
   * @returns Pipeline execution status
   */
  async getPipelineStatus(productId: string): Promise<any> {
    try {
      const pipelineData = await this.redis.get(`pipeline:${productId}`);
      if (!pipelineData) {
        return null;
      }

      return JSON.parse(pipelineData);
    } catch (error) {
      console.error("Error getting pipeline status:", error);
      return null;
    }
  }

  /**
   * Get pipeline statistics
   * @returns Pipeline statistics
   */
  getPipelineStats(): any {
    return {
      platform: "Lazada Live Orchestrator",
      pipelineSteps: [
        "lazada_fetch",
        "image_processing",
        "twitter_post",
        "facebook_post",
        "telegram_audit",
        "redis_storage",
      ],
      supportedPlatforms: ["twitter", "facebook", "telegram"],
      rateLimiting: {
        imageProcessing: "500ms between images",
        socialPosting: "2 seconds between posts",
        batchProcessing: "5 seconds between products",
      },
      storage: "Redis with 5-day TTL",
      auditFeatures: [
        "visual_audit",
        "inline_keyboard",
        "error_handling",
        "retry_logic",
      ],
    };
  }
}
