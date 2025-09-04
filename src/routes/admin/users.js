const express = require('express');
const router = express.Router();
const { pool } = require('../../db');

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

    res.redirect('/admin/users');
  } catch (err) {
    console.error('Error al guardar usuario:', err);
    res.status(500).send('Error al guardar usuario');
  }
});

module.exports = router;
