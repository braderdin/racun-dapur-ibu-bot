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

async function testConnection() {
  try {
    loadEnvFromDevVars();
    const connectionString = getDirectUrl();
    console.log('Connecting to:', connectionString.replace(/:[^:@]+@/, ':[REDACTED]@'));

    const pool = new Pool({
      connectionString: connectionString,
      connectionTimeoutMillis: 5000,
    });

    // Test connection
    const res = await pool.query('SELECT version()');
    console.log('Connected to:', res.rows[0].version);

    // Get current database and user
    const dbRes = await pool.query('SELECT current_database(), current_user');
    console.log('Database:', dbRes.rows[0].current_database);
    console.log('User:', dbRes.rows[0].current_user);

    // List tables in the public schema
    const tablesRes = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    console.log('Tables in public schema:');
    tablesRes.rows.forEach(row => {
      console.log('  -', row.table_name);
    });

    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

testConnection();