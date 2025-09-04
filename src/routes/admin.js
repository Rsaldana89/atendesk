const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Middleware para permitir solo admins
function requireAdmin(req, res, next) {
  if (req.session.user && req.session.user.role === 'admin') return next();
  res.redirect('/');
}

router.get('/users', requireAdmin, async (req, res) => {
  const [users] = await pool.query('SELECT id, name, email, role FROM users WHERE role IN ("user", "manager")');
  res.render('admin/users', { title: 'Administración de Usuarios', users });
});
