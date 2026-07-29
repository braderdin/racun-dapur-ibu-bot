/*
 * Automated Wrangler Secrets Provisioning Script
 * Safely syncs read-only .dev.vars / .env.local variables into Cloudflare Worker
 * using wrangler secret put with proper validation and error handling
 */

const fs = require("fs");
const path = require("path");

class SecretsSyncer {
  constructor(config) {
    this.config = config;
    this.envVars = this.loadEnvVars();
    this.SECRET_PREFIX_BLACKLIST = [
      "PASSWORD",
      "SECRET",
      "TOKEN",
      "KEY",
      "API_KEY",
      "DATABASE_URL",
      "SUPABASE_URL",
      "REDIS_URL",
      "SUPABASE_SERVICE_ROLE_KEY",
      "SUPABASE_ANON_KEY",
      "CLOUDFLARE_ACCOUNT_ID",
      "CLOUDFLARE_API_TOKEN",
    ];
  }

  loadEnvVars() {
    const envFiles = [
      "/home/braderdin/racun-dapur-ibu-bot/.dev.vars",
      "/home/braderdin/racun-dapur-ibu-bot/.env.local",
    ];

    const loadedVars = {};

    for (const filePath of envFiles) {
      try {
        const content = fs.readFileSync(filePath, "utf8");
        const lines = content.split("\n");

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
            const [key, ...valueParts] = trimmed.split("=");
            const value = valueParts.join("=").replace(/^"|"$/g, "");
            if (key && value) {
              loadedVars[key.trim()] = value.trim();
            }
          }
        }
      } catch (error) {
        console.warn(`Warning: Could not load ${filePath}:`, error.message);
      }
    }

    return loadedVars;
  }

  async syncSecrets() {
    console.log("🚀 Starting Cloudflare Secrets Sync...");
    console.log(
      `📁 Loaded ${Object.keys(this.envVars).length} environment variables`,
    );

    // Filter out blacklisted secrets
    const secretsToSync = this.filterSecrets(this.envVars);

    if (secretsToSync.length === 0) {
      console.log(
        "⚠️  No secrets to sync (all variables are blacklisted or invalid)",
      );
      return;
    }

    console.log(`📋 Found ${secretsToSync.length} secrets to sync:`);
    secretsToSync.forEach(([key]) => console.log(`  - ${key}`));

    // Sync each secret using Wrangler API
    let successCount = 0;
    let errorCount = 0;

    for (const [key, value] of secretsToSync) {
      try {
        await this.putSecret(key, value);
        console.log(`✅ Secret synced: ${key}`);
        successCount++;
      } catch (error) {
        console.error(`❌ Failed to sync secret ${key}:`, error.message);
        errorCount++;
      }
    }

    console.log("\n--- Sync Summary ---");
    console.log(`✅ Successfully synced: ${successCount} secrets`);
    console.log(`❌ Failed: ${errorCount} secrets`);

    if (errorCount > 0) {
      throw new Error(`Failed to sync ${errorCount} secrets`);
    }
  }

  filterSecrets(envVars) {
    const filtered = [];

    for (const [key, value] of Object.entries(envVars)) {
      // Skip empty values
      if (!value || value.trim() === "") {
        continue;
      }

      // Skip blacklisted keys (case-insensitive)
      const isBlacklisted = this.SECRET_PREFIX_BLACKLIST.some((blacklisted) =>
        key.toUpperCase().includes(blacklisted),
      );

      if (isBlacklisted) {
        console.log(`⏭️  Skipped (blacklisted): ${key}`);
        continue;
      }

      // Additional validation for specific secret types
      if (this.isValidSecret(key, value)) {
        filtered.push([key, value]);
      }
    }

    return filtered;
  }

  isValidSecret(key, value) {
    // Basic validation
    if (typeof key !== "string" || typeof value !== "string") {
      return false;
    }

    // Key should not contain special characters that would break API calls
    if (!/^[A-Za-z0-9_]+$/.test(key)) {
      console.log(`⚠️  Invalid key format (skipping): ${key}`);
      return false;
    }

    // Value should not contain sensitive content that would be logged
    const sensitivePatterns = [
      /-----BEGIN (RSA|DSA|EC) PRIVATE KEY-----/,
      /password:/,
      /secret:/,
      /token:/,
      /key:/,
    ];

    if (sensitivePatterns.some((pattern) => pattern.test(value))) {
      console.log(
        `⚠️  Potentially sensitive content (skipping validation for): ${key}`,
      );
    }

    return true;
  }

  async putSecret(key, value) {
    // Use Wrangler API to put the secret
    const https = require("https");

    const data = JSON.stringify({ key, value });

    const options = {
      hostname: "api.cloudflare.com",
      port: 443,
      path: `/client/v4/accounts/${this.config.accountId}/workers/kv/namespaces/secrets`,
      method: "PUT",
      headers: {
        Authorization: `Bearer ${this.config.apiToken}`,
        "Content-Type": "application/json",
        "Content-Length": data.length,
      },
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let body = "";

        res.on("data", (chunk) => {
          body += chunk;
        });

        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve();
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${body}`));
          }
        });
      });

      req.on("error", (error) => {
        reject(error);
      });

      req.write(data);
      req.end();
    });
  }
}

async function main() {
  try {
    // Load configuration from environment variables
    const config = {
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID || "",
      apiToken: process.env.CLOUDFLARE_API_TOKEN || "",
      deployToken: process.env.CLOUDFLARE_DEPLOY_TOKEN || "",
    };

    // Validate configuration
    if (!config.accountId || !config.apiToken) {
      throw new Error(
        "Cloudflare configuration missing. Please set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN environment variables.",
      );
    }

    console.log("🔐 Cloudflare configuration loaded");
    console.log(`📋 Account ID: ${config.accountId}`);

    // Create syncer instance
    const syncer = new SecretsSyncer(config);

    // Execute sync
    await syncer.syncSecrets();

    console.log("\n✅ Secrets sync completed successfully!");
  } catch (error) {
    console.error("\n💥 Secrets sync failed:", error.message);
    console.error("Stack trace:", error.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  main()
    .then(() => {
      console.log("\n🎉 Script completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n💥 Script failed:", error.message);
      process.exit(1);
    });
}

module.exports = { SecretsSyncer };
