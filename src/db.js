// Simplified DB config (like 'incidencias'): only DB_* variables
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
dotenv.config();

// Local defaults: soportebd; Railway: set DB_* in app variables
const host = process.env.DB_HOST || 'localhost';
const port = Number(process.env.DB_PORT || 3306);
const user = process.env.DB_USER || 'root';
const password = process.env.DB_PASSWORD || process.env.DB_PASS || '';
const database = process.env.DB_NAME || 'soportebd';

if (!password && process.env.NODE_ENV !== 'development') {
  console.warn('⚠️ DB_PASSWORD no está definido (usando vacío).');
}

const pool = mysql.createPool({
  host, port, user, password, database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4_general_ci'
});

// Quick connection check
pool.query('SELECT 1').then(() => {
  console.log('✅ Conexión MySQL OK →', host + ':' + port, '/', database);
}).catch(err => {
  console.error('❌ Error MySQL:', err.code || err.message);
});

module.exports = { pool };
