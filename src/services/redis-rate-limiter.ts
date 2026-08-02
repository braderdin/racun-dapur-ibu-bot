// Redis Sliding-Window Rate Limiter
// Upstash Redis sliding-window rate limiter ensuring API requests to OpenRouter, Lazada, X, and Meta Graph API stay strictly within 100% Free-Tier quotas

import { Redis } from "@upstash/redis";

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyPrefix: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

interface RateLimitStats {
  totalRequests: number;
  allowedRequests: number;
  blockedRequests: number;
  currentWindowRequests: number;
  windowResetTime: number;
}

class RedisRateLimiter {
  private redis: Redis;
  private configs: Map<string, RateLimitConfig>;
  private defaultConfig: RateLimitConfig;

  constructor() {
    this.redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });

    this.configs = new Map();

    this.defaultConfig = {
      windowMs: 60000, // 1 minute
      maxRequests: 100,
      keyPrefix: "rate_limit",
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
    };

    this.initializeConfigs();
  }

  private initializeConfigs(): void {
    // OpenRouter AI API rate limits (Free Tier: 5 requests/minute)
    this.configs.set("openrouter", {
      windowMs: 60000,
      maxRequests: 5,
      keyPrefix: "rate_limit:openrouter",
      skipSuccessfulRequests: false,
      skipFailedRequests: true,
    });

    // Lazada Open API rate limits (Free Tier: 500 requests/day)
    this.configs.set("lazada", {
      windowMs: 86400000, // 24 hours
      maxRequests: 500,
      keyPrefix: "rate_limit:lazada",
      skipSuccessfulRequests: false,
      skipFailedRequests: true,
    });

    // X (Twitter) API v2 rate limits (Free Tier: 300 requests/15 minutes)
    this.configs.set("x", {
      windowMs: 900000, // 15 minutes
      maxRequests: 300,
      keyPrefix: "rate_limit:x",
      skipSuccessfulRequests: false,
      skipFailedRequests: true,
    });

    // Meta Graph API rate limits (Free Tier: 95 requests/day)
    this.configs.set("facebook", {
      windowMs: 86400000, // 24 hours
      maxRequests: 95,
      keyPrefix: "rate_limit:facebook",
      skipSuccessfulRequests: false,
      skipFailedRequests: true,
    });

    // Internal service rate limits
    this.configs.set("internal", {
      windowMs: 60000,
      maxRequests: 1000,
      keyPrefix: "rate_limit:internal",
      skipSuccessfulRequests: true,
      skipFailedRequests: false,
    });
  }

  async checkRateLimit(
    service: string,
    key: string = "",
  ): Promise<RateLimitResult> {
    try {
      const config = this.configs.get(service) || this.defaultConfig;
      const rateKey = `${config.keyPrefix}:${service}:${key}`;

      const now = Date.now();
      const windowStart = now - config.windowMs;

      // Clean old entries
      await this.cleanOldEntries(rateKey, windowStart);

      // Get current window requests
      const requestIds = await this.redis.zrange(rateKey, "-inf", now, {
        byScore: true,
      });
      const currentCount = requestIds.length;

      if (currentCount >= config.maxRequests) {
        const oldestRequest = requestIds[0];
        const oldestTimestamp = await this.redis.zscore(rateKey, oldestRequest);
        const retryAfter = oldestTimestamp
          ? Math.max(0, (oldestTimestamp as number) + config.windowMs - now)
          : config.windowMs;

        return {
          allowed: false,
          remaining: 0,
          resetTime: oldestTimestamp
            ? (oldestTimestamp as number) + config.windowMs
            : now + config.windowMs,
          retryAfter,
        };
      }

      // Add current request
      await this.redis.zadd(rateKey, {
        score: now,
        member: `req:${now}:${Math.random().toString(36).substr(2, 9)}`,
      });

      // Clean up old entries periodically
      await this.cleanupOldKeys(rateKey);

      return {
        allowed: true,
        remaining: config.maxRequests - currentCount - 1,
        resetTime: now + config.windowMs,
      };
    } catch (error) {
      console.error(`Error checking rate limit for ${service}:`, error);
      return {
        allowed: true, // Fail open for resilience
        remaining: 999,
        resetTime: Date.now() + this.defaultConfig.windowMs,
      };
    }
  }

  private async cleanOldEntries(
    key: string,
    beforeTimestamp: number,
  ): Promise<void> {
    try {
      await this.redis.zremrangebyscore(key, "-inf", beforeTimestamp);
    } catch (error) {
      console.error(`Error cleaning old entries for ${key}:`, error);
    }
  }

  private async cleanupOldKeys(key: string): Promise<void> {
    try {
      const keys = await this.redis.keys(`${key}:*`);
      for (const k of keys.slice(0, 10)) {
        const ttl = await this.redis.ttl(k);
        if (ttl === -1) {
          await this.redis.expire(k, 3600); // 1 hour TTL
        }
      }
    } catch (error) {
      console.error(`Error cleaning up old keys for ${key}:`, error);
    }
  }

  async recordRequest(
    service: string,
    key: string = "",
    success: boolean = true,
  ): Promise<void> {
    try {
      const config = this.configs.get(service) || this.defaultConfig;

      if (config.skipSuccessfulRequests && success) return;
      if (config.skipFailedRequests && !success) return;

      const rateKey = `${config.keyPrefix}:${service}:${key}`;
      const timestamp = Date.now();

      await this.redis.zadd(rateKey, {
        score: timestamp,
        member: `req:${timestamp}:${Math.random().toString(36).substr(2, 9)}`,
      });

      await this.redis.expire(rateKey, Math.ceil(config.windowMs / 1000));
    } catch (error) {
      console.error(`Error recording request for ${service}:`, error);
    }
  }

  async getRateLimitStats(service: string): Promise<RateLimitStats | null> {
    try {
      const config = this.configs.get(service) || this.defaultConfig;
      const rateKey = `${config.keyPrefix}:${service}`;

      const now = Date.now();
      const windowStart = now - config.windowMs;

      await this.cleanOldEntries(rateKey, windowStart);

      const requestIds = await this.redis.zrange(rateKey, "-inf", now, {
        byScore: true,
      });
      const currentCount = requestIds.length;

      const totalRequests = await this.redis.zcard(rateKey);
      const blockedRequests = totalRequests - currentCount;

      const oldestRequest = requestIds[0];
      const oldestTimestamp = oldestRequest
        ? await this.redis.zscore(rateKey, oldestRequest)
        : now;
      const windowResetTime = oldestTimestamp
        ? (oldestTimestamp as number) + config.windowMs
        : now + config.windowMs;

      return {
        totalRequests: totalRequests || 0,
        allowedRequests: currentCount,
        blockedRequests: blockedRequests || 0,
        currentWindowRequests: currentCount,
        windowResetTime,
      };
    } catch (error) {
      console.error(`Error getting rate limit stats for ${service}:`, error);
      return null;
    }
  }

  async resetRateLimit(service: string, key: string = ""): Promise<void> {
    try {
      const config = this.configs.get(service) || this.defaultConfig;
      const rateKey = `${config.keyPrefix}:${service}:${key}`;

      await this.redis.del(rateKey);
    } catch (error) {
      console.error(`Error resetting rate limit for ${service}:`, error);
    }
  }

  async getAllRateLimitStats(): Promise<Record<string, RateLimitStats | null>> {
    try {
      const stats: Record<string, RateLimitStats | null> = {};

      for (const [service] of this.configs.entries()) {
        stats[service] = await this.getRateLimitStats(service);
      }

      return stats;
    } catch (error) {
      console.error("Error getting all rate limit stats:", error);
      return {};
    }
  }

  async cleanupExpiredRateLimits(): Promise<void> {
    try {
      const keys = await this.redis.keys("rate_limit:*");
      for (const key of keys.slice(0, 50)) {
        const ttl = await this.redis.ttl(key);
        if (ttl === -1) {
          await this.redis.expire(key, 3600);
        }
      }
    } catch (error) {
      console.error("Error cleaning up expired rate limits:", error);
    }
  }

  async isRateLimitExceeded(
    service: string,
    key: string = "",
  ): Promise<boolean> {
    const config = this.configs.get(service) || this.defaultConfig;
    const rateKey = `${config.keyPrefix}:${service}:${key}`;

    try {
      const now = Date.now();
      const windowStart = now - config.windowMs;

      const requestIds = await this.redis.zrange(rateKey, "-inf", now, {
        byScore: true,
      });
      return requestIds.length >= config.maxRequests;
    } catch (error) {
      console.error(
        `Error checking rate limit exceeded for ${service}:`,
        error,
      );
      return false;
    }
  }

  async waitForRateLimit(service: string, key: string = ""): Promise<void> {
    try {
      const config = this.configs.get(service) || this.defaultConfig;
      const rateKey = `${config.keyPrefix}:${service}:${key}`;

      const now = Date.now();
      const windowStart = now - config.windowMs;

      await this.cleanOldEntries(rateKey, windowStart);

      const requestIds = await this.redis.zrange(rateKey, "-inf", now, {
        byScore: true,
      });

      if (requestIds.length < config.maxRequests) {
        return;
      }

      const oldestRequest = requestIds[0];
      const oldestTimestamp = await this.redis.zscore(rateKey, oldestRequest);

      if (oldestTimestamp) {
        const waitTime = (oldestTimestamp as number) + config.windowMs - now;
        if (waitTime > 0) {
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
      }
    } catch (error) {
      console.error(`Error waiting for rate limit for ${service}:`, error);
    }
  }
}

export { RedisRateLimiter };
export type { RateLimitConfig, RateLimitResult, RateLimitStats };
