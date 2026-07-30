/*
 * Final Database Migration Script for Phase 3
 * Reads DIRECT_URL from .dev.vars and executes SQL schema files
 * Simple and reliable migration execution
 */n

const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

// Simple function to load DIRECT_URL from .dev.vars file
function loadDirectUrl() {
    try {
        const devVarsPath = path.join(process.cwd(), ".dev.vars");
        if (!fs.existsSync(devVarsPath)) {
            console.error("❌ .dev.vars file not found");
            return null;
        }

        const content = fs.readFileSync(devVarsPath, "utf8");
        const lines = content.split("\n");
        
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith("#") && trimmed.startsWith("DIRECT_URL=")) {
                return trimmed.substring(11).replace(/\"/g, "");
            }
        }
        
        return null;
    } catch (error) {
        console.error("❌ Failed to read .dev.vars:", error.message);
        return null;
    }
}

async function main() {
    console.log("🚀 Phase 3 Database Migration");
    console.log("==============================");
    
    // Load DIRECT_URL
    const directUrl = loadDirectUrl();
    
    if (!directUrl) {
        console.error("❌ DIRECT_URL not found in .dev.vars");
        console.log("\n📋 Available environment variables:");
        if (fs.existsSync(path.join(process.cwd(), ".dev.vars"))) {
            const content = fs.readFileSync(path.join(process.cwd(), ".dev.vars"), "utf8");
            const lines = content.split("\n");
            lines.forEach((line, index) => {
                if (line.trim() && !line.trim().startsWith("#")) {
                    console.log("   ", line);
                }
            });
        }
        console.log("\n🔧 To fix this, add DIRECT_URL to .dev.vars file:");
        console.log("   DIRECT_URL=\"postgresql://postgres:password@your-supabase-url:5432/postgres?pgbouncer=false\"");
        process.exit(1);
    }
    
    console.log("✅ DIRECT_URL loaded: " + directUrl.substring(0, 50) + "...");
    
    // Set environment variable
    process.env.DIRECT_URL = directUrl;
    
    // Create database connection
    const client = new Client({
        connectionString: directUrl,
        connectionTimeoutMillis: 5000,
        idleInTransactionSessionTimeoutMillis: 5000,
        max: 20
    });
    
    try {
        await client.connect();
        console.log("✅ Connected to database");
        
        // Execute migrations
        const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
        const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
        
        if (files.length === 0) {
            console.log("⚠️  No migration files found");
            await client.end();
            return;
        }
        
        console.log("📋 Found", files.length, "migration files:");
        files.forEach((file, index) => {
            console.log("   ", (index + 1).toString().padStart(2), ". ", file);
        });
        
        for (const file of files) {
            console.log("\n📄 Processing:", file);
            
            const filePath = path.join(migrationsDir, file);
            const sqlContent = fs.readFileSync(filePath, "utf8");
            
            // Simple SQL parsing
            const statements = sqlContent
                .split(';')
                .map(s => s.trim())
                .filter(s => s.length > 0 && !s.startsWith('--'))
                .filter(s => !s.startsWith('/\*') || s.includes('*/'));
            
            if (statements.length === 0) {
                console.log("⚠️  No valid SQL statements in", file);
                continue;
            }
            
            console.log("   📝 Executing", statements.length, "statements...");
            
            for (let i = 0; i < statements.length; i++) {
                const stmt = statements[i];
                try {
                    await client.query(stmt);
                    console.log("      ✓ " + (i + 1).toString().padStart(2));
                } catch (error) {
                    console.error("      ✗ " + (i + 1).toString().padStart(2), "Error:", error.message);
                    throw error;
                }
            }
            
            console.log("✅", file, "completed successfully");
        }
        
        await client.end();
        
        console.log("\n🎉 ALL MIGRATIONS COMPLETED SUCCESSFULLY!");
        console.log("================================================");
        console.log("\n✅ Phase 3 deployment ready for execution!");
        console.log("\n📋 Created schemas:");
        console.log("   • posted_products (dual-engine support)");
        console.log("   • link_clicks (click analytics)");
        
    } catch (error) {
        console.error("\n❌ MIGRATION FAILED:", error.message);
        process.exit(1);
    }
}

// Run migration
main().catch(error => {
    console.error("Migration failed:", error);
    process.exit(1);
});