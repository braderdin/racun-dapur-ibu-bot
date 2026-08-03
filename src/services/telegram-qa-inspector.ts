/**
 * Interactive Telegram Visual QA Audit Inspector
 * Dispatches real-time visual audit reports to Telegram containing HD WebP photo preview,
 * copywriting text for X & FB, direct live post links, affiliate shortlinks, and inline
 * keyboard controls (Emergency Delete, Audit Override).
 */

import { Env } from "../types/env";
import { GeneratedCopy } from "./vector-rag-copywriter";

export interface TelegramQAConfig {
  botToken: string;
  chatId: string;
  parseMode: "HTML" | "Markdown";
  disableWebPagePreview: boolean;
}

export interface AuditReportData {
  productId: string;
  productTitle: string;
  productImageUrl: string;
  category: string;
  price: string;
  originalPrice: string;
  discountRate: string;
  xCopy: GeneratedCopy;
  facebookCopy: GeneratedCopy;
  shortUrl: string;
  affiliateUrl: string;
  twitterPostUrl?: string;
  facebookPostUrl?: string;
  timestamp: number;
}

export interface InlineKeyboardButton {
  text: string;
  callback_data?: string;
  url?: string;
}

export interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][];
}

export interface TelegramMessageResult {
  success: boolean;
  messageId?: number;
  error?: string;
}

export class TelegramQAInspector {
  private env: Env;
  private config: TelegramQAConfig;
  private apiBaseUrl: string;

  constructor(env: Env, config?: Partial<TelegramQAConfig>) {
    this.env = env;
    this.config = {
      botToken: env.TELEGRAM_BOT_TOKEN || "",
      chatId: env.TELEGRAM_CHAT_ID || "",
      parseMode: "HTML",
      disableWebPagePreview: false,
      ...config,
    };
    this.apiBaseUrl = `https://api.telegram.org/bot${this.config.botToken}`;
  }

  /**
   * Send comprehensive visual audit report to Telegram
   * @param auditData - Audit report data
   * @returns Message result
   */
  async sendAuditReport(
    auditData: AuditReportData,
  ): Promise<TelegramMessageResult> {
    try {
      if (!this.config.botToken || !this.config.chatId) {
        throw new Error("Telegram bot token or chat ID not configured");
      }

      // Build message caption
      const caption = this.buildAuditCaption(auditData);

      // Build inline keyboard
      const keyboard = this.buildAuditKeyboard(auditData);

      // Send photo with caption and keyboard
      const result = await this.sendPhotoWithCaption(
        auditData.productImageUrl,
        caption,
        keyboard,
      );

      return result;
    } catch (error) {
      console.error("Error sending audit report:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Send emergency alert to Telegram
   * @param alertData - Alert data
   * @returns Message result
   */
  async sendEmergencyAlert(alertData: {
    type: "post_error" | "api_failure" | "rate_limit" | "critical";
    message: string;
    productId?: string;
    platform?: "twitter" | "facebook";
    details?: Record<string, any>;
  }): Promise<TelegramMessageResult> {
    try {
      const emojiMap = {
        post_error: "⚠️",
        api_failure: "🔴",
        rate_limit: "🟡",
        critical: "🚨",
      };

      const emoji = emojiMap[alertData.type] || "⚠️";
      const timestamp = new Date().toLocaleString("ms-MY", {
        timeZone: "Asia/Kuala_Lumpur",
      });

      let text = `${emoji} <b>EMERGENCY ALERT</b> ${emoji}\n\n`;
      text += `<b>Type:</b> ${alertData.type.replace("_", " ").toUpperCase()}\n`;
      text += `<b>Time:</b> ${timestamp}\n`;
      text += `<b>Message:</b> ${alertData.message}\n`;

      if (alertData.productId) {
        text += `<b>Product ID:</b> ${alertData.productId}\n`;
      }
      if (alertData.platform) {
        text += `<b>Platform:</b> ${alertData.platform.toUpperCase()}\n`;
      }
      if (alertData.details) {
        text += `<b>Details:</b> <code>${JSON.stringify(alertData.details, null, 2)}</code>\n`;
      }

      const keyboard: InlineKeyboardMarkup = {
        inline_keyboard: [
          [
            {
              text: "🔍 View Details",
              callback_data: `view_details:${alertData.productId || "unknown"}`,
            },
            {
              text: "🔄 Retry",
              callback_data: `retry:${alertData.productId || "unknown"}`,
            },
          ],
          [
            {
              text: "🛑 Emergency Stop",
              callback_data: `emergency_stop:${alertData.productId || "unknown"}`,
            },
          ],
        ],
      };

      return await this.sendMessage(text, keyboard);
    } catch (error) {
      console.error("Error sending emergency alert:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Send daily summary report
   * @param summaryData - Summary data
   * @returns Message result
   */
  async sendDailySummary(summaryData: {
    totalProducts: number;
    successfulPosts: number;
    failedPosts: number;
    totalClicks: number;
    revenue: number;
    topCategories: Array<{ category: string; count: number }>;
    errors: Array<{ productId: string; error: string }>;
  }): Promise<TelegramMessageResult> {
    try {
      const timestamp = new Date().toLocaleString("ms-MY", {
        timeZone: "Asia/Kuala_Lumpur",
      });

      let text = `📊 <b>DAILY SUMMARY REPORT</b>\n\n`;
      text += `<b>Date:</b> ${timestamp}\n\n`;
      text += `<b>📈 Performance:</b>\n`;
      text += `• Total Products: ${summaryData.totalProducts}\n`;
      text += `• Successful Posts: ${summaryData.successfulPosts}\n`;
      text += `• Failed Posts: ${summaryData.failedPosts}\n`;
      text += `• Total Clicks: ${summaryData.totalClicks}\n`;
      text += `• Est. Revenue: RM ${summaryData.revenue.toFixed(2)}\n\n`;

      text += `<b>🏆 Top Categories:</b>\n`;
      summaryData.topCategories.forEach((cat, i) => {
        text += `${i + 1}. ${cat.category}: ${cat.count} posts\n`;
      });

      if (summaryData.errors.length > 0) {
        text += `\n<b>❌ Errors:</b>\n`;
        summaryData.errors.slice(0, 5).forEach((err) => {
          text += `• ${err.productId}: ${err.error}\n`;
        });
        if (summaryData.errors.length > 5) {
          text += `... and ${summaryData.errors.length - 5} more\n`;
        }
      }

      const keyboard: InlineKeyboardMarkup = {
        inline_keyboard: [
          [
            { text: "📈 View Analytics", callback_data: "view_analytics" },
            { text: "🔄 Retry Failed", callback_data: "retry_failed" },
          ],
          [{ text: "📋 Export Report", callback_data: "export_daily_report" }],
        ],
      };

      return await this.sendMessage(text, keyboard);
    } catch (error) {
      console.error("Error sending daily summary:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Build audit report caption
   * @param data - Audit data
   * @returns Formatted caption
   */
  private buildAuditCaption(data: AuditReportData): string {
    const timestamp = new Date(data.timestamp).toLocaleString("ms-MY", {
      timeZone: "Asia/Kuala_Lumpur",
    });

    let caption = `🔍 <b>VISUAL QA AUDIT REPORT</b>\n\n`;
    caption += `<b>📦 Product:</b> ${data.productTitle}\n`;
    caption += `<b>🆔 ID:</b> <code>${data.productId}</code>\n`;
    caption += `<b>🏷️ Category:</b> ${data.category}\n`;
    caption += `<b>💰 Price:</b> ${data.price} <s>${data.originalPrice}</s> (${data.discountRate} OFF)\n\n`;

    caption += `<b>🐦 X (TWITTER) COPY:</b>\n`;
    caption += `<i>Hook:</i> ${data.xCopy.hook}\n`;
    caption += `<i>CTA:</i> ${data.xCopy.cta}\n`;
    caption += `<i>Cultural:</i> ${data.xCopy.culturalAdaptation}\n\n`;

    caption += `<b>📘 FACEBOOK COPY:</b>\n`;
    caption += `<i>Hook:</i> ${data.facebookCopy.hook}\n`;
    caption += `<i>CTA:</i> ${data.facebookCopy.cta}\n`;
    caption += `<i>Cultural:</i> ${data.facebookCopy.culturalAdaptation}\n\n`;

    caption += `<b>🔗 LINKS:</b>\n`;
    caption += `• Short: ${data.shortUrl}\n`;
    caption += `• Original: <code>${data.affiliateUrl}</code>\n`;

    if (data.twitterPostUrl) {
      caption += `• X Post: ${data.twitterPostUrl}\n`;
    }
    if (data.facebookPostUrl) {
      caption += `• FB Post: ${data.facebookPostUrl}\n`;
    }

    caption += `\n<b>⏰ Audit Time:</b> ${timestamp}`;

    return caption;
  }

  /**
   * Build inline keyboard for audit actions
   * @param data - Audit data
   * @returns Inline keyboard markup
   */
  private buildAuditKeyboard(data: AuditReportData): InlineKeyboardMarkup {
    const keyboard: InlineKeyboardButton[][] = [
      [
        {
          text: "🗑️ Emergency Delete X",
          callback_data: `delete_post:twitter:${data.productId}`,
        },
        {
          text: "🗑️ Emergency Delete FB",
          callback_data: `delete_post:facebook:${data.productId}`,
        },
      ],
      [
        {
          text: "✅ Audit Override",
          callback_data: `audit_override:${data.productId}`,
        },
        {
          text: "🔗 View Shortlink",
          callback_data: `view_shortlink:${data.productId}`,
        },
      ],
      [
        {
          text: "📊 View Analytics",
          callback_data: `view_analytics:${data.productId}`,
        },
        {
          text: "📤 Export Data",
          callback_data: `export_data:${data.productId}`,
        },
      ],
    ];

    // Add live post links if available
    if (data.twitterPostUrl || data.facebookPostUrl) {
      const linkRow: InlineKeyboardButton[] = [];
      if (data.twitterPostUrl) {
        linkRow.push({ text: "🐦 View X Post", url: data.twitterPostUrl });
      }
      if (data.facebookPostUrl) {
        linkRow.push({ text: "📘 View FB Post", url: data.facebookPostUrl });
      }
      keyboard.push(linkRow);
    }

    return { inline_keyboard: keyboard };
  }

  /**
   * Send photo with caption and keyboard
   * @param photoUrl - Photo URL
   * @param caption - Caption text
   * @param keyboard - Inline keyboard
   * @returns Message result
   */
  private async sendPhotoWithCaption(
    photoUrl: string,
    caption: string,
    keyboard: InlineKeyboardMarkup,
  ): Promise<TelegramMessageResult> {
    try {
      const formData = new FormData();
      formData.append("chat_id", this.config.chatId);
      formData.append("photo", photoUrl);
      formData.append("caption", caption);
      formData.append("parse_mode", this.config.parseMode);
      formData.append(
        "disable_web_page_preview",
        this.config.disableWebPagePreview.toString(),
      );
      formData.append("reply_markup", JSON.stringify(keyboard));

      const response = await fetch(`${this.apiBaseUrl}/sendPhoto`, {
        method: "POST",
        body: formData,
        signal: AbortSignal.timeout(15000),
      });

      const result: { ok: boolean; result?: { message_id: number }; description?: string } = await response.json();

      if (!response.ok) {
        throw new Error(`Telegram API error: ${result.description}`);
      }

      return {
        success: true,
        messageId: result.result?.message_id,
      };
    } catch (error) {
      console.error("Error sending photo:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Send text message with keyboard
   * @param text - Message text
   * @param keyboard - Inline keyboard
   * @returns Message result
   */
  private async sendMessage(
    text: string,
    keyboard?: InlineKeyboardMarkup,
  ): Promise<TelegramMessageResult> {
    try {
      const body: Record<string, any> = {
        chat_id: this.config.chatId,
        text,
        parse_mode: this.config.parseMode,
        disable_web_page_preview: this.config.disableWebPagePreview,
      };

      if (keyboard) {
        body.reply_markup = JSON.stringify(keyboard);
      }

      const response = await fetch(`${this.apiBaseUrl}/sendMessage`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10000),
      });

      const result: { ok: boolean; result?: { message_id: number }; description?: string } = await response.json();

      if (!response.ok) {
        throw new Error(`Telegram API error: ${result.description}`);
      }

      return {
        success: true,
        messageId: result.result?.message_id,
      };
    } catch (error) {
      console.error("Error sending message:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Edit message caption
   * @param messageId - Message ID
   * @param caption - New caption
   * @param keyboard - New keyboard
   * @returns Success status
   */
  async editMessageCaption(
    messageId: number,
    caption: string,
    keyboard?: InlineKeyboardMarkup,
  ): Promise<boolean> {
    try {
      const body: Record<string, any> = {
        chat_id: this.config.chatId,
        message_id: messageId,
        caption,
        parse_mode: this.config.parseMode,
      };

      if (keyboard) {
        body.reply_markup = JSON.stringify(keyboard);
      }

      const response = await fetch(`${this.apiBaseUrl}/editMessageCaption`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10000),
      });

      const result: { ok: boolean } = await response.json();
      return response.ok && result.ok;
    } catch (error) {
      console.error("Error editing message caption:", error);
      return false;
    }
  }

  /**
   * Delete message
   * @param messageId - Message ID
   * @returns Success status
   */
  async deleteMessage(messageId: number): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/deleteMessage`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: this.config.chatId,
          message_id: messageId,
        }),
        signal: AbortSignal.timeout(5000),
      });

      const result: { ok: boolean } = await response.json();
      return response.ok && result.ok;
    } catch (error) {
      console.error("Error deleting message:", error);
      return false;
    }
  }

  /**
   * Answer callback query
   * @param callbackQueryId - Callback query ID
   * @param text - Answer text
   * @param showAlert - Show as alert
   * @returns Success status
   */
  async answerCallbackQuery(
    callbackQueryId: string,
    text: string,
    showAlert: boolean = false,
  ): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/answerCallbackQuery`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          callback_query_id: callbackQueryId,
          text,
          show_alert: showAlert,
        }),
        signal: AbortSignal.timeout(5000),
      });

      const result: { ok: boolean } = await response.json();
      return response.ok && result.ok;
    } catch (error) {
      console.error("Error answering callback query:", error);
      return false;
    }
  }
}
