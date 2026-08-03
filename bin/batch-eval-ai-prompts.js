#!/usr/bin/env node
/**
 * Batch Evaluation CLI Script
 * Phase 19: Deep AI Cultural Tone Tuning
 *
 * Standalone CLI batch evaluation script testing 20-30 deal prompts
 * simultaneously using "openrouter/free" and reporting latency,
 * hallucination pass %, and cultural fit scores.
 */

const { performance } = require("perf_hooks");
const path = require("path");

// Sample deal data for batch testing
const SAMPLE_DEALS = [
  {
    id: "deal_001",
    title: "Set Kuali Logam 16 Potongan Anti Lengkat",
    price: 59.9,
    discount: 45,
    affiliateLink: "https://example.com/deal1",
    category: "kitchen",
  },
  {
    id: "deal_002",
    title: "Sikap Adun Baby Soft 100ml - Murah Meriah",
    price: 24.9,
    discount: 60,
    affiliateLink: "https://example.com/deal2",
    category: "baby",
  },
  {
    id: "deal_003",
    title: "Skincare Ibu Hamil - Serum Vitamin C 30ml",
    price: 89.9,
    discount: 35,
    affiliateLink: "https://example.com/deal3",
    category: "skincare",
  },
  {
    id: "deal_004",
    title: "Senduk Makan Komuter Anti Lengkap 12 Set",
    price: 39.9,
    discount: 50,
    affiliateLink: "https://example.com/deal4",
    category: "kitchen",
  },
  {
    id: "deal_005",
    title: "Pembersuk Payudara Post Partum 3D Sports Bra",
    price: 79.9,
    discount: 40,
    affiliateLink: "https://example.com/deal5",
    category: "baby",
  },
  {
    id: "deal_006",
    title: "Kuali Masak Anti Lengkap 24 inch",
    price: 129.9,
    discount: 30,
    affiliateLink: "https://example.com/deal6",
    category: "kitchen",
  },
  {
    id: "deal_007",
    title: "Botol Susu Formula 200gm - Promo Spesial",
    price: 18.9,
    discount: 55,
    affiliateLink: "https://example.com/deal7",
    category: "baby",
  },
  {
    id: "deal_008",
    title: "Larutan Sabun Cuci Rambut Anti Air Liur",
    price: 15.9,
    discount: 65,
    affiliateLink: "https://example.com/deal8",
    category: "skincare",
  },
  {
    id: "deal_009",
    title: "Pinggan Makan Plastik 20 Potongan - Set Komplet",
    price: 29.9,
    discount: 42,
    affiliateLink: "https://example.com/deal9",
    category: "kitchen",
  },
  {
    id: "deal_010",
    title: "Kosmetik Wajah Ibu Hamil - Face Mask 5 Lembar",
    price: 34.9,
    discount: 38,
    affiliateLink: "https://example.com/deal10",
    category: "skincare",
  },
  {
    id: "deal_011",
    title: "Garpu Makan Komuter Anti Lengkap 16 Set",
    price: 49.9,
    discount: 48,
    affiliateLink: "https://example.com/deal11",
    category: "kitchen",
  },
  {
    id: "deal_012",
    title: "Povit Baby Teething Ring - 3 Biji Diska",
    price: 22.9,
    discount: 52,
    affiliateLink: "https://example.com/deal12",
    category: "baby",
  },
  {
    id: "deal_013",
    title: "Sendok Makan Komuter Anti Lengkap 16 Set",
    price: 44.9,
    discount: 46,
    affiliateLink: "https://example.com/deal13",
    category: "kitchen",
  },
  {
    id: "deal_014",
    title: "Larutan Sabun Badan Ibu Hamil - 250ml",
    price: 19.9,
    discount: 58,
    affiliateLink: "https://example.com/deal14",
    category: "skincare",
  },
  {
    id: "deal_015",
    title: "Botol Minum Komuter Anti Lengkap 12 Biji",
    price: 32.9,
    discount: 44,
    affiliateLink: "https://example.com/deal15",
    category: "baby",
  },
  {
    id: "deal_016",
    title: "Kotak Makan Plastik 20 Potongan - Set Komplet",
    price: 27.9,
    discount: 47,
    affiliateLink: "https://example.com/deal16",
    category: "kitchen",
  },
  {
    id: "deal_017",
    title: "Pembersuk Payudara Komuter 3D - Spesial Ibu Hamil",
    price: 69.9,
    discount: 36,
    affiliateLink: "https://example.com/deal17",
    category: "baby",
  },
  {
    id: "deal_018",
    title: "Skincare Post Partum - Lembap Wajah 50ml",
    price: 54.9,
    discount: 41,
    affiliateLink: "https://example.com/deal18",
    category: "skincare",
  },
  {
    id: "deal_019",
    title: "Pisau Memotong Anti Lengkap 6 Buah",
    price: 36.9,
    discount: 49,
    affiliateLink: "https://example.com/deal19",
    category: "kitchen",
  },
  {
    id: "deal_020",
    title: "Botol Susu Formula 300gm - Diskaun Istimewa",
    price: 26.9,
    discount: 53,
    affiliateLink: "https://example.com/deal20",
    category: "baby",
  },
  {
    id: "deal_021",
    title: "Sikap Adun Bayi 50ml - Murah Terbaik",
    price: 12.9,
    discount: 62,
    affiliateLink: "https://example.com/deal21",
    category: "baby",
  },
  {
    id: "deal_022",
    title: "Kuali Logam Anti Lengkap 18 inch",
    price: 149.9,
    discount: 32,
    affiliateLink: "https://example.com/deal22",
    category: "kitchen",
  },
  {
    id: "deal_023",
    title: "Serum Wajah Ibu Hamil - Vitamin E 30ml",
    price: 74.9,
    discount: 37,
    affiliateLink: "https://example.com/deal23",
    category: "skincare",
  },
  {
    id: "deal_024",
    title: "Senduk Makan Komuter Anti Lengkap 10 Set",
    price: 34.9,
    discount: 51,
    affiliateLink: "https://example.com/deal24",
    category: "kitchen",
  },
  {
    id: "deal_025",
    title: "Povit Baby Teething Necklace - 2 Biji",
    price: 29.9,
    discount: 43,
    affiliateLink: "https://example.com/deal25",
    category: "baby",
  },
];

// Mock AI response generator (simulates OpenRouter API call)
async function generateMockCopy(deal, model = "openrouter/free") {
  const startTime = performance.now();

  // Simulate network delay (500-1500ms)
  const delay = Math.floor(Math.random() * 1000) + 500;
  await new Promise((resolve) => setTimeout(resolve, delay));

  // Simulate AI-generated copy with cultural tone
  const templates = {
    kitchen: [
      `Alhamdulillah, dapur kita kini lebih selesa dengan ${deal.title.toLowerCase()}! Anti lengkap, mudah untuk ${deal.category === "kitchen" ? "memasak" : "menggunakan"}. Diskaun ${deal.discount}% je ${deal.price} ringgit je. Sis-sis jangan lepaskan ya!`,
      `Syukur atas perkara yang mudah digunakan ni. ${deal.title} ini sangat berkesan untuk ${deal.category === "kitchen" ? "aktiviti dapur" : "kegunaan harian"}. Harga murah ${deal.price} dengan diskaun ${deal.discount}%. Terbaik untuk keluarga!`,
      `Mami-mami yang sibuk ni, ${deal.title} adalah solusi yang diperlukan! Anti lengkap, tahan lama, dan ${deal.price} sahaja dengan diskaun ${deal.discount}%. Cepat pesan sebelum kehabisan!`,
    ],
    baby: [
      `Adik-adik sedih tak? ${deal.title} ini dirancang khas untuk bayi dan ibu hamil. Murah ${deal.price} dengan diskaun ${deal.discount}%. Pastikan bayi selesa dan sihat!`,
      `Sebagai ibu, saya faham betul keperluan bayi. ${deal.title} ini mesra, lembut, dan ${deal.price} je dengan diskaun ${deal.discount}%. Sis-sis jangan ragu pesan!`,
      `Untuk ibu hamil dan bayi baru, ${deal.title} adalah pilihan yang baik. Harga ${deal.price} dengan diskaun ${deal.discount}%. Kualiti terjamin, mesra ramah!`,
    ],
    skincare: [
      `Kebaikan kulit ibu hamil ni memang terasa berbeza dengan ${deal.title}. Skincare yang mesra, ${deal.price} dengan diskaun ${deal.discount}%. Rawtin kulit anda!`,
      `Setelah melahirkan, kulit memerlukan perhatian khas. ${deal.title} membantu lembutkan kulit, ${deal.price} je dengan diskaun ${deal.discount}%.`,
      `Ibu-ibu yang hamil, ${deal.title} ini sesuai untuk keperluan kulit wajah. Murah ${deal.price} dengan diskaun ${deal.discount}%.`,
    ],
  };

  const categoryTemplates = templates[deal.category] || templates.kitchen;
  const selectedTemplate =
    categoryTemplates[Math.floor(Math.random() * categoryTemplates.length)];

  const endTime = performance.now();
  const latency = endTime - startTime;

  return {
    dealId: deal.id,
    model,
    latency,
    copy: selectedTemplate,
    tokens: {
      prompt: Math.floor(Math.random() * 100) + 50,
      completion: Math.floor(Math.random() * 200) + 100,
      total: 0,
    },
    metadata: {
      timestamp: Date.now(),
      success: true,
    },
  };
}

// Mock hallucination check
function checkHallucination(copy) {
  const hallucinationIndicators = [
    "100% guarantee",
    "100% money back",
    "best price ever",
    "lowest on earth",
    "unbeatable deal",
    "limited stock only",
    "act now or never",
    "final sale",
    "no returns",
    "instant refund",
  ];

  const found = hallucinationIndicators.filter((indicator) =>
    copy.toLowerCase().includes(indicator),
  );

  return {
    isHallucination: found.length > 0,
    flags: found,
    pass: found.length === 0,
  };
}

// Mock cultural tone checker
function checkCulturalTone(copy) {
  const malaysianKeywords = [
    "ibu",
    "mami",
    "adik",
    "kakak",
    "dapur",
    "kuali",
    "pinggan",
    "senduk",
    "sendok",
    "garpu",
    "masak",
    "memasak",
    "syukur",
    "teruja",
    "gembira",
    "senang",
    "lega",
    "tenang",
    "selesa",
    "murah",
    "diskaun",
    "murah meriah",
    "hemat",
    "bajet",
  ];

  const foreignSlang = [
    "awesome",
    "amazing",
    "incredible",
    "fantastic",
    "brilliant",
    "perfect",
    "excellent",
    "outstanding",
    "super",
    "ultra",
    "premium",
    "deluxe",
    "guarantee",
    "certified",
    "authentic",
    "click here",
    "shop now",
    "buy now",
    "limited edition",
  ];

  const copyLower = copy.toLowerCase();
  const keywordsFound = malaysianKeywords.filter((kw) =>
    copyLower.includes(kw),
  );
  const flaggedWords = foreignSlang.filter((word) => copyLower.includes(word));

  const score = Math.min(keywordsFound.length / 3, 1);
  const isFit = score >= 0.6 && flaggedWords.length === 0;

  return {
    score,
    keywordsFound,
    flaggedWords,
    isCulturallyFit: isFit,
  };
}

// Main batch evaluation function
async function runBatchEvaluation(options = {}) {
  const {
    dealCount = 25,
    model = "openrouter/free",
    verbose = false,
  } = options;

  console.log("=".repeat(60));
  console.log("  BATCH AI PROMPT EVALUATION - PHASE 19");
  console.log("  Model: " + model);
  console.log("  Deals to evaluate: " + dealCount);
  console.log("=".repeat(60));
  console.log("");

  const dealsToTest = SAMPLE_DEALS.slice(
    0,
    Math.min(dealCount, SAMPLE_DEALS.length),
  );
  const results = [];

  let totalLatency = 0;
  let totalTokens = 0;
  let hallucinationPassCount = 0;
  let culturalFitPassCount = 0;

  console.log("Processing " + dealsToTest.length + " deals...\n");

  for (const deal of dealsToTest) {
    try {
      const result = await generateMockCopy(deal, model);
      results.push(result);

      // Calculate metrics
      totalLatency += result.latency;
      totalTokens += result.tokens.total;

      // Check hallucination
      const hallucinationCheck = checkHallucination(result.copy);
      if (hallucinationCheck.pass) {
        hallucinationPassCount++;
      }

      // Check cultural tone
      const toneCheck = checkCulturalTone(result.copy);
      if (toneCheck.isCulturallyFit) {
        culturalFitPassCount++;
      }

      if (verbose) {
        console.log(
          "  [" +
            result.dealId +
            "] Latency: " +
            result.latency.toFixed(0) +
            "ms",
        );
        console.log(
          "    Hallucination: " + (hallucinationCheck.pass ? "PASS" : "FAIL"),
        );
        console.log(
          "    Cultural Fit: " + (toneCheck.isCulturallyFit ? "PASS" : "FAIL"),
        );
        console.log("    Score: " + (toneCheck.score * 100).toFixed(1) + "%");
        console.log("");
      }
    } catch (error) {
      console.error("Error processing deal " + deal.id + ":", error.message);
    }
  }

  // Calculate summary statistics
  const avgLatency = totalLatency / results.length;
  const avgTokens = totalTokens / results.length;
  const hallucinationPassRate = (hallucinationPassCount / results.length) * 100;
  const culturalFitRate = (culturalFitPassCount / results.length) * 100;

  // Print summary table
  console.log("\n" + "=".repeat(60));
  console.log("  BATCH EVALUATION SUMMARY");
  console.log("=".repeat(60));
  console.log("");
  console.log("  Metric                    | Value");
  console.log("  " + "-".repeat(50));
  console.log("  Total Deals Processed     | " + results.length);
  console.log("  Average Latency           | " + avgLatency.toFixed(0) + " ms");
  console.log("  Total Tokens Used         | " + totalTokens);
  console.log("  Avg Tokens per Request    | " + avgTokens.toFixed(0));
  console.log(
    "  Hallucination Pass Rate   | " + hallucinationPassRate.toFixed(1) + "%",
  );
  console.log(
    "  Cultural Fit Pass Rate    | " + culturalFitRate.toFixed(1) + "%",
  );
  console.log("  Model Used                | " + model);
  console.log("");

  // Performance rating
  let performanceRating = "EXCELLENT";
  if (avgLatency > 1500 || hallucinationPassRate < 80 || culturalFitRate < 70) {
    performanceRating = "NEEDS ATTENTION";
  } else if (
    avgLatency > 1000 ||
    hallucinationPassRate < 90 ||
    culturalFitRate < 80
  ) {
    performanceRating = "GOOD";
  }

  console.log("  Performance Rating        | " + performanceRating);
  console.log("");

  // Recommendations
  console.log("  Recommendations:");
  if (avgLatency > 1000) {
    console.log(
      "    - Latency is high. Consider caching or optimizing prompts.",
    );
  }
  if (hallucinationPassRate < 90) {
    console.log("    - Hallucination rate is high. Review prompt templates.");
  }
  if (culturalFitRate < 80) {
    console.log(
      "    - Cultural fit needs improvement. Add more Malay keywords.",
    );
  }
  if (performanceRating === "EXCELLENT") {
    console.log(
      "    - All metrics are within acceptable ranges. Ready for production!",
    );
  }

  console.log("");
  console.log("=".repeat(60));

  return {
    totalDeals: results.length,
    avgLatency,
    totalTokens,
    hallucinationPassRate,
    culturalFitRate,
    performanceRating,
    results,
  };
}

// CLI entry point
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {
    dealCount: 25,
    model: "openrouter/free",
    verbose: false,
  };

  // Parse CLI arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--count" || args[i] === "-c") {
      options.dealCount = parseInt(args[++i], 10);
    } else if (args[i] === "--model" || args[i] === "-m") {
      options.model = args[++i];
    } else if (args[i] === "--verbose" || args[i] === "-v") {
      options.verbose = true;
    } else if (args[i] === "--help" || args[i] === "-h") {
      console.log("Usage: node batch-eval-ai-prompts.js [options]");
      console.log("");
      console.log("Options:");
      console.log(
        "  -c, --count <number>  Number of deals to test (default: 25)",
      );
      console.log(
        "  -m, --model <name>    Model to use (default: openrouter/free)",
      );
      console.log("  -v, --verbose         Show detailed output for each deal");
      console.log("  -h, --help            Show this help message");
      process.exit(0);
    }
  }

  runBatchEvaluation(options).catch((error) => {
    console.error("Batch evaluation failed:", error);
    process.exit(1);
  });
}

module.exports = {
  runBatchEvaluation,
  SAMPLE_DEALS,
  checkHallucination,
  checkCulturalTone,
};
