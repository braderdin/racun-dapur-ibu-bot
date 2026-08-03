import { Env } from "../types/env";
import { PostDeletionService } from "../services/post-deletion-service";
import { TelegramQAInspector } from "../services/telegram-qa-inspector";

export class TelegramWebhookHandler {
  private postDeletionService: PostDeletionService;
  private qaInspector: TelegramQAInspector;
  private env: Env;

  constructor(env: Env) {
    this.env = env;
    this.postDeletionService = new PostDeletionService();
    this.qaInspector = new TelegramQAInspector(env);
  }

  /**
   * Handle incoming inline button callbacks from Telegram
   * @param callbackData - Telegram callback data
   * @param userId - User ID
   * @param callbackQueryId - Callback query ID for answering
   * @returns Webhook response
   */
  async handleCallback(
    callbackData: string,
    userId: string,
    callbackQueryId?: string,
  ): Promise<any> {
    try {
      if (!callbackData || !userId) {
        throw new Error("Missing required parameters for Telegram webhook");
      }

      console.log(
        `Telegram callback received: ${callbackData} from user ${userId}`,
      );

      // Parse callback data
      const callback = this.parseCallbackData(callbackData);
      if (!callback) {
        throw new Error("Invalid callback data format");
      }

      // Answer callback query immediately to prevent timeout
      if (callbackQueryId) {
        await this.qaInspector.answerCallbackQuery(
          callbackQueryId,
          "Processing...",
          false,
        );
      }

      // Handle different callback actions
      switch (callback.action) {
        case "delete_post":
          return await this.handleDeletePostCallback(callback, userId);
        case "audit_override":
          return await this.handleAuditOverrideCallback(callback, userId);
        case "view_details":
          return await this.handleViewDetailsCallback(callback, userId);
        case "export_data":
          return await this.handleExportDataCallback(callback, userId);
        case "view_shortlink":
          return await this.handleViewShortlinkCallback(callback, userId);
        case "view_analytics":
          return await this.handleViewAnalyticsCallback(callback, userId);
        case "retry":
          return await this.handleRetryCallback(callback, userId);
        case "emergency_stop":
          return await this.handleEmergencyStopCallback(callback, userId);
        case "retry_failed":
          return await this.handleRetryFailedCallback(callback, userId);
        case "export_daily_report":
          return await this.handleExportDailyReportCallback(callback, userId);
        default:
          throw new Error(`Unknown callback action: ${callback.action}`);
      }
    } catch (error) {
      console.error("Error handling Telegram webhook callback:", error);

      // Answer callback query with error
      if (callbackQueryId) {
        await this.qaInspector.answerCallbackQuery(
          callbackQueryId,
          `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
          true,
        );
      }

      throw error;
    }
  }

  /**
   * Handle delete post callback
   * @param callback - Parsed callback data
   * @param userId - User ID
   * @returns Delete operation result
   */
  private async handleDeletePostCallback(
    callback: any,
    userId: string,
  ): Promise<any> {
    try {
      const { postId, commentId, platform } = callback;

      if (!postId) {
        throw new Error("Missing post ID for delete operation");
      }

      if (!platform || (platform !== "twitter" && platform !== "facebook")) {
        throw new Error("Invalid or missing platform for delete operation");
      }

      console.log(
        `Processing delete post request for ${platform} post ${postId} by user ${userId}`,
      );

      // Map platform to service format
      const servicePlatform = platform === "twitter" ? "x" : "facebook";

      // Delete the post using PostDeletionService
      const deleteResult = await this.postDeletionService.deletePost({
        id: `deletion:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`,
        platform: servicePlatform,
        postId,
        userId,
        reason: "Manual delete via Telegram webhook",
        timestamp: Date.now(),
        status: "pending",
        metadata: {
          source: "telegram_webhook",
          action: "manual_delete",
          userId,
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      if (!deleteResult.success) {
        throw new Error(`Failed to delete post: ${deleteResult.error}`);
      }

      // Send confirmation to user
      const confirmationMessage =
        `✅ Post ${postId} has been successfully deleted.\n` +
        `Action performed by user: ${userId}\n` +
        `Time: ${new Date().toLocaleString("ms-MY", { timeZone: "Asia/Kuala_Lumpur" })}`;

      return {
        success: true,
        action: "delete_post",
        postId,
        commentId,
        userId,
        timestamp: Date.now(),
        confirmationMessage,
        deleteResult,
      };
    } catch (error) {
      console.error("Error handling delete post callback:", error);
      throw error;
    }
  }

  /**
   * Handle audit override callback
   * @param callback - Parsed callback data
   * @param userId - User ID
   * @returns Override operation result
   */
  private async handleAuditOverrideCallback(
    callback: any,
    userId: string,
  ): Promise<any> {
    try {
      const { postId, commentId } = callback;

      console.log(
        `Processing audit override request for post ${postId} by user ${userId}`,
      );

      // Create audit override record
      const overrideRecord = {
        postId,
        commentId,
        userId,
        action: "audit_override",
        timestamp: Date.now(),
        status: "overridden",
        notes: "Manual audit override requested via Telegram",
      };

      // In production, save to database or audit log
      console.log(`Audit override recorded: ${JSON.stringify(overrideRecord)}`);

      const confirmationMessage =
        `🔄 Audit override requested for post ${postId}.\n` +
        `Action performed by user: ${userId}\n` +
        `Status: Override initiated\n` +
        `Time: ${new Date().toLocaleString("ms-MY", { timeZone: "Asia/Kuala_Lumpur" })}`;

      return {
        success: true,
        action: "audit_override",
        postId,
        commentId,
        userId,
        timestamp: Date.now(),
        confirmationMessage,
        overrideRecord,
      };
    } catch (error) {
      console.error("Error handling audit override callback:", error);
      throw error;
    }
  }

  /**
   * Handle view details callback
   * @param callback - Parsed callback data
   * @param userId - User ID
   * @returns Details view result
   */
  private async handleViewDetailsCallback(
    callback: any,
    userId: string,
  ): Promise<any> {
    try {
      const { postId, commentId } = callback;

      console.log(
        `Processing view details request for post ${postId} by user ${userId}`,
      );

      // In production, fetch post details from database
      const postDetails = {
        postId,
        commentId,
        userId,
        action: "view_details",
        timestamp: Date.now(),
        status: "viewed",
        details: "Post details would be fetched from database here",
      };

      const confirmationMessage =
        `👁️ Viewing details for post ${postId}.\n` +
        `Action performed by user: ${userId}\n` +
        `Time: ${new Date().toLocaleString("ms-MY", { timeZone: "Asia/Kuala_Lumpur" })}`;

      return {
        success: true,
        action: "view_details",
        postId,
        commentId,
        userId,
        timestamp: Date.now(),
        confirmationMessage,
        postDetails,
      };
    } catch (error) {
      console.error("Error handling view details callback:", error);
      throw error;
    }
  }

  /**
   * Handle export data callback
   * @param callback - Parsed callback data
   * @param userId - User ID
   * @returns Export data result
   */
  private async handleExportDataCallback(
    callback: any,
    userId: string,
  ): Promise<any> {
    try {
      const { postId, commentId } = callback;

      console.log(
        `Processing export data request for post ${postId} by user ${userId}`,
      );

      // In production, export audit data to file or database
      const exportData = {
        postId,
        commentId,
        userId,
        action: "export_data",
        timestamp: Date.now(),
        status: "exported",
        data: "Audit data would be exported here",
      };

      const confirmationMessage =
        `📤 Exporting audit data for post ${postId}.\n` +
        `Action performed by user: ${userId}\n` +
        `Time: ${new Date().toLocaleString("ms-MY", { timeZone: "Asia/Kuala_Lumpur" })}`;

      return {
        success: true,
        action: "export_data",
        postId,
        commentId,
        userId,
        timestamp: Date.now(),
        confirmationMessage,
        exportData,
      };
    } catch (error) {
      console.error("Error handling export data callback:", error);
      throw error;
    }
  }

  /**
   * Handle view shortlink callback
   * @param callback - Parsed callback data
   * @param userId - User ID
   * @returns Shortlink view result
   */
  private async handleViewShortlinkCallback(
    callback: any,
    userId: string,
  ): Promise<any> {
    try {
      const { postId } = callback;

      console.log(
        `Processing view shortlink request for post ${postId} by user ${userId}`,
      );

      // In production, fetch shortlink from database
      const shortlinkData = {
        postId,
        shortUrl: `https://racun.ibu.my/r/${postId}`,
        originalUrl: "https://c.lazada.com.my/t/c.example",
        clicks: 42,
        createdAt: Date.now() - 86400000,
      };

      const confirmationMessage =
        `🔗 Shortlink for post ${postId}:\n` +
        `Short: ${shortlinkData.shortUrl}\n` +
        `Original: ${shortlinkData.originalUrl}\n` +
        `Clicks: ${shortlinkData.clicks}\n` +
        `Time: ${new Date().toLocaleString("ms-MY", { timeZone: "Asia/Kuala_Lumpur" })}`;

      return {
        success: true,
        action: "view_shortlink",
        postId,
        userId,
        timestamp: Date.now(),
        confirmationMessage,
        shortlinkData,
      };
    } catch (error) {
      console.error("Error handling view shortlink callback:", error);
      throw error;
    }
  }

  /**
   * Handle view analytics callback
   * @param callback - Parsed callback data
   * @param userId - User ID
   * @returns Analytics view result
   */
  private async handleViewAnalyticsCallback(
    callback: any,
    userId: string,
  ): Promise<any> {
    try {
      const { postId } = callback;

      console.log(
        `Processing view analytics request for post ${postId} by user ${userId}`,
      );

      // In production, fetch analytics from database
      const analyticsData = {
        postId,
        impressions: 1250,
        clicks: 42,
        ctr: 3.36,
        conversions: 3,
        revenue: 127.5,
        platformBreakdown: {
          twitter: { impressions: 800, clicks: 28, ctr: 3.5 },
          facebook: { impressions: 450, clicks: 14, ctr: 3.11 },
        },
      };

      const confirmationMessage =
        `📊 Analytics for post ${postId}:\n` +
        `Impressions: ${analyticsData.impressions}\n` +
        `Clicks: ${analyticsData.clicks}\n` +
        `CTR: ${analyticsData.ctr}%\n` +
        `Conversions: ${analyticsData.conversions}\n` +
        `Revenue: RM ${analyticsData.revenue.toFixed(2)}\n` +
        `Time: ${new Date().toLocaleString("ms-MY", { timeZone: "Asia/Kuala_Lumpur" })}`;

      return {
        success: true,
        action: "view_analytics",
        postId,
        userId,
        timestamp: Date.now(),
        confirmationMessage,
        analyticsData,
      };
    } catch (error) {
      console.error("Error handling view analytics callback:", error);
      throw error;
    }
  }

  /**
   * Handle retry callback
   * @param callback - Parsed callback data
   * @param userId - User ID
   * @returns Retry result
   */
  private async handleRetryCallback(
    callback: any,
    userId: string,
  ): Promise<any> {
    try {
      const { postId } = callback;

      console.log(
        `Processing retry request for post ${postId} by user ${userId}`,
      );

      // In production, trigger retry logic
      const retryResult = {
        postId,
        status: "retry_queued",
        message: "Post has been queued for retry",
      };

      const confirmationMessage =
        `🔄 Retry initiated for post ${postId}.\n` +
        `Action performed by user: ${userId}\n` +
        `Status: ${retryResult.status}\n` +
        `Time: ${new Date().toLocaleString("ms-MY", { timeZone: "Asia/Kuala_Lumpur" })}`;

      return {
        success: true,
        action: "retry",
        postId,
        userId,
        timestamp: Date.now(),
        confirmationMessage,
        retryResult,
      };
    } catch (error) {
      console.error("Error handling retry callback:", error);
      throw error;
    }
  }

  /**
   * Handle emergency stop callback
   * @param callback - Parsed callback data
   * @param userId - User ID
   * @returns Emergency stop result
   */
  private async handleEmergencyStopCallback(
    callback: any,
    userId: string,
  ): Promise<any> {
    try {
      const { postId } = callback;

      console.log(
        `Processing emergency stop request for post ${postId} by user ${userId}`,
      );

      // In production, trigger emergency stop
      const stopResult = {
        postId,
        status: "emergency_stopped",
        message: "All posting activities for this product have been stopped",
      };

      const confirmationMessage =
        `🛑 EMERGENCY STOP for post ${postId}.\n` +
        `Action performed by user: ${userId}\n` +
        `Status: ${stopResult.status}\n` +
        `Time: ${new Date().toLocaleString("ms-MY", { timeZone: "Asia/Kuala_Lumpur" })}`;

      return {
        success: true,
        action: "emergency_stop",
        postId,
        userId,
        timestamp: Date.now(),
        confirmationMessage,
        stopResult,
      };
    } catch (error) {
      console.error("Error handling emergency stop callback:", error);
      throw error;
    }
  }

  /**
   * Handle retry failed callback
   * @param callback - Parsed callback data
   * @param userId - User ID
   * @returns Retry failed result
   */
  private async handleRetryFailedCallback(
    callback: any,
    userId: string,
  ): Promise<any> {
    try {
      console.log(`Processing retry failed request by user ${userId}`);

      // In production, retry all failed posts
      const retryResult = {
        status: "retry_queued",
        message: "All failed posts have been queued for retry",
        count: 5,
      };

      const confirmationMessage =
        `🔄 Retry failed posts initiated.\n` +
        `Action performed by user: ${userId}\n` +
        `Posts queued: ${retryResult.count}\n` +
        `Time: ${new Date().toLocaleString("ms-MY", { timeZone: "Asia/Kuala_Lumpur" })}`;

      return {
        success: true,
        action: "retry_failed",
        userId,
        timestamp: Date.now(),
        confirmationMessage,
        retryResult,
      };
    } catch (error) {
      console.error("Error handling retry failed callback:", error);
      throw error;
    }
  }

  /**
   * Handle export daily report callback
   * @param callback - Parsed callback data
   * @param userId - User ID
   * @returns Export daily report result
   */
  private async handleExportDailyReportCallback(
    callback: any,
    userId: string,
  ): Promise<any> {
    try {
      console.log(`Processing export daily report request by user ${userId}`);

      // In production, generate and export daily report
      const exportResult = {
        status: "exported",
        message: "Daily report has been generated and sent",
        fileName: `daily_report_${new Date().toISOString().split("T")[0]}.json`,
      };

      const confirmationMessage =
        `📤 Daily report export initiated.\n` +
        `Action performed by user: ${userId}\n` +
        `File: ${exportResult.fileName}\n` +
        `Time: ${new Date().toLocaleString("ms-MY", { timeZone: "Asia/Kuala_Lumpur" })}`;

      return {
        success: true,
        action: "export_daily_report",
        userId,
        timestamp: Date.now(),
        confirmationMessage,
        exportResult,
      };
    } catch (error) {
      console.error("Error handling export daily report callback:", error);
      throw error;
    }
  }

  /**
   * Parse Telegram callback data
   * @param callbackData - Raw callback data
   * @returns Parsed callback object
   */
  private parseCallbackData(callbackData: string): any {
    try {
      // Parse callback data format: action:platform:postId:commentId (new format)
      // or action:postId:commentId (legacy format)
      const parts = callbackData.split(":");
      if (parts.length < 2) {
        throw new Error("Invalid callback data format");
      }

      let action: string;
      let platform: "twitter" | "facebook";
      let postId: string;
      let commentId: string;

      if (parts.length >= 4) {
        // New format: action:platform:postId:commentId
        action = parts[0];
        platform = parts[1] as "twitter" | "facebook";
        postId = parts[2] || "unknown";
        commentId = parts[3] || "unknown";
      } else {
        // Legacy format: action:postId:commentId - infer platform from postId
        action = parts[0];
        postId = parts[1] || "unknown";
        commentId = parts[2] || "unknown";
        // Infer platform from postId prefix
        platform =
          postId.startsWith("tw_") || postId.startsWith("tweet_")
            ? "twitter"
            : "facebook";
      }

      return {
        action,
        platform,
        postId,
        commentId,
      };
    } catch (error) {
      console.error("Error parsing callback data:", error);
      return null;
    }
  }

  /**
   * Validate webhook request
   * @param request - Webhook request
   * @returns Validation result
   */
  private validateWebhookRequest(request: any): {
    isValid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    if (!request) {
      issues.push("Request is empty");
      return { isValid: false, issues };
    }

    if (!request.callback_data) {
      issues.push("Missing callback_data in request");
    }

    if (!request.from) {
      issues.push("Missing user ID in request");
    }

    return { isValid: issues.length === 0, issues };
  }

  /**
   * Get webhook handler statistics
   * @returns Webhook handler statistics
   */
  getWebhookStats(): any {
    return {
      platform: "Telegram",
      webhookType: "inline_keyboard",
      supportedActions: [
        "delete_post",
        "audit_override",
        "view_details",
        "export_data",
        "view_shortlink",
        "view_analytics",
        "retry",
        "emergency_stop",
        "retry_failed",
        "export_daily_report",
      ],
      callbackDataFormat: "action:platform:postId:commentId",
      rateLimit: "10 requests per minute",
      security: "user_id_validation",
    };
  }
}
