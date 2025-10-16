const express = require('express');
const router = express.Router();
const { pool } = require('../../db');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

function requireAdmin(req, res, next) {
  if (req.session.user && req.session.user.role === 'admin') return next();
  res.redirect('/');
}

// 👉 GET /admin/users
router.get('/users', requireAdmin, async (req, res) => {
  try {
    const [users] = await pool.query(`
      SELECT 
        u.id,
        u.username,
        u.full_name,
        u.email,
        u.role,
        GROUP_CONCAT(d.name ORDER BY d.name SEPARATOR ', ') AS departments,
        GROUP_CONCAT(d.id ORDER BY d.name SEPARATOR ',') AS department_ids
      FROM users u
      LEFT JOIN user_department_access uda ON u.id = uda.user_id
      LEFT JOIN departments d ON uda.department_id = d.id
      WHERE u.role IN ('manager','agent','user')
      GROUP BY u.id, u.username, u.full_name, u.email, u.role
      ORDER BY FIELD(u.role, 'manager','agent','user'), u.full_name ASC
    `);

    const [departamentos] = await pool.query(
      'SELECT id, name FROM departments ORDER BY name'
    );

    // No se cargan suscripciones de categorías porque la notificación por
    // categorías se gestiona mediante el archivo notificaciones.json.
    users.forEach(u => { u.category_subs = {}; });

    res.render('admin/users', {
      title: 'Administración de Usuarios',
      users,
      departamentos
    });
  } catch (err) {
    console.error('Error cargando usuarios:', err);
    res.status(500).send('Error al cargar usuarios');
  }
});

// 👉 POST /admin/users/save
router.post('/users/save', requireAdmin, async (req, res) => {
  const { id, username, name, email, password, role, departments } = req.body;

  try {
    const full_name = name;
    const now = new Date();
    let userId = id;

    if (id) {
      // Actualizar
      let query = `UPDATE users SET username = ?, full_name = ?, email = ?, role = ?`;
      const params = [username, full_name, email, role];

      if (password && password.trim() !== '') {
        query += `, password_plain = ?`;
        params.push(password);
      }

      query += ` WHERE id = ?`;
      params.push(id);
      await pool.query(query, params);
    } else {
      // Crear
      const [result] = await pool.query(
        `INSERT INTO users (username, password_plain, full_name, email, role, is_active, created_at)
         VALUES (?, ?, ?, ?, ?, 1, ?)`,
        [username, password || '', full_name, email, role, now]
      );
      userId = result.insertId;
    }

    // 👉 Actualizar accesos de departamentos
    await pool.query('DELETE FROM user_department_access WHERE user_id = ?', [userId]);

    if (role === 'manager' || role === 'agent') {
      if (departments) {
        // Para manager: múltiple; para agent: solo el primero
        const raw = Array.isArray(departments) ? departments : [departments];
        const toInsert = role === 'agent' ? raw.slice(0, 1) : raw;

        for (const depId of toInsert) {
          await pool.query(
            'INSERT INTO user_department_access (user_id, department_id) VALUES (?, ?)',
            [userId, depId]
          );
        }
      }
    }

    // Las suscripciones de categorías ya no se guardan en la base de datos.
    res.redirect('/admin/users');
  } catch (err) {
    console.error('Error al guardar usuario:', err);
    res.status(500).send('Error al guardar usuario');
  }
});


// 👉 GET /admin/backup
router.get('/backup', requireAdmin, (req, res) => {
  // Nombre de archivo con marca de tiempo legible (YYYY-MM-DD_HH-MM-SS)
  const timestamp = new Date().toISOString().replace(/[:T]/g, '-').replace(/\..+/, '');
  const filename = `backup-${timestamp}.sql`;
  const backupDir = path.join(__dirname, '..', '..', 'backup');
  const filePath = path.join(backupDir, filename);

  try {
    fs.mkdirSync(backupDir, { recursive: true });
  } catch (err) {
    console.error('Error al crear directorio de respaldo:', err);
    return res.status(500).send('No se pudo crear la carpeta de respaldo');
  }

  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || '3306';
  const user = process.env.DB_USER || process.env.DB_USERNAME || 'root';
  const password = process.env.DB_PASSWORD || process.env.DB_PASS || '';
  const database = process.env.DB_NAME || 'soportebd';

  // Construye comando mysqldump. Si no hay password, se omite -p
  const pwdPart = password ? `-p${password}` : '';
  const dumpCmd = `mysqldump -h ${host} -P ${port} -u ${user} ${pwdPart} ${database} > "${filePath}"`;

  exec(dumpCmd, (error, stdout, stderr) => {
    if (error) {
      console.error('Error ejecutando mysqldump:', error, stderr);
      return res.status(500).send('Error al generar el respaldo de la base de datos');
    }
    // Descargar el archivo una vez generado
    res.download(filePath, filename, err => {
      if (err) {
        console.error('Error al enviar archivo de respaldo:', err);
        return res.status(500).send('No se pudo enviar el respaldo');
      }
    });
  });
});


module.exports = router;
