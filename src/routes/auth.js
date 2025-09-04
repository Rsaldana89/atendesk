const express = require('express');
const router = express.Router();
const { pool } = require('../db');

router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard'); // ← antes /tickets
  res.render('login', { title: 'Iniciar sesión', error: null });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.render('login', { title: 'Iniciar sesión', error: 'Usuario y contraseña requeridos.' });
  }
  try {
    const [rows] = await pool.query(
      "SELECT id, username, full_name, email, role FROM users WHERE username=? AND password_plain=? AND is_active=1 LIMIT 1",
      [username, password]
    );
    if (rows.length === 0) {
      return res.render('login', { title: 'Iniciar sesión', error: 'Credenciales inválidas.' });
    }
    req.session.user = rows[0];
    return res.redirect('/dashboard'); // ← antes /tickets
  } catch (err) {
    console.error(err);
    return res.render('login', { title: 'Iniciar sesión', error: 'Error de servidor. Intenta de nuevo.' });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

module.exports = router;
