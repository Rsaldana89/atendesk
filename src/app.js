// src/app.js
const path = require('path');
const express = require('express');
const session = require('express-session');
const dotenv = require('dotenv');
const expressLayouts = require('express-ejs-layouts');
dotenv.config();

const { pool } = require('./db');
const authRoutes         = require('./routes/auth');
const ticketRoutes       = require('./routes/tickets');       // /tickets/*
const attachmentsRoutes  = require('./routes/attachments');   // /attachments/:id/*
const dashboardRoutes    = require('./routes/dashboard');
const { requireAuth }    = require('./middleware/auth');

// Administración
const adminUsersRoutes = require('./routes/admin/users');

const app = express();

// Proxy (Railway, etc.)
if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'partials/layout');

// Middlewares
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: !!process.env.COOKIE_SECURE // ponla en "1" en prod con HTTPS
  }
}));

// Locals para todas las vistas
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.path = req.path;
  next();
});

/* ------------------------- Rutas principales ------------------------- */
app.use('/', authRoutes);
app.use('/dashboard', requireAuth, dashboardRoutes);
app.use('/tickets',   requireAuth, ticketRoutes);

// 👇 Monta adjuntos SIN prefijo y protegido (las rutas dentro ya empiezan con /attachments/…)
app.use(requireAuth, attachmentsRoutes);

/* --------------------------- Administración -------------------------- */
app.get('/admin', requireAuth, (req, res) => {
  return res.render('administracion', { title: 'Administración' });
});
app.use('/admin', adminUsersRoutes);

/* ------------------------------ API mini ----------------------------- */
// GET anuncios
app.get('/api/announcements', requireAuth, async (req, res) => {
  try {
    const depts = (req.query.depts || '')
      .split(',').map(s => s.trim()).filter(Boolean);
    const limit = Math.min(parseInt(req.query.limit || '5', 10) || 5, 100);
    const includeInactive = String(req.query.include_inactive || '') === '1';
    const includeExpired  = String(req.query.include_expired  || '') === '1';

    const whereParts = [];
    const params = [];
    if (!includeInactive) whereParts.push(`a.active = 1`);
    if (!includeExpired)  whereParts.push(`(a.until_date IS NULL OR a.until_date >= CURDATE())`);
    if (depts.length) {
      whereParts.push(`(a.dept = 'ALL' OR a.dept IN (${depts.map(() => '?').join(',')}))`);
      params.push(...depts);
    }
    const where = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

    const [rows] = await pool.query(
      `SELECT a.id, a.dept, a.title, a.body, a.active,
              DATE_FORMAT(a.created_at,'%Y-%m-%d %H:%i') AS created_at,
              DATE_FORMAT(a.until_date,'%Y-%m-%d')       AS until_date
         FROM announcements a
         ${where}
         ORDER BY a.created_at DESC
         LIMIT ?`,
      [...params, limit]
    );

    res.json(rows);
  } catch (e) {
    console.error('GET /api/announcements', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST anuncio
app.post('/api/announcements', requireAuth, async (req, res) => {
  try {
    const user = req.session.user || {};
    const canCreate = ['admin', 'manager'].includes(user.role);
    if (!canCreate) return res.status(403).json({ error: 'No autorizado' });

    const { dept = 'ALL', title, body, until_date = null } = req.body || {};
    if (!title || !body) return res.status(400).json({ error: 'Faltan campos: title y body' });

    await pool.query(
      `INSERT INTO announcements (dept, title, body, until_date, created_by)
       VALUES (?,?,?,?,?)`,
      [dept, title, body, until_date, user.id || 0]
    );

    res.json({ ok: true });
  } catch (e) {
    console.error('POST /api/announcements', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH activar/desactivar
app.patch('/api/announcements/:id', requireAuth, async (req, res) => {
  try {
    const user = req.session.user || {};
    if (!['admin', 'manager'].includes(user.role)) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const id = req.params.id;
    const { active } = req.body || {};
    if (!(active === 0 || active === 1)) {
      return res.status(400).json({ error: 'Valor "active" inválido (0 o 1)' });
    }

    const [result] = await pool.query(`UPDATE announcements SET active=? WHERE id=?`, [active, id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Anuncio no encontrado' });

    res.json({ ok: true });
  } catch (e) {
    console.error('PATCH /api/announcements/:id', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE anuncio
app.delete('/api/announcements/:id', requireAuth, async (req, res) => {
  try {
    const user = req.session.user || {};
    if (!['admin', 'manager'].includes(user.role)) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const id = req.params.id;
    const [result] = await pool.query(`DELETE FROM announcements WHERE id=?`, [id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Anuncio no encontrado' });

    res.json({ ok: true });
  } catch (e) {
    console.error('DELETE /api/announcements/:id', e);
    res.status(500).json({ error: 'Server error' });
  }
});

/* ------------------------------- Home ------------------------------- */
app.get('/', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  return res.redirect('/login');
});

/* ------------------------------- 404 -------------------------------- */
// ¡Siempre lo último!
app.use((req, res) => {
  res.status(404).render('404', { title: 'No encontrado' });
});

const port = process.env.PORT || 3000;

// Prueba rápida de conexión
pool.query('SELECT 1')
  .then(() => console.log('✅ Conexión a MySQL OK'))
  .catch(err => console.error('❌ Error conectando a MySQL:', err.message));

app.listen(port, () => {
  console.log(`CHC HelpDesk minimal corriendo en http://localhost:${port}`);
});
