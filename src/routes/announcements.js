const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Página de anuncios
// Esta ruta muestra una lista de comunicados (anuncios) y, si el usuario tiene
// permisos de administrador o manager, también permite crear y eliminar
// anuncios. Los usuarios finales y agentes solamente pueden ver los anuncios
// vigentes y no ven los controles de publicación.
router.get('/', async (req, res) => {
  const user = req.session.user || {};
  try {
    // Obtiene todos los departamentos activos para mostrar como canales.
    const [deptRows] = await pool.query(
      `SELECT name
         FROM departments
        WHERE is_active = 1
        ORDER BY name`
    );
    const departments = deptRows.map(r => r.name);
    // Determina a qué departamentos puede publicar el usuario (solo admin/manager)
    let accessibleDeptNames = [];
    if (user.role === 'admin') {
      // Admin puede publicar en cualquier departamento
      accessibleDeptNames = [...departments];
    } else if (user.role === 'manager') {
      // Managers sólo pueden publicar en sus departamentos asignados
      const [rows] = await pool.query(
        `SELECT d.name
           FROM user_department_access uda
           JOIN departments d ON d.id = uda.department_id
          WHERE uda.user_id = ? AND d.is_active = 1
          ORDER BY d.name`,
        [user.id || 0]
      );
      accessibleDeptNames = rows.map(r => r.name);
    }
    return res.render('announcements', {
      title: 'Anuncios',
      departments,
      accessibleDeptNames
    });
  } catch (err) {
    console.error('GET /announcements error:', err);
    return res.status(500).render('announcements', {
      title: 'Anuncios',
      departments: [],
      accessibleDeptNames: [],
      error: 'Error al cargar anuncios'
    });
  }
});

module.exports = router;