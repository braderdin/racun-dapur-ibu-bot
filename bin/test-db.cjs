/*
 * Simple database connection test
 */

const { Pool } = require("pg");

const connectionString =
  "postgresql://postgres.yttyztkjbbpcqoozepmn:Sakurasasuke1122@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres";

async function testConnection() {
  console.log("Testing database connection...");
  console.log(
    "Connection String:",
    connectionString.replace(/:[^:]*@/, ":***@"),
  );

  const pool = new Pool({
    connectionString,
    connectionTimeoutMillis: 5000,
  });

  try {
    const client = await pool.connect();
    console.log("✅ Connected successfully");

    // Test if we can list tables
    const result = await client.query(
      "SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public' ORDER BY tablename",
    );
    console.log(
      "Tables in database:",
      result.rows.map((row) => row.tablename),
    );

    // If no tables, create a test table
    if (result.rows.length === 0) {
      console.log("📝 No existing tables, creating test table...");
      await client.query(
        "CREATE TABLE test_table (id SERIAL PRIMARY KEY, name VARCHAR(100))",
      );
      console.log("✅ Test table created");
    }

    client.release();
    await pool.end();
    return true;
  } catch (error) {
    console.error("❌ Connection failed:", error.message);
    await pool.end();
    return false;
  }
}

if (require.main === module) {
  testConnection()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error("💥 Fatal error:", error);
      process.exit(1);
    });
}

module.exports = { testConnection };
