/**
 * Affiliate Yield Tracker
 * Commission yield and CTR analytics tracker
 *
 * Tracks shortlink conversions toward the target 5% Sales Conversion Rate
 * and reports to Telegram GUI
 */

import { Redis } from "@upstash/redis";
import { Env } from "../types/env";
import { TelegramNotifierService } from "./telegram-notifier";

export interface YieldMetrics {
  totalClicks: number;
  totalConversions: number;
  conversionRate: number;
  ctrByPlatform: Record<string, number>;
  clicksByPlatform: Record<string, number>;
  estimatedRevenue: number;
  targetConversionRate: number;
  targetCtr: number;
}

export interface ClickRecord {
  code: string;
  timestamp: number;
  platform: "x" | "facebook" | "web";
  ip?: string;
  userAgent?: string;
}

export interface ConversionRecord {
  code: string;
  timestamp: number;
  orderId?: string;
  revenue?: number;
}

export class AffiliateYieldTracker {
  private redis: Redis;
  private env: Env;
  private telegram: TelegramNotifierService;
  private targetConversionRate: number = 0.05; // 5%
  private targetCtr: number = 0.05; // 5% CTR

  constructor(env: Env) {
    this.env = env;
    this.redis = new Redis({
      url: env.UPSTASH_REDIS_REST_URL || process.env.UPSTASH_REDIS_REST_URL,
      token:
        env.UPSTASH_REDIS_REST_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    this.telegram = new TelegramNotifierService(
      env.TELEGRAM_BOT_TOKEN || "",
      env.TELEGRAM_CHAT_ID || "",
    );
  }

  /**
   * Record a click on a shortlink
   * @param code - Shortlink code
   * @param platform - Platform (x, facebook, web)
   */
  async recordClick(
    code: string,
    platform: "x" | "facebook" | "web",
  ): Promise<void> {
    const clickRecord: ClickRecord = {
      code,
      timestamp: Date.now(),
      platform,
    };

    // Store click in Redis with 5-day TTL
    const key = `click:${code}:${Date.now()}`;
    await this.redis.setex(key, 432000, JSON.stringify(clickRecord)); // 5 days

    // Increment platform counter
    const platformKey = `yield:platform:${platform}:clicks`;
    await this.redis.incr(platformKey);
    await this.redis.expire(platformKey, 432000);

    // Update total clicks
    const totalKey = "yield:total:clicks";
    await this.redis.incr(totalKey);
    await this.redis.expire(totalKey, 432000);

    // Check if we should send Telegram update
    const totalClicks = await this.getTotalClicks();
    if (totalClicks > 0 && totalClicks % 100 === 0) {
      await this.sendTelegramUpdate();
    }
  }

  /**
   * Record a conversion (sale)
   * @param code - Shortlink code
   * @param orderId - Order ID (optional)
   * @param revenue - Revenue amount (optional)
   */
  async recordConversion(
    code: string,
    orderId?: string,
    revenue?: number,
  ): Promise<void> {
    const conversionRecord: ConversionRecord = {
      code,
      timestamp: Date.now(),
      orderId,
      revenue,
    };

    // Store conversion in Redis with 5-day TTL
    const key = `conversion:${code}:${Date.now()}`;
    await this.redis.setex(key, 432000, JSON.stringify(conversionRecord));

    // Update total conversions
    const totalKey = "yield:total:conversions";
    await this.redis.incr(totalKey);
    await this.redis.expire(totalKey, 432000);

    // Update estimated revenue
    if (revenue) {
      const revenueKey = "yield:total:revenue";
      await this.redis.incrbyfloat(revenueKey, revenue);
      await this.redis.expire(revenueKey, 432000);
    }

    // Check if we should send Telegram update
    const totalConversions = await this.getTotalConversions();
    if (totalConversions > 0 && totalConversions % 10 === 0) {
      await this.sendTelegramUpdate();
    }
  }

  /**
   * Get total clicks
   */
  async getTotalClicks(): Promise<number> {
    const key = "yield:total:clicks";
    const value = await this.redis.get(key);
    return value ? parseInt(value as string, 10) : 0;
  }

  /**
   * Get total conversions
   */
  async getTotalConversions(): Promise<number> {
    const key = "yield:total:conversions";
    const value = await this.redis.get(key);
    return value ? parseInt(value as string, 10) : 0;
  }

  /**
   * Get estimated revenue
   */
  async getEstimatedRevenue(): Promise<number> {
    const key = "yield:total:revenue";
    const value = await this.redis.get(key);
    return value ? parseFloat(value as string) : 0;
  }

  /**
   * Get clicks by platform
   */
  async getClicksByPlatform(): Promise<Record<string, number>> {
    const platforms = ["x", "facebook", "web"];
    const result: Record<string, number> = {};

    for (const platform of platforms) {
      const key = `yield:platform:${platform}:clicks`;
      const value = await this.redis.get(key);
      result[platform] = value ? parseInt(value as string, 10) : 0;
    }

    return result;
  }

  /**
   * Get complete yield metrics
   */
  async getMetrics(): Promise<YieldMetrics> {
    const totalClicks = await this.getTotalClicks();
    const totalConversions = await this.getTotalConversions();
    const estimatedRevenue = await this.getEstimatedRevenue();
    const clicksByPlatform = await this.getClicksByPlatform();

    const conversionRate = totalClicks > 0 ? totalConversions / totalClicks : 0;

    // Calculate CTR by platform
    const ctrByPlatform: Record<string, number> = {};
    for (const [platform, clicks] of Object.entries(clicksByPlatform)) {
      ctrByPlatform[platform] = clicks > 0 ? clicks / totalClicks : 0;
    }

    return {
      totalClicks,
      totalConversions,
      conversionRate,
      ctrByPlatform,
      clicksByPlatform,
      estimatedRevenue,
      targetConversionRate: this.targetConversionRate,
      targetCtr: this.targetCtr,
    };
  }

  /**
   * Send Telegram update with yield metrics
   */
  private async sendTelegramUpdate(): Promise<void> {
    const metrics = await this.getMetrics();

    const message = `
📊 *Affiliate Yield Report*

🔗 Total Clicks: ${metrics.totalClicks.toLocaleString()}
💰 Total Conversions: ${metrics.totalConversions.toLocaleString()}
📈 Conversion Rate: ${(metrics.conversionRate * 100).toFixed(2)}%
💵 Estimated Revenue: RM ${metrics.estimatedRevenue.toFixed(2)}

🎯 Target Conversion Rate: ${(metrics.targetConversionRate * 100).toFixed(1)}%
🎯 Target CTR: ${(metrics.targetCtr * 100).toFixed(1)}%

📱 Platform Breakdown:
• X (Twitter): ${metrics.clicksByPlatform.x.toLocaleString()} clicks
• Facebook: ${metrics.clicksByPlatform.facebook.toLocaleString()} clicks
• Web: ${metrics.clicksByPlatform.web.toLocaleString()} clicks

_Updated automatically_
    `.trim();

    await this.telegram.sendTextMessage(message);
  }

  /**
   * Reset all yield metrics
   */
  async resetMetrics(): Promise<void> {
    const keys = [
      "yield:total:clicks",
      "yield:total:conversions",
      "yield:total:revenue",
      "yield:platform:x:clicks",
      "yield:platform:facebook:clicks",
      "yield:platform:web:clicks",
    ];

    for (const key of keys) {
      await this.redis.del(key);
    }
  }

  /**
   * Get current status (for health checks)
   */
  async getStatus(): Promise<{ healthy: boolean; message: string }> {
    try {
      const metrics = await this.getMetrics();
      const conversionRate = metrics.conversionRate;

      if (conversionRate >= this.targetConversionRate) {
        return {
          healthy: true,
          message: `Conversion rate ${conversionRate.toFixed(2)}% meets target ${this.targetConversionRate * 100}%`,
        };
      }

      return {
        healthy: true,
        message: `Conversion rate ${conversionRate.toFixed(2)}% below target ${this.targetConversionRate * 100}%`,
      };
    } catch (error) {
      return {
        healthy: false,
        message: `Error getting metrics: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}
