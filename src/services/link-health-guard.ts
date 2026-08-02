// Link Health Guard
// Verify that cloaked affiliate shortlinks return valid HTTP 200/302 status codes via Upstash Redis edge cache check prior to posting in comments

import { Redis } from "@upstash/redis";
import { performance } from "perf_hooks";

interface LinkHealth {
  id: string;
  originalUrl: string;
  cloakedUrl: string;
  platform: "x" | "facebook";
  status: "healthy" | "unhealthy" | "checking" | "unknown";
  lastChecked: number;
  responseTime: number;
  httpStatus: number;
  error?: string;
  healthScore: number;
  metadata: {
    contentType?: string;
    contentLength?: number;
    cacheControl?: string;
    redirects?: string[];
    finalUrl?: string;
  };
  createdAt: number;
  updatedAt: number;
}

interface HealthCheckResult {
  isHealthy: boolean;
  status: "healthy" | "unhealthy" | "checking" | "unknown";
  responseTime: number;
  httpStatus: number;
  error?: string;
  healthScore: number;
  metadata: any;
}

interface CacheEntry {
  url: string;
  status: "healthy" | "unhealthy" | "checking" | "unknown";
  lastChecked: number;
  ttl: number;
}

class LinkHealthGuard {
  private redis: Redis;
  private healthCache: Map<string, CacheEntry>;
  private healthCheckQueue: Map<string, Promise<HealthCheckResult>>;

  constructor() {
    this.redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });

    this.healthCache = new Map();
    this.healthCheckQueue = new Map();
    this.initializeHealthCache();
  }

  private async initializeHealthCache(): Promise<void> {
    try {
      const keys = await this.redis.keys("health:*");
      for (const key of keys) {
        const cache = await this.redis.get(key);
        if (cache) {
          const parsedCache = JSON.parse(cache as string);
          this.healthCache.set(parsedCache.url, parsedCache);
        }
      }
    } catch (error) {
      console.error("Error initializing health cache:", error);
    }
  }

  async checkLinkHealth(
    originalUrl: string,
    cloakedUrl: string,
    platform: "x" | "facebook",
  ): Promise<HealthCheckResult> {
    try {
      const cacheKey = `health:${cloakedUrl}`;
      const cacheEntry = this.healthCache.get(cloakedUrl);

      if (cacheEntry && Date.now() - cacheEntry.lastChecked < cacheEntry.ttl) {
        return {
          isHealthy: cacheEntry.status === "healthy",
          status: cacheEntry.status,
          responseTime: 0,
          httpStatus: cacheEntry.status === "healthy" ? 200 : 0,
          error:
            cacheEntry.status === "unhealthy" ? "Cached unhealthy" : undefined,
          healthScore: cacheEntry.status === "healthy" ? 100 : 0,
          metadata: {},
        };
      }

      const existingCheck = this.healthCheckQueue.get(cacheKey);
      if (existingCheck) {
        return await existingCheck;
      }

      const checkPromise = this.performHealthCheck(
        originalUrl,
        cloakedUrl,
        platform,
      );
      this.healthCheckQueue.set(cacheKey, checkPromise);

      const result = await checkPromise;
      this.healthCheckQueue.delete(cacheKey);

      await this.updateHealthCache(cloakedUrl, result, platform);

      return result;
    } catch (error) {
      console.error("Error checking link health:", error);
      return {
        isHealthy: false,
        status: "unknown",
        responseTime: 0,
        httpStatus: 0,
        error: error instanceof Error ? error.message : "Unknown error",
        healthScore: 0,
        metadata: {},
      };
    }
  }

  private async performHealthCheck(
    originalUrl: string,
    cloakedUrl: string,
    platform: "x" | "facebook",
  ): Promise<HealthCheckResult> {
    const startTime = performance.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(cloakedUrl, {
        method: "HEAD",
        headers: {
          "User-Agent": this.getUserAgent(platform),
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
          "Accept-Encoding": "gzip, deflate, br",
          Connection: "keep-alive",
          "Upgrade-Insecure-Requests": "1",
        },
        redirect: "follow",
        signal: controller.signal,
        cf: {
          cacheEverything: true,
        },
      });

      clearTimeout(timeoutId);

      const responseTime = performance.now() - startTime;
      const httpStatus = response.status;
      const isHealthy = httpStatus >= 200 && httpStatus < 400;

      const metadata = {
        contentType: response.headers.get("content-type"),
        contentLength: response.headers.get("content-length"),
        cacheControl: response.headers.get("cache-control"),
        redirects: [],
        finalUrl: response.url,
      };

      const healthScore = this.calculateHealthScore(
        responseTime,
        httpStatus,
        isHealthy,
      );

      return {
        isHealthy,
        status: isHealthy ? "healthy" : "unhealthy",
        responseTime,
        httpStatus,
        error: isHealthy ? undefined : `HTTP ${httpStatus}`,
        healthScore,
        metadata,
      };
    } catch (error) {
      const responseTime = performance.now() - startTime;

      return {
        isHealthy: false,
        status: "unhealthy",
        responseTime,
        httpStatus: 0,
        error: error instanceof Error ? error.message : "Network error",
        healthScore: 0,
        metadata: {},
      };
    }
  }

  private calculateHealthScore(
    responseTime: number,
    httpStatus: number,
    isHealthy: boolean,
  ): number {
    let score = 0;

    if (isHealthy) {
      score += 50;
    }

    if (httpStatus >= 200 && httpStatus < 300) {
      score += 30;
    } else if (httpStatus >= 300 && httpStatus < 400) {
      score += 20;
    } else if (httpStatus >= 400 && httpStatus < 500) {
      score += 10;
    }

    if (responseTime < 1000) {
      score += 20;
    } else if (responseTime < 3000) {
      score += 10;
    } else {
      score += 0;
    }

    return Math.min(score, 100);
  }

  private getUserAgent(platform: "x" | "facebook"): string {
    const userAgents = {
      x: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      facebook:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1",
    };

    return userAgents[platform];
  }

  private async updateHealthCache(
    cloakedUrl: string,
    result: HealthCheckResult,
    platform: "x" | "facebook",
  ): Promise<void> {
    try {
      const cacheEntry: CacheEntry = {
        url: cloakedUrl,
        status: result.status,
        lastChecked: Date.now(),
        ttl: result.isHealthy ? 3600000 : 300000,
      };

      this.healthCache.set(cloakedUrl, cacheEntry);

      await this.redis.setex(
        `health:${cloakedUrl}`,
        cacheEntry.ttl / 1000,
        JSON.stringify(cacheEntry),
      );

      await this.redis.zadd("health_index", {
        score: result.healthScore,
        member: `url:${cloakedUrl}`,
      });
    } catch (error) {
      console.error("Error updating health cache:", error);
    }
  }

  async getLinkHealth(cloakedUrl: string): Promise<LinkHealth | null> {
    try {
      const cacheEntry = this.healthCache.get(cloakedUrl);
      if (cacheEntry) {
        return {
          id: `health:${cloakedUrl}`,
          originalUrl: "",
          cloakedUrl,
          platform: "x",
          status: cacheEntry.status,
          lastChecked: cacheEntry.lastChecked,
          responseTime: 0,
          httpStatus: cacheEntry.status === "healthy" ? 200 : 0,
          healthScore: cacheEntry.status === "healthy" ? 100 : 0,
          metadata: {},
          createdAt: cacheEntry.lastChecked,
          updatedAt: cacheEntry.lastChecked,
        };
      }

      const cached = await this.redis.get(`health:${cloakedUrl}`);
      if (cached) {
        return JSON.parse(cached as string);
      }

      return null;
    } catch (error) {
      console.error("Error getting link health:", error);
      return null;
    }
  }

  async getUnhealthyLinks(
    platform?: "x" | "facebook",
    limit: number = 10,
  ): Promise<LinkHealth[]> {
    try {
      const keys = await this.redis.keys("health:*");
      const unhealthyLinks: LinkHealth[] = [];

      for (const key of keys.slice(0, 100)) {
        const health = await this.redis.get(key);
        if (health) {
          const parsed = JSON.parse(health as string);
          if (
            parsed.status === "unhealthy" &&
            (!platform || parsed.platform === platform)
          ) {
            unhealthyLinks.push(parsed);
          }
        }
      }

      unhealthyLinks.sort((a, b) => b.updatedAt - a.updatedAt);
      return unhealthyLinks.slice(0, limit);
    } catch (error) {
      console.error("Error getting unhealthy links:", error);
      return [];
    }
  }

  async getHealthyLinks(
    platform?: "x" | "facebook",
    limit: number = 10,
  ): Promise<LinkHealth[]> {
    try {
      const keys = await this.redis.keys("health:*");
      const healthyLinks: LinkHealth[] = [];

      for (const key of keys.slice(0, 100)) {
        const health = await this.redis.get(key);
        if (health) {
          const parsed = JSON.parse(health as string);
          if (
            parsed.status === "healthy" &&
            (!platform || parsed.platform === platform)
          ) {
            healthyLinks.push(parsed);
          }
        }
      }

      healthyLinks.sort((a, b) => b.healthScore - a.healthScore);
      return healthyLinks.slice(0, limit);
    } catch (error) {
      console.error("Error getting healthy links:", error);
      return [];
    }
  }

  async getLinkHealthStats(): Promise<any> {
    try {
      const totalLinks = await this.redis.zcard("health_index");
      const healthyCount = await this.redis.zcount("health_index", 50, 100);
      const unhealthyCount = await this.redis.zcount("health_index", 0, 49);

      const platformStats: Record<string, number> = {};
      const statusStats: Record<string, number> = {};

      const keys = await this.redis.keys("health:*");
      for (const key of keys.slice(0, 100)) {
        const health = await this.redis.get(key);
        if (health) {
          const parsed = JSON.parse(health as string);
          platformStats[parsed.platform] =
            (platformStats[parsed.platform] || 0) + 1;
          statusStats[parsed.status] = (statusStats[parsed.status] || 0) + 1;
        }
      }

      return {
        totalLinks,
        healthyCount,
        unhealthyCount,
        platformStats,
        statusStats,
        lastUpdated: Date.now(),
      };
    } catch (error) {
      console.error("Error getting link health stats:", error);
      return null;
    }
  }

  async cleanupOldHealthRecords(
    olderThan: number = 7 * 24 * 60 * 60 * 1000,
  ): Promise<void> {
    try {
      const now = Date.now();
      const keysToDelete: string[] = [];

      for (const [url, cacheEntry] of this.healthCache.entries()) {
        if (now - cacheEntry.lastChecked > olderThan) {
          keysToDelete.push(`health:${url}`);
        }
      }

      for (const key of keysToDelete) {
        await this.redis.del(key);
        this.healthCache.delete(key.replace("health:", ""));
      }
    } catch (error) {
      console.error("Error cleaning up old health records:", error);
    }
  }

  async batchCheckLinks(
    links: {
      originalUrl: string;
      cloakedUrl: string;
      platform: "x" | "facebook";
    }[],
  ): Promise<HealthCheckResult[]> {
    const results: HealthCheckResult[] = [];

    for (const link of links) {
      try {
        const result = await this.checkLinkHealth(
          link.originalUrl,
          link.cloakedUrl,
          link.platform,
        );
        results.push(result);
      } catch (error) {
        console.error(`Error checking link ${link.cloakedUrl}:`, error);
        results.push({
          isHealthy: false,
          status: "unknown",
          responseTime: 0,
          httpStatus: 0,
          error: error instanceof Error ? error.message : "Unknown error",
          healthScore: 0,
          metadata: {},
        });
      }
    }

    return results;
  }

  async getHealthCheckQueueSize(): Promise<number> {
    return this.healthCheckQueue.size;
  }

  async getHealthCacheSize(): Promise<number> {
    return this.healthCache.size;
  }

  async validateLinkForPosting(
    cloakedUrl: string,
  ): Promise<{ isValid: boolean; reason?: string; health?: LinkHealth }> {
    try {
      const health = await this.getLinkHealth(cloakedUrl);
      if (!health) {
        return { isValid: false, reason: "Link health not found" };
      }

      if (health.status === "unhealthy") {
        return {
          isValid: false,
          reason: `Link unhealthy: ${health.error}`,
          health,
        };
      }

      if (health.healthScore < 50) {
        return {
          isValid: false,
          reason: `Low health score: ${health.healthScore}`,
          health,
        };
      }

      if (health.httpStatus >= 400) {
        return {
          isValid: false,
          reason: `HTTP error: ${health.httpStatus}`,
          health,
        };
      }

      return { isValid: true, health };
    } catch (error) {
      console.error("Error validating link for posting:", error);
      return {
        isValid: false,
        reason: error instanceof Error ? error.message : "Validation error",
      };
    }
  }
}

export { LinkHealthGuard };
export type { LinkHealth, HealthCheckResult, CacheEntry };
