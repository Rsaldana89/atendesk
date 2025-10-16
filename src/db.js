const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
dotenv.config();

const host = process.env.DB_HOST || 'localhost';
const port = Number(process.env.DB_PORT || 3306);
const user = process.env.DB_USER || 'root';
const password = process.env.DB_PASSWORD || process.env.DB_PASS || '';
const database = process.env.DB_NAME || 'soportebd';

const pool = mysql.createPool({
  host, port, user, password, database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4_general_ci'
});

// Fijar TZ -06:00 por conexión (callback API aquí)
pool.on('connection', (conn) => {
  conn.query("SET time_zone = '-06:00'", (err) => {
    if (err) {
      console.error('⚠️ No se pudo fijar zona horaria -06:00:', err.message);
    }
  });
});

// Prueba rápida (sí es promise aquí)
(async () => {
  try {
    const [rows] = await pool.query('SELECT @@session.time_zone tz, NOW() ahora');
    console.log(`✅ MySQL OK → ${host}:${port}/${database} | TZ: ${rows[0].tz} | NOW(): ${rows[0].ahora}`);
  } catch (err) {
    console.error('❌ Error MySQL:', err.code || err.message);
  }
})();

module.exports = { pool };
