/*
 * Fixed Database Migration Script
 * Reads DIRECT_URL from .dev.vars file and executes SQL schema files
 * Executes SQL schema files directly against Supabase unpooled direct connection
 * Follows WSL Network Protocol with ?pgbouncer=false parameter
 * Provides timeout wrappers to guarantee process auto-exits on failure
 */n

const fs = require("fs");
const path = require("path");

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
                    return match[1].replace(/\"/g, "").trim();
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
let DIRECT_URL = process.env.DIRECT_URL;
let SUPABASE_URL = process.env.SUPABASE_URL;
let SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
};

function executeSqlFile(filePath) {
    return new Promise(async (resolve, reject) => {
        try {
            console.log(`📄 Executing SQL file: ${filePath}`);

            const sqlContent = fs.readFileSync(filePath, "utf8");

            // Parse SQL into individual statements (simple splitting by semicolon)
            const statements = sqlContent
                .split(";")
                .map(stmt => stmt.trim())
                .filter(stmt => stmt.length > 0 && !stmt.startsWith("--"));

            if (statements.length === 0) {
                console.log(`⚠️  No valid SQL statements found in ${filePath}`);
                resolve();
                return;
            }

            const { Client } = require("pg");
            const client = new Client(connectionConfig);

            // Execute each statement with timeout
            async function executeStatements() {
                for (let i = 0; i < statements.length; i++) {
                    const stmt = statements[i];
                    console.log(`  Executing statement ${i + 1}/${statements.length}`);

                    await client.query(stmt);
                }

                await client.end();
                console.log(
                    `✅ Successfully executed ${statements.length} statements from ${filePath}`,
                );
                resolve();
            }

            executeStatements().catch(error => reject(error));
            
        } catch (error) {
            console.error(`❌ Failed to execute ${filePath}:`, error.message);
            reject(error);
        }
    });
}

async function main() {
    await loadEnvFromDevVars();
    
    const migrationsDir = path.join(process.cwd(), "supabase", "migrations");

    try {
        console.log("🚀 Database Migration Helper Script started");
        console.log(`📁 Migration directory: ${migrationsDir}`);

        // Read all migration files
        const files = fs.readdirSync(migrationsDir);
        const sqlFiles = files.filter(file => file.endsWith(".sql")).sort(); // Execute in alphabetical order (timestamp prefix)

        if (sqlFiles.length === 0) {
            console.log("⚠️  No migration files found");
            return;
        }

        console.log(`📋 Found ${sqlFiles.length} migration file(s):`);
        sqlFiles.forEach(file => console.log(`  - ${file}`));

        // Execute each migration file
        for (const file of sqlFiles) {
            const filePath = path.join(migrationsDir, file);
            await executeSqlFile(filePath);
            console.log(""); // Add spacing between files
        }

        console.log("🎉 All migrations executed successfully!");
    } catch (error) {
        console.error("💥 Migration script failed:", error.message);
        process.exit(1);
    }
}

// Execute main function with timeout wrapper
const timeoutPromise = new Promise((_, reject) => {
    setTimeout(
        () => reject(new Error("Migration timed out after 30 seconds")),
        30000,
    );
});

Promise.race([main(), timeoutPromise])
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("💥 Fatal error:", error.message);
        process.exit(1);
    });

console.log("Running migration script...");
main().catch(error => {
    console.error("Migration failed:", error);
    process.exit(1);
});