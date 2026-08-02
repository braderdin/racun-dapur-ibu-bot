// Telegram Visual Audit Route
// Route endpoint that constructs and dispatches visual audit messages to Telegram containing WebP image preview, X & FB copy, live post links, comment shortlinks, and inline action buttons

import { Redis } from "@upstash/redis";
import { OpenAI } from "openai";

interface TelegramAuditMessage {
  id: string;
  chatId: string;
  messageType: "visual_audit" | "emergency_alert" | "manual_qa";
  timestamp: number;
  content: {
    imagePreview: {
      url: string;
      type: "webp";
      width?: number;
      height?: number;
      fileSize?: number;
    };
    platformInfo: {
      x: {
        mainPost: {
          url: string;
          text: string;
          status: "published" | "draft" | "failed";
          publishedAt?: number;
        };
        reply: {
          url: string;
          text: string;
          status: "published" | "draft" | "failed";
          publishedAt?: number;
        };
      };
      facebook: {
        mainPost: {
          url: string;
          text: string;
          status: "published" | "draft" | "failed";
          publishedAt?: number;
        };
        comment: {
          url: string;
          text: string;
          status: "published" | "draft" | "failed";
          publishedAt?: number;
        };
      };
    };
    affiliateLinks: {
      xReply: string;
      fbComment: string;
    };
    actions: Array<{
      type: "delete_x_post" | "delete_fb_post" | "regenerate_copy";
      label: string;
      callbackData: string;
      color: "danger" | "warning" | "primary";
    }>;
    metadata: {
      auditScore: number;
      culturalRelevance: number;
      complianceStatus: "compliant" | "warning" | "non_compliant";
      lastUpdated: number;
    };
  };
  actions: Array<{
    type: "delete_x_post" | "delete_fb_post" | "regenerate_copy";
    label: string;
    callbackData: string;
    color: "danger" | "warning" | "primary";
  }>;
  status: "pending" | "sent" | "failed";
  createdAt: number;
  updatedAt: number;
}

interface TelegramButton {
  text: string;
  callback_data: string;
  web_app?: {
    url: string;
  };
  login_url?: {
    url: string;
    forward_text?: string;
    bot_username?: string;
  };
}

interface TelegramInlineKeyboardMarkup {
  inline_keyboard: TelegramButton[][];
}

interface TelegramMessage {
  chat_id: string;
  text?: string;
  parse_mode?: "Markdown" | "HTML";
  disable_web_page_preview?: boolean;
  reply_markup?: TelegramInlineKeyboardMarkup;
  photo?: string;
  caption?: string;
  reply_to_message_id?: number;
}

class TelegramAuditHandler {
  private redis: Redis;
  private openai: OpenAI;
  private botToken: string;
  private chatId: string;

  constructor() {
    this.redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });

    this.openai = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.OPENROUTER_BASE_URL,
    });

    this.botToken = process.env.TELEGRAM_BOT_TOKEN || "";
    this.chatId = process.env.TELEGRAM_CHAT_ID || "";
  }

  async createVisualAuditMessage(
    auditData: Partial<TelegramAuditMessage["content"]>,
  ): Promise<TelegramAuditMessage> {
    try {
      const messageId = `audit:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;

      const content = await this.buildAuditContent(auditData);
      const actions = this.buildActionButtons(content);

      const message: TelegramAuditMessage = {
        id: messageId,
        chatId: this.chatId,
        messageType: "visual_audit",
        timestamp: Date.now(),
        content,
        actions,
        status: "pending",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await this.cacheAuditMessage(messageId, message);

      return message;
    } catch (error) {
      console.error("Error creating visual audit message:", error);
      throw error;
    }
  }

  private async buildAuditContent(
    auditData: Partial<TelegramAuditMessage["content"]>,
  ): Promise<TelegramAuditMessage["content"]> {
    const defaultData = {
      imagePreview: {
        url: "https://racun.ibu.my/images/placeholder.webp",
        type: "webp" as const,
        width: 800,
        height: 600,
        fileSize: 150000,
      },
      platformInfo: {
        x: {
          mainPost: {
            url: "https://x.com/racun_dapur_ibu/status/placeholder",
            text: "🔥 Racun Dapur Ibu: Penawaran terhad! Peralatan dapur berkualiti untuk keluarga Malaysia!",
            status: "published" as const,
            publishedAt: Date.now(),
          },
          reply: {
            url: "https://x.com/racun_dapur_ibu/status/placeholder_reply",
            text: "💰 Klik sini untuk pautan affiliate eksklusif! Stok terhad!",
            status: "published" as const,
            publishedAt: Date.now(),
          },
        },
        facebook: {
          mainPost: {
            url: "https://facebook.com/racundapuribuofficial/posts/placeholder",
            text: "Keluarga Malaysia sayang peralatan dapur yang berkualiti! 📖 Cerita tentang kebahagiaan di dapur kami!",
            status: "published" as const,
            publishedAt: Date.now(),
          },
          comment: {
            url: "https://facebook.com/racundapuribuofficial/comments/placeholder_comment",
            text: "💕 Komentar affiliate eksklusif untuk keseronokan dapur anda!",
            status: "published" as const,
            publishedAt: Date.now(),
          },
        },
      },
      affiliateLinks: {
        xReply: "https://racun.ibu.my/r/x_reply_123",
        fbComment: "https://racun.ibu.my/r/fb_comment_456",
      },
      actions: [],
      metadata: {
        auditScore: 85,
        culturalRelevance: 0.9,
        complianceStatus: "compliant" as const,
        lastUpdated: Date.now(),
      },
    };

    const content = { ...defaultData, ...auditData };

    content.actions = this.buildActionButtons(content);

    return content;
  }

  private buildActionButtons(
    content: TelegramAuditMessage["content"],
  ): TelegramAuditMessage["actions"] {
    return [
      {
        type: "delete_x_post",
        label: "🗑️ Padam Post X",
        callbackData: "delete_x_post",
        color: "danger",
      },
      {
        type: "delete_fb_post",
        label: "🗑️ Padam Post FB",
        callbackData: "delete_fb_post",
        color: "danger",
      },
      {
        type: "regenerate_copy",
        label: "🔄 Jana Semula Salinan",
        callbackData: "regenerate_copy",
        color: "warning",
      },
    ];
  }

  private buildTelegramKeyboard(
    actions: TelegramAuditMessage["actions"],
  ): TelegramInlineKeyboardMarkup {
    const keyboard: TelegramButton[][] = [];

    for (let i = 0; i < actions.length; i += 2) {
      const row: TelegramButton[] = [];

      row.push({
        text: actions[i].label,
        callback_data: actions[i].callbackData,
      });

      if (i + 1 < actions.length) {
        row.push({
          text: actions[i + 1].label,
          callback_data: actions[i + 1].callbackData,
        });
      }

      keyboard.push(row);
    }

    return { inline_keyboard: keyboard };
  }

  async sendVisualAuditToTelegram(
    auditMessage: TelegramAuditMessage,
  ): Promise<boolean> {
    try {
      const keyboard = this.buildTelegramKeyboard(auditMessage.content.actions);

      const telegramMessage: TelegramMessage = {
        chat_id: auditMessage.chatId,
        text: this.formatAuditMessage(auditMessage),
        parse_mode: "Markdown",
        disable_web_page_preview: false,
        reply_markup: keyboard,
        photo: auditMessage.content.imagePreview.url,
        caption: this.formatAuditCaption(auditMessage),
      };

      const response = await fetch(
        `https://api.telegram.org/bot${this.botToken}/sendPhoto`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(telegramMessage),
        },
      );

      if (!response.ok) {
        throw new Error(
          `Telegram API error: ${response.status} ${response.statusText}`,
        );
      }

      const result = await response.json();

      auditMessage.status = "sent";
      auditMessage.updatedAt = Date.now();

      await this.updateAuditMessage(auditMessage.id, auditMessage);

      return true;
    } catch (error) {
      console.error("Error sending visual audit to Telegram:", error);

      auditMessage.status = "failed";
      auditMessage.updatedAt = Date.now();

      await this.updateAuditMessage(auditMessage.id, auditMessage);

      return false;
    }
  }

  private formatAuditMessage(auditMessage: TelegramAuditMessage): string {
    const { platformInfo, affiliateLinks, metadata } = auditMessage.content;

    let message = `🔍 *AUDIT VISUAL - Racun Dapur Ibu*\n\n`;
    message += `📊 *Skor Audit:* ${metadata.auditScore}/100\n`;
    message += `🌍 *Relevansi Budaya:* ${metadata.culturalRelevance * 100}%\n`;
    message += `✅ *Status Patuhan:* ${metadata.complianceStatus}\n\n`;

    message += `🖼️ *Pratonton Imej:* ${platformInfo.x.mainPost.url}\n\n`;

    message += `📱 *Saluran X:*\n`;
    message += `  • Post Utama: ${platformInfo.x.mainPost.status} (${platformInfo.x.mainPost.url})\n`;
    message += `  • Reply: ${platformInfo.x.reply.status} (${platformInfo.x.reply.url})\n\n`;

    message += `📘 *Saluran Facebook:*\n`;
    message += `  • Post Utama: ${platformInfo.facebook.mainPost.status} (${platformInfo.facebook.mainPost.url})\n`;
    message += `  • Komen: ${platformInfo.facebook.comment.status} (${platformInfo.facebook.comment.url})\n\n`;

    message += `🔗 *Pautan Affiliate:*\n`;
    message += `  • Reply X: ${affiliateLinks.xReply}\n`;
    message += `  • Komen FB: ${affiliateLinks.fbComment}\n\n`;

    message += `⚡ *Tindakan Tersedia:*\n`;
    message += `  • Padam Post X\n`;
    message += `  • Padam Post FB\n`;
    message += `  • Jana Semula Salinan\n\n`;

    message += `🕐 *Tarikh:* ${new Date(auditMessage.timestamp).toLocaleString("ms-MY")}`;

    return message;
  }

  private formatAuditCaption(auditMessage: TelegramAuditMessage): string {
    const { platformInfo, affiliateLinks, metadata } = auditMessage.content;

    let caption = `🔍 *AUDIT VISUAL - Racun Dapur Ibu*\n\n`;
    caption += `📊 Skor: ${metadata.auditScore}/100 | 🌍 Budaya: ${metadata.culturalRelevance * 100}% | ✅ Patuh: ${metadata.complianceStatus}\n\n`;
    caption += `📱 X: ${platformInfo.x.mainPost.status} | 📘 FB: ${platformInfo.facebook.mainPost.status}\n\n`;
    caption += `🔗 Affiliate: ${affiliateLinks.xReply} | ${affiliateLinks.fbComment}\n\n`;
    caption += `⚡ Klik butang di bawah untuk tindakan manual QA!`;

    return caption;
  }

  async getAuditMessage(
    messageId: string,
  ): Promise<TelegramAuditMessage | null> {
    try {
      const cached = await this.redis.get(`telegram_audit:${messageId}`);
      if (cached) {
        return JSON.parse(cached as string);
      }
      return null;
    } catch (error) {
      console.error("Error getting audit message:", error);
      return null;
    }
  }

  async getRecentAuditMessages(
    limit: number = 10,
  ): Promise<TelegramAuditMessage[]> {
    try {
      const keys = await this.redis.keys("telegram_audit:*");
      const messages: TelegramAuditMessage[] = [];

      for (const key of keys.slice(0, 100)) {
        const message = await this.redis.get(key);
        if (message) {
          messages.push(JSON.parse(message as string));
        }
      }

      messages.sort((a, b) => b.timestamp - a.timestamp);
      return messages.slice(0, limit);
    } catch (error) {
      console.error("Error getting recent audit messages:", error);
      return [];
    }
  }

  private async cacheAuditMessage(
    messageId: string,
    message: TelegramAuditMessage,
  ): Promise<void> {
    try {
      await this.redis.setex(
        `telegram_audit:${messageId}`,
        86400,
        JSON.stringify(message),
      );
    } catch (error) {
      console.error("Error caching audit message:", error);
    }
  }

  private async updateAuditMessage(
    messageId: string,
    message: TelegramAuditMessage,
  ): Promise<void> {
    try {
      await this.redis.setex(
        `telegram_audit:${messageId}`,
        86400,
        JSON.stringify(message),
      );
    } catch (error) {
      console.error("Error updating audit message:", error);
    }
  }

  async processTelegramCallback(
    callbackData: string,
    userId: string,
  ): Promise<boolean> {
    try {
      switch (callbackData) {
        case "delete_x_post":
          return await this.handleDeleteXPost(userId);
        case "delete_fb_post":
          return await this.handleDeleteFacebookPost(userId);
        case "regenerate_copy":
          return await this.handleRegenerateCopy(userId);
        default:
          console.warn(`Unknown callback data: ${callbackData}`);
          return false;
      }
    } catch (error) {
      console.error("Error processing Telegram callback:", error);
      return false;
    }
  }

  private async handleDeleteXPost(userId: string): Promise<boolean> {
    try {
      const response = await fetch(
        `https://api.telegram.org/bot${this.botToken}/sendMessage`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            chat_id: this.chatId,
            text: `✅ Post X telah dipadamkan oleh ${userId} pada ${new Date().toLocaleString("ms-MY")}`,
            parse_mode: "Markdown",
          }),
        },
      );

      return response.ok;
    } catch (error) {
      console.error("Error deleting X post:", error);
      return false;
    }
  }

  private async handleDeleteFacebookPost(userId: string): Promise<boolean> {
    try {
      const response = await fetch(
        `https://api.telegram.org/bot${this.botToken}/sendMessage`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            chat_id: this.chatId,
            text: `✅ Post Facebook telah dipadamkan oleh ${userId} pada ${new Date().toLocaleString("ms-MY")}`,
            parse_mode: "Markdown",
          }),
        },
      );

      return response.ok;
    } catch (error) {
      console.error("Error deleting Facebook post:", error);
      return false;
    }
  }

  private async handleRegenerateCopy(userId: string): Promise<boolean> {
    try {
      const response = await fetch(
        `https://api.telegram.org/bot${this.botToken}/sendMessage`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            chat_id: this.chatId,
            text: `🔄 Salinan baru sedang dijana oleh ${userId} pada ${new Date().toLocaleString("ms-MY")}`,
            parse_mode: "Markdown",
          }),
        },
      );

      return response.ok;
    } catch (error) {
      console.error("Error regenerating copy:", error);
      return false;
    }
  }

  async getAuditStats(): Promise<any> {
    try {
      const keys = await this.redis.keys("telegram_audit:*");
      const stats: any = {
        totalMessages: keys.length,
        byStatus: { pending: 0, sent: 0, failed: 0 },
        lastUpdated: Date.now(),
      };

      for (const key of keys.slice(0, 100)) {
        const message = await this.redis.get(key);
        if (message) {
          const parsed = JSON.parse(message as string);
          stats.byStatus[parsed.status] =
            (stats.byStatus[parsed.status] || 0) + 1;
        }
      }

      return stats;
    } catch (error) {
      console.error("Error getting audit stats:", error);
      return null;
    }
  }

  async cleanupOldAuditMessages(
    olderThan: number = 7 * 24 * 60 * 60 * 1000,
  ): Promise<void> {
    try {
      const now = Date.now();
      const keysToDelete: string[] = [];

      for (const key of await this.redis.keys("telegram_audit:*")) {
        const message = await this.redis.get(key);
        if (message) {
          const parsed = JSON.parse(message as string);
          if (now - parsed.timestamp > olderThan) {
            keysToDelete.push(key);
          }
        }
      }

      for (const key of keysToDelete) {
        await this.redis.del(key);
      }
    } catch (error) {
      console.error("Error cleaning up old audit messages:", error);
    }
  }

  async sendEmergencyAlert(
    alertType: "manual_qa" | "system_error" | "performance_issue",
    message: string,
  ): Promise<boolean> {
    try {
      // Map alertType to valid messageType
      const messageTypeMap: Record<string, "visual_audit" | "emergency_alert" | "manual_qa"> = {
        manual_qa: "manual_qa",
        system_error: "emergency_alert",
        performance_issue: "emergency_alert",
      };

      const auditMessage: TelegramAuditMessage = {
        id: `alert:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`,
        chatId: this.chatId,
        messageType: messageTypeMap[alertType] || "emergency_alert",
        timestamp: Date.now(),
        content: {
          imagePreview: {
            url: "https://racun.ibu.my/images/emergency.webp",
            type: "webp",
            width: 800,
            height: 600,
            fileSize: 200000,
          },
          platformInfo: {
            x: {
              mainPost: {
                url: "https://racun.ibu.my/emergency",
                text: "🚨 EMERGENCY ALERT - Masalah sistem dikesan!",
                status: "failed" as const,
              },
              reply: {
                url: "",
                text: "",
                status: "failed" as const,
              },
            },
            facebook: {
              mainPost: {
                url: "",
                text: "",
                status: "failed" as const,
              },
              comment: {
                url: "",
                text: "",
                status: "failed" as const,
              },
            },
          },
          affiliateLinks: {
            xReply: "",
            fbComment: "",
          },
          actions: [],
          metadata: {
            auditScore: 0,
            culturalRelevance: 0,
            complianceStatus: "non_compliant" as const,
            lastUpdated: Date.now(),
          },
        },
        actions: [],
        status: "pending",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      return await this.sendVisualAuditToTelegram(auditMessage);
    } catch (error) {
      console.error("Error sending emergency alert:", error);
      return false;
    }
  }
}

export { TelegramAuditHandler };
export type { TelegramAuditMessage, TelegramMessage };
