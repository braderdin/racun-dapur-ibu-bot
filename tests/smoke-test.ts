/**
 * Smoke Test Script for Local Simulation
 * Automated test script to ping local worker endpoints (`http://localhost:8787/health`) and validate responses.
 * Tests core worker functionality for deployment validation.
 */

import { performance } from "perf_hooks";
import fetch, { Response } from "node-fetch";

// Global test configuration
const TEST_CONFIG = {
  healthEndpoint: "http://localhost:8787/health",
  healthSimpleEndpoint: "http://localhost:8787/health/simple",
  healthTimeoutMs: 10000,
  performanceThresholdMs: 5000,
  expectedStatusCodes: {
    health: 200,
    simpleHealth: 200,
  },
};

class SmokeTestError extends Error {
  constructor(
    message: string,
    public readonly testName: string,
    public readonly statusCode?: number,
    public readonly responseTime?: number,
  ) {
    super(message);
    this.name = "SmokeTestError";
  }
}

interface SmokeTestResult {
  testName: string;
  status: "passed" | "failed" | "skipped" | "timeout";
  message: string;
  responseTime?: number;
  error?: string;
  timestamp: string;
}

interface SmokeTestReport {
  overall: {
    totalTests: number;
    passed: number;
    failed: number;
    skipped: number;
    timeout: number;
    successRate: number;
  };
  results: SmokeTestResult[];
  executionTime: {
    start: string;
    end: string;
    durationMs: number;
  };
  environment: any;
}

export class SmokeTestRunner {
  private config: typeof TEST_CONFIG;
  private report: SmokeTestReport;

  constructor(config?: Partial<typeof TEST_CONFIG>) {
    this.config = { ...TEST_CONFIG, ...config };
    this.report = {
      overall: {
        totalTests: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        timeout: 0,
        successRate: 0,
      },
      results: [],
      executionTime: {
        start: new Date().toISOString(),
        end: "",
        durationMs: 0,
      },
      environment: {},
    };
  }

  public async runAllTests(): Promise<SmokeTestReport> {
    console.log("🚀 Starting Smoke Tests for @RacunDapurIbu Bot Worker\n");
    console.log(`📋 Testing endpoint: ${this.config.healthEndpoint}\n`);

    this.report.executionTime.start = new Date().toISOString();

    await this.runTest("Basic Health Check", this.runHealthCheck.bind(this));
    await this.runTest(
      "Simple Health Check",
      this.runSimpleHealthCheck.bind(this),
    );
    await this.runTest(
      "Endpoint Accessibility",
      this.runEndpointAccessibility.bind(this),
    );
    await this.runTest(
      "Response Time Validation",
      this.runResponseTimeValidation.bind(this),
    );

    this.report.executionTime.end = new Date().toISOString();
    this.report.executionTime.durationMs =
      new Date(this.report.executionTime.end).getTime() -
      new Date(this.report.executionTime.start).getTime();

    // Calculate success rate
    const { passed, total } = this.report.overall;
    this.report.overall.successRate = total > 0 ? (passed / total) * 100 : 0;

    // Log summary
    this.logTestSummary();

    return this.report;
  }

  private async runTest<T>(
    testName: string,
    testFn: () => Promise<T>,
  ): Promise<void> {
    const startTime = performance.now();
    this.report.overall.totalTests++;

    try {
      await testFn();
      const endTime = performance.now();
      const responseTime = endTime - startTime;

      this.report.results.push({
        testName,
        status: "passed",
        message: "Test passed successfully",
        responseTime,
        timestamp: new Date().toISOString(),
      });

      this.report.overall.passed++;

      console.log(`✅ [${testName}] PASSED - ${responseTime.toFixed(2)}ms`);
    } catch (error) {
      const endTime = performance.now();
      const responseTime = endTime - startTime;

      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      const statusCode =
        error instanceof SmokeTestError ? error.statusCode : undefined;

      this.report.results.push({
        testName,
        status:
          error instanceof SmokeTestError && error.message.includes("timeout")
            ? "timeout"
            : "failed",
        message: errorMessage,
        responseTime,
        error: errorMessage,
        timestamp: new Date().toISOString(),
        ...(statusCode && { statusCode }),
      });

      if (
        error instanceof SmokeTestError &&
        error.message.includes("timeout")
      ) {
        this.report.overall.timeout++;
      } else {
        this.report.overall.failed++;
      }

      console.error(`❌ [${testName}] FAILED - ${errorMessage}`);
    }
  }

  private async runHealthCheck(): Promise<void> {
    const startTime = Date.now();
    const response = await fetch(this.config.healthEndpoint, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(this.config.healthTimeoutMs),
    });

    if (!response.ok) {
      throw new SmokeTestError(
        `Health check failed with status ${response.status}: ${response.statusText}`,
        "Basic Health Check",
        response.status,
        Date.now() - startTime,
      );
    }

    const data = await response.json();

    if (!data || typeof data !== "object") {
      throw new SmokeTestError(
        "Health check response is not a valid JSON object",
        "Basic Health Check",
        response.status,
        Date.now() - startTime,
      );
    }

    if (!data.status || data.status !== "ok") {
      throw new SmokeTestError(
        'Health check response status is not "ok"',
        "Basic Health Check",
        response.status,
        Date.now() - startTime,
      );
    }
  }

  private async runSimpleHealthCheck(): Promise<void> {
    const startTime = Date.now();
    const response = await fetch(this.config.healthSimpleEndpoint, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(this.config.healthTimeoutMs),
    });

    if (!response.ok) {
      throw new SmokeTestError(
        `Simple health check failed with status ${response.status}: ${response.statusText}`,
        "Simple Health Check",
        response.status,
        Date.now() - startTime,
      );
    }

    const data = await response.json();

    if (!data || typeof data !== "object") {
      throw new SmokeTestError(
        "Simple health check response is not a valid JSON object",
        "Simple Health Check",
        response.status,
        Date.now() - startTime,
      );
    }

    if (!data.status || data.status !== "healthy") {
      throw new SmokeTestError(
        'Simple health check response status is not "healthy"',
        "Simple Health Check",
        response.status,
        Date.now() - startTime,
      );
    }
  }

  private async runEndpointAccessibility(): Promise<void> {
    const startTime = Date.now();
    const response = await fetch(this.config.healthEndpoint, {
      method: "HEAD",
      signal: AbortSignal.timeout(this.config.healthTimeoutMs),
    });

    if (!response.ok) {
      throw new SmokeTestError(
        `Endpoint accessibility check failed with status ${response.status}`,
        "Endpoint Accessibility",
        response.status,
        Date.now() - startTime,
      );
    }
  }

  private async runResponseTimeValidation(): Promise<void> {
    const startTime = Date.now();
    const response = await fetch(this.config.healthEndpoint, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(this.config.healthTimeoutMs),
    });

    if (!response.ok) {
      throw new SmokeTestError(
        `Response time validation failed with status ${response.status}`,
        "Response Time Validation",
        response.status,
        Date.now() - startTime,
      );
    }

    const endTime = Date.now();
    const responseTime = endTime - startTime;

    if (responseTime > this.config.performanceThresholdMs) {
      throw new SmokeTestError(
        `Response time too slow: ${responseTime}ms (threshold: ${this.config.performanceThresholdMs}ms)`,
        "Response Time Validation",
        response.status,
        responseTime,
      );
    }
  }

  public printReport(): void {
    console.log("\n" + "=".repeat(60));
    console.log("📊 SMOKE TEST REPORT");
    console.log("=".repeat(60));

    console.log(`\n📈 Test Execution Summary:`);
    console.log(`   Total Tests: ${this.report.overall.totalTests}`);
    console.log(`   Passed: ${this.report.overall.passed}`);
    console.log(`   Failed: ${this.report.overall.failed}`);
    console.log(`   Timeout: ${this.report.overall.timeout}`);
    console.log(`   Skipped: ${this.report.overall.skipped}`);
    console.log(
      `   Success Rate: ${this.report.overall.successRate.toFixed(2)}%`,
    );

    console.log(`\n⏰ Execution Time:`);
    console.log(`   Start: ${this.report.executionTime.start}`);
    console.log(`   End: ${this.report.executionTime.end}`);
    console.log(`   Duration: ${this.report.executionTime.durationMs}ms`);

    console.log("\n📋 Detailed Results:");
    this.report.results.forEach((result, index) => {
      const statusIcon = this.getStatusIcon(result.status);
      console.log(
        `   ${index + 1}. ${statusIcon} ${result.testName}: ${result.message}`,
      );
      if (result.responseTime) {
        console.log(`      Response Time: ${result.responseTime.toFixed(2)}ms`);
      }
      if (result.error) {
        console.log(`      Error: ${result.error}`);
      }
    });

    console.log("\n" + "=".repeat(60));
  }

  private getStatusIcon(status: string): string {
    switch (status) {
      case "passed":
        return "✅";
      case "failed":
        return "❌";
      case "timeout":
        return "⏰";
      case "skipped":
        return "⏭";
      default:
        return "❓";
    }
  }

  // Helper method to generate JSON report
  public generateJsonReport(): string {
    return JSON.stringify(this.report, null, 2);
  }

  // Helper method to save report to file
  public async saveReport(filePath: string): Promise<void> {
    const fs = require("fs");
    await fs.writeFileSync(filePath, this.generateJsonReport());
  }
}

// Export the SmokeTestRunner class and configuration
export { SmokeTestRunner, SmokeTestConfig };

// Default export for easy importing
export default SmokeTestRunner;
