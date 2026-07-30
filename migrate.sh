#!/bin/bash

# Simple migration script for Phase 3
# This script fixes the environment variable loading issue by extracting
# DIRECT_URL from .dev.vars and running the migration directly with Node

set -e

echo "🚀 Starting Phase 3 Database Migration Script"
echo "============================================="

# Check if .dev.vars exists
if [ ! -f ".dev.vars" ]; then
    echo "❌ ERROR: .dev.vars file not found!"
    echo "Please ensure the .dev.vars file exists in the project root."
    echo "It should contain the DIRECT_URL environment variable."
    exit 1
fi

# Extract DIRECT_URL from .dev.vars using simple grep (works on all systems)
DIRECT_URL=$(grep "^DIRECT_URL=" ".dev.vars" | cut -d'=' -f2- | tr -d '"')

# Check if DIRECT_URL was extracted
if [ -z "$DIRECT_URL" ]; then
    echo "❌ ERROR: Could not extract DIRECT_URL from .dev.vars"
    echo "Please check the .dev.vars file format and ensure it contains:"
    echo "   DIRECT_URL=\"postgresql://username:password@your-supabase-url:5432/postgres?pgbouncer=false\""
    echo ""
    echo "Available environment variables in .dev.vars:"
    grep "^[A-Z_][A-Z_]*=" ".dev.vars" | head -10
    exit 1
fi

# Export the DIRECT_URL to environment
echo "🔗 DIRECT_URL extracted: ${DIRECT_URL:0:50}..."
echo ""

# Set the environment variable for the Node script
export DIRECT_URL

# Check if node_modules/.bin/pg is available
if [ ! -f "node_modules/.bin/pg" ] && [ ! -f "node_modules/.bin/tsx" ]; then
    echo "⚠️  Warning: Node modules not found. Running 'npm install' first..."
    npm install --quiet
fi

# Run the migration using Node.js with the fixed migration script
echo "🔄 Executing database migration..."
echo "This will execute all SQL schema files in supabase/migrations/"
echo ""

# Use Node.js to run a simple migration script
node -e "
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// Validate DIRECT_URL
if (!process.env.DIRECT_URL) {
    console.error('❌ ERROR: DIRECT_URL environment variable is required');
    console.error('   Please check your .dev.vars file');
    process.exit(1);
}

const DIRECT_URL = process.env.DIRECT_URL;
console.log('✅ DIRECT_URL loaded successfully');

// Create database connection
const client = new Client({
    connectionString: DIRECT_URL,
    connectionTimeoutMillis: 5000,
    idleInTransactionSessionTimeoutMillis: 5000,
    max: 20
});

async function migrate() {
    try {
        // Connect to database
        await client.connect();
        console.log('🔄 Connected to Supabase database');
        
        // Get list of migration files
        const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
        const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
        
        if (files.length === 0) {
            console.log('⚠️  No migration files found in', migrationsDir);
            await client.end();
            return;
        }
        
        console.log('📋 Found', files.length, 'migration files to execute:');
        files.forEach((file, index) => {
            console.log('   ', (index + 1).toString().padStart(2), '. ', file);
        });
        
        console.log('');
        console.log('🔄 Executing migrations...');
        
        // Execute each migration file
        for (const file of files) {
            const filePath = path.join(migrationsDir, file);
            const sqlContent = fs.readFileSync(filePath, 'utf8');
            
            // Parse SQL statements (split by semicolon, remove empty lines and comments)
            const statements = sqlContent
                .split(';')
                .map(stmt => stmt.trim())
                .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
            
            if (statements.length === 0) {
                console.log('⚠️  No valid SQL statements found in', file);
                continue;
            }
            
            console.log('📄 Executing', file, '(' + statements.length + ' statements)');
            
            // Execute each statement
            for (let i = 0; i < statements.length; i++) {
                const stmt = statements[i];
                await client.query(stmt);
            }
            
            console.log('✅', file, 'completed successfully');
        }
        
        // Close connection
        await client.end();
        
        console.log('');
        console.log('🎉 ALL MIGRATIONS COMPLETED SUCCESSFULLY!');
        console.log('');
        console.log('The following schemas have been created:');
        console.log('  • Posted Products table (with dual-engine support for Lazada & Shopee)');
        console.log('  • Click Analytics table (for tracking shortlink clicks and conversions)');
        console.log('');
        console.log('Phase 3 deployment is now ready!');
        
    } catch (error) {
        console.error('❌ MIGRATION FAILED:', error.message);
        console.error('');
        console.error('This might be due to:');
        console.error('  • Invalid DIRECT_URL in .dev.vars');
        console.error('  • Network connectivity issues');
        console.error('  • Supabase service temporarily unavailable');
        console.error('');
        console.error('Please check your .dev.vars file and try again.');
        process.exit(1);
    }
}

migrate();
"

if [ $? -eq 0 ]; then
    echo "✅ Database migration completed successfully!"
    echo "🎉 Phase 3 deployment is ready for execution!"
    echo ""
    echo "Next steps after Phase 3 completion:"
    echo "  • Loop 4: Build Image Processing & WebP Auto-Compression Utility"
    echo "  • Loop 5: Update Backblaze B2 Service with Hierarchical WebP Folder Structure"
    echo "  • Loop 6: Build Shopee API Integration Service Interface"
    echo "  • Loop 7: Build Dual-Engine Rotation Manager"
    echo "  • Loop 8: Build 3-Tier AI Fallback Copywriting Engine"
    echo "  • Loop 9: Build Edge Analytics & Click Recording Service"
    echo "  • Loop 10: Update Shortener Service with Click Analytics"
    echo "  • Loop 11: Build Dry-Run End-to-End Simulation Script"
    echo "  • Loop 12: Execute Local End-to-End Dry-Run Test"
    echo "  • Loop 13: Capture WebP B2 Storage Skill"
    echo "  • Loop 14: Capture Dual-Engine Rotation Skill"
    echo "  • Loop 15: Execute Final Phase 3 Build Verification & Compile Summary Report"
else
    echo "❌ Database migration failed"
    echo "Please check the error messages above and try again."
    exit 1
fi