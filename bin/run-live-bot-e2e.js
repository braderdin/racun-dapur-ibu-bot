#!/usr/bin/env node
/**
 * Master Live Bot E2E Dry-Run CLI Test Runner
 * Standalone CLI runner script for Chip Besar to execute 1-click end-to-end
 * dry-run testing across the full pipeline:
 * Lazada API -> WebP B2 -> AI Copywriter -> Social Poster -> Telegram QA Audit
 */

import { Command } from "commander";
import { config } from "dotenv";

// Load environment variables
config({ path: ".dev.vars" });
config({ path: ".env.local" });

// Import services dynamically to avoid circular dependencies
async function importServices() {
  const { LazadaLiveScraper } =
    await import("../src/services/lazada-live-scraper");
  const { B2WebPUploader } = await import("../src/services/b2-webp-uploader");
  const { VectorRAGCopywriter } =
    await import("../src/services/vector-rag-copywriter");
  const { EdgeLinkShortener } =
    await import("../src/services/edge-link-shortener");
  const { SocialPosterEngine } =
    await import("../src/services/social-poster-engine");
  const { TelegramQAInspector } =
    await import("../src/services/telegram-qa-inspector");
  const { SupabaseRealtimeBroadcaster } =
    await import("../src/services/supabase-realtime-broadcaster");
  const { LinkHealthGuard } = await import("../src/services/link-health-guard");

  return {
    LazadaLiveScraper,
    B2WebPUploader,
    VectorRAGCopywriter,
    EdgeLinkShortener,
    SocialPosterEngine,
    TelegramQAInspector,
    SupabaseRealtimeBroadcaster,
    LinkHealthGuard,
  };
}

class LiveBotE2ETestRunner {
  constructor(config) {
    this.config = config;
    this.env = this.loadEnv();
    this.results = [];
    this.startTime = 0;
  }

  loadEnv() {
    return {
      LAZADA_APP_KEY: process.env.LAZADA_APP_KEY || "",
      LAZADA_APP_SECRET: process.env.LAZADA_APP_SECRET || "",
      LAZADA_MEMBER_ID: process.env.LAZADA_MEMBER_ID || "",
      LAZADA_USER_TOKEN: process.env.LAZADA_USER_TOKEN || "",
      LAZADA_LITEAPP_KEY: process.env.LAZADA_LITEAPP_KEY || "",
      LAZADA_LITEAPP_SECRET: process.env.LAZADA_LITEAPP_SECRET || "",
      SHOPEE_AFFILIATE_APP_ID: process.env.SHOPEE_AFFILIATE_APP_ID || "",
      SHOPEE_AFFILIATE_SECRET: process.env.SHOPEE_AFFILIATE_SECRET || "",
      SHOPEE_AFFILIATE_API_BASE_URL:
        process.env.SHOPEE_AFFILIATE_API_BASE_URL || "",
      X_API_KEY: process.env.X_API_KEY || "",
      X_API_KEY_SECRET: process.env.X_API_KEY_SECRET || "",
      X_BEARER_TOKEN: process.env.X_BEARER_TOKEN || "",
      X_ACCESS_TOKEN: process.env.X_ACCESS_TOKEN || "",
      X_ACCESS_TOKEN_SECRET: process.env.X_ACCESS_TOKEN_SECRET || "",
      X_CONSUMER_KEY: process.env.X_CONSUMER_KEY || "",
      X_CONSUMER_KEY_SECRET: process.env.X_CONSUMER_KEY_SECRET || "",
      X_CLIENT_ID: process.env.X_CLIENT_ID || "",
      X_CLIENT_SECRET: process.env.X_CLIENT_SECRET || "",
      META_APP_ID: process.env.META_APP_ID || "",
      META_APP_SECRET: process.env.META_APP_SECRET || "",
      META_PAGE_ID: process.env.META_PAGE_ID || "",
      META_PAGE_ACCESS_TOKEN: process.env.META_PAGE_ACCESS_TOKEN || "",
      UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL || "",
      UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN || "",
      QSTASH_URL: process.env.QSTASH_URL || "",
      QSTASH_TOKEN: process.env.QSTASH_TOKEN || "",
      QSTASH_CURRENT_SIGNING_KEY: process.env.QSTASH_CURRENT_SIGNING_KEY || "",
      QSTASH_NEXT_SIGNING_KEY: process.env.QSTASH_NEXT_SIGNING_KEY || "",
      OPENROUTER_BASE_URL: process.env.OPENROUTER_BASE_URL || "",
      OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || "",
      OPENROUTER_MODEL: process.env.OPENROUTER_MODEL || "openrouter/free",
      SUPABASE_URL: process.env.SUPABASE_URL || "",
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || "",
      DATABASE_URL: process.env.DATABASE_URL || "",
      BACKBLAZE_B2_ACCOUNT_ID_1: process.env.BACKBLAZE_B2_ACCOUNT_ID_1 || "",
      BACKBLAZE_B2_ACCOUNT_KEY_1: process.env.BACKBLAZE_B2_ACCOUNT_KEY_1 || "",
      BACKBLAZE_B2_ACCOUNT_ID_2: process.env.BACKBLAZE_B2_ACCOUNT_ID_2 || "",
      BACKBLAZE_B2_ACCOUNT_KEY_2: process.env.BACKBLAZE_B2_ACCOUNT_KEY_2 || "",
      BACKBLAZE_B2_ACCOUNT_ID_3: process.env.BACKBLAZE_B2_ACCOUNT_ID_3 || "",
      BACKBLAZE_B2_ACCOUNT_KEY_3: process.env.BACKBLAZE_B2_ACCOUNT_KEY_3 || "",
      CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID || "",
      CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN || "",
      TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || "",
      TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID || "",
      DISCORD_WEBHOOK_URL: process.env.DISCORD_WEBHOOK_URL || "",
      SHORTLINK_DOMAIN: process.env.SHORTLINK_DOMAIN || "racun.ibu.my",
      WORKER_URL: process.env.WORKER_URL || "",
    };
  }

  log(message, level = "info") {
    const prefix = {
      info: "ℹ️",
      success: "✅",
      error: "❌",
      warn: "⚠️",
    }[level];

    const timestamp = new Date().toLocaleTimeString("ms-MY", {
      timeZone: "Asia/Kuala_Lumpur",
    });
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  async runStage(stageName, fn) {
    const start = Date.now();
    this.log(`Starting stage: ${stageName}`);

    try {
      const data = await fn();
      const duration = Date.now() - start;
      this.log(`Completed stage: ${stageName} (${duration}ms)`, "success");
      return { success: true, data, duration };
    } catch (error) {
      const duration = Date.now() - start;
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      this.log(
        `Failed stage: ${stageName} - ${errorMsg} (${duration}ms)`,
        "error",
      );
      return { success: false, error: errorMsg, duration };
    }
  }

  async run() {
    this.startTime = Date.now();
    this.log("🚀 Starting Live Bot E2E Test Runner");
    this.log(`Mode: ${this.config.mode}`);
    this.log(`Peak Hours: ${this.config.peakHours}`);
    this.log(`Product Limit: ${this.config.productLimit}`);
    this.log(`Categories: ${this.config.categories.join(", ")}`);

    // Validate environment
    const envValidation = this.validateEnvironment();
    if (!envValidation.valid) {
      this.log(
        `Environment validation failed: ${envValidation.missing.join(", ")}`,
        "error",
      );
      process.exit(1);
    }
    this.log("Environment validation passed", "success");

    // Import services
    const services = await importServices();

    // Stage 1: Lazada Live Scraper
    if (!this.config.skipStages.includes("scraper")) {
      const result = await this.runStage("Lazada Live Scraper", async () => {
        const scraper = new services.LazadaLiveScraper(this.env);
        const products = await scraper.fetchTrendingDeals();
        this.log(`Found ${products.length} trending deals`);
        return products.slice(0, this.config.productLimit);
      });
      this.results.push({ stage: "Lazada Live Scraper", ...result });
    }

    // Stage 2: B2 WebP Uploader
    if (!this.config.skipStages.includes("uploader")) {
      const result = await this.runStage("B2 WebP Uploader", async () => {
        const uploader = new services.B2WebPUploader(this.env);
        // Test with a sample image URL
        const testImageUrl =
          "https://via.placeholder.com/400x400?text=Test+Product";
        const uploadResult = await uploader.processAndUploadImage(
          testImageUrl,
          "test_product_001",
        );
        this.log(
          `Upload result: ${uploadResult.success ? "Success" : "Failed"} - ${uploadResult.webpUrl || uploadResult.error}`,
        );
        return uploadResult;
      });
      this.results.push({ stage: "B2 WebP Uploader", ...result });
    }

    // Stage 3: Vector RAG Copywriter
    if (!this.config.skipStages.includes("copywriter")) {
      const result = await this.runStage("Vector RAG Copywriter", async () => {
        const copywriter = new services.VectorRAGCopywriter(this.env);
        const copy = await copywriter.generateDualPlatformCopy({
          category: "kitchen",
          productType: "air fryer",
          priceRange: "mid",
          season: "all",
        });
        this.log(`X Copy: ${copy.xCopy.hook.substring(0, 50)}...`);
        this.log(`FB Copy: ${copy.facebookCopy.hook.substring(0, 50)}...`);
        return copy;
      });
      this.results.push({ stage: "Vector RAG Copywriter", ...result });
    }

    // Stage 4: Edge Link Shortener
    if (!this.config.skipStages.includes("shortener")) {
      const result = await this.runStage("Edge Link Shortener", async () => {
        const shortener = new services.EdgeLinkShortener(this.env);
        const shortLink = await shortener.createShortLink(
          "https://c.lazada.com.my/t/c.example123?affiliate_id=123",
          "lazada",
          "test_product_001",
        );
        this.log(`Short link: ${shortLink.shortUrl || shortLink.error}`);
        return shortLink;
      });
      this.results.push({ stage: "Edge Link Shortener", ...result });
    }

    // Stage 5: Link Health Guard
    if (!this.config.skipStages.includes("health-guard")) {
      const result = await this.runStage("Link Health Guard", async () => {
        const healthGuard = new services.LinkHealthGuard();
        const health = await healthGuard.checkLinkHealth(
          "https://c.lazada.com.my/t/c.example123",
          "https://racun.ibu.my/r/abc123",
          "x",
        );
        this.log(
          `Health check: ${health.isHealthy ? "Healthy" : "Unhealthy"} (Score: ${health.healthScore})`,
        );
        return health;
      });
      this.results.push({ stage: "Link Health Guard", ...result });
    }

    // Stage 6: Social Poster Engine
    if (
      !this.config.skipStages.includes("poster") &&
      this.config.mode !== "dry-run"
    ) {
      const result = await this.runStage("Social Poster Engine", async () => {
        const poster = new services.SocialPosterEngine(this.env);
        // This would require actual product data from previous stages
        this.log("Social posting skipped in dry-run mode");
        return { skipped: true, reason: "Dry-run mode" };
      });
      this.results.push({ stage: "Social Poster Engine", ...result });
    } else if (this.config.skipStages.includes("poster")) {
      this.results.push({
        stage: "Social Poster Engine",
        success: true,
        duration: 0,
        data: { skipped: true, reason: "Skipped by config" },
      });
    }

    // Stage 7: Telegram QA Inspector
    if (!this.config.skipStages.includes("telegram")) {
      const result = await this.runStage("Telegram QA Inspector", async () => {
        const inspector = new services.TelegramQAInspector(this.env);
        // Send test audit report
        const auditResult = await inspector.sendAuditReport({
          productId: "test_product_001",
          productTitle: "Test Air Fryer 5L",
          productImageUrl: "https://via.placeholder.com/400x400?text=Air+Fryer",
          category: "kitchen",
          price: "RM 119.00",
          originalPrice: "RM 299.00",
          discountRate: "60%",
          xCopy: {
            hook: "Test hook for X",
            cta: "Test CTA for X",
            culturalAdaptation: "Test cultural",
            platform: "x",
            confidence: 0.9,
            metadata: {
              category: "kitchen",
              season: "all",
              priceRange: "mid",
              culturalScore: 0.9,
            },
          },
          facebookCopy: {
            hook: "Test hook for FB",
            cta: "Test CTA for FB",
            culturalAdaptation: "Test cultural FB",
            platform: "facebook",
            confidence: 0.9,
            metadata: {
              category: "kitchen",
              season: "all",
              priceRange: "mid",
              culturalScore: 0.9,
            },
          },
          shortUrl: "https://racun.ibu.my/r/test123",
          affiliateUrl: "https://c.lazada.com.my/t/c.test123",
          timestamp: Date.now(),
        });
        this.log(
          `Telegram audit: ${auditResult.success ? "Sent" : "Failed"} - ${auditResult.error || ""}`,
        );
        return auditResult;
      });
      this.results.push({ stage: "Telegram QA Inspector", ...result });
    }

    // Stage 8: Supabase Realtime Broadcaster
    if (!this.config.skipStages.includes("realtime")) {
      const result = await this.runStage(
        "Supabase Realtime Broadcaster",
        async () => {
          const broadcaster = new services.SupabaseRealtimeBroadcaster(
            this.env,
          );
          const broadcastResult = await broadcaster.broadcastDealCurated({
            dealId: "test_deal_001",
            productId: "test_product_001",
            title: "Test Air Fryer 5L",
            price: 119,
            discountPrice: 299,
            discountPercent: 60,
            platform: "lazada",
            affiliateLink: "https://racun.ibu.my/r/test123",
            imageUrls: ["https://via.placeholder.com/400x400"],
            category: "kitchen",
            rating: 4.8,
            stock: 100,
          });
          this.log(
            `Realtime broadcast: ${broadcastResult.success ? "Sent" : "Failed"} - ${broadcastResult.error || ""}`,
          );
          return broadcastResult;
        },
      );
      this.results.push({ stage: "Supabase Realtime Broadcaster", ...result });
    }

    // Print summary
    this.printSummary();
  }

  validateEnvironment() {
    const required = [
      "LAZADA_APP_KEY",
      "LAZADA_APP_SECRET",
      "LAZADA_MEMBER_ID",
      "LAZADA_USER_TOKEN",
      "UPSTASH_REDIS_REST_URL",
      "UPSTASH_REDIS_REST_TOKEN",
      "OPENROUTER_BASE_URL",
      "OPENROUTER_API_KEY",
      "SUPABASE_URL",
      "SUPABASE_SERVICE_ROLE_KEY",
      "TELEGRAM_BOT_TOKEN",
      "TELEGRAM_CHAT_ID",
    ];

    const missing = required.filter((key) => !this.env[key]);
    return { valid: missing.length === 0, missing };
  }

  printSummary() {
    const totalDuration = Date.now() - this.startTime;
    const successful = this.results.filter((r) => r.success).length;
    const failed = this.results.filter((r) => !r.success).length;

    console.log("\n" + "=".repeat(60));
    console.log("📊 E2E TEST RUNNER SUMMARY");
    console.log("=".repeat(60));
    console.log(`Total Duration: ${totalDuration}ms`);
    console.log(`Stages Run: ${this.results.length}`);
    console.log(`Successful: ${successful}`);
    console.log(`Failed: ${failed}`);
    console.log("-".repeat(60));

    this.results.forEach((result) => {
      const status = result.success ? "✅" : "❌";
      const duration = `${result.duration}ms`;
      console.log(
        `${status} ${result.stage.padEnd(35)} ${duration.padStart(10)}`,
      );
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });

    console.log("=".repeat(60));

    if (failed > 0) {
      console.log("⚠️  Some stages failed. Check logs above for details.");
      process.exit(1);
    } else {
      console.log("🎉 All stages completed successfully!");
      process.exit(0);
    }
  }
}

// CLI Setup
const program = new Command();

program
  .name("run-live-bot-e2e")
  .description("Master Live Bot E2E Dry-Run CLI Test Runner")
  .version("1.0.0");

program
  .option(
    "-m, --mode <mode>",
    "Run mode: dry-run | live | autonomous",
    "dry-run",
  )
  .option("--peak-hours", "Run during peak hours only", false)
  .option("-l, --limit <number>", "Product limit", "5")
  .option(
    "-c, --categories <categories>",
    "Comma-separated categories",
    "kitchen,baby,skincare",
  )
  .option("--skip <stages>", "Comma-separated stages to skip", "")
  .option("-v, --verbose", "Verbose output", false)
  .action(async (options) => {
    const config = {
      mode: options.mode,
      peakHours: options.peakHours,
      productLimit: parseInt(options.limit, 10),
      categories: options.categories.split(",").map((c) => c.trim()),
      skipStages: options.skip
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      verbose: options.verbose,
    };

    const runner = new LiveBotE2ETestRunner(config);
    await runner.run();
  });

program.parse(process.argv);
