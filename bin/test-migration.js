/*
 * Simple migration test for Direct URL access
 */

import { Pool } from "pg";

const connectionString =
  "postgresql://postgres.yttyztkjbbpcqoozepmn:Sakurasasuke1122@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres";

async function testConnection() {
  console.log("Testing Direct URL connection...");
  console.log(
    "Connection String:",
    connectionString.replace(/:[^:]*@/, ":***@"),
  ); // Mask password for logging

  const pool = new Pool({
    connectionString,
    connectionTimeoutMillis: 5000,
  });

  try {
    const client = await pool.connect();
    const result = await client.query("SELECT version()");
    console.log("✅ Connection successful!");
    console.log("PostgreSQL version:", result.rows[0].version);
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
