#!/usr/bin/env node
/**
 * Live Production Test CLI Runner
 * Executes 1 full live pipeline execution with --mode=live or --mode=dry-run
 *
 * Usage:
 *   node bin/run-live-production-test.js --mode=live
 *   node bin/run-live-production-test.js --mode=dry-run
 */

const dotenv = require("dotenv");
const path = require("path");

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

// Import orchestrator (will be compiled from TS)
const {
  LiveProductionOrchestrator,
} = require("../src/services/live-production-orchestrator");

// Mock Env object for CLI execution (With Robust Fallback Mapping)
const createEnv = () => ({
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID,

  // Twitter / X API Fallback Mapping
  TWITTER_BEARER_TOKEN: process.env.TWITTER_BEARER_TOKEN || process.env.X_BEARER_TOKEN,
  TWITTER_API_KEY: process.env.TWITTER_API_KEY || process.env.X_API_KEY,
  TWITTER_API_SECRET: process.env.TWITTER_API_SECRET || process.env.X_API_KEY_SECRET,
  TWITTER_ACCESS_TOKEN: process.env.TWITTER_ACCESS_TOKEN || process.env.X_ACCESS_TOKEN,
  TWITTER_ACCESS_TOKEN_SECRET:
    process.env.TWITTER_ACCESS_TOKEN_SECRET ||
    process.env.TWITTER_ACCESS_SECRET ||
    process.env.X_ACCESS_TOKEN_SECRET,

  // Facebook Page API Fallback Mapping
  FACEBOOK_PAGE_ID:
    process.env.FACEBOOK_PAGE_ID ||
    process.env.META_PAGE_ID ||
    process.env.FB_PAGE_ID,
  FACEBOOK_ACCESS_TOKEN:
    process.env.FACEBOOK_ACCESS_TOKEN ||
    process.env.FACEBOOK_PAGE_ACCESS_TOKEN ||
    process.env.META_PAGE_ACCESS_TOKEN ||
    process.env.FB_PAGE_ACCESS_TOKEN,

  // Upstash Redis & Vector Fallback Mapping
  UPSTASH_REDIS_URL:
    process.env.UPSTASH_REDIS_URL ||
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.REDIS_URL,
  UPSTASH_REDIS_TOKEN:
    process.env.UPSTASH_REDIS_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
  UPSTASH_VECTOR_URL:
    process.env.UPSTASH_VECTOR_URL || process.env.UPSTASH_VECTOR_REST_URL,
  UPSTASH_VECTOR_TOKEN:
    process.env.UPSTASH_VECTOR_TOKEN || process.env.UPSTASH_VECTOR_REST_TOKEN,

  // Backblaze B2 Storage Fallback Mapping
  BACKBLAZE_B2_KEY_ID:
    process.env.BACKBLAZE_B2_KEY_ID ||
    process.env.B2_ACC1_KEY_ID ||
    process.env.BACKBLAZE_B2_ACCOUNT_ID_1,
  BACKBLAZE_B2_APP_KEY:
    process.env.BACKBLAZE_B2_APP_KEY ||
    process.env.B2_ACC1_APPLICATION_KEY ||
    process.env.BACKBLAZE_B2_ACCOUNT_KEY_1,
  BACKBLAZE_B2_BUCKET_ID: process.env.BACKBLAZE_B2_BUCKET_ID,

  // AI & E-commerce APIs Fallback Mapping
  OPENROUTER_BASE_URL:
    process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
  LAZADA_API_KEY: process.env.LAZADA_API_KEY || process.env.LAZADA_APP_KEY,
  LAZADA_API_SECRET:
    process.env.LAZADA_API_SECRET || process.env.LAZADA_APP_SECRET,
  SHOPEE_API_KEY: process.env.SHOPEE_API_KEY,
  SHOPEE_API_SECRET: process.env.SHOPEE_API_SECRET,
  QSTASH_URL: process.env.QSTASH_URL,
  QSTASH_TOKEN: process.env.QSTASH_TOKEN,
});

/**
 * Parse CLI arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const mode =
    args.find((arg) => arg.startsWith("--mode="))?.split("=")[1] || "dry-run";
  const verbose = args.includes("--verbose");
  const maxDeals = parseInt(
    args.find((arg) => arg.startsWith("--max-deals="))?.split("=")[1] || "3",
  );

  return { mode, verbose, maxDeals };
}

/**
 * Print execution progress table
 */
function printProgressTable(results) {
  console.log("\n" + "=".repeat(70));
  console.log("LIVE PRODUCTION PIPELINE EXECUTION RESULTS");
  console.log("=".repeat(70));
  console.log(`Mode:                 ${results.mode}`);
  console.log(
    `Timestamp:            ${new Date(results.timestamp).toISOString()}`,
  );
  console.log(
    `Overall Status:       ${results.success ? "✅ SUCCESS" : "❌ FAILED"}`,
  );
  console.log("\n📊 Pipeline Metrics:");
  console.log("-".repeat(40));
  console.log(`  Deals Processed:    ${results.dealsProcessed}`);
  console.log(`  Twitter Posts:      ${results.twitterPosts}`);
  console.log(`  Facebook Posts:     ${results.facebookPosts}`);
  console.log(`  Telegram Notif:     ${results.telegramNotifications}`);
  console.log(`  Realtime Broadcast: ${results.realtimeBroadcasts}`);
  console.log("-".repeat(40));

  if (results.errors && results.errors.length > 0) {
    console.log("\n❌ Errors:");
    results.errors.forEach((err, i) => console.log(`  ${i + 1}. ${err}`));
  }

  if (results.warnings && results.warnings.length > 0) {
    console.log("\n⚠️  Warnings:");
    results.warnings.forEach((warn, i) => console.log(`  ${i + 1}. ${warn}`));
  }

  console.log("\n" + "=".repeat(70));
}

/**
 * Main execution function
 */
async function main() {
  const { mode, verbose, maxDeals } = parseArgs();

  console.log(`\n🚀 Starting Live Production Test Runner`);
  console.log(`Mode: ${mode}`);
  console.log(`Max Deals: ${maxDeals}`);
  console.log(`Verbose: ${verbose}`);
  console.log("");

  const env = createEnv();

  // Validate critical environment variables
  const requiredVars = [
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "OPENROUTER_API_KEY",
  ];
  const missingVars = requiredVars.filter((v) => !env[v]);

  if (missingVars.length > 0) {
    console.error("❌ Missing required environment variables:");
    missingVars.forEach((v) => console.error(`  - ${v}`));
    process.exit(1);
  }

  // Create orchestrator with configuration
  const config = {
    mode: mode === "live" ? "production" : "dry-run",
    maxDealsPerRun: maxDeals,
    enableTwitter: true,
    enableFacebook: true,
    enableTelegram: true,
    enableRealtime: true,
  };

  const orchestrator = new LiveProductionOrchestrator(env, config);

  try {
    console.log("🔄 Executing 8-step production pipeline...\n");

    const startTime = Date.now();
    const result = await orchestrator.executePipeline();
    const duration = Date.now() - startTime;

    console.log(`⏱️  Pipeline completed in ${duration}ms\n`);

    // Print detailed results
    printProgressTable({
      ...result,
      mode,
      timestamp: Date.now(),
    });

    // Exit with appropriate code
    process.exit(result.success ? 0 : 1);
  } catch (error) {
    console.error("\n❌ Pipeline execution failed with error:");
    console.error(error.message);
    console.error(error.stack);

    printProgressTable({
      success: false,
      dealsProcessed: 0,
      twitterPosts: 0,
      facebookPosts: 0,
      telegramNotifications: 0,
      realtimeBroadcasts: 0,
      errors: [error.message],
      warnings: [],
      mode,
      timestamp: Date.now(),
    });

    process.exit(1);
  }
}

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\n\n⚠️  Received SIGINT, shutting down gracefully...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n\n⚠️  Received SIGTERM, shutting down gracefully...");
  process.exit(0);
});

// Run main function
main();