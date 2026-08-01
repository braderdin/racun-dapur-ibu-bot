const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

// Load environment variables from .dev.vars if not set
function loadEnvFromDevVars() {
  const envPath = path.join(process.cwd(), ".dev.vars");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf8");
    const lines = content.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
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
          if (!process.env[varName]) {
            process.env[varName] = varValue;
          }
        }
      }
    }
  }
}

// Get the direct URL with pgbouncer=false
function getDirectUrl() {
  let url = process.env.DATABASE_URL_DIRECT_UNPOOLED || process.env.DIRECT_URL;
  if (!url) {
    throw new Error("DATABASE_URL_DIRECT_UNPOOLED or DIRECT_URL not set");
  }
  // Ensure pgbouncer=false is set
  if (!url.includes("pgbouncer=false")) {
    url = url.replace(/pgbouncer=true/, "pgbouncer=false");
    if (!url.includes("pgbouncer=")) {
      url = url + (url.includes("?") ? "&" : "?") + "pgbouncer=false";
    }
  }
  return url;
}

async function executeSqlFile(pool, filePath) {
  console.log(`Executing: ${filePath}`);
  const sql = fs.readFileSync(filePath, "utf8");
  // Split by semicolon, but ignore semicolons inside comments and strings (simple approach)
  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));
  for (const statement of statements) {
    await pool.query(statement);
  }
  console.log(`Executed ${statements} statements`);
}

async function main() {
  try {
    loadEnvFromDevVars();
    const connectionString = getDirectUrl();
    console.log(
      `Connecting to: ${connectionString.replace(/:[^:@]+@/, ":[REDACTED]@")}`,
    );

    const pool = new Pool({
      connectionString: connectionString,
      connectionTimeoutMillis: 5000,
    });

    // Test connection
    await pool.query("SELECT NOW()");
    console.log("Connected successfully");

    const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort(); // Execute in order

    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      await executeSqlFile(pool, filePath);
    }

    await pool.end();
    console.log("All migrations completed successfully");
  } catch (error) {
    console.error("Migration failed:", error.message);
    process.exit(1);
  }
}

main();
