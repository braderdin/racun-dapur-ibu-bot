/*
 * Migration Script Wrapper
 * Simple wrapper that extracts DIRECT_URL from .dev.vars and runs the migration
 * This is a quick fix for the Phase 3 deployment requirements
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

console.log("🚀 Starting Database Migration Script...");

// First, extract DIRECT_URL from .dev.vars to environment
function extractEnvironmentFromDevVars() {
    try {
        const devVarsPath = path.join(process.cwd(), ".dev.vars");
        if (!fs.existsSync(devVarsPath)) {
            throw new Error("❌ .dev.vars file not found!");
        }

        const content = fs.readFileSync(devVarsPath, "utf8");
        const lines = content.split("\n");
        
        console.log("📄 Loaded .dev.vars file");
        
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith("#")) {
                // Match VAR_NAME=value (where value may be quoted)
                const match = trimmed.match(/^([A-Z_][A-Z_]*)=(.*)$/);
                if (match) {
                    const varName = match[1];
                    let varValue = match[2].trim();
                    
                    // Remove surrounding quotes
                    if ((varValue.startsWith('"') && varValue.endsWith('"')) || 
                        (varValue.startsWith("'") && varValue.endsWith("'"))) {
                        varValue = varValue.slice(1, -1);
                    }
                    
                    // Set environment variable
                    process.env[varName] = varValue;
                    console.log(`✅ Set ${varName}");
                }
            }
        }
        
        // Verify DIRECT_URL is available
        if (!process.env.DIRECT_URL) {
            throw new Error("❌ DIRECT_URL not found in .dev.vars file");
        }
        
        console.log("✅ DIRECT_URL successfully extracted:", process.env.DIRECT_URL.substring(0, 50) + "...");
        
    } catch (error) {
        console.error("❌ Failed to extract environment from .dev.vars:", error.message);
        throw error;
    }
}

function checkDirectUrl() {
    const directUrl = process.env.DIRECT_URL;
    if (!directUrl) {
        console.error("❌ DIRECT_URL environment variable is required!");
        console.log("\n💡 To fix this, create or update .dev.vars with DIRECT_URL:");
        console.log("   DIRECT_URL=\"postgresql://postgres:your_password@your-supabase-url:5432/postgres?pgbouncer=false\"");
        process.exit(1);
    }
    
    console.log("✅ DIRECT_URL found:", directUrl.substring(0, 50) + "...");
}

async function runMigrationScript() {
    try {
        // Check for .dev.vars file
        if (!fs.existsSync(path.join(process.cwd(), ".dev.vars"))) {
            console.error("❌ .dev.vars file not found!");
            console.log("   Please create .dev.vars file with the required environment variables.");
            process.exit(1);
        }
        
        // Extract and set environment variables
        extractEnvironmentFromDevVars();
        
        // Verify DIRECT_URL
        checkDirectUrl();
        
        console.log("\n🔄 Executing migration script...");
        
        // Try to import and run the migration script
        try {
            // Try the TypeScript version first
            const migrationModule = require("./bin/migration-helper.js");
            if (migrationModule && migrationModule.default) {
                await migrationModule.default();
            } else if (migrationModule && migrationModule.main) {
                await migrationModule.main();
            } else {
                console.log("🔄 Using binary migration script...");
                execSync("npx tsx bin/db-migrate.js", { stdio: "inherit" });
            }
        } catch (importError) {
            console.log("⚠️  TypeScript migration failed, trying binary version...")
            execSync("npx tsx bin/db-migrate.js", { stdio: "inherit" });
        }
        
        console.log("\n🎉 Migration completed successfully!");
        
    } catch (error) {
        console.error("\n❌ Migration failed:", error.message);
        
        if (error.message.includes("DIRECT_URL")) {
            console.log("\n🔧 To fix this issue:")
            console.log("   1. Check that .dev.vars file exists in the project root");
            console.log("   2. Add DIRECT_URL with proper Supabase connection string");
            console.log("   3. Format: DIRECT_URL=\"postgresql://username:password@your-supabase-url:5432/postgres?pgbouncer=false\"");
            console.log("\n📝 Example from .dev.vars:", process.env.DIRECT_URL ? "DIRECT_URL found" : "DIRECT_URL missing");
        }
        
        process.exit(1);
    }
}

// Run the migration
runMigrationScript();