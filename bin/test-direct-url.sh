#!/bin/bash

# Script to extract DIRECT_URL from .dev.vars and test connection

echo "📄 Reading DIRECT_URL from .dev.vars..."

# Extract DIRECT_URL from .dev.vars using grep and remove quotes
DIRECT_URL=$(grep '^DIRECT_URL=' .dev.vars | cut -d'=' -f2- | tr -d '"')

if [ -z "$DIRECT_URL" ]; then
    echo "❌ DIRECT_URL not found in .dev.vars"
    echo "Available env vars:"
    grep '^[A-Z_][A-Z_]*=' .dev.vars
    exit 1
fi

echo "🔗 DIRECT_URL found: ${DIRECT_URL:0:50}..."

# Check if .dev.vars has Windows line endings
if grep -q $'\r\n' .dev.vars; then
    echo "⚠️  .dev.vars appears to have Windows line endings (CRLF)"
fi

# Test if the URL looks valid
if [[ "$DIRECT_URL" == postgresql://* ]]; then
    echo "✅ URL format appears valid (postgresql://)"
    
    # Try to extract the connection string without ?pgbouncer=false if present
    if [[ "$DIRECT_URL" == *"?pgbouncer=false"* ]]; then
        echo "ℹ️  URL contains ?pgbouncer=false (good for direct connection)"
    fi
    
else
    echo "❌ URL does not appear to be a PostgreSQL URL"
    exit 1
fi

echo "📋 First migration script (20260730000001_analytics_and_clicks.sql) content preview:"
head -20 supabase/migrations/20260730000001_analytics_and_clicks.sql

echo ""
echo "💡 Next step: We need to modify db-migrate.js to extract DIRECT_URL from .dev.vars file directly" 

echo ""
echo "Current db-migrate.js checks process.env.DIRECT_URL, but when running:", 

echo "    node bin/db-migrate.js"
echo ""
echo "The script doesn't automatically load .dev.vars into the environment."
echo ""
echo "Solution options:"
echo "1. Modify db-migrate.js to read .dev.vars directly"
echo "2. Use export before running: export $(grep '^[A-Z_][A-Z_]*=' .dev.vars | xargs)" 
echo "3. Install dotenv package and load .dev.vars as .env"