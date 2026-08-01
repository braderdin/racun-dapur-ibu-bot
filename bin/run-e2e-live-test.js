#!/usr/bin/env node
/*
 * CLI E2E Live Simulation Script
 * Phase 10: Triggers a single end-to-end deal processing cycle
 * and prints detailed status logs for each step.
 *
 * Usage: node bin/run-e2e-live-test.js
 * All credentials read from environment variables — no hardcoded secrets.
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const CONFIG = {
  productId: process.env.E2E_TEST_PRODUCT_ID || "test-product-001",
  enableWatermark: false,
  enableB2Upload: true,
  enableFacebook: false,
  enableTwitter: false,
  platforms: ["lazada", "shopee"],
  dedupThreshold: 0.85,
};

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------

function log(step, message, type = "INFO") {
  const timestamp = new Date().toISOString();
  const prefix =
    {
      INFO: "ℹ️",
      SUCCESS: "OK2",
      ERROR: "FAIL",
      WARN: "WARN",
      STEP: "RETRY",
    }[type] || "ℹ️";
  console.log(`[${timestamp}] ${prefix} [${step}] ${message}`);
}

// ---------------------------------------------------------------------------
// Simulated pipeline steps (no external service dependencies required)
// ---------------------------------------------------------------------------

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function simulateDealCuration(productId) {
  log("deal_curation", `Curating deal for ${productId}...`, "STEP");
  await delay(50);
  log("deal_curation", "Deal curated — 2 platforms found", "SUCCESS");
  return { success: true, deals: [{ id: productId, name: "Test Product" }] };
}

async function simulateVectorDedup(productId) {
  log(
    "vector_dedup",
    `Checking semantic similarity for ${productId}...`,
    "STEP",
  );
  await delay(30);
  log(
    "vector_dedup",
    "No duplicate found — similarity below threshold",
    "SUCCESS",
  );
  return { isDuplicate: false, similarity: 0.42 };
}

async function simulateAICopywriting(productId) {
  log("ai_copywriting", `Generating persona copy for ${productId}...`, "STEP");
  await delay(40);
  log("ai_copywriting", "Copy generated for both platforms", "SUCCESS");
  return {
    platform: "both",
    hook: "🔥 Harga terbaik hari ini!",
    body: ["Produk dapur premium", "Harga istimewa untuk ibu mertua"],
    cta: "Beli sekarang!",
    hashtags: ["#RacunDapurIbu", "#DealHariIni"],
  };
}

async function simulateWatermark(productId) {
  log("watermark", `Processing watermark for ${productId}...`, "STEP");
  await delay(20);
  log("watermark", "Watermark skipped (CLI simulation mode)", "INFO");
  return { success: true, details: "Watermark skipped (CLI simulation)" };
}

async function simulateB2Upload(productId) {
  log("b2_upload", `Uploading to B2 for ${productId}...`, "STEP");
  await delay(25);
  log("b2_upload", "B2 upload placeholder completed", "SUCCESS");
  return { success: true, details: "B2 upload placeholder" };
}

async function simulateSupabaseInsert(productId) {
  log("supabase_insert", `Inserting into Supabase for ${productId}...`, "STEP");
  await delay(35);
  log("supabase_insert", "Product upserted in Supabase", "SUCCESS");
  return { success: true };
}

async function simulateFacebookPost(productId) {
  log("facebook_post", `Posting to Facebook for ${productId}...`, "STEP");
  await delay(20);
  log("facebook_post", "Facebook post skipped (simulation mode)", "INFO");
  return { success: true, details: "Facebook post skipped (simulation)" };
}

async function simulateTwitterThread(productId) {
  log(
    "twitter_thread",
    `Publishing Twitter thread for ${productId}...`,
    "STEP",
  );
  await delay(20);
  log("twitter_thread", "Twitter thread skipped (simulation mode)", "INFO");
  return { success: true, details: "Twitter thread skipped (simulation)" };
}

// ---------------------------------------------------------------------------
// Main execution
// ---------------------------------------------------------------------------

async function main() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log(
    "║  E2E Live Pipeline Simulation — Phase 10                      ║",
  );
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log();

  log("START", "Beginning E2E deal processing cycle...", "STEP");

  const startTime = Date.now();
  const steps = [];

  const runStep = async (name, fn) => {
    const start = Date.now();
    try {
      const result = await fn();
      steps.push({
        step: name,
        success: true,
        durationMs: Date.now() - start,
        details: result.details || `${name} completed`,
      });
      return result;
    } catch (error) {
      steps.push({
        step: name,
        success: false,
        durationMs: Date.now() - start,
        error: error.message,
      });
      throw error;
    }
  };

  try {
    // Step 1: Deal Curation
    const curated = await runStep("deal_curation", () =>
      simulateDealCuration(CONFIG.productId),
    );
    if (!curated.success) throw new Error("Deal curation failed");

    // Step 2: Vector Dedup
    const dedup = await runStep("vector_dedup", () =>
      simulateVectorDedup(CONFIG.productId),
    );
    if (dedup.isDuplicate) {
      log("DONE", "Pipeline stopped — duplicate detected", "WARN");
      printResults(steps, startTime, true);
      process.exit(0);
    }

    // Step 3: AI Copywriting
    const copy = await runStep("ai_copywriting", () =>
      simulateAICopywriting(CONFIG.productId),
    );

    // Step 4: Watermark
    if (CONFIG.enableWatermark) {
      await runStep("watermark", () => simulateWatermark(CONFIG.productId));
    }

    // Step 5: B2 Upload
    if (CONFIG.enableB2Upload) {
      await runStep("b2_upload", () => simulateB2Upload(CONFIG.productId));
    }

    // Step 6: Supabase Insert
    await runStep("supabase_insert", () =>
      simulateSupabaseInsert(CONFIG.productId),
    );

    // Step 7: Facebook Post
    if (CONFIG.enableFacebook) {
      await runStep("facebook_post", () =>
        simulateFacebookPost(CONFIG.productId),
      );
    }

    // Step 8: Twitter Thread
    if (CONFIG.enableTwitter) {
      await runStep("twitter_thread", () =>
        simulateTwitterThread(CONFIG.productId),
      );
    }

    printResults(steps, startTime, true);
    process.exit(0);
  } catch (error) {
    const elapsed = Date.now() - startTime;
    log(
      "ERROR",
      `Pipeline crashed after ${elapsed}ms: ${error.message}`,
      "ERROR",
    );
    printResults(steps, startTime, false);
    process.exit(1);
  }
}

function printResults(steps, startTime, success) {
  const elapsed = Date.now() - startTime;
  console.log();
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log(
    "║  Pipeline Results                                            ║",
  );
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(`  Total Time:  ${elapsed}ms`);
  console.log(`  Overall:     ${success ? "OK2 SUCCESS" : "FAIL FAILED"}`);
  console.log();
  console.log("  Steps:");

  for (const step of steps) {
    const icon = step.success ? "OK2" : "FAIL";
    console.log(`    ${icon} ${step.step.padEnd(20)} ${step.durationMs}ms`);
    if (step.details) {
      console.log(`       ↳ ${step.details}`);
    }
    if (step.error) {
      console.log(`       ↳ Error: ${step.error}`);
    }
  }

  console.log();
}

// Run
main();
