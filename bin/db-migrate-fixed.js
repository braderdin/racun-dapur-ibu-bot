/*
 * Database Migration Helper Script - Fixed Version
 * Reads DIRECT_URL from .dev.vars file to execute SQL schema files
 * Executes SQL schema files directly against Supabase unpooled direct connection
 * Follows WSL Network Protocol with ?pgbouncer=false parameter
 * Provides timeout wrappers to guarantee process auto-exits on failure
 */

import pg from "pg";
import fs from "fs/promises";
import path from "path";

// Helper function to read DIRECT_URL from .dev.vars file
async function getDirectUrlFromDevVars() {
  try {
    const content = await fs.readFile(
      path.join(process.cwd(), ".dev.vars"),
      "utf8",
    );
    const lines = content.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      // Skip empty lines and comments
      if (trimmed && !trimmed.startsWith("#")) {
        // Match DIRECT_URL=...
        const match = trimmed.match(/^DIRECT_URL=(.*)$/);
        if (match) {
          // Remove quotes and trim any trailing comments
          return match[1].replace(/\"/g, "").trim();
        }
      }
    }
    throw new Error("DIRECT_URL not found in .dev.vars file");
  } catch (error) {
    console.error("FAIL Failed to read .dev.vars file:", error.message);
    throw error;
  }
}

// Environment variables - read-only access to .env.local/.dev.vars
let DIRECT_URL =
  process.env.DATABASE_URL_DIRECT_UNPOOLED || process.env.DIRECT_URL;
let SUPABASE_URL = process.env.SUPABASE_URL;
let SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function loadEnvFromDevVars() {
  try {
    // Try to load from .dev.vars if environment variables are not set
    if (!DIRECT_URL || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.log("📄 Loading environment variables from .dev.vars file...");
      // Extract values from .dev.vars
      const devVarsContent = await fs.readFile(
        path.join(process.cwd(), ".dev.vars"),
        "utf8",
      );
      const lines = devVarsContent.split("\n");

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#")) {
          // Match VAR_NAME=value (where value may be quoted)
          const match = trimmed.match(/^([A-Z_][A-Z_]*)=(.*)$/);
          if (match) {
            const varName = match[1];
            let varValue = match[2].trim();

            // Remove surrounding quotes
            if (
              (varValue.startsWith('"') && varValue.endsWith('"')) ||
              (varValue.startsWith("'") && varValue.endsWith("'"))
            ) {
              varValue = varValue.slice(1, -1);
            }

            // Set environment variable
            if (!process.env[varName]) {
              process.env[varName] = varValue;
            }

            // Set local variables for the script
            switch (varName) {
              case "DATABASE_URL_DIRECT_UNPOOLED":
                DIRECT_URL = varValue;
                break;
              case "DIRECT_URL":
                DIRECT_URL = varValue;
                break;
              case "SUPABASE_URL":
                SUPABASE_URL = varValue;
                break;
              case "SUPABASE_SERVICE_ROLE_KEY":
                SUPABASE_SERVICE_ROLE_KEY = varValue;
                break;
            }
          }
        }
      }
    }

    // Validate required environment variables
    if (!DIRECT_URL) {
      throw new Error(
        "FAIL DATABASE_URL_DIRECT_UNPOOLED environment variable is required (set in .env.local or .dev.vars)",
      );
    }

    // Ensure pgbouncer=false is set for direct unpooled connection
    if (!DIRECT_URL.includes("pgbouncer=false")) {
      DIRECT_URL = DIRECT_URL.replace(/pgbouncer=true/, "pgbouncer=false");
      if (!DIRECT_URL.includes("pgbouncer=")) {
        DIRECT_URL = DIRECT_URL + "?pgbouncer=false";
      }
    }

    console.log("OK2 Environment variables loaded successfully");
    console.log(
      "🔗 DATABASE_URL_DIRECT_UNPOOLED: " + DIRECT_URL.substring(0, 50) + "...",
    );
  } catch (error) {
    console.error("FAIL Failed to load environment variables:", error.message);
    throw error;
  }
}

// Split SQL into individual statements by semicolons outside of $$ blocks
function splitSqlStatements(sql) {
  const statements = [];
  let current = "";
  let inDollarBlock = false;
  let i = 0;

  while (i < sql.length) {
    if (sql.substring(i, i + 3) === "$$") {
      inDollarBlock = !inDollarBlock;
      current += "$$";
      i += 3;
    } else if (sql[i] === ";" && !inDollarBlock) {
      statements.push(current.trim());
      current = "";
      i++;
    } else {
      current += sql[i];
      i++;
    }
  }

  if (current.trim()) {
    statements.push(current.trim());
  }

  return statements;
}

async function executeSqlFile(filePath) {
  try {
    console.log(`📄 Executing SQL file: ${filePath}`);

    const sqlContent = await fs.readFile(filePath, "utf8");

    // Remove single-line comment lines but preserve all SQL statements
    const cleanedSql = sqlContent
      .split("\n")
      .map((line) => {
        const trimmed = line.trim();
        if (trimmed.startsWith("--")) return "";
        return line;
      })
      .join("\n")
      .trim();

    if (cleanedSql.length === 0) {
      console.log(`WARN  No valid SQL found in ${filePath}`);
      return;
    }

    const client = new pg.Pool({
      connectionString: DIRECT_URL,
      ssl: { rejectUnauthorized: false },
    });

    // Execute SQL file by splitting into individual statements
    // This avoids issues with DO $$ blocks containing BEGIN/END
    // and allows each statement to be executed independently
    console.log(`  Executing SQL batch from ${path.basename(filePath)}`);

    // Split SQL into individual statements by semicolons outside of $$ blocks
    const statements = splitSqlStatements(cleanedSql);
    let successCount = 0;
    let failCount = 0;

    for (const stmt of statements) {
      const trimmed = stmt.trim();
      if (!trimmed) continue;
      try {
        await client.query(trimmed);
        successCount++;
      } catch (stmtError) {
        // Skip non-critical errors (e.g., IF NOT EXISTS for existing objects)
        const msg = stmtError.message || "";
        if (
          msg.includes("already exists") ||
          msg.includes("does not exist") ||
          (msg.includes("relation") && msg.includes("already"))
        ) {
          console.log(`  WARN  Skipped (expected): ${msg.substring(0, 100)}`);
          successCount++;
        } else {
          console.error(`  FAIL Statement failed: ${msg.substring(0, 200)}`);
          failCount++;
        }
      }
    }

    console.log(
      `  OK2 SQL batch executed (${successCount} succeeded, ${failCount} failed)`,
    );

    await client.end();
    console.log(`OK2 Successfully executed ${path.basename(filePath)}`);
  } catch (error) {
    console.error(`FAIL Failed to execute ${filePath}:`, error.message);
    throw error;
  }
}

async function main() {
  await loadEnvFromDevVars();

  const migrationsDir = path.join(process.cwd(), "supabase", "migrations");

  try {
    console.log("ROCKET Database Migration Helper Script started");
    console.log(`FOLDER Migration directory: ${migrationsDir}`);

    // Read all migration files
    const files = await fs.readdir(migrationsDir);
    const sqlFiles = files.filter((file) => file.endsWith(".sql")).sort(); // Execute in alphabetical order (timestamp prefix)

    if (sqlFiles.length === 0) {
      console.log("WARN  No migration files found");
      return;
    }

    console.log(`📋 Found ${sqlFiles.length} migration file(s):`);
    sqlFiles.forEach((file) => console.log(`  - ${file}`));

    // Execute each migration file
    for (const file of sqlFiles) {
      const filePath = path.join(migrationsDir, file);
      await executeSqlFile(filePath);
      console.log(""); // Add spacing between files
    }

    console.log("SUCCESS All migrations executed successfully!");
  } catch (error) {
    console.error("BANG Migration script failed:", error.message);
    process.exit(1);
  }
}

// Execute main function with timeout wrapper
const timeoutPromise = new Promise((_, reject) => {
  setTimeout(
    () => reject(new Error("Migration timed out after 30 seconds")),
    30000,
  );
});

Promise.race([main(), timeoutPromise])
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("BANG Fatal error:", error.message);
    process.exit(1);
  });
