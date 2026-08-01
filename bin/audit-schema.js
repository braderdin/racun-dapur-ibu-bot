// Schema Audit Script - Queries live Supabase schema and compares with expected tables
import pg from "pg";
import fs from "fs/promises";
import path from "path";

const DIRECT_URL =
  process.env.DATABASE_URL_DIRECT_UNPOOLED || process.env.DIRECT_URL;

if (!DIRECT_URL) {
  console.error("FAIL DATABASE_URL_DIRECT_UNPOOLED or DIRECT_URL not set");
  process.exit(1);
}

const client = new pg.Pool({
  connectionString: DIRECT_URL,
  ssl: { rejectUnauthorized: false },
});

const expectedTables = [
  "posted_products",
  "link_clicks",
  "click_analytics",
  "facebook_posts",
  "system_health_logs",
  "dual_engine_posts",
];

const expectedViews = ["facebook_posts_summary", "catalog_stats"];

async function main() {
  await client.connect();

  console.log("=== LIVE SCHEMA AUDIT ===\n");

  // Query live tables
  const { rows: tables } = await client.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name",
  );
  const liveTableNames = tables.map((r) => r.table_name);
  console.log("Live tables in public schema:");
  liveTableNames.forEach((t) => console.log(`  OK2 ${t}`));

  // Query live views
  const { rows: views } = await client.query(
    "SELECT table_name FROM information_schema.views WHERE table_schema = 'public' ORDER BY table_name",
  );
  const liveViewNames = views.map((r) => r.table_name);
  console.log("\nLive views in public schema:");
  liveViewNames.forEach((v) => console.log(`  OK2 ${v}`));

  // Check missing tables
  const missingTables = expectedTables.filter(
    (t) => !liveTableNames.includes(t),
  );
  console.log("\n--- Missing Tables ---");
  if (missingTables.length === 0) {
    console.log("  OK2 All expected tables exist");
  } else {
    missingTables.forEach((t) => console.log(`  FAIL MISSING: ${t}`));
  }

  // Check missing views
  const missingViews = expectedViews.filter((v) => !liveViewNames.includes(v));
  console.log("\n--- Missing Views ---");
  if (missingViews.length === 0) {
    console.log("  OK2 All expected views exist");
  } else {
    missingViews.forEach((v) => console.log(`  FAIL MISSING: ${v}`));
  }

  // Check extra tables (not in expected list)
  const extraTables = liveTableNames.filter((t) => !expectedTables.includes(t));
  console.log("\n--- Extra Tables (not in expected list) ---");
  extraTables.forEach((t) => console.log(`  WARN  ${t}`));

  console.log("\n=== AUDIT COMPLETE ===");
  console.log(
    `Expected tables: ${expectedTables.length}, Found: ${liveTableNames.length}, Missing: ${missingTables.length}`,
  );
  console.log(
    `Expected views: ${expectedViews.length}, Found: ${liveViewNames.length}, Missing: ${missingViews.length}`,
  );

  await client.end();

  if (missingTables.length > 0 || missingViews.length > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("FAIL Audit failed:", err.message);
  process.exit(1);
});
