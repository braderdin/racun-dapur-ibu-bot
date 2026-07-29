/*
 * Simple script to run database migrations using DIRECT_URL from .dev.vars
 * CommonJS version for WSL bash compatibility
 */

const { Pool } = require("pg");
const fs = require("fs").promises;
const path = require("path");

// Use the same DIRECT_URL from .dev.vars
const connectionString =
  "postgresql://postgres.yttyztkjbbpcqoozepmn:Sakurasasuke1122@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres";

async function executeSqlFile(filePath, client) {
  try {
    console.log(`📄 Executing SQL file: ${filePath}`);

    const sqlContent = await fs.readFile(filePath, "utf8");

    // Parse SQL into individual statements (simple splitting by semicolon)
    const statements = sqlContent
      .split(";")
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0 && !stmt.startsWith("--"))
      .filter((stmt) => !stmt.includes("-- Pembaruan sesi tergesa-gesa"));

    console.log(`✅ Found ${statements.length} statements`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      if (stmt.trim()) {
        await client.query(stmt);
        console.log(`  Executed statement ${i + 1}/${statements.length}`);
      }
    }

    return statements.length;
  } catch (error) {
    console.error(`❌ Failed to execute ${filePath}:`, error.message);
    throw error;
  }
}

async function main() {
  console.log("🚀 Database Migration Helper Script started");
  console.log(`📁 Migration directory: ${__dirname}/../supabase/migrations`);

  const pool = new Pool({
    connectionString,
    connectionTimeoutMillis: 5000,
  });

  try {
    const client = await pool.connect();

    // Test connection first
    await client.query("SELECT 1");
    console.log("✅ Database connection established");

    const migrationsDir = path.join(__dirname, "..", "supabase", "migrations");
    const files = await fs.readdir(migrationsDir);
    const sqlFiles = files.filter((file) => file.endsWith(".sql")).sort();

    console.log(`📋 Found ${sqlFiles.length} migration file(s):`);
    sqlFiles.forEach((file) => console.log(`  - ${file}`));

    // Execute each migration file
    for (const file of sqlFiles) {
      const filePath = path.join(migrationsDir, file);
      await executeSqlFile(filePath, client);
    }

    console.log("🎉 All migrations executed successfully!");
    client.release();
    await pool.end();
  } catch (error) {
    console.error("💥 Migration script failed:", error.message);
    await pool.end();
    process.exit(1);
  }
}

if (require.main === module) {
  main()
    .then(() => {
      console.log("✅ Migration completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 Fatal error:", error.message);
      process.exit(1);
    });
}

module.exports = { main };
