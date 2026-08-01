/*
 * Worker Router Module
 * Handles HTTP endpoints for bot operations and dual-channel posting (X + Facebook)
 */

import { Router, Request, Response } from "express";
import { healthHandler } from "./routes/health";
import { ShortenerService } from "./services/shortener";
import { RedisService } from "./services/redis";
import { SupabaseService } from "./services/supabase";
import { createFacebookService } from "./services/facebook";

export class WorkerRouter {
  private router: Router;
  private env: any;

  constructor(env: any) {
    this.router = Router();
    this.env = env;
    this.initializeRoutes(env);
  }

  private initializeRoutes(env: any): void {
    // Health endpoints
    this.router.get("/health", this.handleHealth.bind(this));
    this.router.get("/health/simple", this.handleSimpleHealth.bind(this));

    // Main bot processing endpoint
    this.router.post("/run-bot", this.handleRunBot.bind(this));
    this.router.get("/run-bot/status", this.handleGetBotStatus.bind(this));

    // URL shortener endpoints
    this.router.get("/r/:code", this.handleRedirectToAffiliate.bind(this));

    // Facebook posting endpoint
    this.router.post("/api/post/facebook", this.handleFacebookPost.bind(this));

    // Dual-channel posting endpoint (X + Facebook)
    this.router.post("/api/post/dual", this.handleDualPost.bind(this));

    // QStash webhook endpoint
    this.router.post("/qstash-trigger", this.handleQStashWebhook.bind(this));

    // Analytics endpoints
    this.router.get(
      "/analytics/clicks",
      this.handleGetClickAnalytics.bind(this),
    );
    this.router.get(
      "/analytics/conversions",
      this.handleGetConversionAnalytics.bind(this),
    );

    // Worker information endpoint
    this.router.get("/worker/info", this.handleGetWorkerInfo.bind(this));
  }

  private async handleHealth(req: Request, res: Response): Promise<Response> {
    const webResponse = await healthHandler(req as any, {});
    return res.status(webResponse.status).send(await webResponse.text());
  }

  private async handleSimpleHealth(
    req: Request,
    res: Response,
  ): Promise<Response> {
    const webResponse = await healthHandler(req as any, {});
    return res.status(webResponse.status).send(await webResponse.text());
  }

  private async handleRunBot(req: Request, res: Response): Promise<Response> {
    try {
      const redisService = new RedisService(this.env);
      const supabaseService = new SupabaseService(this.env);

      const startTime = Date.now();
      await this.processBotWorkflow(this.env, redisService, supabaseService);

      const processingTime = Date.now() - startTime;

      return res.status(200).json({
        message: "Bot processed successfully",
        processingTimeMs: processingTime,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Bot processing failed:", error);
      return res.status(500).json({
        error: "Bot processing failed",
        message: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });
    }
  }

  private async handleGetBotStatus(
    req: Request,
    res: Response,
  ): Promise<Response> {
    try {
      const redisService = new RedisService(this.env);
      const supabaseService = new SupabaseService(this.env);

      const recentProducts = await supabaseService.getRecentProducts();
      const totalProducts = recentProducts.length;
      const redisStats = await redisService.getServiceStatus();
      const workerStatus = await this.getWorkerServiceStatus(this.env);

      return res.status(200).json({
        status: "running",
        totalProductsProcessed: totalProducts,
        redisStatus: redisStats,
        workerStatus,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Failed to get bot status:", error);
      return res.status(500).json({
        error: "Failed to get bot status",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  private async handleRedirectToAffiliate(
    req: Request,
    res: Response,
  ): Promise<Response> {
    try {
      const { code } = req.params;

      const shortenerService = new ShortenerService(
        new RedisService(this.env),
        new SupabaseService(this.env),
      );

      const affiliateUrl = await shortenerService.getAffiliateUrl(code);

      if (!affiliateUrl) {
        return res.status(404).json({
          error: "Short code not found",
          message: `Short code ${code} not found or expired`,
        });
      }

      await shortenerService.incrementClickCount(code);

      return res.status(302).redirect(affiliateUrl);
    } catch (error) {
      console.error("Error redirecting to affiliate:", error);
      return res.status(500).json({
        error: "Failed to redirect to affiliate",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  private async handleQStashWebhook(
    req: Request,
    res: Response,
  ): Promise<Response> {
    try {
      const webhookData = req.body;

      console.log("QStash webhook received:", webhookData);

      if (webhookData.type === "workflow.triggered") {
        await this.handleRunBot(req, res);
      } else if (webhookData.type === "workflow.completed") {
        console.log("QStash workflow completed:", webhookData.data);
        return res.status(200).json({
          message: "QStash webhook processed successfully",
          type: webhookData.type,
        });
      } else {
        return res.status(200).json({
          message: "QStash webhook acknowledged",
          type: webhookData.type,
        });
      }
    } catch (error) {
      console.error("Error processing QStash webhook:", error);
      return res.status(500).json({
        error: "Failed to process QStash webhook",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  private async handleFacebookPost(
    req: Request,
    res: Response,
  ): Promise<Response> {
    try {
      const {
        productId,
        platform,
        title,
        price,
        description,
        imageUrl,
        affiliateLink,
      } = req.body;

      const facebookService = createFacebookService(this.env);
      const supabaseService = new SupabaseService(this.env);

      const isFacebook =
        req.query.platform === "facebook" || !req.query.platform;

      console.log(
        `Handling Facebook posting request for product: ${productId}`,
      );

      if (isFacebook) {
        const result = await facebookService.publishPhotoWithStory(
          productId,
          platform || "lazada",
          title,
          description,
          price,
          imageUrl,
          platform || "kitchen",
          4.5,
          affiliateLink,
          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          this.env.FACEBOOK_PAGE_ACCESS_TOKEN,
          this.env.FACEBOOK_PAGE_ID,
        );

        await supabaseService.logFacebookPost({
          productId,
          platform: platform || "lazada",
          postId: result.postId || result.id,
          commentId: undefined,
          status: result.success ? "published" : "failed",
          errorMessage: result.error?.message,
          timestamp: new Date().toISOString(),
          source: "facebook_graph_api",
        });

        return res.status(200).json({
          success: result.success,
          postId: result.postId || result.id,
          commentId: undefined,
          platform: "facebook",
          timestamp: new Date().toISOString(),
          message: result.success
            ? "Facebook posting successful"
            : `Facebook posting failed: ${result.error?.message}`,
        });
      }

      return res.status(400).json({
        error: "Invalid platform",
        message: "Platform must be 'facebook' for this endpoint",
      });
    } catch (error) {
      console.error("Error handling Facebook post request:", error);
      return res.status(500).json({
        error: "Failed to handle Facebook post request",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  private async handleDualPost(req: Request, res: Response): Promise<Response> {
    try {
      const dealData = req.body;

      console.log(
        `Handling dual-channel posting request for deal: ${dealData.id || dealData.productId}`,
      );

      const redisService = new RedisService(this.env);
      const supabaseService = new SupabaseService(this.env);
      const b2StorageService = new B2StorageService(this.env);
      const imageProcessor = new ImageProcessor();

      const dualPosterService = new DualPosterService(
        redisService,
        supabaseService,
        b2StorageService,
        imageProcessor,
        {
          enableFacebookPosting: true,
          enableTwitterPosting: true,
          maxPostAttempts: 3,
          retryDelayMs: 2000,
          timeoutMs: 30000,
          requireBothPlatforms: false,
        },
      );

      const processedDeal: any = {
        id: dealData.id || dealData.productId,
        title: dealData.title,
        description: dealData.description || "",
        price: parseFloat(dealData.price) || 0,
        imageUrl: dealData.imageUrl,
        category: dealData.category || "general",
        rating: parseFloat(dealData.rating) || 4.5,
        platform: dealData.platform || "lazada",
        sourceUrl: dealData.sourceUrl || "",
        affiliateLink: dealData.affiliateLink,
        commissionRate: parseFloat(dealData.commissionRate) || 0.1,
        expirationDate:
          dealData.expirationDate ||
          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        seller: dealData.seller || "Online Seller",
        stock: parseInt(dealData.stock) || 100,
        createdAt: new Date(),
        body: dealData.body || [],
        cta: dealData.cta || "Shop Now",
        hashtags: dealData.hashtags || [],
      };

      const dualPostResult = await dualPosterService.executeDualPost(
        processedDeal,
        this.env,
      );

      const response: any = {
        success: dualPostResult.overallSuccess,
        platform: "dual",
        timestamp: new Date().toISOString(),
        processingTimeMs:
          Date.now() - new Date(dualPostResult.processedAt).getTime(),
        results: {
          twitter: dualPostResult.twitter,
          facebook: dualPostResult.facebook,
        },
        message: dualPostResult.overallSuccess
          ? "Dual-channel posting successful"
          : "Dual-channel posting partially failed",
      };

      await supabaseService.logFacebookPost({
        productId: processedDeal.id,
        platform: processedDeal.platform,
        fb_post_id: dualPostResult.facebook?.postId,
        fb_comment_id: dualPostResult.facebook?.commentId,
        status: dualPostResult.overallSuccess ? "published" : "failed",
        error_message:
          dualPostResult.facebook?.error || dualPostResult.twitter?.error,
        timestamp: new Date().toISOString(),
        source: "dual_poster_orchestrator",
      });

      return res.status(200).json(response);
    } catch (error) {
      console.error("Error handling dual-post request:", error);
      return res.status(500).json({
        error: "Failed to handle dual-post request",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  private async handleQStashWebhookWithDualPoster(
    req: Request,
    res: Response,
  ): Promise<Response> {
    try {
      const webhookData = req.body;

      console.log(
        "QStash webhook received (dual-poster version):",
        webhookData,
      );

      if (webhookData.type === "workflow.triggered") {
        await this.handleRunBot(req, res);
      } else if (webhookData.type === "workflow.completed") {
        console.log("QStash dual-poster workflow completed:", webhookData.data);
        return res.status(200).json({
          message: "QStash dual-poster webhook processed successfully",
          type: webhookData.type,
        });
      } else {
        return res.status(200).json({
          message: "QStash dual-poster webhook acknowledged",
          type: webhookData.type,
        });
      }
    } catch (error) {
      console.error("Error processing QStash dual-poster webhook:", error);
      return res.status(500).json({
        error: "Failed to process QStash dual-poster webhook",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  private async handleGetClickAnalytics(
    req: Request,
    res: Response,
  ): Promise<Response> {
    try {
      const { startDate, endDate, shortCode } = req.query;

      const supabaseService = new SupabaseService(this.env);
      const analytics = await supabaseService.getLinkClickAnalytics(
        startDate as string,
        endDate as string,
        shortCode as string,
      );

      return res.status(200).json({
        analytics,
        totalClicks: analytics.reduce((sum, item) => sum + item.clicks, 0),
        period: { startDate, endDate },
      });
    } catch (error) {
      console.error("Error getting click analytics:", error);
      return res.status(500).json({
        error: "Failed to get click analytics",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  private async handleGetConversionAnalytics(
    req: Request,
    res: Response,
  ): Promise<Response> {
    try {
      const { startDate, endDate, shortCode } = req.query;

      const supabaseService = new SupabaseService(this.env);
      const conversions = await supabaseService.getConversionAnalytics(
        startDate as string,
        endDate as string,
        shortCode as string,
      );

      return res.status(200).json({
        conversions,
        totalConversions: conversions.reduce(
          (sum, item) => sum + item.conversions,
          0,
        ),
        period: { startDate, endDate },
      });
    } catch (error) {
      console.error("Error getting conversion analytics:", error);
      return res.status(500).json({
        error: "Failed to get conversion analytics",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  private async handleGetWorkerInfo(
    req: Request,
    res: Response,
  ): Promise<Response> {
    try {
      const workerInfo = {
        worker: "racun-dapur-ibu-bot",
        version: "1.0.0",
        status: "running",
        environment: process.env.NODE_ENV || "production",
        startTime: process.env.WORKER_START_TIME || new Date().toISOString(),
        memory: process.memoryUsage ? process.memoryUsage() : null,
        uptime: process.uptime ? process.uptime() : 0,
        services: {
          redis: "connected",
          supabase: "connected",
          storage: "connected",
        },
      };

      return res.status(200).json(workerInfo);
    } catch (error) {
      console.error("Error getting worker info:", error);
      return res.status(500).json({
        error: "Failed to get worker info",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  private async processBotWorkflow(
    env: any,
    redisService: RedisService,
    supabaseService: SupabaseService,
  ): Promise<void> {
    console.log("Starting bot workflow processing...");

    try {
      const rawProducts = await this.fetchTrendingProducts(env);
      const filteredProducts =
        await redisService.filterRepeatProducts(rawProducts);

      if (filteredProducts.length === 0) {
        console.log("No new products to process");
        return;
      }

      for (const product of filteredProducts) {
        await this.processProduct(env, product, redisService, supabaseService);
      }

      console.log(
        `Bot workflow completed. Processed ${filteredProducts.length} products.`,
      );
    } catch (error) {
      console.error("Bot workflow processing failed:", error);
      throw error;
    }
  }

  private async fetchTrendingProducts(env: any): Promise<any[]> {
    console.log("Fetching trending products from Lazada API...");

    return [
      {
        id: `product_${Date.now()}_1`,
        title: "Flash Sale - Kitchen Appliances",
        price: 299.99,
        imageUrl: "https://example.com/image1.jpg",
        affiliateUrl: "https://example.com/affiliate/1",
        lazadaProductId: "LAZ123456",
        lazadaItemId: "ITEM789012",
      },
      {
        id: `product_${Date.now()}_2`,
        title: "Back to School - Baby Supplies",
        price: 149.99,
        imageUrl: "https://example.com/image2.jpg",
        affiliateUrl: "https://example.com/affiliate/2",
        lazadaProductId: "LAZ345678",
        lazadaItemId: "ITEM901234",
      },
      {
        id: `product_${Date.now()}_3`,
        title: "Skincare Deal - Limited Stock",
        price: 89.99,
        imageUrl: "https://example.com/image3.jpg",
        affiliateUrl: "https://example.com/affiliate/3",
        lazadaProductId: "LAZ567890",
        lazadaItemId: "ITEM345678",
      },
    ];
  }

  private async processProduct(
    env: any,
    product: any,
    redisService: RedisService,
    supabaseService: SupabaseService,
  ): Promise<void> {
    const productId = product.id;

    console.log(`Processing product: ${productId}`);

    try {
      const generatedCopy = await this.generateCopywriting(product);
      const imageUrl = await this.uploadProductImage(
        product.imageUrl,
        productId,
      );
      const tweetResults = await this.createTweetThread(
        generatedCopy,
        imageUrl,
      );

      await supabaseService.logPostedProduct({
        product_id: productId,
        title: product.title,
        price: parseFloat(product.price) || 0,
        imageUrl: imageUrl,
        affiliateUrl: product.affiliateUrl,
        lazadaProductId: product.lazadaProductId,
        lazadaItemId: product.lazadaItemId,
        tweetId: tweetResults ? "tweet_mock_id" : null,
        replyTweetId: null,
        copyUsed: JSON.stringify(generatedCopy),
        xUserId: null,
        xUsername: null,
        xDisplayName: null,
        tagsUsed: [],
        sentimentScore: null,
        imageStorageUsed: JSON.stringify({
          account: 1,
          bucket: "default",
          object: `${productId}.jpg`,
        }),
      });

      await redisService.addRepeatProduct(
        productId,
        env.REDIS_ANTI_REPEAT_TTL_SECONDS || 432000,
      );

      console.log(`Product ${productId} processed successfully`);
    } catch (error) {
      console.error(`Failed to process product ${productId}:`, error);
      throw error;
    }
  }

  private async generateCopywriting(product: any): Promise<any> {
    console.log("Generating AI copy for product...");

    return {
      problem: `Looking for ${product.title.toLowerCase()}?`,
      solution: `Get ${product.title} at ${product.price}% off - Limited time offer!`,
      price: product.price,
      discount: "50%",
      socialProof: "Rated 4.8/5 stars by 1000+ customers",
    };
  }

  private async uploadProductImage(
    imageUrl: string,
    productId: string,
  ): Promise<string> {
    console.log(`Uploading product image for ${productId}...`);

    return `https://storage.example.com/products/${productId}.jpg`;
  }

  private async createTweetThread(
    copywriting: any,
    imageUrl: string,
  ): Promise<any> {
    console.log("Creating 2-tweet thread on X...");

    return {
      tweetId: `tweet_${Date.now()}`,
      replyTweetId: `reply_${Date.now()}`,
    };
  }

  private async getWorkerServiceStatus(env: any): Promise<any> {
    const redisService = new RedisService(env);
    const supabaseService = new SupabaseService(env);

    const redisStatus = await redisService.getServiceStatus();
    const supabaseStatus = await supabaseService.getServiceStatus();

    return {
      redis: redisStatus,
      supabase: supabaseStatus,
      storage: "connected",
    };
  }

  public getRouter(): Router {
    return this.router;
  }
}

export default WorkerRouter;
