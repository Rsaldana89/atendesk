const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

// Carga las variables de entorno desde un archivo `.env` si existe.  En
// entornos locales esto provee credenciales de la base de datos y otras
// configuraciones.  En Railway u otros proveedores de nube, las
// variables se inyectan automáticamente, por lo que esta llamada no
// sobrescribe nada.
dotenv.config();

/*
 * Determina los valores de conexión a MySQL utilizando diferentes
 * variables de entorno, de modo que el proyecto funcione tanto en un
 * entorno local como cuando se despliega en Railway.  Se priorizan
 * las variables DB_HOST/DB_PORT/DB_USER/DB_PASS/DB_NAME definidas
 * por el desarrollador.  Si no existen, se revisan las variables
 * estándar generadas por Railway (MYSQLHOST, MYSQLPORT, etc.).  Como
 * último recurso se utilizan valores por defecto para una base local.
 */

const host = process.env.DB_HOST || process.env.MYSQLHOST || 'localhost';
const port = parseInt(
  process.env.DB_PORT || process.env.MYSQLPORT || '3306',
  10
);
const user = process.env.DB_USER || process.env.MYSQLUSER || 'root';

// Permitir usar DB_PASS o DB_PASSWORD así como la variable creada
// por Railway (MYSQLPASSWORD) para mayor flexibilidad.
const password =
  process.env.DB_PASS ||
  process.env.DB_PASSWORD ||
  process.env.MYSQLPASSWORD;

const database =
  process.env.DB_NAME || process.env.MYSQLDATABASE || 'soportebd';

if (!password) {
  throw new Error(
    'La contraseña de la base de datos no está definida. Asegúrate de establecer DB_PASS, DB_PASSWORD o MYSQLPASSWORD en tu entorno.'
  );
}

const pool = mysql.createPool({
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


console.log('🔍 Variables de conexión:');
console.log('Host:', host);
console.log('Port:', port);
console.log('User:', user);
console.log('Database:', database);
console.log('Password exists:', !!password);

module.exports = { pool };