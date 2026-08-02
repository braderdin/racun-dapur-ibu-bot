import { Env } from "../types/env";
import { Telegram } from "../services/telegram";
import { LazadaLinkCloaker } from "./link-cloaker-lazada";

export class TelegramInteractiveAudit {
  private telegram: Telegram;
  private linkCloaker: LazadaLinkCloaker;
  private env: Env;

  constructor(env: Env) {
    this.env = env;
    this.telegram = new Telegram(env);
    this.linkCloaker = new LazadaLinkCloaker(env);
  }

  /**
   * Format and send comprehensive Telegram visual audit messages
   * @param postData - Post data from social media platforms
   * @param commentData - Comment data from social media platforms
   * @param imageUrl - HD image URL
   * @returns Telegram message response
   */
  async sendVisualAudit(
    postData: any,
    commentData: any,
    imageUrl?: string,
  ): Promise<any> {
    try {
      if (!postData || !commentData) {
        throw new Error("Missing required data for Telegram visual audit");
      }

      // Format comprehensive audit message
      const auditMessage = this.formatVisualAuditMessage(
        postData,
        commentData,
        imageUrl,
      );

      // Send to Telegram with visual elements
      const telegramResponse = await this.telegram.sendMessage(auditMessage, {
        parseMode: "Markdown",
        disableWebPagePreview: false,
        replyMarkup: this.generateInlineKeyboard(postData, commentData),
      });

      if (!telegramResponse) {
        throw new Error("Failed to send Telegram visual audit");
      }

      console.log(
        `Telegram visual audit sent successfully: ${telegramResponse.message_id}`,
      );
      return {
        success: true,
        messageId: telegramResponse.message_id,
        chatId: telegramResponse.chat.id,
        postData,
        commentData,
        imageUrl,
      };
    } catch (error) {
      console.error("Error sending Telegram visual audit:", error);
      throw error;
    }
  }

  /**
   * Format comprehensive visual audit message
   * @param postData - Post data
   * @param commentData - Comment data
   * @param imageUrl - Image URL
   * @returns Formatted audit message
   */
  private formatVisualAuditMessage(
    postData: any,
    commentData: any,
    imageUrl?: string,
  ): string {
    const timestamp = new Date().toLocaleString("ms-MY", {
      timeZone: "Asia/Kuala_Lumpur",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    let message = `🔍 **AUDIT POST LAZADA - ${timestamp}**\n\n`;

    // Post Information Section
    message += `📱 **POST INFORMATION**\n`;
    message += `• Platform: ${postData.platform || "Unknown"}\n`;
    message += `• Post ID: ${postData.postId || "N/A"}\n`;
    message += `• Product: ${postData.productTitle || "Unknown"}\n`;
    message += `• Price: ${postData.price || "N/A"}\n`;
    message += `• Discount: ${postData.discountRate || "0%"}\n`;
    message += `• Rating: ${postData.rating || "0.0"}/5\n`;
    message += `• Stock: ${postData.stockStatus || "Unknown"}\n\n`;

    // Comment Information Section
    message += `💬 **COMMENT INFORMATION**\n`;
    message += `• Comment ID: ${commentData.commentId || "N/A"}\n`;
    message += `• Comment Text: ${commentData.commentText || "N/A"}\n`;
    message += `• Affiliate Link: ${commentData.affiliateLink || "N/A"}\n`;
    message += `• Engagement: ${commentData.engagement || "0"}\n\n`;

    // Image Information Section
    if (imageUrl) {
      message += `🖼️ **IMAGE INFORMATION**\n`;
      message += `• Image URL: ${imageUrl}\n`;
      message += `• Image Status: ✅ Available\n\n`;
    } else {
      message += `🖼️ **IMAGE INFORMATION**\n`;
      message += `• Image URL: Not available\n\n`;
    }

    // Action Buttons Section
    message += `⚡ **QUICK ACTIONS**\n`;
    message += `• /delete_post - Delete this post\n`;
    message += `• /audit_override - Manual audit override\n`;
    message += `• /view_details - View full details\n`;
    message += `• /export_data - Export audit data\n\n`;

    // Status Section
    message += `📊 **AUDIT STATUS**\n`;
    message += `• Status: ✅ COMPLETED\n`;
    message += `• Source: Lazada Live Fetcher\n`;
    message += `• Channel: Dual-Platform (X & Facebook)\n`;
    message += `• Timestamp: ${timestamp}\n`;

    return message;
  }

  /**
   * Generate inline keyboard for Telegram audit actions
   * @param postData - Post data
   * @param commentData - Comment data
   * @returns Inline keyboard markup
   */
  private generateInlineKeyboard(postData: any, commentData: any): any {
    return {
      inline_keyboard: [
        [
          {
            text: "🗑️ Delete Post",
            callback_data: `delete_post:${postData.postId || "unknown"}:${commentData.commentId || "unknown"}`,
          },
          {
            text: "🔄 Audit Override",
            callback_data: `audit_override:${postData.postId || "unknown"}:${commentData.commentId || "unknown"}`,
          },
        ],
        [
          {
            text: "👁️ View Details",
            callback_data: `view_details:${postData.postId || "unknown"}:${commentData.commentId || "unknown"}`,
          },
          {
            text: "📤 Export Data",
            callback_data: `export_data:${postData.postId || "unknown"}:${commentData.commentId || "unknown"}`,
          },
        ],
      ],
    };
  }

  /**
   * Send audit notification with image preview
   * @param postData - Post data
   * @param commentData - Comment data
   * @param imageUrl - Image URL
   * @returns Telegram message with image
   */
  async sendAuditWithImage(
    postData: any,
    commentData: any,
    imageUrl: string,
  ): Promise<any> {
    try {
      const caption = this.formatVisualAuditMessage(
        postData,
        commentData,
        imageUrl,
      );

      const telegramResponse = await this.telegram.sendPhoto(
        imageUrl,
        caption,
        {
          parseMode: "Markdown",
          replyMarkup: this.generateInlineKeyboard(postData, commentData),
        },
      );

      if (!telegramResponse) {
        throw new Error("Failed to send Telegram audit with image");
      }

      console.log(
        `Telegram audit with image sent successfully: ${telegramResponse.message_id}`,
      );
      return {
        success: true,
        messageId: telegramResponse.message_id,
        chatId: telegramResponse.chat.id,
        hasImage: true,
        postData,
        commentData,
      };
    } catch (error) {
      console.error("Error sending Telegram audit with image:", error);
      throw error;
    }
  }

  /**
   * Send emergency audit alert
   * @param postData - Post data
   * @param error - Error information
   * @returns Telegram emergency alert response
   */
  async sendEmergencyAlert(postData: any, error: string): Promise<any> {
    try {
      const emergencyMessage =
        `🚨 **EMERGENCY AUDIT ALERT** 🚨\n\n` +
        `**Post ID:** ${postData.postId || "Unknown"}\n` +
        `**Product:** ${postData.productTitle || "Unknown"}\n` +
        `**Error:** ${error}\n` +
        `**Time:** ${new Date().toLocaleString("ms-MY", { timeZone: "Asia/Kuala_Lumpur" })}\n\n` +
        `⚠️ IMMEDIATE ACTION REQUIRED\n` +
        `Please check the post status and take appropriate action.`;

      const telegramResponse = await this.telegram.sendMessage(
        emergencyMessage,
        {
          parseMode: "Markdown",
          disableWebPagePreview: true,
        },
      );

      if (!telegramResponse) {
        throw new Error("Failed to send Telegram emergency alert");
      }

      console.log(
        `Telegram emergency alert sent successfully: ${telegramResponse.message_id}`,
      );
      return {
        success: true,
        messageId: telegramResponse.message_id,
        chatId: telegramResponse.chat.id,
        isEmergency: true,
        postData,
        error,
      };
    } catch (error) {
      console.error("Error sending Telegram emergency alert:", error);
      throw error;
    }
  }

  /**
   * Get Telegram audit statistics
   * @returns Telegram audit statistics
   */
  getAuditStats(): any {
    return {
      platform: "Telegram",
      messageTypes: ["text", "photo", "emergency"],
      inlineKeyboardSupport: true,
      parseMode: "Markdown",
      rateLimit: "30 messages per minute",
      auditFeatures: [
        "visual_audit",
        "emergency_alert",
        "inline_keyboard",
        "image_preview",
        "quick_actions",
      ],
    };
  }
}
