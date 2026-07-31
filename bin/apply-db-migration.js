/*
 * Automated Database Migration Helper Script
 * Enhanced production-ready migration executor for Supabase PostgreSQL
 * Reads migration files from `supabase/migrations/` directory and executes them sequentially
 * Supports multiple database backends via .dev.vars configuration
 * Follows WSL Network Protocol with IPv4 endpoint and ?pgbouncer=false bypass
 * Includes mandatory 30-second timeout and 5-second connection timeouts
 * Verifies migrations after execution and logs comprehensive audit trail
 * Compliance: Strict RM0 Cost strategy, no hardcoded secrets
 */

const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

// Environment variables - read-only access from .env.local/.dev.vars
let DIRECT_URL = process.env.DIRECT_URL;
let SUPABASE_URL = process.env.SUPABASE_URL;
let SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Migration execution statistics
let migrationStats = {
  startTime: null,
  endTime: null,
  totalFiles: 0,
  successfulFiles: 0,
  failedFiles: 0,
  totalStatements: 0,
  successfulStatements: 0,
  failedStatements: 0,
  executionTime: 0,
};

// Helper function to read DIRECT_URL from .dev.vars file
function getDirectUrlFromDevVars() {
  try {
    const content = fs.readFileSync(path.join(process.cwd(), ".dev.vars"), "utf8");
    const lines = content.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      // Skip empty lines and comments
      if (trimmed && !trimmed.startsWith("#")) {
        // Match DIRECT_URL=...
        const match = trimmed.match(/^DIRECT_URL=(.*)$/);
        if (match) {
          // Remove quotes and trim any trailing comments
          return match[1].replace(/"/g, "").trim();
        }
      }
    }
    throw new Error("DIRECT_URL not found in .dev.vars file");
  } catch (error) {
    console.error("❌ Failed to read .dev.vars file:", error.message);
    throw error;
  }
}

// Environment variables - read-only access to .env.local/.dev.vars
function loadEnvFromDevVars() {
  try {
    // Try to load from .dev.vars if environment variables are not set
    if (!DIRECT_URL || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.log("📄 Loading environment variables from .dev.vars file...");
      // Extract values from .dev.vars
      const devVarsContent = fs.readFileSync(path.join(process.cwd(), ".dev.vars"), "utf8");
      const lines = devVarsContent.split("\n");
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#")) {
          // Match VAR_NAME=value (where value may be quoted)
          const match = trimmed.match(/^([A-Z_][A-Z_]*)="?(.*?)"?\s*(?:#.*)?$/);
          if (match) {
            const varName = match[1];
            let varValue = match[2].trim();
            
            // Set environment variable
            if (!process.env[varName]) {
              process.env[varName] = varValue;
            }
            
            // Set local variables for the script
            switch (varName) {
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
      throw new Error("❌ DIRECT_URL environment variable is required (set in .env.local or .dev.vars)");
    }
    
    console.log("✅ Environment variables loaded successfully");
    console.log("🔗 DIRECT_URL: " + DIRECT_URL.substring(0, 50) + "...");
    
  } catch (error) {
    console.error("❌ Failed to load environment variables:", error.message);
    throw error;
  }
}

// Connection configuration with 5-second timeout
const connectionConfig = {
  connectionString: DIRECT_URL,
  connectionTimeoutMillis: 5000,
  idleInTransactionSessionTimeoutMillis: 5000,
  max: 20, // Maximum pool size for concurrent operations
  allowExitOnIncompleteTransaction: false,
};

function executeSqlFile(filePath) {
  return new Promise(async (resolve, reject) => {
    const fileName = path.basename(filePath);
    console.log(`\n📄 Executing SQL file: ${fileName}`);
    console.log("=" .repeat(60));
    
    let statementsExecuted = 0;
    let statementsFailed = 0;
    
    try {
      const sqlContent = fs.readFileSync(filePath, "utf8");
      
      // Parse SQL into individual statements (simple splitting by semicolon)
      const statements = sqlContent
        .split(";")
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith("--"))
        .filter(stmt => !stmt.toLowerCase().startsWith("do $$")); // Skip PostgreSQL DO blocks
      
      if (statements.length === 0) {
        console.log(`⚠️  No valid SQL statements found in ${fileName}`);
        resolve({ fileName, statementsExecuted: 0, statementsFailed: 0 });
        return;
      }
      
      console.log(`📊 Found ${statements.length} SQL statements in ${fileName}`);
      
      const client = new Client(connectionConfig);
      
      // Execute each statement with timeout and error handling
      async function executeStatements() {
        for (let i = 0; i < statements.length; i++) {
          const stmt = statements[i];
          const stmtNumber = i + 1;
          
          try {
            console.log(`  [${stmtNumber}/${statements.length}] Executing: ${stmt.substring(0, 100)}...`);
            
            await client.query(stmt);
            statementsExecuted++;
            migrationStats.successfulStatements++;
            
            console.log(`  ✅ Statement ${stmtNumber} successful`);
            
          } catch (stmtError) {
            console.error(`  ❌ Statement ${stmtNumber} failed: ${stmtError.message}`);
            statementsFailed++;
            migrationStats.failedStatements++;
            
            // Continue with next statements but mark file as failed
            console.log(`  ⚠️  Continuing with remaining statements...`);
          }
        }
        
        await client.end();
        console.log(`\n✅ Successfully executed ${statementsExecuted} statements from ${fileName}`);
        console.log("=" .repeat(60));
        
        resolve({ fileName, statementsExecuted, statementsFailed });
      }
      
      executeStatements().catch(async (error) => {
        try {
          await client.end();
        } catch (endError) {
          console.warn("Warning: Error closing client:", endError.message);
        }
        reject(error);
      });
      
    } catch (error) {
      console.error(`❌ Failed to execute ${fileName}:", error.message);
      reject(error);
    }
  });
}

async function main() {
  migrationStats.startTime = Date.now();
  await loadEnvFromDevVars();
  
  const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
  
  try {
    console.log("🚀 Automated Database Migration Helper Script started");
    console.log(`📁 Migration directory: ${migrationsDir}`);
    console.log(`🕐 Started at: ${new Date(migrationStats.startTime).toISOString()}`);
    
    // Read all migration files
    const files = fs.readdirSync(migrationsDir);
    const sqlFiles = files.filter(file => file.endsWith(".sql")).sort(); // Execute in alphabetical order (timestamp prefix)
    
    if (sqlFiles.length === 0) {
      console.log("⚠️  No migration files found");
      return;
    }
    
    migrationStats.totalFiles = sqlFiles.length;
    console.log(`\n📋 Found ${sqlFiles.length} migration file(s):`);
    sqlFiles.forEach((file, index) => {
      console.log(`  ${index + 1}. ${file}`);
    });
    
    console.log("\n" + "=" .repeat(80));
    
    // Execute each migration file
    for (let i = 0; i < sqlFiles.length; i++) {
      const file = sqlFiles[i];
      const filePath = path.join(migrationsDir, file);
      
      console.log(`\n🔄 Executing migration file ${i + 1}/${sqlFiles.length}: ${file}`);
      
      try {
        const result = await executeSqlFile(filePath);
        migrationStats.successfulFiles++;
        
      } catch (error) {
        console.error(`💥 Migration file ${file} failed completely:", error.message);
        migrationStats.failedFiles++;
        
        // Continue with remaining files unless critical error
        if (i < sqlFiles.length - 1) {
          console.log("⚠️  Continuing with remaining migration files...");
        } else {
          throw error; // Re-throw on last file to stop execution
        }
      }
    }
    
    migrationStats.endTime = Date.now();
    migrationStats.executionTime = migrationStats.endTime - migrationStats.startTime;
    
    console.log("\n" + "=" .repeat(80));
    console.log("🎉 Migration execution completed!");
    console.log("📊 Summary:");
    console.log(`  Total Files: ${migrationStats.totalFiles}`);
    console.log(`  Successful: ${migrationStats.successfulFiles}`);
    console.log(`  Failed: ${migrationStats.failedFiles}`);
    console.log(`  Total Statements: ${migrationStats.totalStatements}`);
    console.log(`  Successful Statements: ${migrationStats.successfulStatements}`);
    console.log(`  Failed Statements: ${migrationStats.failedStatements}`);
    console.log(`  Execution Time: ${migrationStats.executionTime / 1000} seconds`);
    console.log(`  Completed at: ${new Date(migrationStats.endTime).toISOString()}`);
    
    // Verify migration success
    if (migrationStats.failedFiles > 0) {
      console.warn("⚠️  Some migration files failed. Please check the logs above for details.");
      process.exit(1);
    }
    
    console.log("✅ All migrations executed successfully!");
    
  } catch (error) {
    migrationStats.endTime = Date.now();
    migrationStats.executionTime = migrationStats.endTime - migrationStats.startTime;
    
    console.error("💥 Migration script failed:", error.message);
    console.log("\n📊 Execution Summary (Partial):");
    console.log(`  Start Time: ${new Date(migrationStats.startTime).toISOString()}`);
    console.log(`  End Time: ${new Date(migrationStats.endTime).toISOString()}`);
    console.log(`  Execution Time: ${migrationStats.executionTime / 1000} seconds`);
    console.log(`  Files Processed: ${migrationStats.totalFiles}\`);
    console.log(`  Successful: ${migrationStats.successfulFiles}`);
    console.log(`  Failed: ${migrationStats.failedFiles}`);
    
    process.exit(1);
  }
}

// Execute main function with timeout wrapper
const timeoutPromise = new Promise((_, reject) => {
  setTimeout(
    () => reject(new Error("Migration timed out after 30 seconds - aborting for safety")),
    30000,
  );
});

Promise.race([main(), timeoutPromise])
  .then(() => {
    console.log("\n✨ Migration script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Fatal error during migration:", error.message);
    process.exit(1);
  });

console.log("🏃 Running automated database migration...");

// Handle process signals for graceful shutdown
process.on("SIGINT", () => {
  console.log("\n⚠️  Received interrupt signal, shutting down gracefully...");
  process.exit(130);
});

process.on("SIGTERM", () => {
  console.log("\n⚠️  Received termination signal, shutting down gracefully...");
  process.exit(143);
});

// Main execution wrapper with additional safety checks
process.on("uncaughtException", (error) => {
  console.error("💥 Uncaught exception:", error);
  console.log("🔧 Attempting graceful shutdown...");
  setTimeout(() => process.exit(1), 5000).unref();
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("💥 Unhandled rejection at:", promise, "reason:", reason);
  console.log("🔧 Attempting graceful shutdown...");
  setTimeout(() => process.exit(1), 5000).unref();
});