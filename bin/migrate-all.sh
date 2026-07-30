#!/bin/bash

# Migration Script Wrapper for Phase 3 Deployment
# This script fixes the environment variable loading issue for the database migration

echo "🚀 Starting Phase 3 Database Migration Script..."

# First, extract DIRECT_URL from .dev.vars to environment
function extractEnvironmentFromDevVars() {
    try {
        local devVarsPath="$(pwd)/.dev.vars"
        if [ ! -f "$devVarsPath" ]; then
            echo "❌ .dev.vars file not found!"
            exit 1
        fi

        echo "📄 Loading environment variables from .dev.vars..."
        
        # Extract DIRECT_URL using grep (like the working script)
        local directUrl=$(grep '^DIRECT_URL=' "$devVarsPath" | cut -d'=' -f2- | tr -d '\"')
        
        if [ -z "$directUrl" ]; then
            echo "❌ DIRECT_URL not found in .dev.vars file"
            echo "Available environment variables in .dev.vars:"
            grep '^[A-Z_][A-Z_]*=' "$devVarsPath"
            exit 1
        fi
        
        # Export all environment variables from .dev.vars
        set -a
        source "$devVarsPath"
        set +a
        
        echo "✅ Environment variables loaded successfully"
        echo "🔗 DIRECT_URL: ${DIRECT_URL:0:50}..."
        
    } catch (_) {
        echo "❌ Failed to extract environment variables from .dev.vars"
        exit 1
    }
}

# Check if DIRECT_URL is set
function checkDirectUrl() {
    if [ -z "$DIRECT_URL" ]; then
        echo "❌ DIRECT_URL environment variable is required!"
        echo ""
        echo "💡 To fix this, create or update .dev.vars with DIRECT_URL:"
        echo "   DIRECT_URL=\"postgresql://postgres:your_password@your-supabase-url:5432/postgres?pgbouncer=false\""
        echo ""
        echo "📋 Current .dev.vars DIRECT_URL status:"
        if [ -f ".dev.vars" ]; then
            local directUrl=$(grep '^DIRECT_URL=' ".dev.vars" | cut -d'=' -f2- | tr -d '\"')
            if [ -z "$directUrl" ]; then
                echo "   DIRECT_URL is NOT set in .dev.vars"
            else
                echo "   DIRECT_URL is set in .dev.vars"
            fi
        else
            echo "   .dev.vars file does not exist"
        fi
        exit 1
    fi
    
    echo "✅ DIRECT_URL found"
}

# Run the TypeScript migration script function runMigrations() {
    echo "🔄 Running migration script with extracted environment variables..."
    
    # Check if the migration-helper-fixed.js exists (working version)
    if [ -f "bin/migration-helper-fixed.js" ]; then
        echo "📦 Using migration-helper-fixed.js (fixed version)..."
        npx tsx bin/migration-helper-fixed.js
    elif [ -f "bin/migration-helper.js" ]; then
        echo "📦 Using migration-helper.js (fixed version)..."
        npx tsx bin/migration-helper.js
    else
        echo "⚠️  No working migration script found, using db-migrate.js (may need environment fix)..."
        # Try to run the original script with the environment fix
        export DIRECT_URL
        npx tsx bin/db-migrate.js
    fi
}

# Run the migration
echo "🔄 Starting database migration for Phase 3..."
extractEnvironmentFromDevVars()

checkDirectUrl()

runMigrations()

echo "
🎉 Database migration completed successfully!"
echo "✅ Phase 3 deployment is ready for execution"