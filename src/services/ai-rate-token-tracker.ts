/**
 * AI Rate & Token Tracker Service
 * Phase 19: Deep AI Cultural Tone Tuning
 *
 * Redis-backed token usage and rate limit monitor for OpenRouter
 * to prevent 429 rate limit spikes during 30-minute automated cron runs.
 */

import { Redis } from "@upstash/redis";
import { logger } from "../utils/logger";

// OpenRouter free tier limits
const OPENROUTER_FREE_LIMITS = {
  RPM: 5, // Requests per minute
  RPH: 200, // Requests per hour
  DAILY: 1000, // Requests per day (approximate)
  TOKENS_PER_MINUTE: 15000, // Tokens per minute
  TOKENS_PER_HOUR: 500000, // Tokens per hour
};

// Redis key prefixes
const REDIS_KEYS = {
  USAGE_COUNTER: "ai_usage_counter",
  TOKEN_COUNTER: "ai_token_counter",
  RATE_LIMIT_WINDOW: "ai_rate_limit_window",
  LAST_REQUEST: "ai_last_request",
  ALERT_SENT: "ai_alert_sent",
};

interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  timestamp: number;
  model: string;
}

interface RateLimitHealth {
  isHealthy: boolean;
  remainingQuota: number;
  currentUsage: number;
  limit: number;
  resetTime: number;
  warning: string | null;
}

interface AlertConfig {
  warningThreshold: number; // Percentage (0-100)
  criticalThreshold: number; // Percentage (0-100)
  cooldownMinutes: number; // Minutes before another alert
}

export class AIRateTokenTracker {
  private redis: Redis;
  private botToken: string;
  private chatId: string;
  private alertConfig: AlertConfig;

  constructor() {
    this.redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL || "",
      token: process.env.UPSTASH_REDIS_REST_TOKEN || "",
    });

    this.botToken = process.env.TELEGRAM_BOT_TOKEN || "";
    this.chatId = process.env.TELEGRAM_CHAT_ID || "";

    this.alertConfig = {
      warningThreshold: 80,
      criticalThreshold: 95,
      cooldownMinutes: 30,
    };
  }

  /**
   * Track token usage for a request
   */
  async trackUsage(
    promptTokens: number,
    completionTokens: number,
    model: string = "openrouter/free",
  ): Promise<void> {
    const totalTokens = promptTokens + completionTokens;
    const timestamp = Date.now();

    const usage: TokenUsage = {
      promptTokens,
      completionTokens,
      totalTokens,
      timestamp,
      model,
    };

    // Store usage in Redis with 1-hour expiry
    const key = `${REDIS_KEYS.TOKEN_COUNTER}:${timestamp}`;
    await this.redis.setex(key, 3600, JSON.stringify(usage));

    // Update rolling counters
    await this.updateRollingCounters(totalTokens, timestamp);

    // Check if we need to send alert
    await this.checkAndSendAlert(totalTokens);
  }

  /**
   * Update rolling counters for rate limiting
   */
  private async updateRollingCounters(
    totalTokens: number,
    timestamp: number,
  ): Promise<void> {
    const minuteKey = `${REDIS_KEYS.RATE_LIMIT_WINDOW}:${Math.floor(timestamp / 60000)}`;
    const hourKey = `${REDIS_KEYS.RATE_LIMIT_WINDOW}:${Math.floor(timestamp / 3600000)}`;

    // Increment token counter for current minute
    await this.redis.incrby(minuteKey, totalTokens);
    await this.redis.expire(minuteKey, 3600);

    // Increment token counter for current hour
    await this.redis.incrby(hourKey, totalTokens);
    await this.redis.expire(hourKey, 86400);

    // Update last request time
    await this.redis.set(REDIS_KEYS.LAST_REQUEST, timestamp);
  }

  /**
   * Check rate limit health
   */
  async checkRateLimitHealth(): Promise<RateLimitHealth> {
    const now = Date.now();
    const currentMinute = Math.floor(now / 60000);
    const currentHour = Math.floor(now / 3600000);

    // Get current usage
    const minuteKey = `${REDIS_KEYS.RATE_LIMIT_WINDOW}:${currentMinute}`;
    const hourKey = `${REDIS_KEYS.RATE_LIMIT_WINDOW}:${currentHour}`;

    const [minuteUsage, hourUsage] = await Promise.all([
      this.redis.get(minuteKey),
      this.redis.get(hourKey),
    ]);

    const minuteTokens = Number(minuteUsage) || 0;
    const hourTokens = Number(hourUsage) || 0;

    // Calculate remaining quota
    const minuteRemaining = Math.max(
      0,
      OPENROUTER_FREE_LIMITS.TOKENS_PER_MINUTE - minuteTokens,
    );
    const hourRemaining = Math.max(
      0,
      OPENROUTER_FREE_LIMITS.TOKENS_PER_HOUR - hourTokens,
    );

    // Determine health status
    const minutePercentage =
      (minuteTokens / OPENROUTER_FREE_LIMITS.TOKENS_PER_MINUTE) * 100;
    const hourPercentage =
      (hourTokens / OPENROUTER_FREE_LIMITS.TOKENS_PER_HOUR) * 100;

    const isHealthy = minutePercentage < this.alertConfig.warningThreshold;
    const remainingQuota = Math.min(minuteRemaining, hourRemaining);

    // Calculate reset time (next minute boundary)
    const resetTime = (currentMinute + 1) * 60000;

    // Generate warning message
    let warning: string | null = null;
    if (minutePercentage >= this.alertConfig.criticalThreshold) {
      warning = `Kritikal: Penggunaan token AI mencapai ${minutePercentage.toFixed(0)}% dalam minit ini!`;
    } else if (minutePercentage >= this.alertConfig.warningThreshold) {
      warning = `Amaran: Penggunaan token AI mencapai ${minutePercentage.toFixed(0)}% dalam minit ini.`;
    }

    return {
      isHealthy,
      remainingQuota,
      currentUsage: minuteTokens,
      limit: OPENROUTER_FREE_LIMITS.TOKENS_PER_MINUTE,
      resetTime,
      warning,
    };
  }

  /**
   * Check and send alert if needed
   */
  private async checkAndSendAlert(totalTokens: number): Promise<void> {
    const health = await this.checkRateLimitHealth();

    if (!health.isHealthy && health.warning) {
      // Check if we already sent an alert recently
      const lastAlert = await this.redis.get(REDIS_KEYS.ALERT_SENT);
      const now = Date.now();

      if (lastAlert) {
        const lastAlertTime = Number(lastAlert);
        const cooldownMs = this.alertConfig.cooldownMinutes * 60 * 1000;

        if (now - lastAlertTime < cooldownMs) {
          return; // Still in cooldown
        }
      }

      // Send alert to Telegram
      await this.sendTelegramAlert(health.warning, totalTokens);

      // Record alert time
      await this.redis.setex(
        REDIS_KEYS.ALERT_SENT,
        this.alertConfig.cooldownMinutes * 60,
        now,
      );
    }
  }

  /**
   * Send alert to Telegram
   */
  private async sendTelegramAlert(
    message: string,
    tokens: number,
  ): Promise<void> {
    if (!this.botToken || !this.chatId) {
      logger.warn(
        "Telegram bot token or chat ID not configured",
        {},
        "AIRateTokenTracker",
      );
      return;
    }

    const alertText = `🚨 *Alert AI Token Usage*\n\n${message}\n\nToken dalam permintaan ini: ${tokens}\n\nSila semak beberanya sebelum had minimum.`;

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
            text: alertText,
            parse_mode: "Markdown",
          }),
        },
      );

      if (!response.ok) {
        logger.error("Failed to send Telegram alert", {}, "AIRateTokenTracker");
      }
    } catch (error) {
      logger.error(
        "Error sending Telegram alert",
        { error },
        "AIRateTokenTracker",
      );
    }
  }

  /**
   * Get usage statistics for the last N minutes
   */
  async getUsageStats(minutes: number = 60): Promise<{
    totalTokens: number;
    averageTokensPerMinute: number;
    peakTokensPerMinute: number;
    requestCount: number;
  }> {
    const now = Date.now();
    const minuteKeys = [];

    for (let i = 0; i < minutes; i++) {
      const minute = Math.floor((now - i * 60000) / 60000);
      minuteKeys.push(`${REDIS_KEYS.RATE_LIMIT_WINDOW}:${minute}`);
    }

    const values = await this.redis.mget(minuteKeys);
    const tokens = values.map((v) => Number(v) || 0);

    const totalTokens = tokens.reduce((sum, t) => sum + t, 0);
    const averageTokensPerMinute = totalTokens / minutes;
    const peakTokensPerMinute = Math.max(...tokens);

    return {
      totalTokens,
      averageTokensPerMinute,
      peakTokensPerMinute,
      requestCount: minutes,
    };
  }

  /**
   * Reset counters (for testing or manual reset)
   */
  async resetCounters(): Promise<void> {
    // This is a destructive operation - use with caution
    const keys = await this.redis.keys(`${REDIS_KEYS.RATE_LIMIT_WINDOW}:*`);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
    await this.redis.del(REDIS_KEYS.TOKEN_COUNTER);
    await this.redis.del(REDIS_KEYS.LAST_REQUEST);
  }

  /**
   * Get current request count
   */
  async getRequestCount(): Promise<number> {
    const lastRequest = await this.redis.get(REDIS_KEYS.LAST_REQUEST);
    return lastRequest ? Number(lastRequest) : 0;
  }
}

// Export singleton instance
export const aiRateTokenTracker = new AIRateTokenTracker();

export default AIRateTokenTracker;
