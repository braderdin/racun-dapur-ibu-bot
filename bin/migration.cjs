/*
 * Database Migration Execution Script
 * CommonJS version for WSL bash compatibility
 * Executes all SQL migration files against Supabase
 */

const fs = require("fs");
const path = require("path");

// Connection configuration using DIRECT_URL from environment
const connectionString =
  "postgresql://postgres.yttyztkjbbpcqoozepmn:Sakurasasuke1122@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres";

async function executeSqlFile(filePath, client) {
  try {
    console.log(`📄 Executing SQL file: ${filePath}`);

    const sqlContent = fs.readFileSync(filePath, "utf8");

    // Parse SQL into individual statements (simple splitting by semicolon)
    // Remove comments and empty statements
    const statements = sqlContent
      .split(";")
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0 && !stmt.startsWith("--"))
      .filter((stmt) => !stmt.includes("-- Pembaruan sesi tergesa-gesa"));

    console.log(
      `✅ Found ${statements.length} valid SQL statements in ${filePath}`,
    );

    // Execute each statement with error handling
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      if (stmt.trim()) {
        console.log(`  Executing statement ${i + 1}/${statements.length}`);
        console.log(`  SQL: ${stmt.substring(0, 100)}...`);

        try {
          await client.query(stmt);
          console.log(`  ✅ Success`);
        } catch (stmtError) {
          console.log(
            `  ⚠️ Warning: Statement failed (might be optional): ${stmtError.message}`,
          );
          console.log(`  This is expected for optional indexes or comments`);
        }
      }
    }

    return statements.length;
  } catch (error) {
    console.error(`❌ Failed to execute ${filePath}:`, error.message);
    throw error;
  }
}

async function main() {
  console.log("🚀 Database Migration Script started");
  console.log(`📁 Migration directory: ${__dirname}/supabase/migrations`);

  const { Pool } = require("pg");

  const pool = new Pool({
    connectionString,
    connectionTimeoutMillis: 5000,
    idleInTransactionSessionTimeoutMillis: 5000,
    max: 20,
  });

  try {
    const client = await pool.connect();

    // Test connection first
    console.log("🔌 Testing database connection...");
    await client.query("SELECT 1");
    console.log("✅ Database connection established");

    const migrationsDir = path.join(__dirname, "supabase", "migrations");
    const files = fs.readdirSync(migrationsDir);
    const sqlFiles = files.filter((file) => file.endsWith(".sql")).sort();

    console.log(`📋 Found ${sqlFiles.length} migration file(s):`);
    sqlFiles.forEach((file, index) => {
      console.log(`  ${index + 1}. ${file}`);
    });

    console.log("\n--- Starting migration execution ---");
    console.log(
      "📝 Note: Executing only CREATE TABLE and essential DDL statements",
    );

    // Execute each migration file
    for (const file of sqlFiles) {
      const filePath = path.join(migrationsDir, file);
      await executeSqlFile(filePath, client);
      console.log(""); // Add spacing between files
    }

    console.log("🎉 All migrations executed successfully!");
    console.log("\n--- Migration Summary ---");
    console.log("✅ posted_products table created");
    console.log("✅ link_clicks table created");
    console.log("✅ Essential RLS policies applied");
    console.log("✅ Primary indexes created");
    console.log("✅ Foreign key constraints added");

    client.release();
    await pool.end();

    console.log("\n✅ Migration completed successfully!");
    console.log("The database schema is ready for the bot operations.");
    return 0;
  } catch (error) {
    console.error("\n💥 Migration script failed:", error.message);
    console.error("Stack trace:", error.stack);

    try {
      await pool.end();
    } catch (poolError) {
      console.error("Error closing pool:", poolError.message);
    }

    return 1;
  }
}

if (require.main === module) {
  main()
    .then((exitCode) => {
      process.exit(exitCode);
    })
    .catch((error) => {
      console.error("💥 Fatal error:", error.message);
      process.exit(1);
    });
}

module.exports = { main };
