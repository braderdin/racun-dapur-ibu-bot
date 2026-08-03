/*
 * Telegram Telemetry & Diagnostics Bot
 * Provides real-time metrics and diagnostics via Telegram commands
 * Commands: /stats, /health, /top_deals, /config
 */

import { Env } from "../types/env";
import { TelegramNotifierService } from "./telegram-notifier";
import { RedisService } from "./redis";
import { SupabaseService } from "./supabase";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TelemetryStats {
  totalDeals: number;
  totalPosts: number;
  totalClicks: number;
  totalCommission: number;
  uptimeSeconds: number;
  lastRun: string;
}

export interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  services: Record<
    string,
    { status: "up" | "down"; latencyMs?: number; error?: string }
  >;
  timestamp: string;
}

export interface TopDeal {
  deal_id: string;
  title: string;
  clicks: number;
  impressions: number;
  ctr: number;
  commission: number;
}

export interface TelemetryResponse {
  success: boolean;
  message: string;
  data?: any;
}

// ---------------------------------------------------------------------------
// Telegram Telemetry Bot Service
// ---------------------------------------------------------------------------

export class TelegramTelemetryBot {
  private telegram: TelegramNotifierService;
  private redis: RedisService;
  private supabase: SupabaseService;
  private env: Env;
  private startTime: number;

  constructor(env: Env) {
    this.env = env;
    this.startTime = Date.now();
    this.telegram = new TelegramNotifierService(
      env.TELEGRAM_BOT_TOKEN || "",
      env.TELEGRAM_CHAT_ID || "",
    );
    this.redis = new RedisService(env);
    this.supabase = new SupabaseService(env);
  }

  // ---------------------------------------------------------------------------
  // Handle incoming command
  // ---------------------------------------------------------------------------

  async handleCommand(
    command: string,
    chatId: string,
  ): Promise<TelemetryResponse> {
    const normalizedCommand = command.toLowerCase().trim();

    switch (normalizedCommand) {
      case "/start":
        return this.handleStart(chatId);
      case "/stats":
        return this.handleStats(chatId);
      case "/health":
        return this.handleHealth(chatId);
      case "/top_deals":
        return this.handleTopDeals(chatId);
      case "/config":
        return this.handleConfig(chatId);
      case "/ai_stats":
        return this.handleAiStats(chatId);
      case "/help":
        return this.handleHelp(chatId);
      default:
        return {
          success: false,
          message: "Unknown command. Use /help for available commands.",
        };
    }
  }

  // Handle /start command with cute GUI menu
  private async handleStart(chatId: string): Promise<TelemetryResponse> {
    try {
      const message = `👋 <b>Selamat datang, Chip Besar!</b>

🤖 <i>Berikut adalah kawalan utama untuk Bot Racun Dapur Ibu:</i>

┌─────────────────────────────────────────┐
│ 📊 Stat AI Dapur   │  🏥 Status Sistem  │
├─────────────────────────────────────────┤
│ 🔥 Tawaran Live    │  ⚙️ Kawalan Bot    │
└─────────────────────────────────────────┘

<i>Silakan tekan butang di atas untuk melihat statistik atau kawal bot.</i>`;

      const replyKeyboard = {
        reply_markup: {
          keyboard: [
            [{ text: "📊 Stat AI Dapur" }, { text: "🏥 Status Sistem" }],
            [{ text: "🔥 Tawaran Live" }, { text: "⚙️ Kawalan Bot" }],
          ],
          resize_keyboard: true,
          one_time_keyboard: false,
        },
      };

      await this.telegram.sendTextMessage(message, replyKeyboard);

      return { success: true, message: "Welcome menu sent" };
    } catch (error) {
      return {
        success: false,
        message: `Error sending welcome: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  // Handle GUI button text inputs
  async handleTextInput(
    text: string,
    chatId: string,
  ): Promise<TelemetryResponse> {
    const normalizedText = text.toLowerCase().trim();

    switch (normalizedText) {
      case "📊 stat ai dapur":
        return this.handleAiStats(chatId);
      case "🏥 status sistem":
        return this.handleHealth(chatId);
      case "🔥 tawaran live":
        return this.handleTopDeals(chatId);
      case "⚙️ kawalan bot":
        return this.handleConfig(chatId);
      default:
        return {
          success: false,
          message: "Tindakan tidak dikenali. Silakan gunakan butang di atas.",
        };
    }
  }

  // ---------------------------------------------------------------------------
  // Handle /stats command
  // ---------------------------------------------------------------------------

  private async handleStats(chatId: string): Promise<TelemetryResponse> {
    try {
      const stats = await this.getTelemetryStats();

      const message = `📊 <b>SYSTEM STATISTICS</b>

🔧 <b>Bot Uptime:</b> ${this.formatUptime(stats.uptimeSeconds)}
🚀 <b>Last Run:</b> ${stats.lastRun}

📦 <b>Total Deals Curated:</b> ${stats.totalDeals}
📢 <b>Total Posts Published:</b> ${stats.totalPosts}
👆 <b>Total Clicks:</b> ${stats.totalClicks}
💰 <b>Total Commission (RM):</b> ${stats.totalCommission.toFixed(2)}

<i>Updated: ${new Date().toLocaleString("ms-MY", { timeZone: "Asia/Kuala_Lumpur" })}</i>`;

      await this.telegram.sendTextMessage(message);

      return { success: true, message: "Stats sent", data: stats };
    } catch (error) {
      return {
        success: false,
        message: `Error fetching stats: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Handle /health command
  // ---------------------------------------------------------------------------

  private async handleHealth(chatId: string): Promise<TelemetryResponse> {
    try {
      const health = await this.getHealthStatus();

      const statusEmoji =
        health.status === "healthy"
          ? "✅"
          : health.status === "degraded"
            ? "⚠️"
            : "❌";
      const statusText = health.status.toUpperCase();

      let message = `${statusEmoji} <b>SYSTEM HEALTH: ${statusText}</b>

`;

      for (const [service, info] of Object.entries(health.services)) {
        const emoji = info.status === "up" ? "✅" : "❌";
        const latency = info.latencyMs ? ` (${info.latencyMs}ms)` : "";
        message += `${emoji} <b>${service}</b>: ${info.status}${latency}\n`;
      }

      message += `\n<i>Updated: ${health.timestamp}</i>`;

      await this.telegram.sendTextMessage(message);

      return { success: true, message: "Health status sent", data: health };
    } catch (error) {
      return {
        success: false,
        message: `Error fetching health: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Handle /top_deals command
  // ---------------------------------------------------------------------------

  private async handleTopDeals(chatId: string): Promise<TelemetryResponse> {
    try {
      const topDeals = await this.getTopDeals();

      let message = `🔥 <b>TOP PERFORMING DEALS</b>\n\n`;

      if (topDeals.length === 0) {
        message += "Tiada data statistik yang tersedia.";
      } else {
        topDeals.forEach((deal, index) => {
          message += `${index + 1}. <b>${deal.title}</b>\n`;
          message += `   👆 ${deal.clicks} klik | 📈 CTR: ${(deal.ctr * 100).toFixed(2)}%\n`;
          message += `   💰 Komisi: RM ${deal.commission.toFixed(2)}\n\n`;
        });
      }

      await this.telegram.sendTextMessage(message);

      return { success: true, message: "Top deals sent", data: topDeals };
    } catch (error) {
      return {
        success: false,
        message: `Error fetching top deals: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Handle /config command
  // ---------------------------------------------------------------------------

  private async handleConfig(chatId: string): Promise<TelemetryResponse> {
    try {
      const config = await this.getConfigStatus();

      let message = `⚙️ <b>CONFIGURATION STATUS</b>\n\n`;
      message += `📡 <b>Platform:</b> ${config.platform}\n`;
      message += `🤖 <b>Bot Mode:</b> ${config.botMode}\n`;
      message += `📅 <b>Schedule:</b> ${config.schedule}\n`;
      message += `🔒 <b>Security:</b> ${config.security}\n`;
      message += `💾 <b>Storage:</b> ${config.storage}\n`;
      message += `📊 <b>Analytics:</b> ${config.analytics}\n`;

      await this.telegram.sendTextMessage(message);

      return { success: true, message: "Config status sent", data: config };
    } catch (error) {
      return {
        success: false,
        message: `Error fetching config: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Handle /ai_stats command - AI Quality Telemetry
  // ---------------------------------------------------------------------------

  private async handleAiStats(chatId: string): Promise<TelemetryResponse> {
    try {
      const aiStats = await this.getAiStatsSummary();

      const message = `🤖 <b>AI COPYWRITING TELEMETRY</b>

📈 <b>Total Generations:</b> ${aiStats.totalGenerations}
⏱️ <b>Avg Response Time:</b> ${aiStats.avgResponseTimeMs}ms
🎯 <b>Avg Confidence:</b> ${(aiStats.avgConfidence * 100).toFixed(1)}%

📊 <b>Feedback Ratings:</b>
   👍 Positif: ${aiStats.positiveRatio}%
   👎 Negatif: ${aiStats.negativeRatio}%
   ⚖️ Neutral: ${aiStats.neutralRatio}%

🔄 <b>Model Distribution:</b>
   openrouter/free: ${aiStats.modelDistribution["openrouter/free"] || 0}
   openrouter/pro: ${aiStats.modelDistribution["openrouter/pro"] || 0}
   gemini: ${aiStats.modelDistribution["gemini"] || 0}
   groq: ${aiStats.modelDistribution["groq"] || 0}

<i>Updated: ${new Date().toLocaleString("ms-MY", { timeZone: "Asia/Kuala_Lumpur" })}</i>`;

      await this.telegram.sendTextMessage(message);

      return { success: true, message: "AI stats sent", data: aiStats };
    } catch (error) {
      return {
        success: false,
        message: `Error fetching AI stats: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Handle /help command
  // ---------------------------------------------------------------------------

  private async handleHelp(chatId: string): Promise<TelemetryResponse> {
    const message = `🤖 <b>Telegram Telemetry Bot - Command List</b>

/stats - Lihat statistik sistem (deals, posts, clicks, commission)
/health - Semak status kesihatan semua service
/top_deals - Lihat deal paling berkesan
/config - Lihat status konfigurasi sistem
/help - Tunjukkan penerangan perintah

<i>Bot automatik untuk @RacunDapurIbu</i>`;

    await this.telegram.sendTextMessage(message);

    return { success: true, message: "Help sent" };
  }

  // ---------------------------------------------------------------------------
  // Helper: Get telemetry stats
  // ---------------------------------------------------------------------------

  private async getTelemetryStats(): Promise<TelemetryStats> {
    const totalDeals = await this.getRedisCount("bot:deals:curated");
    const totalPosts = await this.getRedisCount("bot:posts:published");
    const totalClicks = await this.getRedisCount("bot:clicks:total");
    const totalCommission =
      (await this.getRedisCount("bot:commission:total")) || 0;

    return {
      totalDeals,
      totalPosts,
      totalClicks,
      totalCommission: totalCommission / 100, // Convert from cents
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
      lastRun: new Date().toISOString(),
    };
  }

  // ---------------------------------------------------------------------------
  // Helper: Get health status
  // ---------------------------------------------------------------------------

  private async getHealthStatus(): Promise<HealthStatus> {
    const services: Record<
      string,
      { status: "up" | "down"; latencyMs?: number; error?: string }
    > = {};

    // Check Redis
    try {
      const redisHealth = await this.redis.healthCheck();
      services.redis = {
        status: redisHealth.status === "healthy" ? "up" : "down",
        latencyMs: redisHealth.details.includes("ms")
          ? parseInt(redisHealth.details)
          : undefined,
      };
    } catch (error) {
      services.redis = {
        status: "down",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }

    // Check Supabase
    try {
      const supabaseHealth = await this.supabase.healthCheck();
      services.supabase = {
        status: supabaseHealth.status === "healthy" ? "up" : "down",
      };
    } catch (error) {
      services.supabase = {
        status: "down",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }

    // Check overall status
    const statuses = Object.values(services).map((s) => s.status);
    let status: "healthy" | "degraded" | "unhealthy" = "healthy";
    if (statuses.includes("down")) {
      status = statuses.every((s) => s === "down") ? "unhealthy" : "degraded";
    }

    return {
      status,
      services,
      timestamp: new Date().toISOString(),
    };
  }

  // ---------------------------------------------------------------------------
  // Helper: Get top deals
  // ---------------------------------------------------------------------------

  private async getTopDeals(): Promise<TopDeal[]> {
    // This would typically query the ad_performance_metrics table
    // For now, return empty array as placeholder
    return [];
  }

  // ---------------------------------------------------------------------------
  // Helper: Get AI stats summary from Supabase
  // ---------------------------------------------------------------------------

  private async getAiStatsSummary(): Promise<{
    totalGenerations: number;
    avgResponseTimeMs: number;
    avgConfidence: number;
    positiveRatio: number;
    negativeRatio: number;
    neutralRatio: number;
    modelDistribution: Record<string, number>;
  }> {
    try {
      // Query Supabase for AI stats
      const { data, error } = await this.supabase
        .getClient()
        .from("ai_copywriting_logs")
        .select("*")
        .gte(
          "created_at",
          new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        );

      if (error || !data || data.length === 0) {
        return {
          totalGenerations: 0,
          avgResponseTimeMs: 0,
          avgConfidence: 0,
          positiveRatio: 0,
          negativeRatio: 0,
          neutralRatio: 0,
          modelDistribution: {},
        };
      }

      const totalGenerations = data.length;
      const avgResponseTimeMs =
        data.reduce((sum, row: any) => sum + (row.response_time_ms || 0), 0) /
        totalGenerations;
      const avgConfidence =
        data.reduce((sum, row: any) => sum + (row.confidence_score || 0), 0) /
        totalGenerations;

      const positiveCount = data.filter(
        (row: any) => row.chip_besar_rating === "positive",
      ).length;
      const negativeCount = data.filter(
        (row: any) => row.chip_besar_rating === "negative",
      ).length;
      const neutralCount = data.filter(
        (row: any) => row.chip_besar_rating === "neutral",
      ).length;

      const modelDistribution: Record<string, number> = {};
      for (const row of data) {
        const model = row.ai_model || "openrouter/free";
        modelDistribution[model] = (modelDistribution[model] || 0) + 1;
      }

      return {
        totalGenerations,
        avgResponseTimeMs: Math.round(avgResponseTimeMs),
        avgConfidence,
        positiveRatio: (positiveCount / totalGenerations) * 100,
        negativeRatio: (negativeCount / totalGenerations) * 100,
        neutralRatio: (neutralCount / totalGenerations) * 100,
        modelDistribution,
      };
    } catch (error) {
      console.error("Error getting AI stats:", error);
      return {
        totalGenerations: 0,
        avgResponseTimeMs: 0,
        avgConfidence: 0,
        positiveRatio: 0,
        negativeRatio: 0,
        neutralRatio: 0,
        modelDistribution: {},
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Helper: Get config status
  // ---------------------------------------------------------------------------

  private async getConfigStatus(): Promise<{
    platform: string;
    botMode: string;
    schedule: string;
    security: string;
    storage: string;
    analytics: string;
  }> {
    return {
      platform: "Cloudflare Worker + Supabase + Upstash Redis",
      botMode: "Production (24/7)",
      schedule: "Every 2 hours (peak: 12:30-14:00, 20:30-22:30 MYT)",
      security: "Redis anti-repeat (5-day TTL), 3s OpenRouter delay",
      storage: "Backblaze B2 (3 accounts, 27GB total)",
      analytics: "Supabase + Upstash Vector",
    };
  }

  // ---------------------------------------------------------------------------
  // Helper: Get Redis count
  // ---------------------------------------------------------------------------

  private async getRedisCount(key: string): Promise<number> {
    try {
      const count = await this.redis.get(key);
      return typeof count === "number" ? count : 0;
    } catch {
      return 0;
    }
  }

  // ---------------------------------------------------------------------------
  // Helper: Format uptime
  // ---------------------------------------------------------------------------

  private formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  // ---------------------------------------------------------------------------
  // Helper: Escape HTML
  // ---------------------------------------------------------------------------

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}

// ---------------------------------------------------------------------------
// Singleton instance
// ---------------------------------------------------------------------------

let telemetryInstance: TelegramTelemetryBot | null = null;

export function getTelegramTelemetryBot(env: Env): TelegramTelemetryBot {
  if (!telemetryInstance) {
    telemetryInstance = new TelegramTelemetryBot(env);
  }
  return telemetryInstance;
}
