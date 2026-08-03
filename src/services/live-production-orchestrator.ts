/**
 * Live Production Orchestrator
 * Master orchestrator executing the full 8-step pipeline with circuit breakers
 *
 * Pipeline Steps:
 * 1. Lazada/Shopee Fetch -> 2. B2 WebP -> 3. Vector RAG Copy -> 4. Shortlink
 * 5. X Thread -> 6. FB Post+Comment -> 7. Telegram QA -> 8. Realtime Vercel
 */

import { Env } from "../types/env";
import { SocialPosterEngine, PostData } from "./social-poster-engine";
import { EdgeLinkShortener } from "./edge-link-shortener";
import { VectorRAGCopywriter, GeneratedCopy } from "./vector-rag-copywriter";
import { B2WebPUploader } from "./b2-webp-uploader";
import { TelegramService } from "./telegram";
import { SupabaseRealtimeBroadcaster } from "./supabase-realtime-broadcaster";
import { DealCurator } from "./deal-curator";
import { AffiliateYieldTracker } from "./affiliate-yield-tracker";

export interface PipelineConfig {
  mode: "dry-run" | "production";
  peakHoursOnly: boolean;
  maxDealsPerRun: number;
  circuitBreakerThreshold: number;
  circuitBreakerTimeoutMs: number;
  enableTwitter: boolean;
  enableFacebook: boolean;
  enableTelegram: boolean;
  enableRealtime: boolean;
}

export interface DealExecutionMetadata {
  dealId: string;
  productId: string;
  platform: "lazada" | "shopee";
  imageUrl: string;
  webpUrl: string;
  shortLink: string;
  shortCode: string;
  twitterStatus?: "published" | "failed" | "pending";
  facebookStatus?: "published" | "failed" | "pending";
  telegramStatus?: "sent" | "failed";
  realtimeStatus?: "broadcast" | "failed";
  yieldMetrics?: {
    clicks: number;
    conversions: number;
    ctr: number;
  };
  executionTimeMs: number;
  error?: string;
}

export interface PipelineResult {
  success: boolean;
  dealsProcessed: number;
  twitterPosts: number;
  facebookPosts: number;
  telegramNotifications: number;
  realtimeBroadcasts: number;
  errors: string[];
  warnings: string[];
  timestamp: number;
  executionTimeMs: number;
  dealsMetadata: DealExecutionMetadata[];
  yieldSummary?: {
    totalClicks: number;
    totalConversions: number;
    overallCtr: number;
  };
}

export class LiveProductionOrchestrator {
  private env: Env;
  private config: PipelineConfig;
  private socialPoster: SocialPosterEngine;
  private linkShortener: EdgeLinkShortener;
  private copywriter: VectorRAGCopywriter;
  private b2Uploader: B2WebPUploader;
  private telegram: TelegramService;
  private realtimeBroadcaster: SupabaseRealtimeBroadcaster;
  private dealCurator: DealCurator;
  private yieldTracker: AffiliateYieldTracker;

  private circuitBreakerFailures: number = 0;
  private lastCircuitBreakerReset: number = Date.now();

  constructor(env: Env, config?: Partial<PipelineConfig>) {
    this.env = env;
    this.config = {
      mode: "production",
      peakHoursOnly: false,
      maxDealsPerRun: 5,
      circuitBreakerThreshold: 3,
      circuitBreakerTimeoutMs: 300000,
      enableTwitter: true,
      enableFacebook: true,
      enableTelegram: true,
      enableRealtime: true,
      ...config,
    };

    this.socialPoster = new SocialPosterEngine(env);
    this.linkShortener = new EdgeLinkShortener(env);
    this.copywriter = new VectorRAGCopywriter(env);
    this.b2Uploader = new B2WebPUploader(env);
    this.telegram = new TelegramService(env);
    this.realtimeBroadcaster = new SupabaseRealtimeBroadcaster(env);
    this.dealCurator = new DealCurator(env);
    this.yieldTracker = new AffiliateYieldTracker(env);
  }

  /**
   * Execute the full 8-step production pipeline
   */
  async executePipeline(): Promise<PipelineResult> {
    const pipelineStartTime = Date.now();
    const result: PipelineResult = {
      success: false,
      dealsProcessed: 0,
      twitterPosts: 0,
      facebookPosts: 0,
      telegramNotifications: 0,
      realtimeBroadcasts: 0,
      errors: [],
      warnings: [],
      timestamp: Date.now(),
      executionTimeMs: 0,
      dealsMetadata: [],
    };

    // Check circuit breaker
    if (this.shouldCircuitBreak()) {
      result.warnings.push("Circuit breaker active - skipping pipeline");
      console.warn("Circuit breaker active, skipping pipeline execution");
      result.executionTimeMs = Date.now() - pipelineStartTime;
      return result;
    }

    try {
      // Step 1: Fetch deals from Lazada/Shopee
      const deals = await this.fetchDeals();
      if (deals.length === 0) {
        result.warnings.push("No deals found for processing");
        result.executionTimeMs = Date.now() - pipelineStartTime;
        return result;
      }

      // Process up to maxDealsPerRun
      const dealsToProcess = deals.slice(0, this.config.maxDealsPerRun);

      for (const deal of dealsToProcess) {
        try {
          const metadata = await this.processDeal(deal, result);
          result.dealsMetadata.push(metadata);
          result.dealsProcessed++;
        } catch (error) {
          const errorMsg = `Deal ${deal.id} failed: ${error instanceof Error ? error.message : String(error)}`;
          result.errors.push(errorMsg);
          console.error(errorMsg);
        }
      }

      result.success = result.dealsProcessed > 0;

      // Calculate yield summary
      const totalClicks = result.dealsMetadata.reduce(
        (sum, d) => sum + (d.yieldMetrics?.clicks || 0),
        0,
      );
      const totalConversions = result.dealsMetadata.reduce(
        (sum, d) => sum + (d.yieldMetrics?.conversions || 0),
        0,
      );
      result.yieldSummary = {
        totalClicks,
        totalConversions,
        overallCtr: totalClicks > 0 ? totalConversions / totalClicks : 0,
      };
    } catch (error) {
      result.errors.push(
        `Pipeline error: ${error instanceof Error ? error.message : String(error)}`,
      );
      console.error("Pipeline execution error:", error);
    }

    result.executionTimeMs = Date.now() - pipelineStartTime;
    return result;
  }

  /**
   * Fetch deals from Lazada and Shopee
   */
  private async fetchDeals(): Promise<
    Array<{
      id: string;
      title: string;
      price: number;
      discount: number;
      imageUrl: string;
      affiliateUrl: string;
      platform: "lazada" | "shopee";
    }>
  > {
    const deals: Array<{
      id: string;
      title: string;
      price: number;
      discount: number;
      imageUrl: string;
      affiliateUrl: string;
      platform: "lazada" | "shopee";
    }> = [];

    try {
      // Fetch from Lazada
      const lazadaDeals = await this.dealCurator.fetchFromLazada();
      lazadaDeals.forEach((deal) => {
        deals.push({
          id: `lz-${deal.id}`,
          title: deal.title,
          price: deal.price,
          discount: deal.discount,
          imageUrl: deal.imageUrl,
          affiliateUrl: deal.affiliateUrl,
          platform: "lazada",
        });
      });
    } catch (error) {
      console.error("Lazada fetch error:", error);
      this.recordCircuitBreakerFailure();
    }

    try {
      // Fetch from Shopee
      const shopeeDeals = await this.dealCurator.fetchFromShopee();
      shopeeDeals.forEach((deal) => {
        deals.push({
          id: `sp-${deal.id}`,
          title: deal.title,
          price: deal.price,
          discount: deal.discount,
          imageUrl: deal.imageUrl,
          affiliateUrl: deal.affiliateUrl,
          platform: "shopee",
        });
      });
    } catch (error) {
      console.error("Shopee fetch error:", error);
      this.recordCircuitBreakerFailure();
    }

    return deals;
  }

  /**
   * Process a single deal through the pipeline
   */
  private async processDeal(
    deal: {
      id: string;
      title: string;
      price: number;
      discount: number;
      imageUrl: string;
      affiliateUrl: string;
      platform: "lazada" | "shopee";
    },
    result: PipelineResult,
  ): Promise<DealExecutionMetadata> {
    const dealStartTime = Date.now();
    const metadata: DealExecutionMetadata = {
      dealId: deal.id,
      productId: deal.id,
      platform: deal.platform,
      imageUrl: deal.imageUrl,
      webpUrl: "",
      shortLink: "",
      shortCode: "",
      executionTimeMs: 0,
    };

    try {
      // Step 2: Upload to B2 and get WebP URL
      const webpUrl = await this.uploadToB2(deal.imageUrl, deal.id);
      metadata.webpUrl = webpUrl;

      // Step 3: Generate AI copy
      const copy = await this.generateCopy(
        deal.title,
        deal.price,
        deal.discount,
      );

      // Step 4: Create shortlink
      const shortLink = await this.createShortLink(deal.affiliateUrl, deal.id);
      metadata.shortLink = shortLink.url;
      metadata.shortCode = shortLink.code;

      // Step 5-6: Post to X and Facebook
      const postData: PostData = {
        productId: deal.id,
        imageUrl: webpUrl,
        xCopy: copy.x,
        facebookCopy: copy.facebook,
        affiliateUrl: deal.affiliateUrl,
        shortCode: shortLink.code,
        category: "kitchen",
      };

      const postResult = await this.socialPoster.postToBothPlatforms(postData);

      if (postResult.twitter?.status === "published") {
        result.twitterPosts++;
        metadata.twitterStatus = "published";
      } else if (postResult.twitter?.status === "failed") {
        metadata.twitterStatus = "failed";
      }

      if (postResult.facebook?.status === "published") {
        result.facebookPosts++;
        metadata.facebookStatus = "published";
      } else if (postResult.facebook?.status === "failed") {
        metadata.facebookStatus = "failed";
      }

      // Step 7: Send Telegram notification
      if (this.config.enableTelegram) {
        await this.sendTelegramNotification(deal, postResult, shortLink.url);
        result.telegramNotifications++;
        metadata.telegramStatus = "sent";
      }

      // Step 8: Broadcast to Vercel portal
      if (this.config.enableRealtime) {
        await this.broadcastToRealtime(deal, postResult, shortLink.url);
        result.realtimeBroadcasts++;
        metadata.realtimeStatus = "broadcast";
      }

      // Track yield metrics
      const yieldMetrics = await this.yieldTracker.recordClick(
        shortLink.code,
        "production",
      );
      metadata.yieldMetrics = yieldMetrics;
    } catch (error) {
      metadata.error = error instanceof Error ? error.message : String(error);
      result.errors.push(`Deal ${deal.id} failed: ${metadata.error}`);
      console.error(`Deal ${deal.id} failed:`, error);
    }

    metadata.executionTimeMs = Date.now() - dealStartTime;
    return metadata;
  }

  /**
   * Upload image to B2 and return WebP URL
   */
  private async uploadToB2(imageUrl: string, dealId: string): Promise<string> {
    try {
      const uploadResult = await this.b2Uploader.uploadImage(imageUrl, dealId);
      return uploadResult.webpUrl || imageUrl;
    } catch (error) {
      console.warn(`B2 upload failed for ${dealId}, using original URL`);
      return imageUrl;
    }
  }

  /**
   * Generate AI copy for X and Facebook
   */
  private async generateCopy(
    title: string,
    price: number,
    discount: number,
  ): Promise<{ x: GeneratedCopy; facebook: GeneratedCopy }> {
    const copy = await this.copywriter.generateCopy({
      title,
      price,
      discount,
      platform: "both",
    });
    return {
      x: copy.x,
      facebook: copy.facebook,
    };
  }

  /**
   * Create short affiliate link
   */
  private async createShortLink(
    affiliateUrl: string,
    dealId: string,
  ): Promise<{ url: string; code: string }> {
    const result = await this.linkShortener.createShortLink(
      affiliateUrl,
      "lazada",
      dealId,
    );
    return {
      url: result.shortUrl || affiliateUrl,
      code: result.shortCode || dealId,
    };
  }

  /**
   * Send Telegram notification with QA
   */
  private async sendTelegramNotification(
    deal: {
      id: string;
      title: string;
      price: number;
      discount: number;
      imageUrl: string;
      affiliateUrl: string;
      platform: "lazada" | "shopee";
    },
    postResult: any,
    shortLink: string,
  ): Promise<void> {
    const message = `
🆕 Deal Baru: ${deal.title}
💰 Harga: RM ${deal.price} (${deal.discount}% off)
📦 Platform: ${deal.platform}

📊 Status:
• X Twitter: ${postResult.twitter?.status || "pending"}
• Facebook: ${postResult.facebook?.status || "pending"}

🔗 Pautan: ${shortLink}

Please review and approve if suitable.
    `.trim();

    await this.telegram.sendMessage(message);
  }

  /**
   * Broadcast to Vercel realtime portal
   */
  private async broadcastToRealtime(
    deal: {
      id: string;
      title: string;
      price: number;
      discount: number;
      imageUrl: string;
      affiliateUrl: string;
      platform: "lazada" | "shopee";
    },
    postResult: any,
    shortLink: string,
  ): Promise<void> {
    await this.realtimeBroadcaster.broadcastDeal({
      id: deal.id,
      title: deal.title,
      price: deal.price,
      discount: deal.discount,
      imageUrl: deal.imageUrl,
      affiliateUrl: deal.affiliateUrl,
      platform: deal.platform,
      shortLink,
      twitterStatus: postResult.twitter?.status,
      facebookStatus: postResult.facebook?.status,
    });
  }

  /**
   * Check if circuit breaker should trip
   */
  private shouldCircuitBreak(): boolean {
    const now = Date.now();
    const timeSinceReset = now - this.lastCircuitBreakerReset;

    // Reset counter if timeout has passed
    if (timeSinceReset > this.config.circuitBreakerTimeoutMs) {
      this.circuitBreakerFailures = 0;
      this.lastCircuitBreakerReset = now;
    }

    return this.circuitBreakerFailures >= this.config.circuitBreakerThreshold;
  }

  /**
   * Record a circuit breaker failure
   */
  private recordCircuitBreakerFailure(): void {
    this.circuitBreakerFailures++;
    console.warn(
      `Circuit breaker failure recorded: ${this.circuitBreakerFailures}/${this.config.circuitBreakerThreshold}`,
    );
  }

  /**
   * Reset circuit breaker
   */
  resetCircuitBreaker(): void {
    this.circuitBreakerFailures = 0;
    this.lastCircuitBreakerReset = Date.now();
    console.log("Circuit breaker reset");
  }
}
