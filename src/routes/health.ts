/*
 * Health & Diagnostics Handler
 * Lightweight `/health` endpoint returning system status, Redis status, and database connectivity metrics
 */

export interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  uptime: number;
  version: string;
  services: {
    redis?: {
      status: "up" | "down" | "unknown";
      responseTime?: number;
      error?: string;
    };
    supabase?: {
      status: "up" | "down" | "unknown";
      responseTime?: number;
      error?: string;
    };
    storage?: {
      status: "up" | "down" | "unknown";
      responseTime?: number;
      error?: string;
    };
  };
  metrics: {
    totalRequests?: number;
    activeConnections?: number;
    memoryUsage?: {
      rss: number;
      heapTotal: number;
      heapUsed: number;
    };
  };
}

export class HealthHandler {
  private startTime: number;

  constructor() {
    this.startTime = Date.now();
  }

  async getHealthStatus(): Promise<HealthStatus> {
    const timestamp = new Date().toISOString();
    const uptime = Date.now() - this.startTime;

    const status: HealthStatus = {
      status: "healthy",
      timestamp,
      uptime,
      version: "1.0.0",
      services: {},
      metrics: {},
    };

    // Check Redis service
    status.services.redis = await this.checkRedisService();

    // Check Supabase service
    status.services.supabase = await this.checkSupabaseService();

    // Check storage service (Backblaze B2)
    status.services.storage = await this.checkStorageService();

    // Determine overall status
    status.status = this.determineOverallStatus(status.services);

    // Add metrics
    status.metrics = await this.collectMetrics();

    return status;
  }

  private async checkRedisService(): Promise<
    HealthStatus["services"]["redis"]
  > {
    try {
      // Import here to avoid circular dependencies
      const { RedisService } = await import("./../services/redis");

      const startTime = Date.now();
      const redisService = new RedisService({} as any); // Mock env for status check

      // Try a simple operation to test connectivity
      await redisService.get("health_check");

      const responseTime = Date.now() - startTime;

      return {
        status: "up",
        responseTime,
      };
    } catch (error) {
      console.error("Redis health check failed:", error);
      return {
        status: "down",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async checkSupabaseService(): Promise<
    HealthStatus["services"]["supabase"]
  > {
    try {
      // Import here to avoid circular dependencies
      const { SupabaseService } = await import("./../services/supabase");

      const startTime = Date.now();
      const supabaseService = new SupabaseService({} as any); // Mock env for status check

      // Try a simple query to test connectivity
      const result = await supabaseService.getRecentProducts(1);

      const responseTime = Date.now() - startTime;

      return {
        status: "up",
        responseTime,
      };
    } catch (error) {
      console.error("Supabase health check failed:", error);
      return {
        status: "down",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async checkStorageService(): Promise<
    HealthStatus["services"]["storage"]
  > {
    try {
      // Import here to avoid circular dependencies
      const { B2StorageService } = await import("./services/b2-storage");

      const startTime = Date.now();
      const b2Service = new B2StorageService({} as any); // Mock env for status check

      // Try a simple operation to test connectivity
      const testData = new ArrayBuffer(100); // 100 bytes test data
      await b2Service.uploadProductImage(testData, "health_check_test.txt");

      const responseTime = Date.now() - startTime;

      return {
        status: "up",
        responseTime,
      };
    } catch (error) {
      console.error("Storage service health check failed:", error);
      return {
        status: "down",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async checkFacebookService(): Promise<
    HealthStatus["services"]["facebook"]
  > {
    try {
      // Import here to avoid circular dependencies
      const { FacebookService } = await import("./services/facebook");

      const startTime = Date.now();
      const facebookService = new FacebookService({} as any); // Mock env for status check

      // Test Facebook Graph API connectivity
      const healthResult = await facebookService.healthCheck();

      const responseTime = Date.now() - startTime;

      return {
        status: healthResult.status,
        responseTime,
        error:
          healthResult.status === "unhealthy"
            ? healthResult.details
            : undefined,
      };
    } catch (error) {
      console.error("Facebook service health check failed:", error);
      return {
        status: "down",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private determineOverallStatus(
    services: HealthStatus["services"],
  ): HealthStatus["status"] {
    const downServices = Object.entries(services).filter(
      ([, service]) => service?.status === "down",
    );

    if (downServices.length === 0) {
      return "healthy";
    } else if (downServices.length === Object.keys(services).length) {
      return "unhealthy";
    } else {
      return "degraded";
    }
  }

  private async collectMetrics(): Promise<HealthStatus["metrics"]> {
    try {
      // Collect basic metrics about the worker
      const metrics: HealthStatus["metrics"] = {};

      // Try to get memory usage if available
      if (typeof process !== "undefined" && process.memoryUsage) {
        metrics.memoryUsage = process.memoryUsage();
      }

      // Add any custom metrics here
      metrics.totalRequests = 0; // This would be tracked by your actual monitoring
      metrics.activeConnections = 0; // This would be tracked by your actual monitoring

      return metrics;
    } catch (error) {
      console.error("Failed to collect metrics:", error);
      return {};
    }
  }

  // Simple health response for quick endpoint (faster version)
  getQuickHealth(): Omit<HealthStatus, "services" | "metrics"> {
    return {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      version: "1.0.0",
    };
  }
}

// HTTP handler function for the health endpoint
export async function healthHandler(
  request: Request,
  env: any,
): Promise<Response> {
  const healthHandler = new HealthHandler();

  try {
    // For quick health checks (when headers request quick response)
    const url = new URL(request.url);
    const quick = url.searchParams.get("quick") === "true";

    let healthStatus: HealthStatus;

    if (quick) {
      // Return simplified health status for faster response
      healthStatus = healthHandler.getQuickHealth();
    } else {
      // Return full health status with detailed service checks
      healthStatus = await healthHandler.getHealthStatus();
    }

    const statusCode = healthStatus.status === "unhealthy" ? 503 : 200;

    return new Response(JSON.stringify(healthStatus, null, 2), {
      status: statusCode,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error) {
    console.error("Health check failed:", error);

    return new Response(
      JSON.stringify({
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: "Health check failed",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }
}

// Health check function for programmatic use
export async function performHealthCheck(env: any): Promise<HealthStatus> {
  const healthHandler = new HealthHandler();
  return await healthHandler.getHealthStatus();
}
