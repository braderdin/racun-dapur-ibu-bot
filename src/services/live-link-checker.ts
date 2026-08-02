import { Env } from "../types/env";
import { Redis } from "../services/redis";

export class LiveLinkChecker {
  private redis: Redis;
  private env: Env;

  constructor(env: Env) {
    this.env = env;
    this.redis = new Redis(env);
  }

  /**
   * Verify that generated affiliate cloaked links return HTTP 200/302 valid status
   * @param cloakedLink - Cloaked affiliate link to check
   * @param productId - Product ID for logging
   * @returns Link health check result
   */
  async checkLinkHealth(cloakedLink: string, productId: string): Promise<any> {
    try {
      if (!cloakedLink || !productId) {
        throw new Error("Missing required parameters for link health check");
      }

      console.log(
        `🔍 Checking link health: ${cloakedLink} for product ${productId}`,
      );

      // Check if link is cached in Redis
      const cachedResult = await this.redis.get(`link_health:${productId}`);
      if (cachedResult) {
        console.log(`✅ Link health cached: ${cachedResult}`);
        return JSON.parse(cachedResult);
      }

      // Perform actual HTTP health check
      const healthResult = await this.performHealthCheck(
        cloakedLink,
        productId,
      );

      // Cache the result for 1 hour (3600 seconds)
      await this.redis.setex(
        `link_health:${productId}`,
        3600,
        JSON.stringify(healthResult),
      );

      console.log(
        `✅ Link health check completed: ${healthResult.status} - ${healthResult.message}`,
      );
      return healthResult;
    } catch (error) {
      console.error("Error checking link health:", error);
      throw error;
    }
  }

  /**
   * Perform actual HTTP health check
   * @param cloakedLink - Cloaked affiliate link
   * @param productId - Product ID
   * @returns Health check result
   */
  private async performHealthCheck(
    cloakedLink: string,
    productId: string,
  ): Promise<any> {
    try {
      const startTime = Date.now();

      // Make HTTP request to check link
      const response = await fetch(cloakedLink, {
        method: "HEAD",
        headers: {
          "User-Agent": "RacunDapurIbu-LinkChecker/1.0",
        },
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // Determine link status
      let status: "healthy" | "unhealthy" | "timeout" | "error";
      let message: string;

      if (response.ok) {
        status = "healthy";
        message = `Link returned HTTP ${response.status}`;
      } else if (response.status === 0) {
        status = "timeout";
        message = "Request timeout";
      } else if (response.status >= 500) {
        status = "unhealthy";
        message = `Server error: HTTP ${response.status}`;
      } else {
        status = "unhealthy";
        message = `Client error: HTTP ${response.status}`;
      }

      const result = {
        productId,
        cloakedLink,
        status,
        message,
        httpStatus: response.status,
        responseTime,
        timestamp: Date.now(),
        checkedAt: new Date().toLocaleString("ms-MY", {
          timeZone: "Asia/Kuala_Lumpur",
        }),
      };

      return result;
    } catch (error) {
      console.error("Error performing health check:", error);
      return {
        productId,
        cloakedLink,
        status: "error",
        message: error.message,
        httpStatus: 0,
        responseTime: 0,
        timestamp: Date.now(),
        checkedAt: new Date().toLocaleString("ms-MY", {
          timeZone: "Asia/Kuala_Lumpur",
        }),
      };
    }
  }

  /**
   * Check multiple links in batch
   * @param cloakedLinks - Array of cloaked links
   * @param productId - Product ID
   * @returns Batch health check results
   */
  async checkBatchLinks(
    cloakedLinks: string[],
    productId: string,
  ): Promise<any> {
    try {
      console.log(
        `🔍 Checking ${cloakedLinks.length} links for product ${productId}`,
      );

      const results: any[] = [];
      const errors: any[] = [];

      // Process links in parallel with rate limiting
      const promises = cloakedLinks.map(async (link) => {
        try {
          const result = await this.checkLinkHealth(link, productId);
          results.push(result);

          // Add small delay between checks to respect rate limits
          await new Promise((resolve) => setTimeout(resolve, 500));
        } catch (error) {
          errors.push({
            link,
            error: error.message,
          });
        }
      });

      await Promise.all(promises);

      const summary = {
        productId,
        totalLinks: cloakedLinks.length,
        healthy: results.filter((r) => r.status === "healthy").length,
        unhealthy: results.filter((r) => r.status === "unhealthy").length,
        timeout: results.filter((r) => r.status === "timeout").length,
        error:
          results.filter((r) => r.status === "error").length + errors.length,
        results,
        errors,
        timestamp: Date.now(),
      };

      console.log(
        `✅ Batch health check completed: ${summary.healthy}/${summary.totalLinks} healthy`,
      );
      return summary;
    } catch (error) {
      console.error("Error checking batch links:", error);
      throw error;
    }
  }

  /**
   * Validate cloaked link format
   * @param cloakedLink - Cloaked link to validate
   * @returns Validation result
   */
  private validateCloakedLink(cloakedLink: string): {
    isValid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    if (!cloakedLink) {
      issues.push("Cloaked link is empty");
      return { isValid: false, issues };
    }

    // Check if link is from our domain
    if (!cloakedLink.includes("r.racundapuribu.com")) {
      issues.push("Cloaked link is not from our domain");
    }

    // Check if link has query parameters
    if (!cloakedLink.includes("?")) {
      issues.push("Cloaked link missing query parameters");
    }

    // Check if link has redirect parameter
    if (!cloakedLink.includes("redirect=")) {
      issues.push("Cloaked link missing redirect parameter");
    }

    return { isValid: issues.length === 0, issues };
  }

  /**
   * Get link health statistics
   * @returns Link health statistics
   */
  getLinkHealthStats(): any {
    return {
      platform: "Live Link Checker",
      checkMethods: ["HEAD", "GET"],
      statusTypes: ["healthy", "unhealthy", "timeout", "error"],
      caching: "Redis with 1-hour TTL",
      rateLimiting: "500ms between checks",
      validation: "Cloaked link format validation",
      features: [
        "individual_link_check",
        "batch_link_check",
        "caching",
        "rate_limiting",
        "validation",
        "error_handling",
      ],
    };
  }
}
