//!/usr/bin/env node
/*
 * Vercel Production Build Verification Script
 * Phase 6: Triggers Next.js production compilation and confirms zero build errors
 * Validates Next.js application in apps/web (or root) directory
 */

const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const CONFIG = {
  VERCEL_APP_PATH: process.env.VERCEL_APP_PATH || "./apps/web",
  BUILD_TIMEOUT_MS: 180000, // 3 minutes
  MAX_RETRIES: 2,
};

class VercelBuildVerifier {
  constructor() {
    this.appPath = path.join(process.cwd(), CONFIG.VERCEL_APP_PATH);

    if (!fs.existsSync(this.appPath)) {
      throw new Error(`Vercel app path not found: ${this.appPath}`);
    }

    // Check for package.json in app path
    const packageJsonPath = path.join(this.appPath, "package.json");
    if (!fs.existsSync(packageJsonPath)) {
      throw new Error(
        `package.json not found in Vercel app path: ${this.appPath}`,
      );
    }

    console.log("ROCKET Vercel Production Build Verifier Initialized");
    console.log(`FOLDER App Path: ${this.appPath}`);
  }

  async verifyBuild() {
    try {
      // Verify app configuration
      await this.verifyAppConfiguration();

      // Execute build with retries
      const result = await this.executeBuildWithRetries();

      if (!result.success) {
        throw new Error(`Build failed: ${result.message}`);
      }

      // Verify build artifacts
      const artifactsVerification = this.verifyBuildArtifacts();

      console.log("OK2 Vercel build verification completed successfully");
      console.log(
        `REPORT Build artifacts: ${JSON.stringify(artifactsVerification, null, 2)}`,
      );

      return {
        success: true,
        message: "Vercel build verification completed successfully",
        details: {
          buildResult: result,
          artifactsVerification,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error("FAIL Vercel build verification failed:", error.message);

      return {
        success: false,
        message: `Vercel build verification failed: ${error.message}`,
        details: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  async verifyAppConfiguration() {
    console.log("🔍 Verifying Vercel app configuration...");

    // Check for vercel.json configuration
    const vercelJsonPath = path.join(this.appPath, "vercel.json");
    if (!fs.existsSync(vercelJsonPath)) {
      throw new Error("vercel.json not found in Vercel app path");
    }

    const vercelConfig = JSON.parse(fs.readFileSync(vercelJsonPath, "utf8"));

    // Validate vercel.json structure
    if (!vercelConfig.version) {
      throw new Error("vercel.json missing version field");
    }

    if (!vercelConfig.buildCommand) {
      throw new Error("vercel.json missing buildCommand field");
    }

    // Check for required dependencies
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(this.appPath, "package.json"), "utf8"),
    );

    const requiredDeps = ["next", "react", "tailwindcss"];
    const missingDeps = requiredDeps.filter(
      (dep) =>
        !packageJson.dependencies?.[dep] && !packageJson.devDependencies?.[dep],
    );

    if (missingDeps.length > 0) {
      throw new Error(
        `Missing required dependencies: ${missingDeps.join(", ")}`,
      );
    }

    console.log("OK2 Vercel app configuration verification completed");
  }

  async executeBuildWithRetries() {
    let lastError;

    for (let attempt = 1; attempt <= CONFIG.MAX_RETRIES; attempt++) {
      console.log(`ROCKET Build attempt ${attempt}/${CONFIG.MAX_RETRIES}...`);

      try {
        // Execute npm run build or equivalent
        const buildCommand = this.getBuildCommand();
        const result = await this.executeCommand(buildCommand);

        if (result.code === 0) {
          console.log("OK2 Build completed successfully");
          return { success: true, message: "Build completed" };
        } else {
          lastError = new Error(
            `Build failed with exit code ${result.code}: ${result.stderr}`,
          );
          console.error(
            `FAIL Build attempt ${attempt} failed: ${lastError.message}`,
          );

          if (attempt < CONFIG.MAX_RETRIES) {
            console.log("⏱️ Waiting 60 seconds before retry...");
            await this.delay(60000);
          }
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(
          `FAIL Build attempt ${attempt} failed: ${lastError.message}`,
        );

        if (attempt < CONFIG.MAX_RETRIES) {
          console.log("⏱️ Waiting 60 seconds before retry...");
          await this.delay(60000);
        }
      }
    }

    throw lastError || new Error("All build attempts failed");
  }

  getBuildCommand() {
    // Check package.json for available scripts
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(this.appPath, "package.json"), "utf8"),
    );

    if (packageJson.scripts?.build) {
      return `npm run build`;
    }

    if (packageJson.scripts?.nextBuild) {
      return `npm run nextBuild`;
    }

    // Default to next build
    return "npx next build";
  }

  async executeCommand(command) {
    return new Promise((resolve, reject) => {
      const [cmd, ...args] = command.split(" ");

      const child = spawn(cmd, args, {
        cwd: this.appPath,
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

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  verifyBuildArtifacts() {
    const nextJsOutputDirectory = path.join(this.appPath, ".next");
    const staticFiles = [];

    if (fs.existsSync(nextJsOutputDirectory)) {
      const files = fs.readdirSync(nextJsOutputDirectory);
      staticFiles.push(...files);

      // Check for critical Next.js build artifacts
      const requiredArtifacts = ["index.html", "static"];
      const missingArtifacts = requiredArtifacts.filter((artifact) => {
        const artifactPath = path.join(nextJsOutputDirectory, artifact);
        return !fs.existsSync(artifactPath);
      });

      if (missingArtifacts.length > 0) {
        console.warn(
          `WARN Missing Next.js build artifacts: ${missingArtifacts.join(", ")}`,
        );
      }

      return {
        nextJsOutputDirectory: nextJsOutputDirectory,
        staticGeneratedFiles: staticFiles,
        deploymentReady: missingArtifacts.length === 0,
      };
    }

    return {
      deploymentReady: false,
    };
  }

  // Generate verification report
  generateReport(buildResult, artifactsVerification) {
    const timestamp = new Date().toISOString();
    const report = {
      timestamp,
      build: buildResult,
      artifacts: artifactsVerification,
      status:
        buildResult.success && artifactsVerification.deploymentReady
          ? "SUCCESS"
          : "FAILED",
    };

    const reportPath = path.join(this.appPath, "vercel-build-report.json");
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    return reportPath;
  }
}

// Execute verification
async function main() {
  const verifier = new VercelBuildVerifier();

  try {
    const result = await verifier.verifyBuild();

    if (result.success) {
      console.log("\nSUCCESS VERCEL BUILD VERIFICATION SUCCESS! SUCCESS");
      console.log(
        "\nVerification Summary:",
        JSON.stringify(result.details, null, 2),
      );

      // Generate verification report
      const reportPath = verifier.generateReport(
        result.details?.buildResult,
        result.details?.artifactsVerification,
      );

      console.log(`\n📄 Build report saved to: ${reportPath}`);
      console.log("\nOK Vercel build verification ready for Phase 7! OK");

      process.exit(0);
    } else {
      console.error("\nBANG VERCEL BUILD VERIFICATION FAILED! BANG");
      console.error(
        "\nError Details:",
        JSON.stringify(result.details, null, 2),
      );
      console.log("\nTOOL Troubleshooting Steps:");
      console.log("   1. Check vercel.json configuration");
      console.log("   2. Verify all required dependencies are installed");
      console.log("   3. Check available disk space and permissions");
      console.log("   4. Review build errors in output above");

      process.exit(1);
    }
  } catch (error) {
    console.error("\nBANG VERCEL BUILD VERIFICATION FAILED! BANG");
    console.error("\nUnexpected Error:", error.message);

    process.exit(1);
  }
}

// Execute main function
if (require.main === module) {
  main();
}

module.exports = { VercelBuildVerifier };
