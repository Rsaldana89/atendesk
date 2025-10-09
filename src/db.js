const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
dotenv.config();

// Permite DB_* (local) y también variables provistas por Railway (MYSQL*)
const DB_HOST = process.env.DB_HOST || process.env.MYSQLHOST || 'localhost';
const DB_PORT = Number(process.env.DB_PORT || process.env.MYSQLPORT || 3306);
const DB_USER = process.env.DB_USER || process.env.MYSQLUSER || 'root';
const DB_PASS = process.env.DB_PASS || process.env.DB_PASSWORD || process.env.MYSQLPASSWORD;
const DB_NAME = process.env.DB_NAME || process.env.MYSQLDATABASE || 'soportebd';

if (!DB_PASS) {
  throw new Error('No hay contraseña de DB (DB_PASS/DB_PASSWORD/MYSQLPASSWORD). Define tu .env o Variables en Railway.');
}

const pool = mysql.createPool({
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASS,
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4_general_ci'
});

module.exports = { pool };
