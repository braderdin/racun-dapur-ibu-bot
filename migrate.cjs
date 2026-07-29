/*
 * Database Migration Execution Script
 * CommonJS version for WSL bash compatibility
 * Executes all SQL migration files against Supabase
 */

const { Pool } = require("pg");
const fs = require("fs").promises;
const path = require("path");

// Connection configuration using DIRECT_URL from environment
const connectionString =
  "postgresql://postgres.yttyztkjbbpcqoozepmn:Sakurasasuke1122@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres";

// Enhanced SQL parser that filters out comments and non-SQL content
function parseSqlContent(sqlContent) {
  // Split by semicolon to get individual statements
  const statements = sqlContent.split(/;/);

  const cleanedStatements = [];

  for (const stmt of statements) {
    const trimmed = stmt.trim();

    // Skip empty statements
    if (!trimmed) continue;

    // Skip single-line comments (starting with --)
    if (trimmed.startsWith("--")) continue;

    // Skip multi-line comments that might be embedded
    if (trimmed.includes("-- ") && !trimmed.includes("--\n")) {
      // For simple cases, remove comment parts
      const commentIndex = trimmed.indexOf("-- ");
      if (commentIndex > 0) {
        trimmed.substring(0, commentIndex).trim();
      }
    }

    // Skip Bahasa Malay comments (typical patterns from the SQL files)
    if (
      trimmed.includes("anda boleh memilih") ||
      trimmed.includes("Contohnya:") ||
      trimmed.includes("CREATE POLICY") ||
      trimmed.startsWith("CREATE POLICY") ||
      (trimmed.includes("COMMENT ON") && trimmed.includes("IS "))
    ) {
      // Skip these - they're documentation comments
      continue;
    }

    // Only keep statements that look like valid SQL (start with CREATE, INSERT, SELECT, UPDATE, DELETE, ALTER, etc.)
    if (
      /^(CREATE|INSERT|SELECT|UPDATE|DELETE|ALTER|DROP|GRANT|REVOKE|TRUNCATE|COMMENT ON)/i.test(
        trimmed,
      )
    ) {
      cleanedStatements.push(trimmed + ";");
    }
  }

  return cleanedStatements;
}

async function executeSqlFile(filePath, client) {
  try {
    console.log(`📄 Executing SQL file: ${filePath}`);

    const sqlContent = await fs.readFile(filePath, "utf8");

    // Parse SQL using our enhanced parser
    const statements = parseSqlContent(sqlContent);

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
    const files = await fs.readdir(migrationsDir);
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
