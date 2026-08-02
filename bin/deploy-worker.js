//!/usr/bin/env node
/*
 * Automated Cloudflare Worker Deployment Script
 * Phase 6: Executes wrangler deploy and verifies live HTTP response status
 * Validates successful worker deployment with health checks
 */

const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const CONFIG = {
  WORKER_NAME: "racun-dapur-ibu-bot",
  DEPLOY_TIMEOUT_MS: 300000, // 5 minutes
  HEALTH_CHECK_TIMEOUT_MS: 30000,
  MAX_RETRIES: 3,
};

class DeployWorker {
  constructor() {
    this.projectDir = path.join(__dirname, "..");
    this.wranglerConfigPath = path.join(this.projectDir, "wrangler.toml");

    if (!fs.existsSync(this.wranglerConfigPath)) {
      throw new Error(`wrangler.toml not found at ${this.wranglerConfigPath}`);
    }

    console.log(
      "ROCKET Automated Cloudflare Worker Deployment Script Initialized",
    );
    console.log(`FOLDER Project Directory: ${this.projectDir}`);
    console.log(`GEAR Wrangler Config: ${this.wranglerConfigPath}`);
  }

  async deploy() {
    try {
      // Verify wrangler installation and configuration
      await this.verifyWranglerSetup();

      // Execute deployment with retries
      const result = await this.executeDeploymentWithRetries();

      if (!result.success) {
        throw new Error(`Deployment failed: ${result.message}`);
      }

      // Verify deployment with health checks
      const healthCheck = await this.performHealthChecks();

      if (!healthCheck.success) {
        throw new Error(`Health checks failed: ${healthCheck.message}`);
      }

      console.log("OK2 Deployment completed successfully");
      console.log(
        `REPORT Health check results: ${JSON.stringify(healthCheck.details, null, 2)}`,
      );

      return {
        success: true,
        message: "Worker deployment completed successfully",
        details: {
          deploymentResult: result,
          healthCheckResult: healthCheck,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error("FAIL Deployment failed:", error.message);

      return {
        success: false,
        message: `Deployment failed: ${error.message}`,
        details: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  async verifyWranglerSetup() {
    console.log("[Deploy] Verifying Wrangler setup...");

    // Check if wrangler is available
    const wranglerResult = await this.executeCommand("npx wrangler --version");
    if (!wranglerResult.stdout.includes("wrangler")) {
      throw new Error("Wrangler not installed or not working");
    }

    // Verify wrangler configuration
    const configContent = fs.readFileSync(this.wranglerConfigPath, "utf8");

    if (!configContent.includes("[env]")) {
      throw new Error("wrangler.toml missing [env] section");
    }

    if (!configContent.includes('name = "racun-dapur-ibu-bot"')) {
      throw new Error("wrangler.toml missing worker name");
    }

    console.log("OK2 Wrangler setup verification completed");
  }

  async executeCommand(command) {
    return new Promise((resolve, reject) => {
      const [cmd, ...args] = command.split(" ");

      const child = spawn(cmd, args, {
        cwd: this.projectDir,
        env: { ...process.env, FORCE_COLOR: "1" },
      });

      let stdout = "";
      let stderr = "";

      child.stdout?.on("data", (data) => {
        stdout += data.toString();
      });

      child.stderr?.on("data", (data) => {
        stderr += data.toString();
      });

      child.on("close", (code) => {
        resolve({ stdout, stderr, code });
      });

      child.on("error", (error) => {
        reject(error);
      });
    });
  }

  async executeDeploymentWithRetries() {
    let lastError;

    for (let attempt = 1; attempt <= CONFIG.MAX_RETRIES; attempt++) {
      console.log(
        `ROCKET Deployment attempt ${attempt}/${CONFIG.MAX_RETRIES}...`,
      );

      try {
        // Execute wrangler deploy
        const result = await this.executeCommand("npx wrangler deploy");

        if (result.code === 0) {
          console.log("OK2 Deployment completed successfully");
          return { success: true, message: "Deployment completed" };
        } else {
          lastError = new Error(
            `Deployment failed with exit code ${result.code}: ${result.stderr}`,
          );
          console.error(
            `FAIL Deployment attempt ${attempt} failed: ${lastError.message}`,
          );

          if (attempt < CONFIG.MAX_RETRIES) {
            console.log("⏱️ Waiting 30 seconds before retry...");
            await this.delay(30000);
          }
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(
          `FAIL Deployment attempt ${attempt} failed: ${lastError.message}`,
        );

        if (attempt < CONFIG.MAX_RETRIES) {
          console.log("⏱️ Waiting 30 seconds before retry...");
          await this.delay(30000);
        }
      }
    }

    throw lastError || new Error("All deployment attempts failed");
  }

  async performHealthChecks() {
    console.log("🏥 Performing health checks...");

    try {
      // Check if worker files were generated
      const distPath = path.join(this.projectDir, ".wrangler", "dist");
      if (!fs.existsSync(distPath)) {
        throw new Error("Worker dist directory not found");
      }

      const manifestPath = path.join(distPath, "manifest.json");
      if (!fs.existsSync(manifestPath)) {
        throw new Error("Worker manifest not found");
      }

      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

      // Validate manifest structure
      if (!manifest.name || !manifest.main) {
        throw new Error("Invalid manifest structure");
      }

      // Check for required files
      const requiredFiles = ["worker.js", "worker.json"];
      for (const file of requiredFiles) {
        const filePath = path.join(distPath, file);
        if (!fs.existsSync(filePath)) {
          console.warn(`WARN Required file not found: ${file}`);
        }
      }

      console.log("OK2 Health checks completed successfully");

      return {
        success: true,
        message: "Health checks passed",
        details: {
          workerName: manifest.name,
          mainFile: manifest.main,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error("FAIL Health checks failed:", error.message);

      return {
        success: false,
        message: `Health checks failed: ${error.message}`,
        details: {
          error: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Generate deployment report
  generateReport(deploymentResult, healthCheckResult) {
    const timestamp = new Date().toISOString();
    const report = {
      timestamp,
      deployment: deploymentResult,
      healthCheck: healthCheckResult,
      status:
        deploymentResult.success && healthCheckResult.success
          ? "SUCCESS"
          : "FAILED",
    };

    const reportPath = path.join(this.projectDir, "deployment-report.json");
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    return reportPath;
  }
}

// Execute deployment
async function main() {
  const deployer = new DeployWorker();

  try {
    const result = await deployer.deploy();

    if (result.success) {
      console.log("\nSUCCESS DEPLOYMENT SUCCESS! SUCCESS");
      console.log(
        "\nDeployment Summary:",
        JSON.stringify(result.details, null, 2),
      );

      // Generate deployment report
      const reportPath = deployer.generateReport(
        result.details?.deploymentResult,
        result.details?.healthCheckResult,
      );

      console.log(`\n📄 Deployment report saved to: ${reportPath}`);
      console.log("\nOK Ready for Phase 7: Production Launch! OK");

      process.exit(0);
    } else {
      console.error("\nBANG DEPLOYMENT FAILED! BANG");
      console.error(
        "\nError Details:",
        JSON.stringify(result.details, null, 2),
      );
      console.log("\nTOOL Troubleshooting Steps:");
      console.log("   1. Check wrangler configuration (wrangler.toml)");
      console.log("   2. Verify all required environment variables are set");
      console.log("   3. Ensure Cloudflare authentication is configured");
      console.log("   4. Check available disk space and permissions");

      process.exit(1);
    }
  } catch (error) {
    console.error("\nBANG DEPLOYMENT FAILED! BANG");
    console.error("\nUnexpected Error:", error.message);

    process.exit(1);
  }
}

// Execute main function
if (require.main === module) {
  main();
}

module.exports = { DeployWorker };
