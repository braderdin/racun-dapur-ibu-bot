// Debug script to check connection string and connection
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load environment variables from .dev.vars if not set
function loadEnvFromDevVars() {
  const envPath = path.join(process.cwd(), '.dev.vars');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const match = trimmed.match(/^([A-Z_][A-Z_]*)=(.*)$/);
        if (match) {
          const varName = match[1];
          let varValue = match[2].trim();
          // Remove surrounding quotes
          if ((varValue.startsWith('"') && varValue.endsWith('"')) ||
              (varValue.startsWith("'") && varValue.endsWith("'"))) {
            varValue = varValue.slice(1, -1);
          }
          if (!process.env[varName]) {
            process.env[varName] = varValue;
          }
        }
      }
    }
  }
}

// Get the direct URL with pgbouncer=false
function getDirectUrl() {
  let url = process.env.DATABASE_URL_DIRECT_UNPOOLED || process.env.DIRECT_URL;
  if (!url) {
    throw new Error('DATABASE_URL_DIRECT_UNPOOLED or DIRECT_URL not set');
  }
  // Ensure pgbouncer=false is set
  if (!url.includes('pgbouncer=false')) {
    url = url.replace(/pgbouncer=true/, 'pgbouncer=false');
    if (!url.includes('pgbouncer=')) {
      url = url + (url.includes('?') ? '&' : '?') + 'pgbouncer=false';
    }
  }
  return url;
}

async function main() {
  try {
    loadEnvFromDevVars();
    const connectionString = getDirectUrl();
    console.log('Connection string (raw):', connectionString);
    
    // Mask the password in the connection string for logging
    const masked = connectionString.replace(/:[^:@]+@/, ':[REDACTED]@');
    console.log('Connection string (masked):', masked);
    
    const pool = new Pool({
      connectionString: connectionString,
      connectionTimeoutMillis: 5000,
    });
    
    // Test connection
    const res = await pool.query('SELECT NOW() as now');
    console.log('Connected successfully at:', res.rows[0].now);
    
    await pool.end();
    console.log('Connection closed.');
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

main();