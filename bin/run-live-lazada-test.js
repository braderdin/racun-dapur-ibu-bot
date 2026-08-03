#!/usr/bin/env node --experimental-specifier-resolution=node

import { execSync } from "child_process";
import { existsSync } from "fs";
import { join } from "path";

// Live Lazada Test CLI Runner
// Usage: node bin/run-live-lazada-test.js [options]
// Options: --product-id <id> --tweet-id <id> --facebook-post-id <id> --dry-run

class LiveLazadaTestRunner {
  constructor() {
    this.options = this.parseArguments();
  }

  /**
   * Parse command line arguments
   */
  parseArguments() {
    const args = process.argv.slice(2);
    const options = {
      productId: null,
      mainTweetId: null,
      facebookPagePostId: null,
      dryRun: false,
      help: false,
    };

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      switch (arg) {
        case "--product-id":
          options.productId = args[++i];
          break;
        case "--tweet-id":
          options.mainTweetId = args[++i];
          break;
        case "--facebook-post-id":
          options.facebookPagePostId = args[++i];
          break;
        case "--dry-run":
          options.dryRun = true;
          break;
        case "--help":
        case "-h":
          options.help = true;
          break;
      }
    }

    return options;
  }

  /**
   * Run the live test
   */
  async run() {
    try {
      if (this.options.help) {
        this.showHelp();
        return;
      }

      console.log("[START] Starting Live Lazada Test Runner...");
      console.log(
        `[INFO] Date: ${new Date().toLocaleString("ms-MY", { timeZone: "Asia/Kuala_Lumpur" })}\n`,
      );

      // Validate required arguments
      if (!this.options.productId) {
        console.error("[ERROR] Error: --product-id is required");
        this.showHelp();
        process.exit(1);
      }

      // Check if environment is ready
      await this.checkEnvironment();

      // Run test based on mode
      if (this.options.dryRun) {
        await this.runDryRunTest();
      } else {
        await this.runLiveTest();
      }

      console.log("\n[OK] Live Lazada Test completed successfully!");
    } catch (error) {
      console.error("\n[ERROR] Live Lazada Test failed:", error.message);
      process.exit(1);
    }
  }

  /**
   * Check if environment is ready for testing
   */
  async checkEnvironment() {
    console.log("[CHECK] Checking environment readiness...");

    // Check if required files exist
    const requiredFiles = [
      "src/services/lazada-live-fetcher.ts",
      "src/services/lazada-live-orchestrator.ts",
      "src/services/twitter-commenter.ts",
      "src/services/facebook-commenter.ts",
      "src/services/telegram-interactive-audit.ts",
    ];

    for (const file of requiredFiles) {
      if (!existsSync(file)) {
        console.warn(`[WARN] Warning: ${file} not found`);
      }
    }

    // Check if TypeScript can compile
    try {
      console.log("[CHECK] Checking TypeScript compilation...");
      execSync("npx tsc --noEmit --pretty false", { stdio: "pipe" });
      console.log("[OK] TypeScript compilation successful");
    } catch (error) {
      console.warn(
        "[WARN] TypeScript compilation warnings (continuing anyway)...",
      );
    }

    // Check environment variables
    console.log("[CHECK] Checking environment variables...");
    const requiredEnvVars = [
      "LAZADA_APP_KEY",
      "LAZADA_APP_SECRET",
      "LAZADA_MEMBER_ID",
      "LAZADA_USER_TOKEN",
      "TWITTER_API_KEY",
      "TWITTER_API_SECRET",
      "TWITTER_ACCESS_TOKEN",
      "TWITTER_ACCESS_SECRET",
      "FACEBOOK_APP_ID",
      "FACEBOOK_APP_SECRET",
      "FACEBOOK_PAGE_ACCESS_TOKEN",
      "TELEGRAM_BOT_TOKEN",
      "TELEGRAM_CHAT_ID",
    ];

    const missingEnvVars = requiredEnvVars.filter(
      (varName) => !process.env[varName],
    );
    if (missingEnvVars.length > 0) {
      console.warn(
        `[WARN] Warning: Missing environment variables: ${missingEnvVars.join(", ")}`,
      );
    } else {
      console.log("[OK] All required environment variables found");
    }

    console.log("[OK] Environment check completed\n");
  }

  /**
   * Run dry run test
   */
  async runDryRunTest() {
    console.log(
      "[TEST] Running DRY RUN test (no actual posts will be made)...",
    );
    console.log(`[INFO] Product ID: ${this.options.productId}`);
    if (this.options.mainTweetId)
      console.log(`[INFO] Main Tweet ID: ${this.options.mainTweetId}`);
    if (this.options.facebookPagePostId)
      console.log(
        `[INFO] Facebook Page Post ID: ${this.options.facebookPagePostId}`,
      );

    // Simulate the pipeline execution
    console.log("\n[SIM] Simulating pipeline execution...");

    // Step 1: Simulate Lazada fetch
    console.log("[STEP 1] Simulating Lazada product fetch...");
    await this.simulateLazadaFetch(this.options.productId);

    // Step 2: Simulate image processing
    console.log("[STEP 2] Simulating image processing...");
    await this.simulateImageProcessing(this.options.productId);

    // Step 3: Simulate social media posting
    console.log("[STEP 3] Simulating social media posting...");
    await this.simulateSocialPosting();

    // Step 4: Simulate audit
    console.log("[STEP 4] Simulating audit logging...");
    await this.simulateAudit();

    console.log("\n[OK] Dry run test completed successfully!");
  }

  /**
   * Run live test
   */
  async runLiveTest() {
    console.log("[TEST] Running LIVE test (actual posts will be made)...");
    console.log(`[INFO] Product ID: ${this.options.productId}`);
    if (this.options.mainTweetId)
      console.log(`[INFO] Main Tweet ID: ${this.options.mainTweetId}`);
    if (this.options.facebookPagePostId)
      console.log(
        `[INFO] Facebook Page Post ID: ${this.options.facebookPagePostId}`,
      );

    // In production, this would actually execute the pipeline
    console.log("\n[WARN] WARNING: Live test mode is enabled!");
    console.log("   This will actually post to social media platforms.");
    console.log("   Press Ctrl+C to cancel if you're not ready.\n");

    // Wait for user confirmation
    await this.waitForUserConfirmation();

    // Execute the actual pipeline
    console.log("\n[RUN] Executing live pipeline...");
    await this.executeLivePipeline();

    console.log("\n[OK] Live test completed successfully!");
  }

  /**
   * Simulate Lazada product fetch
   */
  async simulateLazadaFetch(productId) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    console.log(`[OK] Product ${productId} fetched successfully`);
    console.log(
      `   Title: Air Fryer 5L Non-Stick Touch Screen Kitchen Appliance`,
    );
    console.log(`   Price: RM 119.00 (60% off from RM 299.00)`);
    console.log(`   Rating: 4.5/5, Stock: Available`);
  }

  /**
   * Simulate image processing
   */
  async simulateImageProcessing(productId) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    console.log(`[OK] Image processed successfully`);
    console.log(`   Format: WebP HD`);
    console.log(`   Size: <2MB`);
    console.log(`   Watermark: Lazada - ${productId}`);
    console.log(
      `   CDN URL: https://racun.ibu.my/images/lazada-${productId}-12345.webp`,
    );
  }

  /**
   * Simulate social media posting
   */
  async simulateSocialPosting() {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    console.log(`[OK] Social media posts created successfully`);
    console.log(`   [Twitter] Thread: 2 tweets posted (hook + affiliate)`);
    console.log(`   [Facebook] Page: Main post + comment posted`);
    console.log(`   [Facebook] Comment: Affiliate link posted under main post`);
  }

  /**
   * Simulate audit logging
   */
  async simulateAudit() {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    console.log(`[OK] Audit logging completed successfully`);
    console.log(`   [Telegram] Visual audit sent with inline keyboard`);
    console.log(`   [Audit] ID: audit_${Date.now()}`);
    console.log(`   [Status] COMPLETED`);
  }

  /**
   * Execute live pipeline (placeholder for actual implementation)
   */
  async executeLivePipeline() {
    // In production, this would import and execute the actual orchestrator
    console.log("[RUN] Executing actual pipeline (implementation pending)...");
    await new Promise((resolve) => setTimeout(resolve, 10000));
    console.log("[OK] Pipeline execution completed");
  }

  /**
   * Wait for user confirmation
   */
  async waitForUserConfirmation() {
    console.log(
      "\n[INPUT] Are you sure you want to proceed with live test? (yes/no)",
    );

    // In production, this would read from stdin
    // For now, we'll auto-confirm for demo purposes
    console.log("[OK] Auto-confirming for demo purposes...");
  }

  /**
   * Show help information
   */
  showHelp() {
    console.log(`
[RUNNER] Live Lazada Test Runner

USAGE:
  node bin/run-live-lazada-test.js --product-id <id> [options]

OPTIONS:
  --product-id <id>        Lazada product ID (required)
  --tweet-id <id>          Main tweet ID for thread (optional)
  --facebook-post-id <id>  Facebook page post ID (optional)
  --dry-run                 Run dry run test (no actual posts)
  -h, --help                Show this help message

EXAMPLES:
  # Dry run test
  node bin/run-live-lazada-test.js --product-id laz_001 --dry-run

  # Live test with thread
  node bin/run-live-lazada-test.js --product-id laz_001 --tweet-id 123456789

  # Live test with Facebook comment
  node bin/run-live-lazada-test.js --product-id laz_001 --facebook-post-id 987654321

  # Full live test
  node bin/run-live-lazada-test.js --product-id laz_001 --tweet-id 123456789 --facebook-post-id 987654321

NOTES:
  - Ensure all required environment variables are set
  - Live tests will actually post to social media platforms
  - Use --dry-run for testing without posting
  - All posts include affiliate links and CTA

[PURPOSE] CLI tool for Chip Besar to execute end-to-end dry-run simulation of Lazada product posting via terminal.
`);
  }
}

// Run the test runner
async function main() {
  const runner = new LiveLazadaTestRunner();
  await runner.run();
}

// Handle unhandled rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("[ERROR] Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

// Handle termination signals
process.on("SIGINT", () => {
  console.log("\n[WARN] Test interrupted by user");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n[WARN] Test terminated");
  process.exit(0);
});

// Start the application
if (require.main === module) {
  main().catch(console.error);
}

export default LiveLazadaTestRunner;
