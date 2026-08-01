#!/usr/bin/env node

/*
 * Automated Failover Recovery & Health Diagnostics Script
 * Pings all system endpoints, checks circuit breaker states,
 * and triggers failover alerts to Discord if any microservice degrades.
 *
 * Phase 8: Autonomous AI Curation Engine
 * All credentials read from environment variables — no hardcoded secrets.
 */

const http = require("http");
const https = require("https");

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const CONFIG = {
  endpoints: [
    { name: "Supabase DB", url: process.env.SUPABASE_URL || "", timeout: 5000 },
    {
      name: "Upstash Redis",
      url: process.env.UPSTASH_REDIS_REST_URL || "",
      timeout: 5000,
    },
    {
      name: "Upstash Vector",
      url: process.env.UPSTASH_VECTOR_REST_URL || "",
      timeout: 5000,
    },
    {
      name: "Upstash QStash",
      url: process.env.UPSTASH_QSTASH_URL || "",
      timeout: 5000,
    },
    {
      name: "Backblaze B2",
      url: process.env.BACKBLAZE_STORAGE_BASE_URL || "",
      timeout: 5000,
    },
    {
      name: "OpenRouter AI",
      url: process.env.OPENROUTER_PROXY_URL || "",
      timeout: 5000,
    },
    {
      name: "Discord Webhook",
      url: process.env.DISCORD_WEBHOOK_URL || "",
      timeout: 5000,
    },
    {
      name: "Vercel Portal",
      url: process.env.NEXT_PUBLIC_API_URL || "",
      timeout: 5000,
    },
  ],
  circuitBreakerThreshold: 3,
  circuitBreakerTimeoutMs: 30000,
  discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL || "",
  checkIntervalMs: parseInt(
    process.env.HEALTH_CHECK_INTERVAL_MS || "60000",
    10,
  ),
};

// ---------------------------------------------------------------------------
// Circuit Breaker State
// ---------------------------------------------------------------------------

class CircuitBreaker {
  constructor(name, threshold, timeoutMs) {
    this.name = name;
    this.threshold = threshold;
    this.timeoutMs = timeoutMs;
    this.errorCount = 0;
    this.state = "closed"; // closed, open, half-open
    this.lastFailureTime = null;
  }

  recordSuccess() {
    this.errorCount = 0;
    this.state = "closed";
  }

  recordFailure() {
    this.errorCount++;
    this.lastFailureTime = Date.now();
    if (this.errorCount >= this.threshold) {
      this.state = "open";
    }
  }

  canExecute() {
    if (this.state === "closed") return true;
    if (this.state === "open") {
      if (Date.now() - this.lastFailureTime > this.timeoutMs) {
        this.state = "half-open";
        return true;
      }
      return false;
    }
    return true; // half-open
  }

  getStatus() {
    return {
      name: this.name,
      state: this.state,
      errorCount: this.errorCount,
      lastFailureTime: this.lastFailureTime
        ? new Date(this.lastFailureTime).toISOString()
        : null,
    };
  }
}

// ---------------------------------------------------------------------------
// Health Checker
// ---------------------------------------------------------------------------

class HealthChecker {
  constructor(config) {
    this.config = config;
    this.circuitBreakers = new Map();
    this.results = [];

    // Initialize circuit breakers for each endpoint
    config.endpoints.forEach((ep) => {
      this.circuitBreakers.set(
        ep.name,
        new CircuitBreaker(
          ep.name,
          config.circuitBreakerThreshold,
          config.circuitBreakerTimeoutMs,
        ),
      );
    });
  }

  // ---------------------------------------------------------------------
  // Ping a single endpoint
  // ---------------------------------------------------------------------

  async pingEndpoint(endpoint) {
    const cb = this.circuitBreakers.get(endpoint.name);

    if (!cb.canExecute()) {
      return {
        name: endpoint.name,
        status: "circuit_open",
        responseTimeMs: 0,
        error: "Circuit breaker is open",
      };
    }

    const startTime = Date.now();

    try {
      const url = new URL(endpoint.url);
      const protocol = url.protocol === "https:" ? https : http;

      const response = await new Promise((resolve, reject) => {
        const req = protocol.get(
          endpoint.url,
          { timeout: endpoint.timeout },
          (res) => {
            let data = "";
            res.on("data", (chunk) => {
              data += chunk;
            });
            res.on("end", () =>
              resolve({ statusCode: res.statusCode, body: data }),
            );
          },
        );
        req.on("error", reject);
        req.on("timeout", () => {
          req.destroy();
          reject(new Error("Timeout"));
        });
      });

      const responseTimeMs = Date.now() - startTime;

      if (response.statusCode >= 200 && response.statusCode < 300) {
        cb.recordSuccess();
        return {
          name: endpoint.name,
          status: "healthy",
          responseTimeMs,
          statusCode: response.statusCode,
        };
      } else {
        cb.recordFailure();
        return {
          name: endpoint.name,
          status: "degraded",
          responseTimeMs,
          statusCode: response.statusCode,
          error: `HTTP ${response.statusCode}`,
        };
      }
    } catch (error) {
      cb.recordFailure();
      const responseTimeMs = Date.now() - startTime;
      return {
        name: endpoint.name,
        status: "unhealthy",
        responseTimeMs,
        error: error.message,
      };
    }
  }

  // ---------------------------------------------------------------------
  // Run full health check
  // ---------------------------------------------------------------------

  async runHealthCheck() {
    console.log("[Health Check] Starting system diagnostics...");

    const results = [];
    for (const endpoint of this.config.endpoints) {
      const result = await this.pingEndpoint(endpoint);
      results.push(result);
      console.log(
        `[Health Check] ${result.name}: ${result.status} (${result.responseTimeMs}ms)`,
      );
    }

    this.results = results;
    return results;
  }

  // ---------------------------------------------------------------------
  // Check if any service needs failover
  // ---------------------------------------------------------------------

  checkFailoverNeeds() {
    const unhealthy = this.results.filter(
      (r) => r.status === "unhealthy" || r.status === "degraded",
    );

    const circuitOpen = this.results.filter((r) => r.status === "circuit_open");

    return {
      needsFailover: unhealthy.length > 0 || circuitOpen.length > 0,
      unhealthyServices: unhealthy.map((r) => r.name),
      circuitOpenServices: circuitOpen.map((r) => r.name),
      overallStatus: unhealthy.length > 0 ? "degraded" : "healthy",
    };
  }

  // ---------------------------------------------------------------------
  // Send Discord alert
  // ---------------------------------------------------------------------

  async sendDiscordAlert(failoverInfo) {
    if (!this.config.discordWebhookUrl) {
      console.log("[Discord] No webhook URL configured, skipping alert.");
      return false;
    }

    const embed = {
      title: "WARN System Health Alert — Failover Triggered",
      description: `Overall status: **${failoverInfo.overallStatus}**`,
      color: failoverInfo.overallStatus === "degraded" ? 15158332 : 16776960,
      fields: [
        {
          name: "Unhealthy Services",
          value:
            failoverInfo.unhealthyServices.length > 0
              ? failoverInfo.unhealthyServices.join(", ")
              : "None",
          inline: true,
        },
        {
          name: "Circuit Breaker Open",
          value:
            failoverInfo.circuitOpenServices.length > 0
              ? failoverInfo.circuitOpenServices.join(", ")
              : "None",
          inline: true,
        },
        {
          name: "Timestamp",
          value: new Date().toISOString(),
          inline: false,
        },
      ],
      footer: {
        text: "Racun Dapur Ibu Health Monitor",
        timestamp: new Date().toISOString(),
      },
    };

    try {
      const response = await fetch(this.config.discordWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ embeds: [embed] }),
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        console.log("[Discord] Failover alert sent successfully.");
        return true;
      } else {
        console.log(`[Discord] Failed to send alert: HTTP ${response.status}`);
        return false;
      }
    } catch (error) {
      console.log(`[Discord] Error sending alert: ${error.message}`);
      return false;
    }
  }

  // ---------------------------------------------------------------------
  // Print diagnostic report
  // ---------------------------------------------------------------------

  printReport() {
    console.log("\n" + "=".repeat(60));
    console.log("  SYSTEM HEALTH DIAGNOSTIC REPORT");
    console.log("=".repeat(60));
    console.log(`  Timestamp: ${new Date().toISOString()}`);
    console.log(`  Total Endpoints: ${this.config.endpoints.length}`);

    const healthy = this.results.filter((r) => r.status === "healthy").length;
    const degraded = this.results.filter((r) => r.status === "degraded").length;
    const unhealthy = this.results.filter(
      (r) => r.status === "unhealthy",
    ).length;
    const circuitOpen = this.results.filter(
      (r) => r.status === "circuit_open",
    ).length;

    console.log(
      `  Healthy: ${healthy} | Degraded: ${degraded} | Unhealthy: ${unhealthy} | Circuit Open: ${circuitOpen}`,
    );
    console.log("-".repeat(60));

    this.results.forEach((r) => {
      const icon =
        r.status === "healthy"
          ? "OK2"
          : r.status === "degraded"
            ? "WARN"
            : "FAIL";
      console.log(`  ${icon} ${r.name}: ${r.status} (${r.responseTimeMs}ms)`);
      if (r.error) {
        console.log(`     Error: ${r.error}`);
      }
    });

    const failoverInfo = this.checkFailoverNeeds();
    console.log("-".repeat(60));
    console.log(
      `  Overall Status: ${failoverInfo.overallStatus.toUpperCase()}`,
    );
    console.log("=".repeat(60) + "\n");

    return failoverInfo;
  }
}

// ---------------------------------------------------------------------------
// Main execution
// ---------------------------------------------------------------------------

async function main() {
  console.log("[Health Failover] Starting automated health diagnostics...");

  const checker = new HealthChecker(CONFIG);

  // Run health check
  await checker.runHealthCheck();

  // Print report
  const failoverInfo = checker.printReport();

  // Trigger Discord alert if needed
  if (failoverInfo.needsFailover) {
    console.log(
      "[Health Failover] Degraded services detected. Sending Discord alert...",
    );
    await checker.sendDiscordAlert(failoverInfo);
  } else {
    console.log(
      "[Health Failover] All systems operational. No failover needed.",
    );
  }

  // Exit with appropriate code
  process.exit(failoverInfo.needsFailover ? 1 : 0);
}

// Run
main().catch((error) => {
  console.error("[Health Failover] Fatal error:", error.message);
  process.exit(1);
});
