#!/usr/bin/env node
/**
 * AI Copywriting Evaluation CLI Script
 * Benchmarks AI copywriting quality and latency across sample kitchen/baby deals
 * Uses openrouter/free model via process.env.OPENROUTER_BASE_URL and process.env.OPENROUTER_MODEL
 */

const { Redis } = require("@upstash/redis");
const fetch = require("node-fetch");

// Configuration
const SAMPLE_DEALS = [
  {
    id: "deal_001",
    title: "Set Sabun Cuci Pakaian Baby Care 3-in-1",
    category: "baby",
    price: 29.9,
    discount: 45,
    platform: "x",
  },
  {
    id: "deal_002",
    title: "Kuali Keramik Anti Lontet 18 Inch",
    category: "kitchen",
    price: 89.9,
    discount: 35,
    platform: "facebook",
  },
  {
    id: "deal_003",
    title: "Skincare Ibu & Bayi Organic Moisturizer 100ml",
    category: "baby",
    price: 59.9,
    discount: 40,
    platform: "x",
  },
  {
    id: "deal_004",
    title: "Panci Arang 3 Liter dengan Penutup",
    category: "kitchen",
    price: 69.9,
    discount: 30,
    platform: "facebook",
  },
  {
    id: "deal_005",
    title: "Sudut Pembersih Bayi Silicone Set 6 Buah",
    category: "baby",
    price: 24.9,
    discount: 50,
    platform: "x",
  },
];

// Environment variables (safe for local & CI)
const OPENROUTER_BASE_URL =
  process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "openrouter/free";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const UPSTASH_REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

// Timeout wrapper for API calls
const TIMEOUT_MS = 10000;

/**
 * Create abort controller with timeout
 */
function createTimeoutController(timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return { controller, timeout };
}

/**
 * Generate AI copywriting for a deal
 */
async function generateCopy(deal, platform) {
  const startTime = Date.now();
  let generatedCopy = "";
  let confidence = 0;
  let fallbackUsed = false;
  let error = null;

  try {
    if (!OPENROUTER_API_KEY) {
      throw new Error("OPENROUTER_API_KEY not set");
    }

    const systemPrompt = `You are a Malaysian marketing copywriter for "Bot Racun Dapur Ibu". Generate engaging copy for ${platform === "x" ? "X/Twitter" : "Facebook"} post about: ${deal.title}. Use warm, friendly Malaysian household tone. Focus on family values and quality products. Keep it concise and compelling.`;

    const userPrompt = `Generate ${platform === "x" ? "a short punchy hook (max 280 chars)" : "a storytelling caption (max 500 chars)"} for this deal: ${deal.title}. Price: RM ${deal.price}, Discount: ${deal.discount}%. Return only the copy text.`;

    const { controller, timeout } = createTimeoutController(TIMEOUT_MS);

    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://racun.ibu.my",
        "X-Title": "Racun Dapur Ibu Bot",
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: platform === "x" ? 50 : 100,
        temperature: 0.7,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    generatedCopy = data.choices?.[0]?.message?.content?.trim() || "";
    confidence = data.choices?.[0]?.finish_reason === "stop" ? 0.9 : 0.7;
  } catch (err) {
    clearTimeout(timeout);
    error = err.message;
    fallbackUsed = true;

    // Fallback: Generate heuristic copy
    generatedCopy =
      platform === "x"
        ? `🔥 DISKON ${deal.discount}%! ${deal.title} hanya RM${deal.price}. Cepat sebelum kehabisan! #RacunDapurIbu`
        : `Kami telah menemui ${deal.title} dengan diskaun ${deal.discount}% untuk hanya RM${deal.price}. Produk berkualiti untuk keluarga. Klik untuk dapatkan!`;
  }

  const responseTime = Date.now() - startTime;

  return {
    dealId: deal.id,
    title: deal.title,
    platform,
    generatedCopy,
    responseTimeMs: responseTime,
    confidenceScore: confidence,
    fallbackUsed,
    error: error || null,
  };
}

/**
 * Store result in Redis for telemetry
 */
async function storeResult(result) {
  if (!UPSTASH_REDIS_URL || !UPSTASH_REDIS_TOKEN) return;

  try {
    const redis = new Redis({
      url: UPSTASH_REDIS_URL,
      token: UPSTASH_REDIS_TOKEN,
    });

    const key = `eval_result:${result.dealId}:${Date.now()}`;
    await redis.setex(key, 86400, JSON.stringify(result));
  } catch (err) {
    console.error("Error storing result:", err.message);
  }
}

/**
 * Main evaluation function
 */
async function runEvaluation() {
  console.log("=".repeat(60));
  console.log("🤖 AI COPYWRITING EVALUATION - Phase 17");
  console.log("=".repeat(60));
  console.log(`Model: ${OPENROUTER_MODEL}`);
  console.log(`Base URL: ${OPENROUTER_BASE_URL}`);
  console.log(`Timeout: ${TIMEOUT_MS}ms`);
  console.log("=".repeat(60));
  console.log();

  const results = [];
  let totalLatency = 0;
  let fallbackCount = 0;
  let errorCount = 0;

  for (const deal of SAMPLE_DEALS) {
    console.log(`\n📦 Evaluating: ${deal.title}`);
    console.log(`   Category: ${deal.category} | Platform: ${deal.platform}`);

    const result = await generateCopy(deal, deal.platform);
    results.push(result);
    totalLatency += result.responseTimeMs;

    if (result.fallbackUsed) fallbackCount++;
    if (result.error) errorCount++;

    console.log(
      `   ✅ Generated: "${result.generatedCopy.substring(0, 60)}..."`,
    );
    console.log(`   ⏱️ Latency: ${result.responseTimeMs}ms`);
    console.log(
      `   🎯 Confidence: ${(result.confidenceScore * 100).toFixed(1)}%`,
    );
    if (result.fallbackUsed) console.log(`   ⚠️ Fallback used`);

    await storeResult(result);
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 EVALUATION SUMMARY");
  console.log("=".repeat(60));
  console.log(`Total Deals Evaluated: ${results.length}`);
  console.log(
    `Average Latency: ${(totalLatency / results.length).toFixed(0)}ms`,
  );
  console.log(
    `Fallback Rate: ${((fallbackCount / results.length) * 100).toFixed(1)}%`,
  );
  console.log(`Error Count: ${errorCount}`);
  console.log(
    `3-Tier Fallback Status: ${fallbackCount > 0 ? "ACTIVE" : "STABLE"}`,
  );
  console.log("=".repeat(60));

  // Return results for programmatic use
  return {
    success: errorCount === 0,
    totalEvaluations: results.length,
    averageLatencyMs: Math.round(totalLatency / results.length),
    fallbackRate: fallbackCount / results.length,
    results,
  };
}

// Run evaluation
if (require.main === module) {
  runEvaluation()
    .then((summary) => {
      console.log("\n✅ Evaluation complete!");
      process.exit(0);
    })
    .catch((err) => {
      console.error("\n❌ Evaluation failed:", err.message);
      process.exit(1);
    });
}

module.exports = { runEvaluation, generateCopy, SAMPLE_DEALS };
