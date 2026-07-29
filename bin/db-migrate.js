/*
 * Database Migration Helper Script
 * Executes SQL schema files directly against Supabase unpooled direct connection
 * Follows WSL Network Protocol with ?pgbouncer=false parameter
 * Provides timeout wrappers to guarantee process auto-exits on failure
 */

import pg from "pg";
import fs from "fs/promises";
import path from "path";

// Environment variables - read-only access to .env.local/.dev.vars
const { DIRECT_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

// Validate required environment variables
if (!DIRECT_URL) {
  console.error("❌ DIRECT_URL environment variable is required");
  process.exit(1);
}

// Connection configuration with 5-second timeout
const connectionConfig = {
  connectionString: DIRECT_URL,
  connectionTimeoutMillis: 5000,
  idleInTransactionSessionTimeoutMillis: 5000,
  max: 20, // Maximum pool size for concurrent operations
};

async function executeSqlFile(filePath) {
  try {
    console.log(`📄 Executing SQL file: ${filePath}`);

    const sqlContent = await fs.readFile(filePath, "utf8");

    // Parse SQL into individual statements (simple splitting by semicolon)
    const statements = sqlContent
      .split(";")
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0 && !stmt.startsWith("--"));

    if (statements.length === 0) {
      console.log(`⚠️  No valid SQL statements found in ${filePath}`);
      return;
    }

    const client = new pg.Pool(connectionConfig);

    // Execute each statement with timeout
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      console.log(`  Executing statement ${i + 1}/${statements.length}`);

      await client.query(stmt);
    }

    await client.end();
    console.log(
      `✅ Successfully executed ${statements.length} statements from ${filePath}`,
    );
  } catch (error) {
    console.error(`❌ Failed to execute ${filePath}:`, error.message);
    throw error;
  }
}

async function main() {
  const migrationsDir = path.join(process.cwd(), "supabase", "migrations");

  try {
    console.log("🚀 Database Migration Helper Script started");
    console.log(`📁 Migration directory: ${migrationsDir}`);

    // Read all migration files
    const files = await fs.readdir(migrationsDir);
    const sqlFiles = files.filter((file) => file.endsWith(".sql")).sort(); // Execute in alphabetical order (timestamp prefix)

    if (sqlFiles.length === 0) {
      console.log("⚠️  No migration files found");
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

    console.log("🎉 All migrations executed successfully!");
  } catch (error) {
    console.error("💥 Migration script failed:", error.message);
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
    console.error("💥 Fatal error:", error.message);
    process.exit(1);
  });
