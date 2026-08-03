import { Env } from "../types/env";
import {
  LiveProductionOrchestrator,
  PipelineResult,
} from "../services/live-production-orchestrator";

export interface LiveTestRequest {
  productId?: string;
  mode?: "dry-run" | "live";
  maxDeals?: number;
  userId?: string;
}

export interface LiveTestResponse {
  success: boolean;
  mode: string;
  pipelineResult?: PipelineResult;
  simulation?: any;
  error?: string;
  message: string;
  timestamp: number;
}

export class LiveTestHandler {
  private orchestrator: LiveProductionOrchestrator;
  private env: Env;

  constructor(env: Env) {
    this.env = env;
    this.orchestrator = new LiveProductionOrchestrator(env);
  }

  /**
   * Handle incoming HTTP requests for live test execution
   * Cloudflare Worker endpoint: /api/test/live-run
   * @param request - HTTP request object
   * @param query - Query parameters
   * @returns HTTP response
   */
  async handleLiveTest(request: any, query: any): Promise<any> {
    try {
      console.log("🔍 Live test handler called");

      // Parse query parameters
      const productId = query.productId || query.id || query.p;
      const mode = query.mode || "dry-run";
      const maxDeals = parseInt(query.maxDeals || "3");
      const userId = query.userId || "telegram_user";

      if (!productId) {
        return {
          status: 400,
          body: {
            success: false,
            error: "Product ID is required",
            usage:
              "/api/test/live-run?productId=laz_001&mode=dry-run|maxDeals=3",
          },
        };
      }

      console.log(`📦 Processing live test for product: ${productId}`);

      // Check if this is a dry run
      const isDryRun = mode === "dry-run";

      if (isDryRun) {
        return await this.handleDryRun(productId, maxDeals, userId);
      } else {
        return await this.handleLiveExecution(productId, maxDeals, userId);
      }
    } catch (error) {
      console.error("Error handling live test request:", error);
      return {
        status: 500,
        body: {
          success: false,
          error: "Internal server error",
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  /**
   * Handle dry run test
   * @param productId - Product ID
   * @param maxDeals - Maximum deals to process
   * @param userId - User ID
   * @returns Dry run response
   */
  private async handleDryRun(
    productId: string,
    maxDeals: number,
    userId: string,
  ): Promise<any> {
    try {
      console.log(`🧪 Running dry run test for product: ${productId}`);

      // Simulate the pipeline execution
      const simulationResult = await this.simulatePipelineExecution(
        productId,
        maxDeals,
      );

      return {
        status: 200,
        body: {
          success: true,
          mode: "dry-run",
          productId,
          simulation: simulationResult,
          message: "Dry run completed successfully. No actual posts were made.",
          nextSteps: [
            "Review the simulation output above",
            "Use mode=live to execute actual posts",
            "Check Telegram for visual audit notifications",
          ],
        },
      };
    } catch (error) {
      console.error("Error in dry run:", error);
      return {
        status: 500,
        body: {
          success: false,
          error: "Dry run failed",
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  /**
   * Handle live execution
   * @param productId - Product ID
   * @param maxDeals - Maximum deals to process
   * @param userId - User ID
   * @returns Live execution response
   */
  private async handleLiveExecution(
    productId: string,
    maxDeals: number,
    userId: string,
  ): Promise<any> {
    try {
      console.log(`🌐 Running live execution for product: ${productId}`);

      // Validate user permissions
      const userValidation = await this.validateUserAccess(userId);
      if (!userValidation.allowed) {
        return {
          status: 403,
          body: {
            success: false,
            error: "Access denied",
            message: userValidation.reason,
          },
        };
      }

      // Execute the live pipeline
      const pipelineResult = await this.orchestrator.executePipeline();

      return {
        status: 200,
        body: {
          success: true,
          mode: "live",
          productId,
          pipelineResult,
          message: "Live execution completed successfully.",
          nextSteps: [
            "Check Telegram for visual audit notifications",
            "Monitor social media platforms for posted content",
            "Review affiliate link performance",
          ],
        },
      };
    } catch (error) {
      console.error("Error in live execution:", error);
      return {
        status: 500,
        body: {
          success: false,
          error: "Live execution failed",
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  /**
   * Validate user access
   * @param userId - User ID
   * @returns Validation result
   */
  private async validateUserAccess(
    userId: string,
  ): Promise<{ allowed: boolean; reason?: string }> {
    try {
      // In production, validate against database or authentication service
      // For now, allow all requests (in production, implement proper authentication)

      if (!userId) {
        return { allowed: false, reason: "User ID is required" };
      }

      // Check if user is in allowed list (in production, check against database)
      const allowedUsers = ["telegram_user", "chip_besar", "admin"];
      if (!allowedUsers.includes(userId)) {
        return {
          allowed: false,
          reason: "User not authorized for live test execution",
        };
      }

      return { allowed: true };
    } catch (error) {
      console.error("Error validating user access:", error);
      return { allowed: false, reason: "Access validation error" };
    }
  }

  /**
   * Simulate pipeline execution for dry run
   * @param productId - Product ID
   * @param maxDeals - Maximum deals to simulate
   * @returns Simulation result
   */
  private async simulatePipelineExecution(
    productId: string,
    maxDeals: number,
  ): Promise<any> {
    const simulation: {
      productId: string;
      steps: Array<{
        step: string;
        status: string;
        duration: number;
        details: string;
      }>;
      timeline: Array<{ time: string; event: string }>;
      resources: Array<{ type: string; name: string; status: string }>;
      expectedOutcomes: Array<{
        metric: string;
        expected: string;
        actual: string;
      }>;
    } = {
      productId,
      steps: [],
      timeline: [],
      resources: [],
      expectedOutcomes: [],
    };

    // Step 1: Simulate Lazada fetch
    simulation.steps.push({
      step: "lazada_fetch",
      status: "completed",
      duration: 2000,
      details: `Product ${productId} fetched from Lazada API`,
    });
    simulation.timeline.push({
      time: "00:00:02",
      event: "Lazada product fetch completed",
    });
    simulation.resources.push({
      type: "API",
      name: "Lazada Open API",
      status: "available",
    });
    simulation.expectedOutcomes.push({
      metric: "product_data",
      expected: "Product details retrieved successfully",
      actual: "✅ Product details retrieved successfully",
    });

    // Step 2: Simulate image processing
    simulation.steps.push({
      step: "image_processing",
      status: "completed",
      duration: 3000,
      details: "Product image processed and uploaded to B2 storage",
    });
    simulation.timeline.push({
      time: "00:00:05",
      event: "Image processing completed",
    });
    simulation.resources.push({
      type: "Storage",
      name: "Backblaze B2",
      status: "available",
    });
    simulation.expectedOutcomes.push({
      metric: "image_url",
      expected: "CDN URL generated",
      actual:
        "✅ CDN URL generated: https://racun.ibu.my/images/lazada-product-12345.webp",
    });

    // Step 3: Simulate Twitter posting
    simulation.steps.push({
      step: "twitter_post",
      status: "completed",
      duration: 2000,
      details: "Thread posted to Twitter/X",
    });
    simulation.timeline.push({
      time: "00:00:07",
      event: "Twitter thread posted",
    });
    simulation.resources.push({
      type: "API",
      name: "Twitter API v2",
      status: "available",
    });
    simulation.expectedOutcomes.push({
      metric: "twitter_tweets",
      expected: "2 tweets posted (hook + affiliate)",
      actual: "✅ 2 tweets posted (hook + affiliate)",
    });

    // Step 4: Simulate Facebook posting
    simulation.steps.push({
      step: "facebook_post",
      status: "completed",
      duration: 2000,
      details: "Main post and comment posted to Facebook Page",
    });
    simulation.timeline.push({
      time: "00:00:09",
      event: "Facebook Page content posted",
    });
    simulation.resources.push({
      type: "API",
      name: "Facebook Graph API",
      status: "available",
    });
    simulation.expectedOutcomes.push({
      metric: "facebook_posts",
      expected: "Main post + comment posted",
      actual: "✅ Main post + comment posted",
    });

    // Step 5: Simulate Telegram audit
    simulation.steps.push({
      step: "telegram_audit",
      status: "completed",
      duration: 1000,
      details: "Visual audit sent to Telegram with inline keyboard",
    });
    simulation.timeline.push({
      time: "00:00:10",
      event: "Telegram audit sent",
    });
    simulation.resources.push({
      type: "API",
      name: "Telegram Bot API",
      status: "available",
    });
    simulation.expectedOutcomes.push({
      metric: "telegram_messages",
      expected: "Audit message with inline keyboard",
      actual: "✅ Audit message with inline keyboard sent",
    });

    // Step 6: Simulate Redis storage
    simulation.steps.push({
      step: "redis_storage",
      status: "completed",
      duration: 500,
      details: "Pipeline execution stored in Redis",
    });
    simulation.timeline.push({
      time: "00:00:11",
      event: "Pipeline execution stored in Redis",
    });
    simulation.resources.push({
      type: "Database",
      name: "Upstash Redis",
      status: "available",
    });
    simulation.expectedOutcomes.push({
      metric: "storage",
      expected: "Execution data stored with 5-day TTL",
      actual: "✅ Execution data stored with 5-day TTL",
    });

    return simulation;
  }

  /**
   * Get live test handler statistics
   * @returns Handler statistics
   */
  getHandlerStats(): any {
    return {
      platform: "Live Test Handler",
      endpoint: "/live-test",
      methods: ["GET", "POST"],
      parameters: [
        "productId (required)",
        "tweetId (optional)",
        "facebookPostId (optional)",
        "mode (dry/live)",
        "userId (optional)",
      ],
      responseTypes: ["JSON"],
      rateLimit: "10 requests per minute",
      authentication: "Basic (userId validation)",
      features: [
        "dry_run_mode",
        "live_execution",
        "user_validation",
        "simulation",
        "telegram_integration",
      ],
    };
  }
}
