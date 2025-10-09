const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
dotenv.config();

if (!process.env.DB_PASS) {
  throw new Error('DB_PASS no está definido. Crea/edita tu archivo .env');
}

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS,
  database: process.env.DB_NAME || 'soportebd',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4_general_ci'
});

module.exports = { pool };

