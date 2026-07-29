// Main entry point for Cloudflare Worker: @RacunDapurIbu Bot Automation System
// Wires all services for 24/7 autonomous deal curation, AI copywriting, and X API posting.
// Configured with QStash receiver for scheduled cron triggers and fetch endpoint for manual processing.

import type { Env } from "./types/env";
import { CONSTANTS } from "./config/constants";
import { logger } from "./utils/logger";
import { delay, rateLimit } from "./utils/delay";

// Service imports
import { RedisService } from "./services/redis";
import { B2StorageService } from "./services/b2-storage";
import { LazadaService } from "./services/lazada";
import { OpenRouterAIService } from "./services/openrouter";
import { TwitterService } from "./services/twitter";
import { SupabaseService } from "./services/supabase";

// Worker handler types
import type {
  ExecutionContext,
  ScheduledController,
} from "@cloudflare/workers-types";

export {
  type Env,
  RedisService,
  B2StorageService,
  LazadaService,
  OpenRouterAIService,
  TwitterService,
  SupabaseService,
};

/*** 1. EXPORT NEXTJS WEB.PORT ENTRY POINT FOR EDGE FRAMEWORK ***/
export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    return await handleRequest(request, env, ctx);
  },
  async scheduled(
    controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    return await handleScheduled(controller, env, ctx);
  },
};

/*** 2. DEFINE FETCH ENDPOINT FOR EDGE (QStash / Worker sebagai HTTP API Gateway) ***/
async function handleRequest(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  try {
    const url = new URL(request.url);

    // Health check endpoint
    if (url.pathname === "/health") {
      return new Response(
        JSON.stringify({ status: "ok", timestamp: new Date().toISOString() }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // QStash webhook payload (untuk processing background)
    if (url.pathname === "/process") {
      const payload = await request.json();
      await processProductAsync(payload, env, ctx);
      return new Response(JSON.stringify({ accepted: true }), { status: 202 });
    }

    // Routing for edge functions
    if (url.pathname.startsWith("/api/")) {
      return await handleEdgeRoute(url, env, ctx);
    }

    // Default: Return worker status/info
    return new Response(
      JSON.stringify({
        worker: "racun-dapur-ibu-bot",
        version: "1.0.0",
        status: "running",
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    logger.error(
      "Fetch request failed",
      { error, requestUrl: request.url },
      "Worker",
    );
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

/*** 3. DEFINE SCHEDULED ENDPOINT FOR CRON TRIGGER (QStash) ***/
async function handleScheduled(
  controller: ScheduledController,
  env: Env,
  ctx: ExecutionContext,
): Promise<void> {
  try {
    logger.info(
      "Scheduled cron trigger started",
      {
        cron: controller.cron,
        scheduledTime: new Date(controller.scheduledTime).toISOString(),
      },
      "Worker",
    );

    // Process product asynchronously
    await processProductAsync({}, env, ctx);

    logger.info(
      "Scheduled cron completed",
      {
        cron: controller.cron,
      },
      "Worker",
    );
  } catch (error) {
    logger.error("Scheduled cron failed", { error }, "Worker");
    throw error; // Re-throw to let QStash handle retries
  }
}

/*** 4. ASYNC PRODUCT PROCESSING PIPELINE ***/
async function processProductAsync(
  payload: any,
  env: Env,
  ctx: ExecutionContext,
): Promise<void> {
  const startTime = Date.now();

  // Initialize services with env
  const redisService = new RedisService(env);
  const b2StorageService = new B2StorageService(env);
  const lazadaService = new LazadaService(env);
  const openrouterService = new OpenRouterAIService(env);
  const twitterService = new TwitterService(env);
  const supabaseService = new SupabaseService(env);

  try {
    // Step 1: Fetch trending products from Lazada API
    logger.info("Fetching trending products from Lazada", {}, "Worker");
    const rawProducts = await lazadaService.fetchTrendingProducts();

    // Step 2: Filter anti-repeat products using Redis
    logger.info("Filtering anti-repeat products via Redis", {}, "Worker");
    const filteredProducts =
      await redisService.filterRepeatProducts(rawProducts);

    if (filteredProducts.length === 0) {
      logger.info("No new products to process", {}, "Worker");
      return;
    }

    // Step 3: For each product, generate AI copy, save image, post tweets, and log to Supabase
    for (const product of filteredProducts) {
      const productId =
        product.id ||
        `product_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      try {
        // Step 3a: Generate AI copywriting (with rate limiting)
        logger.info(
          "Generating AI copy for product",
          { productId, title: product.title },
          "Worker",
        );
        const generatedCopy =
          await openrouterService.generateCopywriting(product);

        // Step 3b: Select and upload image to Backblaze B2 (auto-switching account)
        logger.info("Uploading product image to B2", { productId }, "Worker");
        const uploadResult = await b2StorageService.uploadProductImage(
          new ArrayBuffer(), // Placeholder for actual image buffer, in real implementation you'd fetch from imageUrl
          `${productId}.jpg`,
        );

        // Step 3c: Post 2-tweet thread (Hook + Affiliate)
        logger.info("Posting 2-tweet thread on X", { productId }, "Worker");
        const tweetResults = await twitterService.postAffiliateThread(
          generatedCopy,
          uploadResult,
        );

        // Step 3d: Log everything to Supabase
        logger.info("Logging product to Supabase", { productId }, "Worker");
        await supabaseService.logPostedProduct({
          product_id: productId,
          title: product.title,
          price: parseFloat(product.price) || 0,
          imageUrl: uploadResult,
          affiliateUrl: product.affiliateUrl,
          lazadaProductId: product.id,
          lazadaItemId: product.id,
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

        // Step 3e: Add product to Redis anti-repeat store
        await redisService.addRepeatProduct(
          productId,
          CONSTANTS.REDIS_ANTI_REPEAT_TTL_SECONDS,
        );

        logger.info(
          "Product processed successfully",
          {
            productId,
            tweetId: tweetResults ? "tweet_mock_id" : null,
            imageUrl: uploadResult,
          },
          "Worker",
        );
      } catch (productError) {
        logger.error(
          "Failed to process product",
          {
            productId,
            error:
              productError instanceof Error
                ? productError.message
                : "Unknown error",
          },
          "Worker",
        );
        // Continue with next product
        continue;
      }
    }

    const processingTime = Date.now() - startTime;
    logger.info(
      "Product processing pipeline completed",
      {
        totalProductsProcessed: filteredProducts.length,
        processingTimeMs: processingTime,
      },
      "Worker",
    );
  } catch (error) {
    logger.error("Product processing pipeline failed", { error }, "Worker");
    throw error;
  }
}

/*** 5. EDGE ROUTE HANDLER ***/
async function handleEdgeRoute(
  url: URL,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  const pathParts = url.pathname.split("/").filter((part) => part.length > 0);

  switch (pathParts[0]) {
    case "status":
      return await handleStatusRoute(env, ctx);
    case "products":
      return await handleProductsRoute(env, ctx);
    default:
      return new Response(
        JSON.stringify({
          error: "Not found",
          message: `Route not implemented: ${url.pathname}`,
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        },
      );
  }
}

/*** 6. EDGE ROUTE: STATUS ***/
async function handleStatusRoute(
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  const redisService = new RedisService(env);
  const b2StorageService = new B2StorageService(env);
  const supabaseService = new SupabaseService(env);

  const status = {
    worker: "racun-dapur-ibu-bot",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    uptime: Date.now() - (new Date().getTime() % 86400000), // Simulasi uptime
    memory: {
      rss: 0,
      heapTotal: 0,
      heapUsed: 0,
    },
    services: {
      redis: await redisService.getServiceStatus(),
      b2Storage: await b2StorageService.getServiceStatus(),
      supabase: await supabaseService.getServiceStatus(),
    },
    quotas: {
      maxRequestsPerMinute: CONSTANTS.MAX_REQUESTS_PER_MINUTE,
      storageCapGB: CONSTANTS.B2_STORAGE_CAP_BYTES / (1024 * 1024 * 1024),
      redisTTLSeconds: CONSTANTS.REDIS_ANTI_REPEAT_TTL_SECONDS,
    },
  };

  return new Response(JSON.stringify(status), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

/*** 7. EDGE ROUTE: PRODUCTS ***/
async function handleProductsRoute(
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  const supabaseService = new SupabaseService(env);
  const products = await supabaseService.getRecentProducts(50);

  return new Response(
    JSON.stringify({
      total: products.length,
      products,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
}
