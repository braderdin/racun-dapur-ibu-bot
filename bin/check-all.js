#!/usr/bin/env node

/**
 * SUPER-CHECKER FOR ALL-IN-ONE SYSTEM HEALTH (@RacunDapurIbu Bot)
 * File: bin/check-all.js
 * Description: Runs TypeScript, ESLint, Build, and Environment validation checks
 * sequentially. Generates clean copy-paste reports for Gemini / AI Agents.
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
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
  if (status === "SUCCESS") {
    console.log(
      `  ✅ ${colors.green}${colors.bright}[PASSED]${colors.reset} ${text}`,
    );
  } else if (status === "WARN") {
    console.log(
      `  ⚠️ ${colors.yellow}${colors.bright}[WARNING]${colors.reset} ${text}`,
    );
  } else {
    console.log(
      `  ❌ ${colors.red}${colors.bright}[FAILED]${colors.reset} ${text}`,
    );
  }
}

/**
 * Cleans Stage 4 build output by filtering out Prettier noise (e.g. "(unchanged)")
 */
function cleanBuildOutput(rawOutput) {
  if (!rawOutput) return "No output captured from build command.";

  const lines = rawOutput.split("\n");
  const filteredLines = lines.filter((line) => {
    const trimmed = line.trim();
    return (
      !trimmed.endsWith("(unchanged)") &&
      !trimmed.endsWith("(formatted)") &&
      !/\d+ms \(unchanged\)$/.test(trimmed)
    );
  });

  let cleanedText = filteredLines.join("\n").trim();

  // Keep the most relevant tail lines if the output is still long
  const cleanLines = cleanedText.split("\n");
  if (cleanLines.length > 50) {
    cleanedText =
      "[... Prettier / Verbose logs stripped for clarity ...]\n" +
      cleanLines.slice(-50).join("\n");
  }

  return cleanedText;
}

/**
 * Analyzes Stage 4 error output to extract error count and key lines
 */
function analyzeBuildError(cleanedOutput) {
  const lines = cleanedOutput.split("\n");
  const errorLines = lines.filter((l) => {
    const lower = l.toLowerCase();
    return (
      lower.includes("error") ||
      lower.includes("failed") ||
      lower.includes("err!") ||
      lower.includes("ts")
    );
  });

  return {
    count: Math.max(1, errorLines.length),
    summaryLines: errorLines.slice(-5),
  };
}

const startTime = Date.now();
const results = {
  typeScript: { passed: false, output: "", time: 0 },
  eslint: { passed: false, output: "", time: 0 },
  build: { passed: false, output: "", time: 0, errorCount: 0 },
  environment: { passed: false, output: "", time: 0 },
};

logHeader("🚀 SYSTEM-WIDE HEALTH & COMPLIANCE CHECKER");

// ==========================================
// STAGE 1: TYPESCRIPT HEALTH CHECK
// ==========================================
console.log(
  `${colors.bright}👉 Stage 1/4: Running TypeScript Check...${colors.reset}`,
);
const tsStart = Date.now();
try {
  const checkTsPath = path.join(__dirname, "check-ts.js");
  let command = fs.existsSync(checkTsPath)
    ? "node bin/check-ts.js"
    : "npx tsc --noEmit --pretty false";

  const stdout = execSync(command, {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    cwd: process.cwd(),
  });
  results.typeScript.passed = true;
  results.typeScript.output = stdout;
  logStatus("SUCCESS", "TypeScript compilation is 100% clean!");
} catch (error) {
  results.typeScript.passed = false;
  results.typeScript.output = error.stdout || error.stderr || error.message;
  logStatus("FAILED", "TypeScript errors detected!");
}
results.typeScript.time = ((Date.now() - tsStart) / 1000).toFixed(2);

// ==========================================
// STAGE 2: ESLINT CODE QUALITY CHECK
// ==========================================
console.log(
  `\n${colors.bright}👉 Stage 2/4: Running ESLint Code Quality Check...${colors.reset}`,
);
const eslintStart = Date.now();
try {
  const stdout = execSync("npx eslint src/ --ext .ts,.js --quiet", {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
  results.eslint.passed = true;
  results.eslint.output = stdout || "No linting issues found.";
  logStatus("SUCCESS", "ESLint code quality rules passed!");
} catch (error) {
  results.eslint.passed = false;
  results.eslint.output = error.stdout || error.stderr || error.message;
  logStatus("FAILED", "ESLint violations found!");
}
results.eslint.time = ((Date.now() - eslintStart) / 1000).toFixed(2);

// ==========================================
// STAGE 3: ENVIRONMENT & DOTENV CHECK
// ==========================================
console.log(
  `\n${colors.bright}👉 Stage 3/4: Validating Environment Configuration...${colors.reset}`,
);
const envStart = Date.now();
const envPath = path.join(process.cwd(), ".env");
const envLocalPath = path.join(process.cwd(), ".env.local");
const devVarsPath = path.join(process.cwd(), ".dev.vars");

if (
  fs.existsSync(envPath) ||
  fs.existsSync(envLocalPath) ||
  fs.existsSync(devVarsPath)
) {
  results.environment.passed = true;
  const detectedFile = fs.existsSync(envPath)
    ? ".env"
    : fs.existsSync(envLocalPath)
      ? ".env.local"
      : ".dev.vars";
  results.environment.output = `Environment file (${detectedFile}) detected in workspace root.`;
  logStatus(
    "SUCCESS",
    `Environment configuration file (${detectedFile}) exists!`,
  );
} else {
  results.environment.passed = false;
  results.environment.output =
    "Missing .env / .env.local / .dev.vars file in root directory!";
  logStatus(
    "WARN",
    "No .env / .env.local / .dev.vars file found in workspace root. Please ensure env vars are set.",
  );
}
results.environment.time = ((Date.now() - envStart) / 1000).toFixed(2);

// ==========================================
// STAGE 4: BUILD & BUNDLING CHECK (ENHANCED)
// ==========================================
console.log(
  `\n${colors.bright}👉 Stage 4/4: Testing Project Build / Bundling...${colors.reset}`,
);
const buildStart = Date.now();
const pkgPath = path.join(process.cwd(), "package.json");
let buildCmd = "npx wrangler deploy --dry-run";

if (fs.existsSync(pkgPath)) {
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    if (pkg.scripts && pkg.scripts.build) {
      buildCmd = "npm run build";
    }
  } catch (e) {
    // Fallback if package.json read fails
  }
}

try {
  const stdout = execSync(buildCmd, {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
  results.build.passed = true;
  results.build.output = cleanBuildOutput(stdout);
  logStatus("SUCCESS", `Project build test succeeded via (${buildCmd})!`);
} catch (error) {
  results.build.passed = false;
  const rawOutput =
    (error.stdout || "") +
    "\n" +
    (error.stderr || "") +
    "\n" +
    (error.message || "");
  const cleaned = cleanBuildOutput(rawOutput);
  results.build.output = cleaned;

  const analysis = analyzeBuildError(cleaned);
  results.build.errorCount = analysis.count;

  logStatus(
    "FAILED",
    `Project build test failed via (${buildCmd})! Detected ~${analysis.count} error/warning trace line(s).`,
  );
}
results.build.time = ((Date.now() - buildStart) / 1000).toFixed(2);

// ==========================================
// FINAL SUMMARY & ACTIONABLE REPORT
// ==========================================
const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
const allPassed =
  results.typeScript.passed && results.eslint.passed && results.build.passed;

logHeader(`📊 FINAL REPORT SUMMARY (Completed in ${totalDuration}s)`);

console.log(
  `  1. TypeScript Check : ${results.typeScript.passed ? "✅ PASSED" : "❌ FAILED"} (${results.typeScript.time}s)`,
);
console.log(
  `  2. ESLint Check     : ${results.eslint.passed ? "✅ PASSED" : "❌ FAILED"} (${results.eslint.time}s)`,
);
console.log(
  `  3. Environment Check: ${results.environment.passed ? "✅ PASSED" : "⚠️ WARN"} (${results.environment.time}s)`,
);
console.log(
  `  4. Project Build    : ${results.build.passed ? "✅ PASSED" : "❌ FAILED"} (${results.build.time}s) [${results.build.passed ? "Clean" : results.build.errorCount + " Error Trace(s)"}]`,
);

console.log("\n" + "─".repeat(73));

if (allPassed) {
  console.log(
    `\n${colors.green}${colors.bright} 🎉 ALL SYSTEMS GO! Workspace is 100% clean, valid, and ready for production deployment!${colors.reset}\n`,
  );
  process.exit(0);
} else {
  console.log(
    `\n${colors.red}${colors.bright} ⚠️ ATTENTION: System checks detected issues. Copy the snippet below for Gemini/Agent!${colors.reset}\n`,
  );

  console.log(
    `${colors.yellow}=================== COPY START (FOR GEMINI / AI AGENT) ===================${colors.reset}`,
  );
  console.log(`### 🚨 ALL-IN-ONE CHECKER ERROR REPORT`);
  console.log(`Total Run Time: ${totalDuration}s\n`);

  if (!results.typeScript.passed) {
    console.log(
      `#### ❌ 1. TYPESCRIPT ERRORS:\n\`\`\`text\n${results.typeScript.output.trim()}\n\`\`\`\n`,
    );
  }
  if (!results.eslint.passed) {
    console.log(
      `#### ❌ 2. ESLINT VIOLATIONS:\n\`\`\`text\n${results.eslint.output.trim()}\n\`\`\`\n`,
    );
  }
  if (!results.build.passed) {
    console.log(
      `#### ❌ 3. BUILD FAILURE LOGS (Filtered Clean Trace - ${results.build.errorCount} Error Issue(s)):\n\`\`\`text\n${results.build.output.trim()}\n\`\`\`\n`,
    );
  }

  console.log(
    `**INSTRUCTION FOR AGENT**: Please resolve all the errors listed above starting from TypeScript down to Build failures. Fix 1 file at a time and re-verify with \`node bin/check-all.js\`.`,
  );
  console.log(
    `${colors.yellow}==================== COPY END (FOR GEMINI / AI AGENT) ====================${colors.reset}\n`,
  );

  process.exit(1);
}
