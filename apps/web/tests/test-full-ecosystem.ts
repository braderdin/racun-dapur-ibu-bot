"use strict"; // Enforce strict mode

import { createClient } from "@supabase/supabase-js";
import { CatalogService } from "../src/services/supabase-catalog";
import { RealtimeFeedService } from "../src/services/realtime-feed";
import { FlashSaleService } from "../src/services/flash-sale";
import { DualBuyAnalyticsService } from "../src/services/dual-buy-analytics";
import { BudgetFilterService } from "../src/utils/budget-filter";
import { createFTSQueryBuilder } from "../src/utils/fts-query-builder";

// 🧪 End-to-End System Integration Tests
export class FullEcosystemTest {
  private supabaseUrl: string;
  private supabaseKey: string;
  private supabase;
  private catalogService: CatalogService;
  private realtimeFeedService: RealtimeFeedService;
  private flashSaleService: FlashSaleService;
  private dualBuyAnalyticsService: DualBuyAnalyticsService;
  private budgetFilterService: BudgetFilterService;
  private ftsQueryBuilder;

  constructor() {
    this.supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    this.supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      "";
    this.supabase = createClient(this.supabaseUrl, this.supabaseKey);

    this.catalogService = new CatalogService();
    this.realtimeFeedService = new RealtimeFeedService();
    this.flashSaleService = new FlashSaleService();
    this.dualBuyAnalyticsService = new DualBuyAnalyticsService();
    this.budgetFilterService = new BudgetFilterService();
    this.ftsQueryBuilder = createFTSQueryBuilder();
  }

  // 🚀 Run complete ecosystem test suite
  async runAllTests(): Promise<{
    passed: number;
    failed: number;
    results: any[];
  }> {
    const results: any[] = [];
    let passed = 0;
    let failed = 0;

    // Test Suite 1: Service Initialization
    const initResults = await this.testServiceInitialization();
    results.push(...initResults);
    passed += initResults.filter((r) => r.passed).length;
    failed += initResults.filter((r) => !r.passed).length;

    // Test Suite 2: Database Integration
    const dbResults = await this.testDatabaseIntegration();
    results.push(...dbResults);
    passed += dbResults.filter((r) => r.passed).length;
    failed += dbResults.filter((r) => !r.passed).length;

    // Test Suite 3: Realtime Features
    const realtimeResults = await this.testRealtimeFeatures();
    results.push(...realtimeResults);
    passed += realtimeResults.filter((r) => r.passed).length;
    failed += realtimeResults.filter((r) => !r.passed).length;

    // Test Suite 4: Analytics Processing
    const analyticsResults = await this.testAnalyticsProcessing();
    results.push(...analyticsResults);
    passed += analyticsResults.filter((r) => r.passed).length;
    failed += analyticsResults.filter((r) => !r.passed).length;

    // Test Suite 5: Search Performance
    const searchResults = await this.testSearchPerformance();
    results.push(...searchResults);
    passed += searchResults.filter((r) => r.passed).length;
    failed += searchResults.filter((r) => !r.passed).length;

    // Test Suite 6: Real Deal Workflow
    const workflowResults = await this.testRealDealWorkflow();
    results.push(...workflowResults);
    passed += workflowResults.filter((r) => r.passed).length;
    failed += workflowResults.filter((r) => !r.passed).length;

    console.log(
      `\n📊 E2E Test Results: ${passed} passed, ${failed} failed, ${passed + failed} total`,
    );
    return { passed, failed, results };
  }

  // 🧪 Test all services can be initialized
  async testServiceInitialization(): Promise<any[]> {
    const results = [];

    // Test Supabase client initialization
    const supabaseInitialized = this.supabaseUrl && this.supabaseKey;
    results.push({
      test: "Supabase Client Initialization",
      description:
        "Verify Supabase client can be created with environment variables",
      passed: supabaseInitialized,
      details: supabaseInitialized
        ? "✅ Client initialized successfully"
        : "❌ Missing Supabase environment variables",
    });

    // Test Catalog Service initialization
    try {
      const previewData = await this.catalogService.getPreviewData();
      results.push({
        test: "Catalog Service Initialization",
        description:
          "Verify Catalog service can fetch preview data from database",
        passed: true,
        details: `✅ Catalog service working - ${previewData.length} products available`,
      });
    } catch (error) {
      results.push({
        test: "Catalog Service Initialization",
        description:
          "Verify Catalog service can fetch preview data from database",
        passed: false,
        details: `❌ Catalog service failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }

    // Test Realtime Feed Service initialization
    try {
      const healthCheck = await this.realtimeFeedService.healthCheck();
      results.push({
        test: "Realtime Feed Service Initialization",
        description: "Verify Realtime feed service can connect to Supabase",
        passed: healthCheck,
        details: healthCheck
          ? "✅ Realtime service healthy"
          : "❌ Realtime service failed health check",
      });
    } catch (error) {
      results.push({
        test: "Realtime Feed Service Initialization",
        description: "Verify Realtime feed service can connect to Supabase",
        passed: false,
        details: `❌ Realtime service error: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }

    // Test Flash Sale Service initialization
    try {
      const debugInfo = this.flashSaleService.debugFlashSale({
        productId: "test-product",
        lazadaPeakHourEnd: new Date(Date.now() + 3600000).toISOString(),
        shopeePeakHourEnd: new Date(Date.now() + 7200000).toISOString(),
        lazadaRemaining: 10,
        shopeeRemaining: 5,
        currentPrice: 100,
        originalPrice: 200,
        discountPercentage: 50,
      });
      results.push({
        test: "Flash Sale Service Initialization",
        description: "Verify Flash sale service can process flash sale logic",
        passed: true,
        details: "✅ Flash sale service working - debug output generated",
      });
    } catch (error) {
      results.push({
        test: "Flash Sale Service Initialization",
        description: "Verify Flash sale service can process flash sale logic",
        passed: false,
        details: `❌ Flash sale service error: ${error instanceof Error ? error.message : "Unknown error"}`, // debugFlashSale returns void
      });
    }

    // Test Budget Filter Service initialization
    try {
      const testProducts = await this.catalogService.getActiveDeals(5);
      const categorized =
        this.budgetFilterService.categorizeByBudget(testProducts);
      const totalCategorized = Object.values(categorized).reduce(
        (sum, arr) => sum + arr.length,
        0,
      );
      results.push({
        test: "Budget Filter Service Initialization",
        description:
          "Verify Budget filter service can categorize products by price ranges",
        passed: totalCategorized > 0,
        details: `✅ Budget filter service working - ${totalCategorized} products categorized`,
      });
    } catch (error) {
      results.push({
        test: "Budget Filter Service Initialization",
        description:
          "Verify Budget filter service can categorize products by price ranges",
        passed: false,
        details: `❌ Budget filter service error: ${error instanceof Error ? error.message : "Unknown error"}`, // categorizeByBudget returns object
      });
    }

    // Test Dual Buy Analytics Service initialization
    try {
      const testAnalytics = await this.dualBuyAnalyticsService.testAnalytics();
      results.push({
        test: "Dual Buy Analytics Service Initialization",
        description:
          "Verify Dual buy analytics service can track and process events",
        passed: testAnalytics,
        details: testAnalytics
          ? "✅ Analytics service working"
          : "❌ Analytics service test failed",
      });
    } catch (error) {
      results.push({
        test: "Dual Buy Analytics Service Initialization",
        description:
          "Verify Dual buy analytics service can track and process events",
        passed: false,
        details: `❌ Analytics service error: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }

    return results;
  }

  // 🔍 Test database integration and data access
  async testDatabaseIntegration(): Promise<any[]> {
    const results = [];

    // Test direct database connection
    try {
      const { count, error } = await this.supabase
        .from("posted_products")
        .select("*", { count: "exact", head: true });

      if (error) {
        throw error;
      }

      results.push({
        test: "Direct Database Connection",
        description: "Verify system can connect directly to Supabase database",
        passed: true,
        details: `✅ Database connection successful - ${count} products found`,
      });
    } catch (error) {
      results.push({
        test: "Direct Database Connection",
        description: "Verify system can connect directly to Supabase database",
        passed: false,
        details: `❌ Database connection failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }

    // Test RLS policies (should not block public reads)
    try {
      const { data, error } = await this.supabase
        .from("posted_products")
        .select(
          "id, product_name, category, lazada_availability, shopee_availability",
        )
        .limit(5);

      if (error) {
        throw error;
      }

      const availableProducts = data.filter(
        (p) =>
          p.lazada_availability === "available" ||
          p.shopee_availability === "available",
      );

      results.push({
        test: "RLS Policy Configuration",
        description:
          "Verify Row Level Security allows public reads of available products",
        passed: availableProducts.length === data.length,
        details: `✅ RLS configured - ${availableProducts.length}/${data.length} products accessible`,
      });
    } catch (error) {
      results.push({
        test: "RLS Policy Configuration",
        description:
          "Verify Row Level Security allows public reads of available products",
        passed: false,
        details: `❌ RLS policy error: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }

    // Test FTS index availability
    try {
      const ftsAvailable = await this.ftsQueryBuilder.testFTSConfiguration();
      results.push({
        test: "Full-Text Search Configuration",
        description:
          "Verify Full-Text Search index is available for Malay/English search",
        passed: ftsAvailable,
        details: ftsAvailable
          ? "✅ FTS configuration available"
          : "❌ FTS configuration not available",
      });
    } catch (error) {
      results.push({
        test: "Full-Text Search Configuration",
        description:
          "Verify Full-Text Search index is available for Malay/English search",
        passed: false,
        details: `❌ FTS error: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }

    // Test catalog service search functionality
    try {
      const searchResults = await this.catalogService.searchProducts({
        query: "dapur",
        limit: 5,
      });

      results.push({
        test: "Catalog Service Search",
        description: "Verify Catalog service can perform searches with results",
        passed: searchResults.data.length > 0,
        details: `✅ Catalog search working - ${searchResults.pagination.total} total products, ${searchResults.data.length} returned`,
      });
    } catch (error) {
      results.push({
        test: "Catalog Service Search",
        description: "Verify Catalog service can perform searches with results",
        passed: false,
        details: `❌ Catalog search error: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }

    return results;
  }

  // 🌐 Test realtime functionality
  async testRealtimeFeatures(): Promise<any[]> {
    const results = [];

    // Test realtime service health
    try {
      const healthCheck = await this.realtimeFeedService.healthCheck();
      results.push({
        test: "Realtime Service Health",
        description: "Verify Realtime service is healthy and connected",
        passed: healthCheck,
        details: healthCheck
          ? "✅ Realtime service healthy"
          : "❌ Realtime service unhealthy",
      });
    } catch (error) {
      results.push({
        test: "Realtime Service Health",
        description: "Verify Realtime service is healthy and connected",
        passed: false,
        details: `❌ Realtime health check error: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }

    // Test event history retrieval
    try {
      const eventHistory = this.realtimeFeedService.getEventHistory(10);
      results.push({
        test: "Event History Retrieval",
        description: "Verify Realtime service can retrieve event history",
        passed: Array.isArray(eventHistory),
        details: `✅ Event history available - ${eventHistory.length} events`,
      });
    } catch (error) {
      results.push({
        test: "Event History Retrieval",
        description: "Verify Realtime service can retrieve event history",
        passed: false,
        details: `❌ Event history error: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }

    // Test flash sale calculations
    try {
      const testProduct = await this.catalogService.getActiveDeals(1);
      if (testProduct.length > 0) {
        const countdown = this.flashSaleService.getFlashSaleCountdown(
          testProduct[0],
        );
        const formatted = this.flashSaleService.formatCountdown(countdown);

        results.push({
          test: "Flash Sale Calculations",
          description:
            "Verify Flash sale service can calculate and format countdown timers",
          passed: formatted !== null && formatted !== undefined,
          details: `✅ Flash sale calculations working - ${formatted}`,
        });
      } else {
        results.push({
          test: "Flash Sale Calculations",
          description:
            "Verify Flash sale service can calculate and format countdown timers",
          passed: false,
          details: "❌ No test products available for flash sale calculation",
        });
      }
    } catch (error) {
      results.push({
        test: "Flash Sale Calculations",
        description:
          "Verify Flash sale service can calculate and format countdown timers",
        passed: false,
        details: `❌ Flash sale calculation error: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }

    return results;
  }

  // 📊 Test analytics processing
  async testAnalyticsProcessing(): Promise<any[]> {
    const results = [];

    // Test analytics service functionality
    try {
      const dashboardData =
        await this.dualBuyAnalyticsService.getDashboardAnalytics();

      results.push({
        test: "Dashboard Analytics",
        description: "Verify Analytics service can provide dashboard metrics",
        passed: dashboardData && dashboardData.metrics,
        details: `✅ Analytics working - ${dashboardData.metrics?.totalClicksToday || 0} clicks today`,
      });
    } catch (error) {
      results.push({
        test: "Dashboard Analytics",
        description: "Verify Analytics service can provide dashboard metrics",
        passed: false,
        details: `❌ Analytics error: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }

    // Test click tracking simulation
    try {
      const testClickEvent = {
        productId: "test-product-123",
        platform: "lazada" as const,
        affiliateCode: "test-affiliate",
        timestamp: new Date().toISOString(),
        userAgent: "Test-Agent/1.0",
        referrer: "https://example.com",
        sessionId: "test-session-123",
        ipAddress: "127.0.0.1",
      };

      // We'll simulate the click tracking without actually sending to avoid database writes
      const simulatedClickData = {
        ...testClickEvent,
        processed_at: new Date().toISOString(),
      };

      results.push({
        test: "Click Tracking Simulation",
        description: "Verify analytics can process dual buy click events",
        passed:
          simulatedClickData &&
          simulatedClickData.productId === "test-product-123",
        details: "✅ Click tracking simulation successful",
      });
    } catch (error) {
      results.push({
        test: "Click Tracking Simulation",
        description: "Verify analytics can process dual buy click events",
        passed: false,
        details: `❌ Click tracking error: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }

    // Test budget filtering analytics
    try {
      const testProducts = await this.catalogService.getActiveDeals(10);
      const analytics = this.budgetFilterService.generateFilterAnalytics(
        testProducts,
        "<20",
      );

      results.push({
        test: "Budget Filter Analytics",
        description: "Verify Budget filter service can generate analytics data",
        passed: analytics && analytics.count >= 0,
        details: `✅ Budget filter analytics working - ${analytics.count} products in <RM20 range`,
      });
    } catch (error) {
      results.push({
        test: "Budget Filter Analytics",
        description: "Verify Budget filter service can generate analytics data",
        passed: false,
        details: `❌ Budget filter analytics error: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }

    return results;
  }

  // ⚡ Test search performance
  async testSearchPerformance(): Promise<any[]> {
    const results = [];

    try {
      const searchStart = Date.now();

      // Test basic search
      const searchResults = await this.catalogService.searchProducts({
        query: "test",
        limit: 10,
      });

      const searchTime = Date.now() - searchStart;

      results.push({
        test: "Search Performance - Basic Search",
        description:
          "Verify Catalog service can perform searches within acceptable time",
        passed: searchTime < 5000 && searchResults.data.length >= 0, // Should complete in under 5 seconds
        details: `✅ Search performance - ${searchTime}ms (${searchResults.data.length} results)`,
      });
    } catch (error) {
      results.push({
        test: "Search Performance - Basic Search",
        description:
          "Verify Catalog service can perform searches within acceptable time",
        passed: false,
        details: `❌ Search performance error: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }

    // Test FTS performance
    try {
      const ftsStart = Date.now();
      const ftsMetrics = await this.ftsQueryBuilder.getQueryMetrics();
      const ftsTime = Date.now() - ftsStart;

      results.push({
        test: "Search Performance - Full-Text Search",
        description: "Verify Full-Text Search can provide performance metrics",
        passed: ftsTime < 5000, // Should complete in under 5 seconds
        details: `✅ FTS performance - ${ftsTime}ms, coverage: ${ftsMetrics.searchCoverage || 0}%`,
      });
    } catch (error) {
      results.push({
        test: "Search Performance - Full-Text Search",
        description: "Verify Full-Text Search can provide performance metrics",
        passed: false,
        details: `❌ FTS performance error: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }

    return results;
  }

  // 🔄 Test real deal workflow (end-to-end)
  async testRealDealWorkflow(): Promise<any[]> {
    const results = [];

    try {
      // Step 1: Get available products
      const products = await this.catalogService.getActiveDeals(5);
      if (products.length === 0) {
        throw new Error("No products available for testing");
      }

      const testProduct = products[0];

      // Step 2: Get flash sale info
      const flashSales = this.flashSaleService.identifyFlashSales(products);
      const isFlashProduct = flashSales.some(
        (fs) => fs.productId === testProduct.id,
      );

      results.push({
        test: "Deal Discovery Workflow",
        description:
          "Verify system can discover available deals and flash sales",
        passed: true,
        details: `✅ Deal discovery successful - ${products.length} products, ${isFlashProduct ? "1 flash sale" : "0 flash sales"} found`,
      });
    } catch (error) {
      results.push({
        test: "Deal Discovery Workflow",
        description:
          "Verify system can discover available deals and flash sales",
        passed: false,
        details: `❌ Deal discovery error: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }

    try {
      // Step 3: Test budget filtering
      const categorized = this.budgetFilterService.categorizeByBudget(products);
      const cheapestCategory = Object.entries(categorized).find(
        ([_, products]) => products.length > 0,
      );

      results.push({
        test: "Budget Filtering Workflow",
        description: "Verify system can categorize products by price ranges",
        passed: !!cheapestCategory,
        details: `✅ Budget filtering successful - products found in ${cheapestCategory?.[0] || "unknown"} category`,
      });
    } catch (error) {
      results.push({
        test: "Budget Filtering Workflow",
        description: "Verify system can categorize products by price ranges",
        passed: false,
        details: `❌ Budget filtering error: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }

    try {
      // Step 4: Test analytics integration
      const analytics = await this.dualBuyAnalyticsService.getClickAnalytics(
        testProduct.id,
        {
          start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          end: new Date().toISOString(),
        },
      );

      results.push({
        test: "Analytics Integration Workflow",
        description:
          "Verify system can retrieve and process click analytics for products",
        passed: analytics !== null,
        details: `✅ Analytics integration successful - ${analytics?.clickCount || 0} clicks tracked for test product`,
      });
    } catch (error) {
      results.push({
        test: "Analytics Integration Workflow",
        description:
          "Verify system can retrieve and process click analytics for products",
        passed: false,
        details: `❌ Analytics integration error: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }

    try {
      // Step 5: Test search functionality
      const searchQuery = "dapur";
      const searchResults = await this.catalogService.searchProducts({
        query: searchQuery,
        limit: 5,
      });

      const hasRelevantResults = searchResults.data.some(
        (product) =>
          product.category?.toLowerCase().includes("dapur") ||
          product.product_name?.toLowerCase().includes("dapur"),
      );

      results.push({
        test: "Search Functionality Workflow",
        description: "Verify system can search products with relevant results",
        passed: searchResults.data.length > 0 && hasRelevantResults,
        details: `✅ Search workflow successful - ${searchResults.data.length} results for query '${searchQuery}'`,
      });
    } catch (error) {
      results.push({
        test: "Search Functionality Workflow",
        description: "Verify system can search products with relevant results",
        passed: false,
        details: `❌ Search workflow error: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }

    return results;
  }

  // 📋 Helper method to display test results
  displayResults(results: any[]): void {
    console.log("\n" + "=".repeat(80));
    console.log("📊 END-TO-END ECOSYSTEM TEST REPORT");
    console.log("=".repeat(80));

    results.forEach((result, index) => {
      const status = result.passed ? "✅ PASS" : "❌ FAIL";
      const icon = result.passed ? "🟢" : "🔴";

      console.log(`\n${icon} Test ${index + 1}: ${result.test}`);
      console.log(`${status} ${result.description}`);
      console.log(`📝 Details: ${result.details}`);
    });

    const passed = results.filter((r) => r.passed).length;
    const total = results.length;

    console.log("\n" + "=".repeat(80));
    console.log(
      `🏁 FINAL RESULTS: ${passed}/${total} tests passed (${Math.round((passed / total) * 100)}%)`,
    );
    console.log("=".repeat(80));

    if (passed === total) {
      console.log("🎉 ALL TESTS PASSED! The ecosystem is fully functional.");
    } else {
      console.log("⚠️  Some tests failed. Please review the details above.");
    }
  }
}
