/*
 * Worker Router Module
 * Refactors HTTP request routing for `/run-bot`, `/health`, `/r/:code`, and `/qstash-trigger`
 * Integrates all service handlers into a unified routing system
 */

import { Router, Request, Response, NextFunction } from "express";
import { healthHandler } from "./routes/health";
import { ShortenerService } from "./services/shortener";
import { RedisService } from "./services/redis";
import { SupabaseService } from "./services/supabase";

export class WorkerRouter {
  private router: Router;

  constructor(env: any) {
    this.router = Router();
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

    // QStash webhook endpoint
    this.router.post("/qstash-trigger", this.handleQStashWebhook.bind(this));

    // Analytics endpoints
    this.router.get("/analytics/clicks", this.handleGetClickAnalytics.bind(this));
    this.router.get("/analytics/conversions", this.handleGetConversionAnalytics.bind(this));

    // Worker information endpoint
    this.router.get("/worker/info", this.handleGetWorkerInfo.bind(this));
  }

  private async handleHealth(req: Request, res: Response): Promise<Response> {
    return await healthHandler(req, {} as any);
  }

  private async handleSimpleHealth(req: Request, res: Response): Promise<Response> {
    return await healthHandler(req, {} as any);
  }

  private async handleRunBot(req: Request, res: Response): Promise<Response> {
    try {
      // Initialize services with environment variables
      const redisService = new RedisService(env);
      const supabaseService = new SupabaseService(env);

      // Process the bot's main workflow
      const startTime = Date.now();
      await this.processBotWorkflow(env, redisService, supabaseService);

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

  private async handleGetBotStatus(req: Request, res: Response): Promise<Response> {
    try {
      const redisService = new RedisService(env);
      const supabaseService = new SupabaseService(env);

      // Get current statistics
      const totalProducts = await supabaseService.getRecentProductsCount();
      const redisStats = await redisService.getServiceStatus();
      const workerStatus = await this.getWorkerServiceStatus(env);

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

  private async handleRedirectToAffiliate(req: Request, res: Response): Promise<Response> {
    try {
      const { code } = req.params;

      const shortenerService = new ShortenerService(
        new RedisService(env),
        new SupabaseService(env)
      );

      const affiliateUrl = await shortenerService.getAffiliateUrl(code);

      if (!affiliateUrl) {
        return res.status(404).json({
          error: "Short code not found",
          message: `Short code ${code} not found or expired`,
        });
      }

      // Increment click count for analytics
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

  private async handleQStashWebhook(req: Request, res: Response): Promise<Response> {
    try {
      // Process QStash webhook payload
      const webhookData = req.body;

      // Log webhook for auditing
      console.log("QStash webhook received:", webhookData);

      // Process based on webhook type
      if (webhookData.type === "workflow.triggered") {
        // Trigger bot processing
        await this.handleRunBot(req, res);
      } else if (webhookData.type === "workflow.completed") {
        // Handle workflow completion
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

  private async handleGetClickAnalytics(req: Request, res: Response): Promise<Response> {
    try {
      const { startDate, endDate, shortCode } = req.query;

      const supabaseService = new SupabaseService(env);
      const analytics = await supabaseService.getLinkClickAnalytics(
        startDate as string,
        endDate as string,
        shortCode as string
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

  private async handleGetConversionAnalytics(req: Request, res: Response): Promise<Response> {
    try {
      const { startDate, endDate, shortCode } = req.query;

      const supabaseService = new SupabaseService(env);
      const conversions = await supabaseService.getConversionAnalytics(
        startDate as string,
        endDate as string,
        shortCode as string
      );

      return res.status(200).json({
        conversions,
        totalConversions: conversions.reduce((sum, item) => sum + item.conversions, 0),
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

  private async handleGetWorkerInfo(req: Request, res: Response): Promise<Response> {
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
    supabaseService: SupabaseService
  ): Promise<void> {
    // This function contains the core bot workflow logic
    // For now, we'll implement a simplified version

    console.log("Starting bot workflow processing...");

    try {
      // Step 1: Fetch trending products from Lazada (simulated)
      const rawProducts = await this.fetchTrendingProducts(env);

      // Step 2: Filter anti-repeat products using Redis
      const filteredProducts = await redisService.filterRepeatProducts(rawProducts);

      if (filteredProducts.length === 0) {
        console.log("No new products to process");
        return;
      }

      // Step 3: Process each product
      for (const product of filteredProducts) {
        await this.processProduct(env, product, redisService, supabaseService);
      }

      console.log(`Bot workflow completed. Processed ${filteredProducts.length} products.`);
    } catch (error) {
      console.error("Bot workflow processing failed:", error);
      throw error;
    }
  }

  private async fetchTrendingProducts(env: any): Promise<any[]> {
    // Simulate fetching trending products
    // In a real implementation, this would call the Lazada service
    console.log("Fetching trending products from Lazada API...");

    // Mock data for demonstration
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
    supabaseService: SupabaseService
  ): Promise<void> {
    // Process individual product through the bot workflow
    const productId = product.id;

    console.log(`Processing product: ${productId}`);

    try {
      // Step 1: Generate AI copywriting (simulated)
      const generatedCopy = await this.generateCopywriting(product);

      // Step 2: Upload image to storage (simulated)
      const imageUrl = await this.uploadProductImage(product.imageUrl, productId);

      // Step 3: Create tweet thread (simulated)
      const tweetResults = await this.createTweetThread(generatedCopy, imageUrl);

      // Step 4: Log to database
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

      // Step 5: Add to Redis anti-repeat store
      await redisService.addRepeatProduct(
        productId,
        env.REDIS_ANTI_REPEAT_TTL_SECONDS || 432000,
      );

      console.log(`Product ${productId} processed successfully`);
    } catch (error) {
      console.error(`Failed to process product ${productId}:", error);
      throw error;
    }
  }

  private async generateCopywriting(product: any): Promise<any> {
    // Simulate AI copywriting generation
    console.log("Generating AI copy for product...")

    // Mock AI-generated copy
    return {
      problem: `Looking for ${product.title.toLowerCase()}?",
      solution: `Get ${product.title} at ${product.price}% off - Limited time offer!",
      price: product.price,
      discount: "50%",
      socialProof: "Rated 4.8/5 stars by 1000+ customers",
    };
  }

  private async uploadProductImage(imageUrl: string, productId: string): Promise<string> {
    // Simulate image upload to storage
    console.log(`Uploading product image for ${productId}...`)

    // Mock image upload result
    return `https://storage.example.com/products/${productId}.jpg`;
  }

  private async createTweetThread(copywriting: any, imageUrl: string): Promise<any> {
    // Simulate tweet creation
    console.log("Creating 2-tweet thread on X...`)

    // Mock tweet results
    return {
      tweetId: `tweet_${Date.now()}`,
      replyTweetId: `reply_${Date.now()}`,
    };
  }

  private async getWorkerServiceStatus(env: any): Promise<any> {
    // Get worker service status
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