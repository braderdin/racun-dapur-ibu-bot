/*
 * Simple Database Migration Script for Phase 3
 * Reads DIRECT_URL from .dev.vars file and executes SQL schema files
 * Provides detailed error reporting and debugging
 */n

const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

// Helper function to load environment variables from .dev.vars
function loadEnvFromDevVars() {
    try {
        const devVarsPath = path.join(process.cwd(), ".dev.vars");
        if (!fs.existsSync(devVarsPath)) {
            console.error("❌ ERROR: .dev.vars file not found!");
            console.log("   Please ensure the .dev.vars file exists in the project root.");
            process.exit(1);
        }

        console.log("📄 Loading environment variables from .dev.vars...");
        
        // Read the file content
        const content = fs.readFileSync(devVarsPath, "utf8");
        const lines = content.split("\n");
        
        // Extract DIRECT_URL using regex
        let directUrl = null;
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith("#")) {
                const match = trimmed.match(/^DIRECT_URL=(.*)$/);
                if (match) {
                    directUrl = match[1].replace(/\"/g, "").trim();
                    break;
                }
            }
        }
        
        if (!directUrl) {
            console.error("❌ ERROR: DIRECT_URL not found in .dev.vars file!");
            console.log("\n📋 Available environment variables in .dev.vars:");
            lines.forEach((line, index) => {
                const trimmed = line.trim();
                if (trimmed && !trimmed.startsWith("#")) {
                    console.log("   ", line);
                }
            });
            console.log("\n🔧 Please add DIRECT_URL to .dev.vars file:");
            console.log("   DIRECT_URL=\"postgresql://username:password@your-supabase-url:5432/postgres?pgbouncer=false\"");
            process.exit(1);
        }
        
        // Set environment variable
        process.env.DIRECT_URL = directUrl;
        console.log("✅ DIRECT_URL loaded:", directUrl.substring(0, 50) + "...");
        
    } catch (error) {
        console.error("❌ ERROR loading .dev.vars:", error.message);
        process.exit(1);
    }
}

// Simple function to execute SQL
async function executeSql(conn, sql) {
    try {
        await conn.query(sql);
        return true;
    } catch (error) {
        console.error("❌ SQL Error:", error.message);
        console.error("📄 SQL that failed:", sql.substring(0, 200) + "...");
        throw error;
    }
}

// Main migration function
async function migrate() {
    console.log("🚀 Starting Phase 3 Database Migration...");
    console.log("=============================================================");
    
    // Load environment variables
    loadEnvFromDevVars();
    
    const DIRECT_URL = process.env.DIRECT_URL;
    console.log("✅ Environment variables loaded successfully");
    
    // Create database connection
    const client = new Client({
        connectionString: DIRECT_URL,
        connectionTimeoutMillis: 5000,
        idleInTransactionSessionTimeoutMillis: 5000,
        max: 20
    });
    
    try {
        console.log("🔄 Connecting to Supabase database...");
        await client.connect();
        console.log("✅ Connected successfully");
        
        // Get list of migration files
        const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
        const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));
        
        if (files.length === 0) {
            console.log("⚠️  No migration files found in", migrationsDir);
            await client.end();
            return;
        }
        
        console.log("📋 Found", files.length, "migration files");
        console.log("\n📋 Migration order:");
        files.forEach((file, index) => {
            console.log("   ", (index + 1).toString().padStart(2), ". ", file);
        });
        
        console.log("\n🔄 Executing migrations...");
        
        // Execute each migration file
        for (const file of files) {
            const filePath = path.join(migrationsDir, file);
            const sqlContent = fs.readFileSync(filePath, "utf8");
            
            console.log("\n📄 Processing:", file);
            
            // Parse SQL into statements (simple splitting by semicolon)
            const statements = sqlContent
                .split(';')
                .map(stmt => stmt.trim())
                .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))
                .filter(stmt => !stmt.startsWith('/\*') || stmt.includes('*/'));
            
            if (statements.length === 0) {
                console.log("⚠️  No valid SQL statements found in", file);
                continue;
            }
            
            console.log("   📝 Executing", statements.length, "SQL statements...");
            
            // Execute each statement
            for (let i = 0; i < statements.length; i++) {
                const stmt = statements[i];
                console.log("      " + (i + 1).toString().padStart(2) + "/" + statements.length);
                
                try {
                    await client.query(stmt);
                    console.log("         ✅ Executed");
                } catch (error) {
                    console.error("         ❌ Failed:", error.message);
                    throw error;
                }
            }
            
            console.log("✅", file, "completed successfully");
        }
        
        await client.end();
        
        console.log("\n🎉 ALL MIGRATIONS COMPLETED SUCCESSFULLY!");
        console.log("=============================================================");
        console.log("\n✅ Phase 3 database deployment completed successfully!");
        console.log("\n📋 Created schemas:");
        console.log("   • posted_products (with dual-engine support for Lazada & Shopee)");
        console.log("   • link_clicks (for tracking shortlink clicks and conversions)");
        console.log("\n🚀 Next steps: Continue with Phase 4 implementations...");
        
    } catch (error) {
        console.error("\n❌ MIGRATION FAILED:", error.message);
        console.error("\n🔧 Possible causes:");
        console.error("   • Invalid DIRECT_URL in .dev.vars");
        console.error("   • Network connectivity issues");
        console.error("   • Supabase service temporarily unavailable");
        console.error("   • SQL syntax errors in migration files");
        console.error("");
        console.error("Please check your .dev.vars file and try again.");
        process.exit(1);
    }
}

// Run the migration
migrate().catch(error => {
    console.error("Fatal error:", error);
    process.exit(1);
});
console.log("\nMigration script started. Press Ctrl+C to stop if needed.\");