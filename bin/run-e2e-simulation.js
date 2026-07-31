//!/usr/bin/env node
/*
 * Automated E2E Test Suite Runner
 * Phase 6: CLI runner executing all E2E test suites sequentially
 * Validates worker routes, DB connections, social posting pipelines
 */

const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const CONFIG = {
  E2E_TEST_PATH: "./tests",
  TEST_TIMEOUT_MS: 120000, // 2 minutes per test
  MAX_CONCURRENT_TESTS: 1, // Sequential execution to ensure system stability
  REPORT_PATH: "./e2e-test-results.json",
};

class E2ETestSuiteRunner {
  private testPath: string;

  constructor() {
    this.testPath = path.join(process.cwd(), CONFIG.E2E_TEST_PATH);

    if (!fs.existsSync(this.testPath)) {
      throw new Error(`E2E test path not found: ${this.testPath}`);
    }

    console.log("🚀 E2E Test Suite Runner Initialized");
    console.log(`📁 Test Path: ${this.testPath}`);
  }

  async runAllTests(): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      console.log("🧪 Starting E2E Test Suite Execution...");

      // Discover all test files
      const testFiles = await this.discoverTestFiles();
      
      if (testFiles.length === 0) {
        throw new Error("No E2E test files found");
      }

      console.log(`📝 Found ${testFiles.length} E2E test files:\`;
      testFiles.forEach((file, index) => {
        console.log(`   ${index + 1}. \${file}");
      });

      // Execute tests sequentially
      const testResults = await this.executeTestsSequentially(testFiles);

      // Generate comprehensive report
      const report = this.generateTestReport(testFiles, testResults);

      // Save report
      fs.writeFileSync(CONFIG.REPORT_PATH, JSON.stringify(report, null, 2));

      console.log(`\n📄 E2E Test Report saved to: \${CONFIG.REPORT_PATH}`);

      if (report.summary.failedTests === 0) {
        console.log("\n🎉 ALL E2E TESTS PASSED! 🎉");
        console.log("\nTest Summary:", JSON.stringify(report.summary, null, 2));
        return {
          success: true,
          message: "All E2E tests completed successfully",
          details: report,
        };
      } else {
        console.error("\n💥 SOME E2E TESTS FAILED! 💥");
        console.error("\nTest Summary:", JSON.stringify(report.summary, null, 2));
        console.error("\nFailed Tests:", JSON.stringify(report.failedTests, null, 2));
        console.log("\n🔧 Recommended Actions:");
        console.log("   1. Review failed test outputs for error details");
        console.log("   2. Check environment configuration and dependencies");
        console.log("   3. Verify worker deployment and service connectivity");
        console.log("   4. Review logs for specific test failures");

        return {
          success: false,
          message: `E2E test execution completed with ${report.summary.failedTests} failures`,
          details: report,
        };
      }
    } catch (error) {
      console.error("❌ E2E Test Suite Execution Failed:", error.message);

      return {
        success: false,
        message: `E2E test execution failed: ${error.message}`,
        details: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  private async discoverTestFiles(): Promise<string[]> {
    console.log("🔍 Discovering E2E test files...");

    const testFiles: string[] = [];

    function discoverRecursive(dirPath: string): void {
      const items = fs.readdirSync(dirPath);

      for (const item of items) {
        const itemPath = path.join(dirPath, item);

        if (fs.statSync(itemPath).isDirectory()) {
          // Skip node_modules, .git, and other non-test directories
          if (!["node_modules", ".git", ".wrangler", "dist", "build", "coverage"].includes(item)) {
            discoverRecursive(itemPath);
          }
        } else if (item.endsWith(".ts")) {
          testFiles.push(itemPath);
        }
      }
    }

    discoverRecursive(this.testPath);

    // Sort test files for consistent execution order
    testFiles.sort();

    console.log(`✅ Discovered ${testFiles.length} E2E test files";
    return testFiles;
  }

  private async executeTestsSequentially(testFiles: string[]): Promise<any[]> {
    const results: any[] = [];

    for (let i = 0; i < testFiles.length; i++) {
      const testFile = testFiles[i];
      console.log(`\n🧪 Executing test ${i + 1}/${testFiles.length}: \${testFile}");

      try {
        const result = await this.executeSingleTest(testFile);
        results.push({
          file: testFile,
          result,
          status: "PASSED",
          executionTimeMs: result.executionTimeMs || 0,
        });
        console.log(`✅ Test completed successfully (Execution time: \${result.executionTimeMs || 0}ms)");
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`❌ Test failed: \${errorMessage}");

        results.push({
          file: testFile,
          error: errorMessage,
          status: "FAILED",
          executionTimeMs: result?.executionTimeMs || 0,
        });
      }

      // Small delay between tests to prevent system overload
      if (i < testFiles.length - 1) {
        console.log("⏱️ Waiting 5 seconds before next test...");
        await this.delay(5000);
      }
    }

    return results;
  }

  private async executeSingleTest(testFile: string): Promise<any> {
    const startTime = Date.now();

    // Try different test execution methods
    let result: any = null;
    let lastError: Error | null = null;

    // Method 1: Try as TypeScript file with npx ts-node
    if (testFile.endsWith(".ts")) {
      try {
        result = await this.executeCommand(`npx ts-node \${testFile}`);
        console.log(`✅ Test executed successfully as TypeScript";
        return { ...result, executionTimeMs: Date.now() - startTime };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`⚠️ TypeScript test execution failed: \${lastError.message}`);
      }
    }

    // Method 2: Try as Node.js JavaScript file
    const jsFile = testFile.replace(/\.ts$/,".js");
    if (fs.existsSync(jsFile)) {
      try {
        result = await this.executeCommand(`node \${jsFile}`);
        console.log(`✅ Test executed successfully as JavaScript";
        return { ...result, executionTimeMs: Date.now() - startTime };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`⚠️ JavaScript test execution failed: \${lastError.message}`);
      }
    }

    // Method 3: Try with npm test scripts if available
    const packageJsonPath = path.join(path.dirname(testFile), "package.json");
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
        if (packageJson.scripts?.test) {
          result = await this.executeCommand(`npm test`);
          console.log(`✅ Test executed successfully via npm test";
          return { ...result, executionTimeMs: Date.now() - startTime };
        }
      } catch (error) {
        console.warn(`⚠️ npm test execution failed: \${error.message}`);
      }
    }

    // If all methods fail, throw the last error
    if (lastError) {
      throw lastError;
    }

    throw new Error(`No test execution method available for: \${testFile}`);
  }

  private async executeCommand(command: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const [cmd, ...args] = command.split(" ");

      const child = spawn(cmd, args, {
        stdio: "pipe",
        env: { ...process.env, FORCE_COLOR: "1" },
        timeout: CONFIG.TEST_TIMEOUT_MS,
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
        if (code === 0) {
          resolve({
            stdout,
            stderr,
            exitCode: code,
            success: true,
          });
        } else {
          const error = new Error(`Test failed with exit code ${code}: ${stderr || "Unknown error"}`);
          error.name = "TestExecutionError";
          reject(error);
        }
      });

      child.on("error", (error) => {
        reject(error);
      });
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private generateTestReport(testFiles: string[], testResults: any[]): any {
    const passedTests = testResults.filter((r) => r.status === "PASSED");
    const failedTests = testResults.filter((r) => r.status === "FAILED");

    const totalExecutionTime = testResults.reduce((sum, r) => sum + (r.executionTimeMs || 0), 0);

    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalTests: testFiles.length,
        passedTests: passedTests.length,
        failedTests: failedTests.length,
        totalExecutionTimeMs: totalExecutionTime,
        successRate: testFiles.length > 0 ? (passedTests.length / testFiles.length) * 100 : 0,
      },
      testFiles: testFiles.map((file) => path.basename(file)),
      results: testResults,
      failedTests: failedTests.map((r) => ({
        file: r.file,
        error: r.error,
        executionTimeMs: r.executionTimeMs,
      })),
      metadata: {
        runnerVersion: "1.0.0",
        nodeVersion: process.version,
        platform: process.platform,
        e2eTestPath: this.testPath,
      },
    };

    return report;
  }
}

// Execute E2E test suite
async function main() {
  const runner = new E2ETestSuiteRunner();

  try {
    const result = await runner.runAllTests();

    if (result.success) {
      console.log("\n🎉 E2E TEST SUITE EXECUTION SUCCESSFUL! 🎉");
      console.log("\nExecution Summary:", JSON.stringify(result.details?.summary, null, 2));
      console.log("\n✨ E2E test suite ready for Phase 7 Production Launch! ✨");

      process.exit(0);
    } else {
      console.error("\n💥 E2E TEST SUITE EXECUTION FAILED! 💥");
      console.error("\nExecution Summary:", JSON.stringify(result.details?.summary, null, 2));
      console.error("\nFailed Test Details:", JSON.stringify(result.details?.failedTests, null, 2));
      console.log("\n🔧 Next Steps:");
      console.log("   1. Review failed test outputs for specific errors");
      console.log("   2. Check environment configuration and service connectivity");
      console.log("   3. Verify worker deployment and routing");
      console.log("   4. Run individual failed tests for detailed debugging");

      process.exit(1);
    }
  } catch (error) {
    console.error("\n💥 E2E TEST SUITE EXECUTION FAILED! 💥");
    console.error("\nUnexpected Error:", error.message);

    process.exit(1);
  }
}

// Execute main function
if (require.main === module) {
  main();
}

module.exports = { E2ETestSuiteRunner };