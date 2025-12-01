const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Todos los usuarios ven todos los departamentos activos con orden personalizado
async function getDepartmentsForUser() {
  const [rows] = await pool.query(`
    SELECT id, name
    FROM departments
    WHERE is_active = 1
    ORDER BY FIELD(name,
      'Mantenimiento',
      'Sistemas',
      'CEDIS',
      'Compras',
      'Panaderia',
      'Capital Humano',
      'Inventarios',
      'Finanzas',
      'Mercadotecnia'
    )
  `);
  return rows;
}

// GET /dashboard
router.get('/', async (req, res) => {
  const user = req.session.user;
  try {
    const departments = await getDepartmentsForUser();
    res.render('dashboard', {
      title: 'Dashboard',
      departments,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error cargando dashboard');
  }
});

module.exports = router;
