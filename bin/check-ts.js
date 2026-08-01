#!/usr/bin/env node

/**
 * FAST TYPESCRIPT CHECKER FOR AI AGENTS (@RacunDapurIbu)
 * File: bin/check-ts.js
 * Description: Executes 'npx tsc --noEmit --pretty false' with a 15s safety timeout,
 * parses raw error logs into a clean, grouped format for AI Agents to fix fast.
 */

const { exec } = require("child_process");

console.log("⚡ Running Fast TypeScript Health Check for Agent...");

const startTime = Date.now();

// Execute tsc with 15-second safety timeout guard
exec(
  "npx tsc --noEmit --pretty false",
  { timeout: 15000, maxBuffer: 1024 * 1024 * 10 },
  (error, stdout, stderr) => {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    // Status 0: Clean compilation
    if (!error && !stdout) {
      console.log(
        `\n✅ [PASSED] 0 TypeScript Errors found in ${duration}s! Workspace is clean.\n`,
      );
      process.exit(0);
    }

    const rawOutput = stdout || stderr || "";
    const lines = rawOutput
      .split("\n")
      .filter((line) => line.trim().length > 0);
    const parsedErrors = [];

    // Parse standard line: src/services/shopee.ts(45,12): error TS2339: Property 'discount' does not exist on type 'ShopeeProduct'.
    lines.forEach((line) => {
      const match = line.match(
        /^(.+?)\((\d+),(\d+)\):\s*error\s*(TS\d+):\s*(.+)$/,
      );
      if (match) {
        parsedErrors.push({
          file: match[1].trim(),
          line: match[2],
          col: match[3],
          code: match[4],
          msg: match[5].trim(),
        });
      }
    });

    // Fallback display if regex parsing doesn't match raw format
    if (parsedErrors.length === 0) {
      console.log(`\n⚠️ TypeScript Check Output (${duration}s):\n`);
      console.log(rawOutput);
      process.exit(error ? 1 : 0);
    }

    console.log(
      `\n❌ [FAILED] Found ${parsedErrors.length} TypeScript Error(s) in ${duration}s:\n`,
    );
    console.log("=".repeat(85));

    // Group errors by file path
    const grouped = {};
    parsedErrors.forEach((err) => {
      if (!grouped[err.file]) grouped[err.file] = [];
      grouped[err.file].push(err);
    });

    Object.keys(grouped).forEach((filePath) => {
      console.log(`\n📁 File: ${filePath}`);
      grouped[filePath].forEach((err) => {
        console.log(
          `   └─ 📌 Line ${err.line}:${err.col} [${err.code}] ➔ ${err.msg}`,
        );
      });
    });

    console.log("\n" + "=".repeat(85));
    console.log(
      "💡 Tip for Agent: Fix errors starting from the top file listed above!",
    );
    console.log("=".repeat(85) + "\n");

    process.exit(1);
  },
);
