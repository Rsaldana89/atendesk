// src/routes/auth.js
const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// GET /login (vista)
router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  res.render('login', { title: 'Iniciar sesión', error: null });
});

// POST /login (JSON o formulario)
router.post('/login', async (req, res) => {
  const wantsJson = req.is('application/json'); // detecta fetch JSON
  const username = (req.body?.username || '').trim();
  const password = (req.body?.password || '').trim();

  // Validación básica
  if (!username || !password) {
    if (wantsJson) return res.status(400).json({ error: 'missing_fields' });
    return res.render('login', { title: 'Iniciar sesión', error: 'Usuario y contraseña requeridos.' });
  }

  try {
    const [rows] = await pool.query(
      `SELECT id, username, full_name, email, role
         FROM users
        WHERE username=? AND password_plain=? AND is_active=1
        LIMIT 1`,
      [username, password]
    );

    if (rows.length === 0) {
      // Usuario no existe o password incorrecto
      if (wantsJson) return res.status(401).json({ error: 'invalid_credentials' });
      return res.render('login', { title: 'Iniciar sesión', error: 'Credenciales inválidas.' });
    }

    // Autenticado: guardar sesión
    req.session.user = rows[0];

    if (wantsJson) return res.status(200).json({ ok: true });
    return res.redirect('/dashboard');

  } catch (err) {
    console.error('Error en /login:', err);
    if (wantsJson) return res.status(500).json({ error: 'server_error' });
    return res.render('login', { title: 'Iniciar sesión', error: 'Error de servidor. Intenta de nuevo.' });
  }
});

// POST /logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

module.exports = router;
