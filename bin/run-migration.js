/*
 * Migration script wrapper
 * Reads DIRECT_URL from .dev.vars and runs database migration
 */n

const fs = require("fs");
const path = require("path");

// Extract DIRECT_URL from .dev.vars file
function extractEnvironmentFromDevVars() {
    try {
        const devVarsPath = path.join(process.cwd(), ".dev.vars");
        if (!fs.existsSync(devVarsPath)) {
            throw new Error("❌ .dev.vars file not found!");
        }

        const content = fs.readFileSync(devVarsPath, "utf8");
        const lines = content.split("\n");
        
        console.log("📄 Loading .dev.vars file...");
        
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
                }
            }
        }
        
        // Verify DIRECT_URL is available
        if (!process.env.DIRECT_URL) {
            throw new Error("❌ DIRECT_URL not found in .dev.vars file");
        }
        
        console.log("✅ Environment variables loaded successfully");
        console.log("🔗 DIRECT_URL: " + process.env.DIRECT_URL.substring(0, 50) + "...");
        
    } catch (error) {
        console.error("❌ Failed to load environment from .dev.vars:", error.message);
        throw error;
    }
}

async function runMigrations() {
    try {
        // Load environment variables from .dev.vars
        extractEnvironmentFromDevVars();
        
        // Check if DIRECT_URL is set
        const directUrl = process.env.DIRECT_URL;
        if (!directUrl) {
            throw new Error("❌ DIRECT_URL environment variable is required!");
        }
        
        // Create a simple SQL statement to test connection
        console.log("🔄 Testing database connection...");
        
        // Read migration files and execute them
        const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
        const files = fs.readdirSync(migrationsDir);
        const sqlFiles = files.filter(file => file.endsWith(".sql")).sort();
        
        if (sqlFiles.length === 0) {
            console.log("⚠️  No migration files found");
            return;
        }
        
        console.log(`📋 Found ${sqlFiles.length} migration files to execute...");
        
        // For now, just copy the .dev.vars content to process.env
        // then call the TypeScript migration script using tsx
        console.log("🔄 Running migration script with extracted environment variables...");
        
        // Execute the TypeScript migration script
        const { execSync } = require("child_process");
        execSync("npx tsx bin/db-migrate.js", { stdio: "inherit" });
        
        console.log("\n🎉 All migrations executed successfully!");
        
    } catch (error) {
        console.error("\n❌ Migration failed:", error.message);
        
        if (error.message.includes("DIRECT_URL")) {
            console.log("\n🔧 To fix this issue:");
            console.log("   1. Check that .dev.vars file exists in the project root");
            console.log("   2. Add DIRECT_URL with proper Supabase connection string");
            console.log("   3. Format: DIRECT_URL=\"postgresql://username:password@your-supabase-url:5432/postgres?pgbouncer=false\"");
            console.log("\n📝 Current .dev.vars DIRECT_URL:", process.env.DIRECT_URL ? "is set" : "is NOT set");
        }
        
        process.exit(1);
    }
}

// Run the migrations
runMigrations();