const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

// Carga las variables de entorno desde un archivo `.env` si existe.
// En entornos locales esto provee credenciales de la base de datos.
// En Railway u otros proveedores de nube, las variables se inyectan automáticamente.
dotenv.config();

/*
 * Este archivo permite conexión dual:
 *  - Local: usando DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME (como soportebd)
 *  - Railway (producción): usando una sola variable DATABASE_URL
 * 
 * DATABASE_URL debe ser igual a {{MySQL.MYSQL_URL}} en el panel de Railway.
 */

const DATABASE_URL = process.env.DATABASE_URL;

// Configuración local (modo desarrollo)
const host = process.env.DB_HOST || process.env.MYSQLHOST || 'localhost';
const port = parseInt(process.env.DB_PORT || process.env.MYSQLPORT || '3306', 10);
const user = process.env.DB_USER || process.env.MYSQLUSER || 'root';
const password =
  process.env.DB_PASS ||
  process.env.DB_PASSWORD ||
  process.env.MYSQLPASSWORD;
const database = process.env.DB_NAME || process.env.MYSQLDATABASE || 'soportebd';

// Construye el pool según el entorno
let pool;

if (DATABASE_URL) {
  console.log('🌐 Conectando a MySQL con DATABASE_URL (Railway)...');
  pool = mysql.createPool({
    uri: DATABASE_URL,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4_general_ci'
  });
} else {
  console.log('💻 Conectando a MySQL local...');
  if (!password) {
    throw new Error(
      'La contraseña de la base de datos no está definida. Asegúrate de establecer DB_PASS, DB_PASSWORD o MYSQLPASSWORD en tu entorno local.'
    );
  }

  pool = mysql.createPool({
    host,
    port,
    user,
    password,
    database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4_general_ci'
  });
}

// Mostrar configuración (sin exponer la contraseña)
console.log('🔍 Variables de conexión:');
console.log('Modo:', DATABASE_URL ? 'Railway (1 variable)' : 'Local');
console.log('Host:', DATABASE_URL ? '(desde DATABASE_URL)' : host);
console.log('Port:', DATABASE_URL ? '(desde DATABASE_URL)' : port);
console.log('User:', DATABASE_URL ? '(desde DATABASE_URL)' : user);
console.log('Database:', DATABASE_URL ? '(desde DATABASE_URL)' : database);
console.log('Password exists:', !!(DATABASE_URL || password));

// Prueba inicial de conexión (opcional)
pool.query('SELECT 1')
  .then(() => console.log('✅ Conexión a MySQL exitosa.'))
  .catch(err => console.error('❌ Error al conectar con MySQL:', err.message));

module.exports = { pool };
