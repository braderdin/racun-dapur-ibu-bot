import { Env } from "../types/env";
import { PostDeletionService } from "../services/post-deletion-service";

export class TelegramWebhookHandler {
  private postDeletionService: PostDeletionService;
  private env: Env;

  constructor(env: Env) {
    this.env = env;
    this.postDeletionService = new PostDeletionService(env);
  }

  /**
   * Handle incoming inline button callbacks from Telegram
   * @param callbackData - Telegram callback data
   * @param userId - User ID
   * @returns Webhook response
   */
  async handleCallback(callbackData: string, userId: string): Promise<any> {
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
        default:
          throw new Error(`Unknown callback action: ${callback.action}`);
      }
    } catch (error) {
      console.error("Error handling Telegram webhook callback:", error);
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

      // Delete the post using PostDeletionService
      const deleteResult = await this.postDeletionService.deletePost(
        postId,
        platform,
        userId,
        {
          source: "telegram_webhook",
          action: "manual_delete",
          timestamp: Date.now(),
          userId,
        },
      );

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
        platform = postId.startsWith("tw_") || postId.startsWith("tweet_") ? "twitter" : "facebook";
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
      ],
      callbackDataFormat: "action:postId:commentId",
      rateLimit: "10 requests per minute",
      security: "user_id_validation",
    };
  }
}
