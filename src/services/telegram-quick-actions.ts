// Telegram Quick Actions Handler
// Process interactive inline button callbacks from Telegram (e.g. `Delete X Post`, `Delete FB Post`, `Regenerate Copy`) for manual QA control

import { Redis } from "@upstash/redis";
import { OpenAI } from "openai";

interface TelegramCallback {
  id: string;
  userId: string;
  chatId: string;
  callbackData: string;
  messageId: string;
  timestamp: number;
  status: "pending" | "processing" | "completed" | "failed";
  metadata: {
    postId?: string;
    platform?: "x" | "facebook";
    actionType?:
      | "delete_x_post"
      | "delete_fb_post"
      | "regenerate_copy"
      | "rate_pos"
      | "rate_neg"
      | "regen_ai"
      | "autofix_ai"
      | "view_ai_audit";
    originalMessage?: string;
    generatedCopy?: string;
    chipBesarRating?: "positive" | "negative" | "neutral";
  };
  createdAt: number;
  updatedAt: number;
}

interface QuickActionResult {
  success: boolean;
  action: string;
  message: string;
  postId?: string;
  generatedCopy?: string;
  timestamp: number;
}

interface PostInfo {
  id: string;
  platform: "x" | "facebook";
  url: string;
  content: string;
  status: "published" | "draft" | "failed";
  publishedAt?: number;
}

class TelegramQuickActions {
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

  async processCallback(
    callbackData: string,
    userId: string,
    chatId: string,
    messageId: string,
  ): Promise<QuickActionResult> {
    try {
      const callbackId = `callback:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;

      const callback: TelegramCallback = {
        id: callbackId,
        userId,
        chatId,
        callbackData,
        messageId,
        timestamp: Date.now(),
        status: "processing",
        metadata: {
          actionType: this.parseCallbackData(callbackData),
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await this.cacheCallback(callbackId, callback);

      const result = await this.executeAction(callback);

      callback.status = result.success ? "completed" : "failed";
      callback.updatedAt = Date.now();

      await this.updateCallback(callbackId, callback);

      return result;
    } catch (error) {
      console.error("Error processing Telegram callback:", error);
      return {
        success: false,
        action: callbackData,
        message: `Error processing action: ${error instanceof Error ? error.message : "Unknown error"}`,
        timestamp: Date.now(),
      };
    }
  }

  private parseCallbackData(
    callbackData: string,
  ):
    | "delete_x_post"
    | "delete_fb_post"
    | "regenerate_copy"
    | "rate_pos"
    | "rate_neg"
    | "regen_ai"
    | "autofix_ai"
    | "view_ai_audit"
    | undefined {
    const validActions = [
      "delete_x_post",
      "delete_fb_post",
      "regenerate_copy",
      "rate_pos",
      "rate_neg",
      "regen_ai",
      "autofix_ai",
      "view_ai_audit",
    ];
    return validActions.includes(callbackData)
      ? (callbackData as any)
      : undefined;
  }

  // Generate inline keyboard rating buttons for AI copywriting feedback
  generateRatingInlineKeyboard(dealId: string): any {
    return {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "👍 Ayat Padu", callback_data: `cb:rate_pos:${dealId}` },
            {
              text: "👎 Kurang Menyengat",
              callback_data: `cb:rate_neg:${dealId}`,
            },
          ],
          [
            {
              text: "🔄 Re-generate AI",
              callback_data: `cb:regen_ai:${dealId}`,
            },
          ],
          [
            {
              text: "🛠️ Auto-Betulkan AI",
              callback_data: `cb:autofix_ai:${dealId}`,
            },
            {
              text: "📝 Lihat Audit AI",
              callback_data: `cb:view_ai_audit:${dealId}`,
            },
          ],
        ],
      },
    };
  }

  // Parse callback data with deal ID (format: cb:action:dealId)
  private parseDetailedCallbackData(
    callbackData: string,
  ): { action: string; dealId: string } | null {
    if (!callbackData.startsWith("cb:")) return null;
    const parts = callbackData.split(":");
    if (parts.length !== 3) return null;
    return { action: parts[1], dealId: parts[2] };
  }

  private async executeAction(
    callback: TelegramCallback,
  ): Promise<QuickActionResult> {
    const action = callback.metadata.actionType;

    switch (action) {
      case "delete_x_post":
        return await this.handleDeleteXPost(callback);
      case "delete_fb_post":
        return await this.handleDeleteFacebookPost(callback);
      case "regenerate_copy":
        return await this.handleRegenerateCopy(callback);
      case "rate_pos":
        return await this.handlePositiveRating(callback);
      case "rate_neg":
        return await this.handleNegativeRating(callback);
      case "regen_ai":
        return await this.handleRegenerateAI(callback);
      case "autofix_ai":
        return await this.handleAutoFixAI(callback);
      case "view_ai_audit":
        return await this.handleViewAIAudit(callback);
      default:
        return {
          success: false,
          action: action || "unknown",
          message: "Unknown action type",
          timestamp: Date.now(),
        };
    }
  }

  // Handle auto-fix AI request - re-runs generation with stricter tone constraints
  private async handleAutoFixAI(
    callback: TelegramCallback,
  ): Promise<QuickActionResult> {
    try {
      const dealId = callback.metadata.postId || "unknown";

      // Log autofix request
      await this.logAction(callback.userId, "autofix_ai", dealId);

      // Store request for AI to process with stricter tone constraints
      await this.redis.hset(`autofix_request:${dealId}`, {
        dealId,
        timestamp: Date.now(),
        userId: callback.userId,
        status: "pending",
        toneConstraints: "strict_malaysian",
      });

      return {
        success: true,
        action: "autofix_ai",
        message: `AI copywriting untuk deal ${dealId} sedang diproses dengan nada Malay yang ketat. Sila tunggu sebentar...`,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error("Error handling auto-fix AI:", error);
      return {
        success: false,
        action: "autofix_ai",
        message: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        timestamp: Date.now(),
      };
    }
  }

  // Handle view AI audit request - shows detailed latency, hallucination score, and model metadata
  private async handleViewAIAudit(
    callback: TelegramCallback,
  ): Promise<QuickActionResult> {
    try {
      const dealId = callback.metadata.postId || "unknown";

      // Retrieve AI audit data from Redis
      const auditKey = `ai_audit:${dealId}`;
      const auditData = await this.redis.get(auditKey);

      if (!auditData) {
        return {
          success: true,
          action: "view_ai_audit",
          message: `Tiada data audit AI untuk deal ${dealId}. Audit pertama kali atau data telah lalui TTL.`,
          timestamp: Date.now(),
        };
      }

      const audit = JSON.parse(auditData as string);

      // Format audit report
      const report = [
        `📊 *Audit AI untuk Deal ${dealId}*`,
        ``,
        `*Latency:* ${audit.latency ? audit.latency + "ms" : "N/A"}`,
        `*Model:* ${audit.model || "openrouter/free"}`,
        `*Hallucination Score:* ${(audit.hallucinationScore * 100).toFixed(1)}%`,
        `*Cultural Fit Score:* ${(audit.culturalFitScore * 100).toFixed(1)}%`,
        `*Tokens:* ${audit.tokens ? `${audit.tokens.prompt}/${audit.tokens.completion}` : "N/A"}`,
        `*Timestamp:* ${new Date(audit.timestamp).toLocaleString("ms_MY")}`,
      ].join("\n");

      // Log view audit action
      await this.logAction(callback.userId, "view_ai_audit", dealId);

      return {
        success: true,
        action: "view_ai_audit",
        message: report,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error("Error handling view AI audit:", error);
      return {
        success: false,
        action: "view_ai_audit",
        message: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        timestamp: Date.now(),
      };
    }
  }

  private async handleDeleteXPost(
    callback: TelegramCallback,
  ): Promise<QuickActionResult> {
    try {
      const postId = callback.metadata.postId;
      if (!postId) {
        return {
          success: false,
          action: "delete_x_post",
          message: "Post ID not found",
          timestamp: Date.now(),
        };
      }

      const postInfo = await this.getPostInfo(postId);
      if (!postInfo) {
        return {
          success: false,
          action: "delete_x_post",
          message: "Post not found",
          timestamp: Date.now(),
        };
      }

      const deleteResult = await this.deleteXPost(postInfo.id);
      if (!deleteResult.success) {
        return deleteResult;
      }

      await this.logAction(callback.userId, "delete_x_post", postInfo.id);

      return {
        success: true,
        action: "delete_x_post",
        message: `Post X ${postInfo.id} has been deleted successfully`,
        postId: postInfo.id,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error("Error deleting X post:", error);
      return {
        success: false,
        action: "delete_x_post",
        message: `Error deleting X post: ${error instanceof Error ? error.message : "Unknown error"}`,
        timestamp: Date.now(),
      };
    }
  }

  private async handleDeleteFacebookPost(
    callback: TelegramCallback,
  ): Promise<QuickActionResult> {
    try {
      const postId = callback.metadata.postId;
      if (!postId) {
        return {
          success: false,
          action: "delete_fb_post",
          message: "Post ID not found",
          timestamp: Date.now(),
        };
      }

      const postInfo = await this.getPostInfo(postId);
      if (!postInfo) {
        return {
          success: false,
          action: "delete_fb_post",
          message: "Post not found",
          timestamp: Date.now(),
        };
      }

      const deleteResult = await this.deleteFacebookPost(postInfo.id);
      if (!deleteResult.success) {
        return deleteResult;
      }

      await this.logAction(callback.userId, "delete_fb_post", postInfo.id);

      return {
        success: true,
        action: "delete_fb_post",
        message: `Post Facebook ${postInfo.id} has been deleted successfully`,
        postId: postInfo.id,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error("Error deleting Facebook post:", error);
      return {
        success: false,
        action: "delete_fb_post",
        message: `Error deleting Facebook post: ${error instanceof Error ? error.message : "Unknown error"}`,
        timestamp: Date.now(),
      };
    }
  }

  private async handleRegenerateCopy(
    callback: TelegramCallback,
  ): Promise<QuickActionResult> {
    try {
      const postId = callback.metadata.postId;
      if (!postId) {
        return {
          success: false,
          action: "regenerate_copy",
          message: "Post ID not found",
          timestamp: Date.now(),
        };
      }

      const postInfo = await this.getPostInfo(postId);
      if (!postInfo) {
        return {
          success: false,
          action: "regenerate_copy",
          message: "Post not found",
          timestamp: Date.now(),
        };
      }

      const generatedCopy = await this.generateNewCopy(postInfo);

      await this.logAction(callback.userId, "regenerate_copy", postInfo.id);

      return {
        success: true,
        action: "regenerate_copy",
        message: `New copy generated for post ${postInfo.id}`,
        postId: postInfo.id,
        generatedCopy,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error("Error regenerating copy:", error);
      return {
        success: false,
        action: "regenerate_copy",
        message: `Error regenerating copy: ${error instanceof Error ? error.message : "Unknown error"}`,
        timestamp: Date.now(),
      };
    }
  }

  private async getPostInfo(postId: string): Promise<PostInfo | null> {
    try {
      const cacheKey = `post:${postId}`;
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached as string);
      }

      return null;
    } catch (error) {
      console.error("Error getting post info:", error);
      return null;
    }
  }

  private async deleteXPost(postId: string): Promise<QuickActionResult> {
    try {
      const response = await fetch(
        `https://api.twitter.com/2/tweets/${postId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${process.env.X_API_BEARER_TOKEN}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        throw new Error(
          `X API error: ${response.status} ${response.statusText}`,
        );
      }

      return {
        success: true,
        action: "delete_x_post",
        message: `X post ${postId} deleted successfully`,
        postId,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error("Error deleting X post via API:", error);
      return {
        success: false,
        action: "delete_x_post",
        message: `X API error: ${error instanceof Error ? error.message : "Unknown error"}`,
        postId,
        timestamp: Date.now(),
      };
    }
  }

  private async deleteFacebookPost(postId: string): Promise<QuickActionResult> {
    try {
      const response = await fetch(
        `${process.env.META_GRAPH_API_URL}/${postId}?access_token=${process.env.FACEBOOK_PAGE_ACCESS_TOKEN}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        throw new Error(
          `Facebook Graph API error: ${response.status} ${response.statusText}`,
        );
      }

      return {
        success: true,
        action: "delete_fb_post",
        message: `Facebook post ${postId} deleted successfully`,
        postId,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error("Error deleting Facebook post via API:", error);
      return {
        success: false,
        action: "delete_fb_post",
        message: `Facebook Graph API error: ${error instanceof Error ? error.message : "Unknown error"}`,
        postId,
        timestamp: Date.now(),
      };
    }
  }

  private async generateNewCopy(postInfo: PostInfo): Promise<string> {
    try {
      const systemPrompt = `You are a Malaysian marketing copywriter. Generate new, engaging copy for ${postInfo.platform} post about ${postInfo.content}. Use warm, friendly Malaysian tone and focus on family values and quality products. Keep it concise and compelling.`;

      const userPrompt = `Generate new copy for ${postInfo.platform} post. Original content: ${postInfo.content}. Return only the new copy text.`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "text" },
        max_tokens: 200,
      });

      return response.choices[0].message.content?.trim() || "";
    } catch (error) {
      console.error("Error generating new copy:", error);
      throw error;
    }
  }

  // Handle positive rating from Chip Besar
  private async handlePositiveRating(
    callback: TelegramCallback,
  ): Promise<QuickActionResult> {
    try {
      const dealId = callback.metadata.postId || "unknown";
      const rating = "positive";

      // Store rating in Redis for feedback loop
      await this.redis.hset(`deal_rating:${dealId}`, {
        rating: "positive",
        timestamp: Date.now(),
        userId: callback.userId,
      });
      await this.redis.expire(`deal_rating:${dealId}`, 86400 * 7);

      // Log to AI telemetry
      await this.logAction(callback.userId, "rate_pos", dealId);

      return {
        success: true,
        action: "rate_pos",
        message:
          "Terima kasih! Ayat anda telah disimpan sebagai contoh baik untuk AI.",
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error("Error handling positive rating:", error);
      return {
        success: false,
        action: "rate_pos",
        message: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        timestamp: Date.now(),
      };
    }
  }

  // Handle negative rating from Chip Besar
  private async handleNegativeRating(
    callback: TelegramCallback,
  ): Promise<QuickActionResult> {
    try {
      const dealId = callback.metadata.postId || "unknown";
      const rating = "negative";

      // Store rating in Redis for feedback loop
      await this.redis.hset(`deal_rating:${dealId}`, {
        rating: "negative",
        timestamp: Date.now(),
        userId: callback.userId,
      });
      await this.redis.expire(`deal_rating:${dealId}`, 86400 * 7);

      // Log to AI telemetry
      await this.logAction(callback.userId, "rate_neg", dealId);

      return {
        success: true,
        action: "rate_neg",
        message:
          "Terima kasih! Pola negatif ini akan dihindari dalam generasi AI semula.",
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error("Error handling negative rating:", error);
      return {
        success: false,
        action: "rate_neg",
        message: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        timestamp: Date.now(),
      };
    }
  }

  // Handle AI regeneration request
  private async handleRegenerateAI(
    callback: TelegramCallback,
  ): Promise<QuickActionResult> {
    try {
      const dealId = callback.metadata.postId || "unknown";

      // Log regeneration request
      await this.logAction(callback.userId, "regen_ai", dealId);

      return {
        success: true,
        action: "regen_ai",
        message: `AI copywriting untuk deal ${dealId} akan digenari semula dalam putaran seterusnya.`,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error("Error handling AI regeneration:", error);
      return {
        success: false,
        action: "regen_ai",
        message: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        timestamp: Date.now(),
      };
    }
  }

  private async logAction(
    userId: string,
    action: string,
    postId: string,
  ): Promise<void> {
    try {
      const logEntry = {
        userId,
        action,
        postId,
        timestamp: Date.now(),
        status: "completed",
      };

      await this.redis.lpush("telegram_actions_log", JSON.stringify(logEntry));
      await this.redis.expire("telegram_actions_log", 86400);
    } catch (error) {
      console.error("Error logging action:", error);
    }
  }

  async getCallbackHistory(
    userId: string,
    limit: number = 10,
  ): Promise<TelegramCallback[]> {
    try {
      const keys = await this.redis.keys("callback:*");
      const callbacks: TelegramCallback[] = [];

      for (const key of keys.slice(0, 100)) {
        const callback = await this.redis.get(key);
        if (callback) {
          const parsed = JSON.parse(callback as string);
          if (parsed.userId === userId) {
            callbacks.push(parsed);
          }
        }
      }

      callbacks.sort((a, b) => b.timestamp - a.timestamp);
      return callbacks.slice(0, limit);
    } catch (error) {
      console.error("Error getting callback history:", error);
      return [];
    }
  }

  async getAllCallbacks(limit: number = 10): Promise<TelegramCallback[]> {
    try {
      const keys = await this.redis.keys("callback:*");
      const callbacks: TelegramCallback[] = [];

      for (const key of keys.slice(0, 100)) {
        const callback = await this.redis.get(key);
        if (callback) {
          callbacks.push(JSON.parse(callback as string));
        }
      }

      callbacks.sort((a, b) => b.timestamp - a.timestamp);
      return callbacks.slice(0, limit);
    } catch (error) {
      console.error("Error getting all callbacks:", error);
      return [];
    }
  }

  private async cacheCallback(
    callbackId: string,
    callback: TelegramCallback,
  ): Promise<void> {
    try {
      await this.redis.setex(
        `callback:${callbackId}`,
        86400,
        JSON.stringify(callback),
      );
    } catch (error) {
      console.error("Error caching callback:", error);
    }
  }

  private async updateCallback(
    callbackId: string,
    callback: TelegramCallback,
  ): Promise<void> {
    try {
      await this.redis.setex(
        `callback:${callbackId}`,
        86400,
        JSON.stringify(callback),
      );
    } catch (error) {
      console.error("Error updating callback:", error);
    }
  }

  async getQuickActionStats(): Promise<any> {
    try {
      const keys = await this.redis.keys("callback:*");
      const stats: any = {
        totalCallbacks: keys.length,
        byStatus: { pending: 0, processing: 0, completed: 0, failed: 0 },
        byAction: { delete_x_post: 0, delete_fb_post: 0, regenerate_copy: 0 },
        lastUpdated: Date.now(),
      };

      for (const key of keys.slice(0, 100)) {
        const callback = await this.redis.get(key);
        if (callback) {
          const parsed = JSON.parse(callback as string);
          stats.byStatus[parsed.status] =
            (stats.byStatus[parsed.status] || 0) + 1;
          if (parsed.metadata.actionType) {
            stats.byAction[parsed.metadata.actionType] =
              (stats.byAction[parsed.metadata.actionType] || 0) + 1;
          }
        }
      }

      return stats;
    } catch (error) {
      console.error("Error getting quick action stats:", error);
      return null;
    }
  }

  async cleanupOldCallbacks(
    olderThan: number = 7 * 24 * 60 * 60 * 1000,
  ): Promise<void> {
    try {
      const now = Date.now();
      const keysToDelete: string[] = [];

      for (const key of await this.redis.keys("callback:*")) {
        const callback = await this.redis.get(key);
        if (callback) {
          const parsed = JSON.parse(callback as string);
          if (now - parsed.timestamp > olderThan) {
            keysToDelete.push(key);
          }
        }
      }

      for (const key of keysToDelete) {
        await this.redis.del(key);
      }
    } catch (error) {
      console.error("Error cleaning up old callbacks:", error);
    }
  }

  async sendQuickActionNotification(
    userId: string,
    action: string,
    result: QuickActionResult,
  ): Promise<boolean> {
    try {
      const message = this.formatQuickActionMessage(userId, action, result);

      const response = await fetch(
        `https://api.telegram.org/bot${this.botToken}/sendMessage`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            chat_id: this.chatId,
            text: message,
            parse_mode: "Markdown",
          }),
        },
      );

      return response.ok;
    } catch (error) {
      console.error("Error sending quick action notification:", error);
      return false;
    }
  }

  private formatQuickActionMessage(
    userId: string,
    action: string,
    result: QuickActionResult,
  ): string {
    const actionLabels: Record<string, string> = {
      delete_x_post: "🗑️ Padam Post X",
      delete_fb_post: "🗑️ Padam Post FB",
      regenerate_copy: "🔄 Jana Semula Salinan",
    };

    const actionLabel = actionLabels[action] || action;

    let message = `⚡ *Tindakan Cepat Dilaksanakan*\n\n`;
    message += `👤 Pengguna: ${userId}\n`;
    message += `🔧 Tindakan: ${actionLabel}\n`;
    message += `✅ Status: ${result.success ? "Berjaya" : "Gagal"}\n`;
    message += `📝 Mesej: ${result.message}\n`;
    message += `🕐 Tarikh: ${new Date(result.timestamp).toLocaleString("ms-MY")}\n`;

    if (result.postId) {
      message += `📌 Post ID: ${result.postId}\n`;
    }

    if (result.generatedCopy) {
      message += `📄 Salinan Baru: ${result.generatedCopy.substring(0, 100)}...\n`;
    }

    return message;
  }
}

export type { TelegramCallback, QuickActionResult, PostInfo };
export { TelegramQuickActions };
