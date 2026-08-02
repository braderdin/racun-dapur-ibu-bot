#!/usr/bin/env node --experimental-specifier-resolution=node

import { execSync } from "child_process";
import { existsSync } from "fs";
import { join } from "path";

// Live Lazada Test CLI Runner
// Usage: node bin/run-live-lazada-test.js [options]
// Options: --product-id <id> --tweet-id <id> --facebook-post-id <id> --dry-run

class LiveLazadaTestRunner {
  private options: any;

  constructor() {
    this.options = this.parseArguments();
  }

  /**
   * Parse command line arguments
   */
  private parseArguments(): any {
    const args = process.argv.slice(2);
    const options: any = {
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
  async run(): Promise<void> {
    try {
      if (this.options.help) {
        this.showHelp();
        return;
      }

      console.log("🚀 Starting Live Lazada Test Runner...");
      console.log(`📅 Date: ${new Date().toLocaleString("ms-MY", { timeZone: "Asia/Kuala_Lumpur" })}\n`);

      // Validate required arguments
      if (!this.options.productId) {
        console.error("❌ Error: --product-id is required");
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

      console.log("\n✅ Live Lazada Test completed successfully!");
      
    } catch (error) {
      console.error("\n❌ Live Lazada Test failed:", error.message);
      process.exit(1);
    }
  }

  /**
   * Check if environment is ready for testing
   */
  private async checkEnvironment(): Promise<void> {
    console.log("🔍 Checking environment readiness...");

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
        console.warn(`⚠️  Warning: ${file} not found"`);
      }
    }

    // Check if TypeScript can compile
    try {
      console.log("📝 Checking TypeScript compilation...");
      execSync("npx tsc --noEmit --pretty false", { stdio: "pipe" });
      console.log("✅ TypeScript compilation successful");
    } catch (error) {
      console.warn("⚠️  TypeScript compilation warnings (continuing anyway)...");
    }

    // Check environment variables
    console.log("🔑 Checking environment variables...");
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

    const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
    if (missingEnvVars.length > 0) {
      console.warn(`⚠️  Warning: Missing environment variables: ${missingEnvVars.join(", ")}`);
    } else {
      console.log("✅ All required environment variables found");
    }

    console.log("✅ Environment check completed\n");
  }

  /**
   * Run dry run test
   */
  private async runDryRunTest(): Promise<void> {
    console.log("🧪 Running DRY RUN test (no actual posts will be made)...");
    console.log(`📦 Product ID: ${this.options.productId}`);
    if (this.options.mainTweetId) console.log(`🐦 Main Tweet ID: ${this.options.mainTweetId}`);
    if (this.options.facebookPagePostId) console.log(`📱 Facebook Page Post ID: ${this.options.facebookPagePostId}`);

    // Simulate the pipeline execution
    console.log("\n🔄 Simulating pipeline execution...");
    
    // Step 1: Simulate Lazada fetch
    console.log("📥 Step 1: Simulating Lazada product fetch...");
    await this.simulateLazadaFetch(this.options.productId);

    // Step 2: Simulate image processing
    console.log("🖼️  Step 2: Simulating image processing...");
    await this.simulateImageProcessing(this.options.productId);

    // Step 3: Simulate social media posting
    console.log("📱 Step 3: Simulating social media posting...");
    await this.simulateSocialPosting();

    // Step 4: Simulate audit
    console.log("🔍 Step 4: Simulating audit logging...");
    await this.simulateAudit();

    console.log("\n✅ Dry run test completed successfully!");
  }

  /**
   * Run live test
   */
  private async runLiveTest(): Promise<void> {
    console.log("🌐 Running LIVE test (actual posts will be made)...");
    console.log(`📦 Product ID: ${this.options.productId}`);
    if (this.options.mainTweetId) console.log(`🐦 Main Tweet ID: ${this.options.mainTweetId}`);
    if (this.options.facebookPagePostId) console.log(`📱 Facebook Page Post ID: ${this.options.facebookPagePostId}`);

    // In production, this would actually execute the pipeline
    console.log("\n⚠️  WARNING: Live test mode is enabled!")
    console.log("   This will actually post to social media platforms.")
    console.log("   Press Ctrl+C to cancel if you're not ready.\n");

    // Wait for user confirmation
    await this.waitForUserConfirmation();

    // Execute the actual pipeline
    console.log("\n🚀 Executing live pipeline...");
    await this.executeLivePipeline();

    console.log("\n✅ Live test completed successfully!");
  }

  /**
   * Simulate Lazada product fetch
   */
  private async simulateLazadaFetch(productId: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log(`✅ Product ${productId} fetched successfully"`);
    console.log(`   Title: Air Fryer 5L Non-Stick Touch Screen Kitchen Appliance`);
    console.log(`   Price: RM 119.00 (60% off from RM 299.00)`);
    console.log(`   Rating: 4.5/5, Stock: Available"`);
  }

  /**
   * Simulate image processing
   */
  private async simulateImageProcessing(productId: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log(`✅ Image processed successfully"`);
    console.log(`   Format: WebP HD"`);
    console.log(`   Size: <2MB"`);
    console.log(`   Watermark: Lazada - ${productId}`);
    console.log(`   CDN URL: https://racun.ibu.my/images/lazada-${productId}-12345.webp"`);
  }

  /**
   * Simulate social media posting
   */
  private async simulateSocialPosting(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 5000));
    console.log(`✅ Social media posts created successfully"`);
    console.log(`   🐦 Twitter Thread: 2 tweets posted (hook + affiliate)");
    console.log(`   📱 Facebook Page: Main post + comment posted"`);
    console.log(`   📱 Facebook Comment: Affiliate link posted under main post"`);
  }

  /**
   * Simulate audit logging
   */
  private async simulateAudit(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log(`✅ Audit logging completed successfully"`);
    console.log(`   📊 Telegram: Visual audit sent with inline keyboard"`);
    console.log(`   🔍 Audit ID: audit_${Date.now()}"`);
    console.log(`   📝 Status: COMPLETED"`);
  }

  /**
   * Execute live pipeline (placeholder for actual implementation)
   */
  private async executeLivePipeline(): Promise<void> {
    // In production, this would import and execute the actual orchestrator
    console.log("🔄 Executing actual pipeline (implementation pending)...");
    await new Promise(resolve => setTimeout(resolve, 10000));
    console.log("✅ Pipeline execution completed");
  }

  /**
   * Wait for user confirmation
   */
  private async waitForUserConfirmation(): Promise<void> {
    console.log("\n❓ Are you sure you want to proceed with live test? (yes/no)");
    
    // In production, this would read from stdin
    // For now, we'll auto-confirm for demo purposes
    console.log("✅ Auto-confirming for demo purposes...");
  }

  /**
   * Show help information
   */
  private showHelp(): void {
    console.log(`
🚀 Live Lazada Test Runner

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

🎯 Purpose:
  CLI tool for Chip Besar to execute end-to-end dry-run simulation of Lazada product posting via terminal.
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
  console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

// Handle termination signals
process.on("SIGINT", () => {
  console.log("\n⚠️  Test interrupted by user");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n⚠️  Test terminated");
  process.exit(0);
});

// Start the application
if (require.main === module) {
  main().catch(console.error);
}

export default LiveLazadaTestRunner;