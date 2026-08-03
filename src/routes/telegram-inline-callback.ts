/*
 * Telegram Inline Callback Handler Route
 * Webhook handler to process inline keyboard button actions
 * (Approve Post, Emergency Delete, Force Re-run AI) sent from Telegram.
 */

import { Env } from "../types/env";
import { PostDeletionService } from "../services/post-deletion-service";
import { DualPosterService } from "../services/dual-poster";
import { RedisService } from "../services/redis";
import { SupabaseService } from "../services/supabase";
import { logger } from "../utils/logger";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TelegramCallback {
  action:
    | "approve_post"
    | "emergency_delete"
    | "force_rerun"
    | "toggle_fb"
    | "toggle_x"
    | "view_stats";
  postId?: string;
  dealId?: string;
  platform?: "twitter" | "facebook";
  userId?: string;
  reason?: string;
}

export interface CallbackResponse {
  success: boolean;
  message: string;
  data?: any;
}

// ---------------------------------------------------------------------------
// Telegram Inline Callback Handler
// ---------------------------------------------------------------------------

export class TelegramInlineCallbackHandler {
  private postDeletionService: PostDeletionService;
  private dualPosterService: DualPosterService | null = null;
  private redis: RedisService;
  private supabase: SupabaseService;
  private env: Env;

  constructor(env: Env) {
    this.env = env;
    this.postDeletionService = new PostDeletionService();
    this.redis = new RedisService(env);
    this.supabase = new SupabaseService(env);
  }

  // ---------------------------------------------------------------------------
  // Handle incoming callback
  // ---------------------------------------------------------------------------

  async handleCallback(
    callbackData: string,
    userId: string,
  ): Promise<CallbackResponse> {
    try {
      logger.info(
        "Telegram inline callback received",
        { callbackData, userId },
        "TelegramInlineCallback",
      );

      // Parse callback data
      const callback = this.parseCallbackData(callbackData);
      if (!callback) {
        return { success: false, message: "Invalid callback data format" };
      }

      // Validate user authorization
      if (!this.isAuthorizedUser(userId)) {
        return { success: false, message: "Unauthorized user" };
      }

      // Handle different callback actions
      switch (callback.action) {
        case "approve_post":
          return await this.handleApprovePost(callback, userId);
        case "emergency_delete":
          return await this.handleEmergencyDelete(callback, userId);
        case "force_rerun":
          return await this.handleForceRerun(callback, userId);
        case "toggle_fb":
          return await this.handleToggleFacebook(callback, userId);
        case "toggle_x":
          return await this.handleToggleTwitter(callback, userId);
        case "view_stats":
          return await this.handleViewStats(callback, userId);
        default:
          return {
            success: false,
            message: `Unknown callback action: ${callback.action}`,
          };
      }
    } catch (error) {
      logger.error(
        "Error handling Telegram inline callback",
        { error, callbackData, userId },
        "TelegramInlineCallback",
      );
      return {
        success: false,
        message: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Parse callback data
  // ---------------------------------------------------------------------------

  private parseCallbackData(callbackData: string): TelegramCallback | null {
    try {
      const parts = callbackData.split(":");

      if (parts.length < 2) {
        return null;
      }

      const action = parts[0] as TelegramCallback["action"];
      const callback: TelegramCallback = { action };

      for (let i = 1; i < parts.length; i++) {
        const [key, value] = parts[i].split("=");
        if (key && value) {
          (callback as any)[key] = value;
        }
      }

      return callback;
    } catch (error) {
      logger.error(
        "Error parsing callback data",
        { error, callbackData },
        "TelegramInlineCallback",
      );
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Check if user is authorized
  // ---------------------------------------------------------------------------

  private async isAuthorizedUser(userId: string): Promise<boolean> {
    // Check against allowed user IDs from environment
    const allowedUsers = (this.env.ALLOWED_TELEGRAM_USER_IDS || "")
      .split(",")
      .filter(Boolean);

    if (allowedUsers.length === 0) {
      // If no restriction, allow all
      return true;
    }

    return allowedUsers.includes(userId);
  }

  // ---------------------------------------------------------------------------
  // Handle approve post callback
  // ---------------------------------------------------------------------------

  private async handleApprovePost(
    callback: TelegramCallback,
    userId: string,
  ): Promise<CallbackResponse> {
    const { postId, dealId } = callback;

    if (!postId && !dealId) {
      return { success: false, message: "Missing post ID or deal ID" };
    }

    logger.info(
      "Post approved via Telegram",
      { postId, dealId, userId },
      "TelegramInlineCallback",
    );

    // Mark as approved in Redis
    if (postId) {
      await this.redis.set(`post:${postId}:approved`, "true", 86400);
    }

    return {
      success: true,
      message: `Post ${postId || dealId} approved successfully`,
      data: { postId, dealId, approvedBy: userId },
    };
  }

  // ---------------------------------------------------------------------------
  // Handle emergency delete callback
  // ---------------------------------------------------------------------------

  private async handleEmergencyDelete(
    callback: TelegramCallback,
    userId: string,
  ): Promise<CallbackResponse> {
    const { postId, platform, reason } = callback;

    if (!postId || !platform) {
      return { success: false, message: "Missing post ID or platform" };
    }

    logger.warn(
      "Emergency delete requested via Telegram",
      { postId, platform, userId, reason },
      "TelegramInlineCallback",
    );

    try {
      // Delete the post
      const deleteResult = await this.postDeletionService.deletePost({
        id: `emergency:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`,
        platform: platform === "twitter" ? "x" : "facebook",
        postId,
        userId,
        reason: reason || "Emergency delete via Telegram",
        timestamp: Date.now(),
        status: "pending",
        metadata: {
          source: "telegram_inline_callback",
          action: "emergency_delete",
          userId,
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      if (!deleteResult.success) {
        return {
          success: false,
          message: `Delete failed: ${deleteResult.error}`,
        };
      }

      return {
        success: true,
        message: `Post ${postId} on ${platform} deleted successfully`,
        data: { postId, platform, deletedBy: userId },
      };
    } catch (error) {
      return {
        success: false,
        message: `Delete error: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Handle force re-run AI callback
  // ---------------------------------------------------------------------------

  private async handleForceRerun(
    callback: TelegramCallback,
    userId: string,
  ): Promise<CallbackResponse> {
    const { dealId } = callback;

    if (!dealId) {
      return { success: false, message: "Missing deal ID" };
    }

    logger.info(
      "Force re-run AI requested",
      { dealId, userId },
      "TelegramInlineCallback",
    );

    // Set flag in Redis to force AI regeneration
    await this.redis.set(`force_rerun:${dealId}`, "true", 3600);

    // Add to regeneration queue
    await this.redis.sadd(
      "ai_regeneration_queue",
      JSON.stringify({
        dealId,
        requestedBy: userId,
        timestamp: Date.now(),
      }),
    );

    return {
      success: true,
      message: `AI regeneration queued for deal ${dealId}`,
      data: { dealId, queuedBy: userId },
    };
  }

  // ---------------------------------------------------------------------------
  // Handle toggle Facebook posting callback
  // ---------------------------------------------------------------------------

  private async handleToggleFacebook(
    callback: TelegramCallback,
    userId: string,
  ): Promise<CallbackResponse> {
    const currentState = await this.redis.get("feature:fb_posting_enabled");
    const newState = currentState !== "true";

    await this.redis.set(
      "feature:fb_posting_enabled",
      newState ? "true" : "false",
      86400,
    );

    logger.info(
      "Facebook posting toggled",
      { enabled: newState, userId },
      "TelegramInlineCallback",
    );

    return {
      success: true,
      message: `Facebook posting ${newState ? "enabled" : "disabled"}`,
      data: { enabled: newState },
    };
  }

  // ---------------------------------------------------------------------------
  // Handle toggle Twitter posting callback
  // ---------------------------------------------------------------------------

  private async handleToggleTwitter(
    callback: TelegramCallback,
    userId: string,
  ): Promise<CallbackResponse> {
    const currentState = await this.redis.get("feature:x_posting_enabled");
    const newState = currentState !== "true";

    await this.redis.set(
      "feature:x_posting_enabled",
      newState ? "true" : "false",
      86400,
    );

    logger.info(
      "Twitter posting toggled",
      { enabled: newState, userId },
      "TelegramInlineCallback",
    );

    return {
      success: true,
      message: `Twitter posting ${newState ? "enabled" : "disabled"}`,
      data: { enabled: newState },
    };
  }

  // ---------------------------------------------------------------------------
  // Handle view stats callback
  // ---------------------------------------------------------------------------

  private async handleViewStats(
    callback: TelegramCallback,
    userId: string,
  ): Promise<CallbackResponse> {
    const stats = await this.getStats();

    return {
      success: true,
      message: "Statistics retrieved",
      data: stats,
    };
  }

  // ---------------------------------------------------------------------------
  // Helper: Get current stats
  // ---------------------------------------------------------------------------

  private async getStats(): Promise<any> {
    const totalDeals = (await this.redis.get("bot:deals:curated")) || 0;
    const totalPosts = (await this.redis.get("bot:posts:published")) || 0;
    const totalClicks = (await this.redis.get("bot:clicks:total")) || 0;

    return {
      totalDeals: typeof totalDeals === "number" ? totalDeals : 0,
      totalPosts: typeof totalPosts === "number" ? totalPosts : 0,
      totalClicks: typeof totalClicks === "number" ? totalClicks : 0,
      fbPostingEnabled:
        (await this.redis.get("feature:fb_posting_enabled")) === "true",
      xPostingEnabled:
        (await this.redis.get("feature:x_posting_enabled")) === "true",
    };
  }
}

// ---------------------------------------------------------------------------
// Express route handler for Cloudflare Worker
// ---------------------------------------------------------------------------

export async function handleTelegramInlineCallback(
  request: Request,
  env: Env,
): Promise<Response> {
  const handler = new TelegramInlineCallbackHandler(env);

  try {
    const body = (await request.json()) as {
      callback_query?: {
        id: string;
        data: string;
        from?: { id: number | string };
      };
    };
    const callbackQuery = body?.callback_query;

    if (!callbackQuery) {
      return new Response(
        JSON.stringify({ success: false, message: "No callback query" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const callbackData = callbackQuery.data;
    const userId = callbackQuery.from?.id?.toString();

    if (!callbackData || !userId) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Missing callback data or user ID",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const result = await handler.handleCallback(callbackData, userId);

    // Send response back to Telegram
    const answerCallbackQuery = {
      callback_query_id: callbackQuery.id,
      text: result.message,
      show_alert: !result.success,
    };

    await fetch(
      `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(answerCallbackQuery),
      },
    );

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error handling Telegram inline callback:", error);

    return new Response(
      JSON.stringify({
        success: false,
        message: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
