#!/usr/bin/env node
/*
 * Production Verification & Health Diagnostics Script
 * Phase 10: Pings Cloudflare Worker endpoints, Supabase IPv4 Session Pooler,
 * Upstash Redis/Vector, and B2 Storage buckets with structured logging.
 *
 * Usage: node bin/verify-full-production.js
 * All credentials read from environment variables — no hardcoded secrets.
 */

const http = require("http");
const https = require("https");

// ---------------------------------------------------------------------------
// Configuration — all from environment
// ---------------------------------------------------------------------------

const ENDPOINTS = [
  {
    name: "Cloudflare Worker",
    url: process.env.CF_WORKER_URL || "",
    timeout: 5000,
    type: "worker",
  },
  {
    name: "Supabase IPv4 Session Pooler",
    url: process.env.SUPABASE_URL || "",
    timeout: 5000,
    type: "supabase",
  },
  {
    name: "Upstash Redis",
    url: process.env.UPSTASH_REDIS_REST_URL || "",
    timeout: 5000,
    type: "redis",
  },
  {
    name: "Upstash Vector",
    url: process.env.UPSTASH_VECTOR_REST_URL || "",
    timeout: 5000,
    type: "vector",
  },
  {
    name: "Backblaze B2 Storage",
    url: process.env.BACKBLAZE_STORAGE_BASE_URL || "",
    timeout: 5000,
    type: "b2",
  },
  {
    name: "QStash",
    url: process.env.UPSTASH_QSTASH_URL || "",
    timeout: 5000,
    type: "qstash",
  },
  {
    name: "OpenRouter AI",
    url: process.env.OPENROUTER_BASE_URL || "",
    timeout: 5000,
    type: "openrouter",
  },
  {
    name: "Vercel Portal API",
    url: process.env.NEXT_PUBLIC_API_URL || "",
    timeout: 5000,
    type: "vercel",
  },
];

// ---------------------------------------------------------------------------
// HTTP ping helper
// ---------------------------------------------------------------------------

function pingEndpoint(endpoint) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const url = endpoint.url;

    if (!url) {
      resolve({
        name: endpoint.name,
        type: endpoint.type,
        status: "skipped",
        responseTimeMs: 0,
        error: "URL not configured in environment",
      });
      return;
    }

    const protocol = url.startsWith("https") ? https : http;

    const req = protocol.get(
      url,
      {
        timeout: endpoint.timeout,
        headers: { "User-Agent": "racun-dapur-ibu-health-check/1.0" },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          const responseTimeMs = Date.now() - startTime;
          const status =
            res.statusCode >= 200 && res.statusCode < 300
              ? "healthy"
              : "degraded";
          resolve({
            name: endpoint.name,
            type: endpoint.type,
            status,
            responseTimeMs,
            statusCode: res.statusCode,
          });
        });
      },
    );

    req.on("error", (err) => {
      const responseTimeMs = Date.now() - startTime;
      resolve({
        name: endpoint.name,
        type: endpoint.type,
        status: "unhealthy",
        responseTimeMs,
        error: err.message,
      });
    });

    req.on("timeout", () => {
      req.destroy();
      resolve({
        name: endpoint.name,
        type: endpoint.type,
        status: "unhealthy",
        responseTimeMs: Date.now() - startTime,
        error: "Timeout",
      });
    });
  });
}

// ---------------------------------------------------------------------------
// Main execution
// ---------------------------------------------------------------------------

async function main() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log(
    "║  Production Verification — Phase 10                          ║",
  );
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log();

  const results = [];

  for (const endpoint of ENDPOINTS) {
    const result = await pingEndpoint(endpoint);
    results.push(result);
    const icon =
      result.status === "healthy"
        ? "OK2"
        : result.status === "degraded"
          ? "WARN"
          : result.status === "skipped"
            ? "⏭️"
            : "FAIL";
    console.log(
      `  ${icon} ${result.name.padEnd(35)} ${result.status.padEnd(10)} ${result.responseTimeMs}ms`,
    );
    if (result.error) {
      console.log(`     ↳ ${result.error}`);
    }
  }

  // Summary
  const healthy = results.filter((r) => r.status === "healthy").length;
  const degraded = results.filter((r) => r.status === "degraded").length;
  const unhealthy = results.filter((r) => r.status === "unhealthy").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  const total = results.length;

  console.log();
  console.log("=".repeat(60));
  console.log("  SUMMARY");
  console.log("=".repeat(60));
  console.log(
    `  Total: ${total} | Healthy: ${healthy} | Degraded: ${degraded} | Unhealthy: ${unhealthy} | Skipped: ${skipped}`,
  );
  console.log(`  Timestamp: ${new Date().toISOString()}`);
  console.log("=".repeat(60));

  // Exit code: 0 if no unhealthy, 1 otherwise
  const exitCode = unhealthy > 0 ? 1 : 0;
  process.exit(exitCode);
}

main().catch((error) => {
  console.error("[Verify] Fatal error:", error.message);
  process.exit(1);
});
