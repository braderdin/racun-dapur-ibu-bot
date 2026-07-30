#!/bin/bash

# Simple migration script wrapper for Phase 3
# This fixes the environment variable loading issue

set -e

echo "🚀 Starting Phase 3 Database Migration..."

# Extract environment from .dev.vars file
echo "📄 Loading environment from .dev.vars..."
if [ ! -f ".dev.vars" ]; then
    echo "❌ .dev.vars file not found!"
    exit 1
fi

# Load environment variables from .dev.vars
while IFS='=' read -r key value; do
    # Skip comments and empty lines
    [[ "$key" =~ ^# ]] && continue
    [[ -z "$key" ]] && continue
    
    # Remove surrounding quotes
    value=${value#\"}
    value=${value%\"}
    
    export "$key=$value"
done < <(grep -E '^[A-Z_][A-Z_]*=' .dev.vars)

# Check if DIRECT_URL is set
if [ -z "$DIRECT_URL" ]; then
    echo "❌ DIRECT_URL not found in .dev.vars"
    echo "Please check .dev.vars file for DIRECT_URL environment variable"
    exit 1
fi

echo "✅ Environment loaded successfully"
echo "🔗 DIRECT_URL: ${DIRECT_URL:0:50}..."

# Execute migration using node directly (avoiding tsx issues)
echo "🔄 Running migration..."

# Use node to run the fixed migration script
node -e "
const fs = require('fs');
const path = require('path');

// Load environment
require('dotenv').config({ path: '.dev.vars' });

const DIRECT_URL = process.env.DIRECT_URL;
if (!DIRECT_URL) {
    console.error('❌ DIRECT_URL is required in .dev.vars');
    process.exit(1);
}

console.log('✅ DIRECT_URL loaded:', DIRECT_URL.substring(0, 50) + '...');

// Execute migration using simple SQL execution
const { Client } = require('pg');
const client = new Client({ connectionString: DIRECT_URL, connectionTimeoutMillis: 5000 });

async function migrate() {
    try {
        await client.connect();
        console.log('🔄 Connected to database');
        
        // Read and execute migration scripts
        const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
        const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
        
        console.log('📋 Found', files.length, 'migration files');
        
        for (const file of files) {
            const filePath = path.join(migrationsDir, file);
            const sqlContent = fs.readFileSync(filePath, 'utf8');
            
            // Split SQL by semicolon and execute each statement
            const statements = sqlContent
                .split(';')
                .map(s => s.trim())
                .filter(s => s.length > 0 && !s.startsWith('--'));
            
            console.log('📄 Executing', file, '(' + statements.length + ' statements)');
            
            for (const stmt of statements) {
                await client.query(stmt);
            }
            
            console.log('✅', file, 'completed');
        }
        
        await client.end();
        console.log('🎉 All migrations completed successfully!');
        
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    }
}

migrate();
"

echo "✅ Database migration completed successfully!"
echo "🎉 Phase 3 deployment is ready for execution"