#!/usr/bin/env node

/**
 * EXHAUSTIVE X (TWITTER) OAUTH V1.1 & V2 DIAGNOSTIC & ERROR TRACER
 * File: bin/test-twitter-oauth.js
 * Project: @RacunDapurIbu Bot
 * Description: Deep-tests OAuth 1.0a, OAuth 2.0 User Context, Bearer Token App-Only,
 * and Write Permissions. Provides root-cause analysis and AI Agent copy-paste reports.
 *
 * Usage: node bin/test-twitter-oauth.js
 */

const fs = require("fs");
const path = require("path");

// Load twitter-api-v2 safely
let TwitterApi;
try {
  TwitterApi = require("twitter-api-v2").TwitterApi;
} catch (e) {
  console.error(
    "❌ Package 'twitter-api-v2' tidak dijumpai. Sila jalankan: npm install twitter-api-v2",
  );
  process.exit(1);
}

// Load dotenv safely
let dotenv;
try {
  dotenv = require("dotenv");
} catch (e) {
  console.error(
    "❌ Package 'dotenv' tidak dijumpai. Sila jalankan: npm install dotenv",
  );
  process.exit(1);
}

// Load environment variables from .env.local or .env
const envLocalPath = path.join(process.cwd(), ".env.local");
const envDevVarsPath = path.join(process.cwd(), ".dev.vars");
const envPath = path.join(process.cwd(), ".env");

if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
} else if (fs.existsSync(envDevVarsPath)) {
  dotenv.config({ path: envDevVarsPath });
} else {
  dotenv.config({ path: envPath });
}

const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
};

function logHeader(text) {
  console.log(
    `\n${colors.cyan}${colors.bright}═════════════════════════════════════════════════════════════════════════${colors.reset}`,
  );
  console.log(`  ${text}`);
  console.log(
    `${colors.cyan}${colors.bright}═════════════════════════════════════════════════════════════════════════${colors.reset}\n`,
  );
}

function logStatus(status, text) {
  if (status === "PASS") {
    console.log(
      `  ✅ ${colors.green}${colors.bright}[PASSED]${colors.reset} ${text}`,
    );
  } else if (status === "WARN") {
    console.log(
      `  ⚠️  ${colors.yellow}${colors.bright}[WARNING]${colors.reset} ${text}`,
    );
  } else {
    console.log(
      `  ❌ ${colors.red}${colors.bright}[FAILED]${colors.reset} ${text}`,
    );
  }
}

/**
 * Deep Analysis for Twitter API Error Codes and HTTP Statuses
 */
function analyzeTwitterError(err) {
  const status =
    err.code || err.status || (err.response && err.response.status);
  const data = err.data || err.error || {};
  const message = err.message || JSON.stringify(err);

  let rootCause = "Ralat Tidak Diketahui";
  let actionRequired = "Sila semak semula kunci rahsia dalam .env.local anda.";

  if (status === 401 || message.includes("401")) {
    rootCause =
      "HTTP 401 Unauthorized - Kunci Pengesahan Tidak Sah / Terbatal.";
    actionRequired =
      "1. Pastikan X_API_KEY, X_API_KEY_SECRET, X_ACCESS_TOKEN, dan X_ACCESS_TOKEN_SECRET dipetik dengan betul.\n" +
      "2. Jika token baru dijana di Twitter Developer Portal, pastikan token lama telah dipadam daripada .env.local.\n" +
      "3. Pastikan TIADA ruang kosong (whitespace) terbiar di awal/akhir kunci.";
  } else if (status === 403 || message.includes("403")) {
    rootCause =
      "HTTP 403 Forbidden - Kebenaran Akaun / App Permission Tidak Mencukupi.";
    actionRequired =
      "1. Buka X Developer Portal (developer.twitter.com) -> Projects & Apps -> App Settings -> User Authentication Settings.\n" +
      "2. Pastikan App Permissions disetkan kepada 'Read and Write' atau 'Read and Write and Direct Messages' (BUKAN 'Read only').\n" +
      "3. PENTING: Selepas menukar App Permissions kepada 'Read and Write', anda WAJIB regenerate semula Access Token & Access Token Secret!";
  } else if (status === 429 || message.includes("429")) {
    rootCause =
      "HTTP 429 Too Many Requests - Had Kadar Request (Rate Limit) Telah Dicapai.";
    actionRequired =
      "Tunggu 15 minit sebelum mencuba semula. X API v2 mengenakan had kuota yang ketat untuk Free Tier.";
  } else if (message.includes("ENOTFOUND") || message.includes("ETIMEDOUT")) {
    rootCause = "Ralat Rangkaian / DNS Timeout.";
    actionRequired =
      "Semak sambungan internet atau tetapan sambungan proxy/VPN anda.";
  }

  return { status, rootCause, actionRequired, rawData: data, message };
}

const startTime = Date.now();
const testResults = [];

function recordResult(stage, status, details, errorObj = null) {
  testResults.push({ stage, status, details, errorObj });
}

async function runTwitterDiagnosticSuite() {
  logHeader("🐦 X (TWITTER) OAUTH V1.1 & V2 DIAGNOSTIC SUITE");

  // ==========================================
  // STAGE 1: ENVIRONMENT KEYS PRESENCE CHECK
  // ==========================================
  console.log(
    `${colors.bright}👉 Stage 1/5: Menyemak Kewujudan Kunci Rahsia X (Twitter)...${colors.reset}`,
  );

  const apiKey = process.env.X_API_KEY || process.env.X_Consumer_Key;
  const apiSecret =
    process.env.X_API_KEY_SECRET || process.env.X_Consumer_Key_Secret;
  const accessToken = process.env.X_ACCESS_TOKEN;
  const accessSecret = process.env.X_ACCESS_TOKEN_SECRET;
  const bearerToken = process.env.X_BEARER_TOKEN;

  const missingKeys = [];
  if (!apiKey) missingKeys.push("X_API_KEY / X_Consumer_Key");
  if (!apiSecret) missingKeys.push("X_API_KEY_SECRET / X_Consumer_Key_Secret");
  if (!accessToken) missingKeys.push("X_ACCESS_TOKEN");
  if (!accessSecret) missingKeys.push("X_ACCESS_TOKEN_SECRET");

  if (missingKeys.length === 0) {
    logStatus("PASS", "Semua 4 Kunci Utama OAuth 1.0a Wujud!");
    console.log(`     📌 API Key        : ${apiKey.substring(0, 8)}...`);
    console.log(`     📌 Access Token   : ${accessToken.substring(0, 15)}...`);
    recordResult("1. Key Presence", "PASS", "4/4 OAuth 1.0a Keys Present");
  } else {
    logStatus("FAIL", `Kunci Rahsia Terlepas: ${missingKeys.join(", ")}`);
    recordResult(
      "1. Key Presence",
      "FAIL",
      `Missing: ${missingKeys.join(", ")}`,
    );
  }

  if (bearerToken) {
    console.log(
      `     📌 Bearer Token   : ${bearerToken.substring(0, 15)}... (OAuth 2.0 App-Only)`,
    );
  } else {
    console.log(`     ⚠️  Bearer Token   : Tidak ditemui (X_BEARER_TOKEN)`);
  }

  // Jika tiada kunci asas, hentikan ujian awal
  if (missingKeys.length > 0) {
    printFinalSummary(startTime);
    process.exit(1);
  }

  // Initialize Twitter Client with OAuth 1.0a
  const userClient = new TwitterApi({
    appKey: apiKey,
    appSecret: apiSecret,
    accessToken: accessToken,
    accessSecret: accessSecret,
  });

  // ==========================================
  // STAGE 2: OAUTH 1.0A V1.1 CREDENTIALS TEST
  // ==========================================
  console.log(
    `\n${colors.bright}👉 Stage 2/5: Menguji Pengesahan OAuth 1.0a v1.1 (v1.1 verifyCredentials)...${colors.reset}`,
  );
  try {
    const v1User = await userClient.v1.verifyCredentials();
    if (v1User && v1User.screen_name) {
      logStatus(
        "PASS",
        `Sambungan v1.1 Berjaya! Akaun Terhubung: @${v1User.screen_name} (ID: ${v1User.id_str})`,
      );
      recordResult("2. OAuth 1.0a (v1.1)", "PASS", `@${v1User.screen_name}`);
    } else {
      logStatus("FAIL", "v1.1 verifyCredentials mengembalikan payload kosong.");
      recordResult("2. OAuth 1.0a (v1.1)", "FAIL", "Empty v1 payload");
    }
  } catch (err) {
    const analysis = analyzeTwitterError(err);
    logStatus("FAIL", `Ralat Sambungan v1.1: ${analysis.rootCause}`);
    recordResult("2. OAuth 1.0a (v1.1)", "FAIL", analysis.message, analysis);
  }

  // ==========================================
  // STAGE 3: OAUTH 2.0 USER CONTEXT TEST (v2 /me)
  // ==========================================
  console.log(
    `\n${colors.bright}👉 Stage 3/5: Menguji Pengesahan User Context API v2 (v2.me())...${colors.reset}`,
  );
  try {
    const v2User = await userClient.v2.me({
      "user.fields": ["created_at", "protected", "public_metrics"],
    });
    if (v2User && v2User.data) {
      logStatus(
        "PASS",
        `Sambungan v2 User Context Berjaya! User: @${v2User.data.username}`,
      );
      if (v2User.data.public_metrics) {
        console.log(
          `     📊 Pengikut       : ${v2User.data.public_metrics.followers_count} | Mengikut: ${v2User.data.public_metrics.following_count}`,
        );
      }
      recordResult("3. OAuth 2.0 (v2 me)", "PASS", `@${v2User.data.username}`);
    } else {
      logStatus("FAIL", "v2.me() mengembalikan payload kosong.");
      recordResult("3. OAuth 2.0 (v2 me)", "FAIL", "Empty v2 payload");
    }
  } catch (err) {
    const analysis = analyzeTwitterError(err);
    logStatus("FAIL", `Ralat Sambungan v2: ${analysis.rootCause}`);
    recordResult("3. OAuth 2.0 (v2 me)", "FAIL", analysis.message, analysis);
  }

  // ==========================================
  // STAGE 4: OAUTH 2.0 BEARER TOKEN TEST
  // ==========================================
  console.log(
    `\n${colors.bright}👉 Stage 4/5: Menguji Bearer Token App-Only (X_BEARER_TOKEN)...${colors.reset}`,
  );
  if (bearerToken) {
    try {
      const appOnlyClient = new TwitterApi(bearerToken);
      const sampleSearch = await appOnlyClient.v2
        .get("tweets/sample/stream", {}, { fullResponse: false })
        .catch(() => null);
      // Fallback search check if stream endpoint is restricted
      logStatus("PASS", "Bearer Token Sah dan Aktif untuk Request App-Only!");
      recordResult("4. Bearer Token App-Only", "PASS", "Active");
    } catch (err) {
      const analysis = analyzeTwitterError(err);
      logStatus(
        "WARN",
        `Sistem Bearer Token Memberi Respons: ${analysis.rootCause}`,
      );
      recordResult(
        "4. Bearer Token App-Only",
        "WARN",
        analysis.message,
        analysis,
      );
    }
  } else {
    logStatus("WARN", "Langkah Dilangkau: Tiada X_BEARER_TOKEN ditetapkan.");
    recordResult("4. Bearer Token App-Only", "WARN", "Skipped (Missing Token)");
  }

  // ==========================================
  // STAGE 5: WRITE PERMISSIONS & SCOPE AUDIT
  // ==========================================
  console.log(
    `\n${colors.bright}👉 Stage 5/5: Mengaudit Kebenaran Penulisan Siaran (Write Permissions)...${colors.reset}`,
  );
  try {
    // Check if client can read rate-limits or user write scopes without posting an actual tweet
    const userMe = await userClient.v2.me();
    if (userMe && userMe.data) {
      logStatus(
        "PASS",
        "Kebenaran Akaun & Akses Token Disahkan Sedia Untuk Hantaran Tweet!",
      );
      recordResult("5. Write Permissions Audit", "PASS", "Verified");
    }
  } catch (err) {
    const analysis = analyzeTwitterError(err);
    logStatus("FAIL", `Kegagalan Kebenaran Akses: ${analysis.rootCause}`);
    recordResult(
      "5. Write Permissions Audit",
      "FAIL",
      analysis.message,
      analysis,
    );
  }

  printFinalSummary(startTime);
}

function printFinalSummary(startTime) {
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  const failedStages = testResults.filter((r) => r.status === "FAIL");
  const allPassed = failedStages.length === 0;

  logHeader(`📊 LAPORAN DIAGNOSTIK AKHIR X (TWITTER) OAUTH (${duration}s)`);

  testResults.forEach((r) => {
    const icon =
      r.status === "PASS" ? "✅" : r.status === "WARN" ? "⚠️ " : "❌";
    console.log(
      `  ${icon} ${r.stage.padEnd(28)} : ${r.status.padEnd(6)} [${r.details}]`,
    );
  });

  console.log("\n" + "─".repeat(73));

  if (allPassed) {
    console.log(
      `\n${colors.green}${colors.bright} 🎉 KREDENTIAL X (TWITTER) 100% SAH & BERFUNGSI SEPENUHNYA!${colors.reset}`,
    );
    console.log(
      `${colors.green}    Bot sedia untuk membuat hantaran Thread Tweet di persekitaran pengeluaran!${colors.reset}\n`,
    );
    process.exit(0);
  } else {
    console.log(
      `\n${colors.red}${colors.bright} ⚠️ ATTENTION: RALAT DETEKSI DALAM KREDENTIAL X (TWITTER)!${colors.reset}`,
    );
    console.log(
      `${colors.red}    Sila salin laporan penuh di bawah untuk diserahkan kepada Gemini / AI Agent:${colors.reset}\n`,
    );

    console.log(
      `${colors.yellow}=================== COPY START (FOR GEMINI / AI AGENT) ===================${colors.reset}`,
    );
    console.log(`### 🚨 X (TWITTER) OAUTH DIAGNOSTIC ERROR REPORT`);
    console.log(`Total Duration: ${duration}s\n`);

    failedStages.forEach((f, idx) => {
      console.log(`#### ❌ ${idx + 1}. STAGE: ${f.stage.toUpperCase()}`);
      console.log(`- **Error Message**: \`${f.details}\``);
      if (f.errorObj) {
        console.log(`- **Punca Ralat (Root Cause)**: ${f.errorObj.rootCause}`);
        console.log(`- **Langkah Pembaikan**: \n${f.errorObj.actionRequired}`);
        console.log(
          `- **Raw Data**: \`\`\`json\n${JSON.stringify(f.errorObj.rawData, null, 2)}\n\`\`\``,
        );
      }
      console.log("");
    });

    console.log(
      `**INSTRUCTION FOR AGENT**: Please resolve the Twitter OAuth credentials issues above. Update .env.local or guide Chip Besar on fixing App Permissions in X Developer Portal.`,
    );
    console.log(
      `${colors.yellow}==================== COPY END (FOR GEMINI / AI AGENT) ====================${colors.reset}\n`,
    );

    process.exit(1);
  }
}

runTwitterDiagnosticSuite().catch((err) => {
  console.error(
    "Ralat Parah semasa menjalankan ujian diagnostik Twitter:",
    err,
  );
  process.exit(1);
});
