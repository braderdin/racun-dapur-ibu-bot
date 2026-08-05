#!/usr/bin/env node
/**
 * OpenRouter AI Model Detection & Proxy Tester
 * Format: OpenAI-Compatible Chat Completions
 * Reads OPENROUTER_BASE_URL, OPENROUTER_API_KEY, and OPENROUTER_MODEL from .env.local
 *
 * Usage: node bin/test-openrouter.js
 */

const fs = require("fs");
const path = require("path");

// Load dotenv safely
let dotenv;
try {
  dotenv = require("dotenv");
} catch (e) {
  console.error("❌ dotenv package not installed. Run: npm install dotenv");
  process.exit(1);
}

// Load environment variables from .env.local
const envPath = path.join(__dirname, "..", ".env.local");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

async function testOpenRouterModel() {
  const rawBaseUrl = process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";
  const baseUrl = rawBaseUrl.replace(/\/+$/, ""); // Clean trailing slashes
  const apiKey = process.env.OPENROUTER_API_KEY || "sk-dummy-key";
  const requestedModel = process.env.OPENROUTER_MODEL || "openrouter/free";

  console.log("\n🚀 Memulakan Ujian Sambungan Cloudflare Worker Proxy OpenRouter...");
  console.log(`📌 Base URL        : ${baseUrl}`);
  console.log(`📌 Requested Model : ${requestedModel}`);
  console.log(`📌 API Key         : ${apiKey.substring(0, 12)}...\n`);

  const endpoint = `${baseUrl}/chat/completions`;

  try {
    const startTime = Date.now();
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://racun-dapur-ibu.vercel.app",
        "X-Title": "Racun Dapur Ibu Bot Tester",
      },
      body: JSON.stringify({
        model: requestedModel,
        messages: [
          {
            role: "user",
            content: "Sapa secara ringkas dalam 1 ayat dan sebutkan nama model AI anda.",
          },
        ],
        temperature: 0.7,
      }),
    });

    const elapsed = Date.now() - startTime;

    if (!response.ok) {
      const errText = await response.text();
      console.error(`❌ Ujian Gagal! HTTP Status: ${response.status}`);
      console.error(`Detail Ralat: ${errText}`);
      return;
    }

    const data = await response.json();

    console.log("==========================================================================");
    console.log("  LAPORAN RESPONS OPENROUTER AI PROXY & MODEL ID SEBENAR");
    console.log("==========================================================================");
    console.log(`✅ Status Sambungan    : HTTP 200 OK (${elapsed}ms)`);
    console.log(`🎯 Actual Model ID     : \x1b[33m\x1b[1m${data.model || "Tidak Ditentukan"}\x1b[0m`);

    if (data.choices && data.choices[0] && data.choices[0].message) {
      console.log(
        `💬 Respons AI          : \x1b[32m"${data.choices[0].message.content.trim()}"\x1b[0m`,
      );
    } else {
      console.log(`⚠️ Payload Choices    : `, JSON.stringify(data.choices));
    }

    if (data.usage) {
      console.log(
        `📊 Penggunaan Token    : Prompt: ${data.usage.prompt_tokens || 0} | Completion: ${data.usage.completion_tokens || 0} | Total: ${data.usage.total_tokens || 0}`,
      );
    }
    console.log("==========================================================================\n");
  } catch (err) {
    console.error(`❌ Ralat Rangkaian / Pelaksanaan:`, err.message);
  }
}

testOpenRouterModel();