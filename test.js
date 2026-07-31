const { Pool } = require('pg');
const connectionString = process.env.DATABASE_URL_DIRECT_UNPOOLED;
if (!connectionString) {
  console.error('DATABASE_URL_DIRECT_UNPOOLED is not set');
  process.exit(1);
}
const pool = new Pool({ connectionString });
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Error:', err.message);
  } else {
    console.log('Success:', res.rows[0]);
  }
  pool.end();
});