// src/app.js
const path = require('path');
const express = require('express');
const session = require('express-session');
const dotenv = require('dotenv');
const expressLayouts = require('express-ejs-layouts');
dotenv.config();

const { pool } = require('./db');
const authRoutes        = require('./routes/auth');
const ticketRoutes      = require('./routes/tickets');       // /tickets/*
const attachmentsRoutes = require('./routes/attachments');   // /attachments/:id/*
const dashboardRoutes   = require('./routes/dashboard');
const { requireAuth }   = require('./middleware/auth');

// Página de anuncios (separada de administración de usuarios)
const announcementsRoutes = require('./routes/announcements');

// Administración
const adminUsersRoutes  = require('./routes/admin/users');

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
    secure: !!process.env.COOKIE_SECURE // 1 en prod con HTTPS
  }
}));

// Helper para roles
function requireRole(roles = []) {
  return (req, res, next) => {
    const user = req.session.user;
    if (!user) return res.redirect('/login');
    if (roles.length && !roles.includes(user.role)) {
      // 403 con vista simple
      return res.status(403).render('403', { title: 'No autorizado' });
    }
    next();
  };
}

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

// Sección de anuncios.  Todos los usuarios logueados pueden acceder a esta
// página para consultar comunicados.  Solamente administradores y managers
// pueden publicar o eliminar anuncios dentro de dicha vista.
app.use('/announcements', requireAuth, announcementsRoutes);

// Adjuntos SIN prefijo (internamente comienzan con /attachments/…)
app.use(requireAuth, attachmentsRoutes);

/* --------------------------- Administración -------------------------- */
app.get('/admin', requireAuth, (req, res) => {
  return res.render('administracion', { title: 'Administración' });
});
app.use('/admin', adminUsersRoutes);

/* -------------------- Informes y Estadísticas ------------------------ */
// Router mínimo aquí mismo (si luego lo prefieres, lo movemos a ./routes/reports.js)
const reportsRouter = express.Router();

// Vista principal: carga el listado de departamentos accesibles según el rol
reportsRouter.get('/', async (req, res) => {
  try {
    const user = req.session.user || {};
    let departments = [];

    // Los administradores pueden ver todos los departamentos
    if (user.role === 'admin') {
      const [rows] = await pool.query(
        `SELECT id, name FROM departments ORDER BY name`
      );
      departments = rows;
    } else {
      // Managers sólo ven sus departamentos asignados a través de user_department_access
      const [rows] = await pool.query(
        `SELECT d.id, d.name
           FROM user_department_access uda
           JOIN departments d ON d.id = uda.department_id
          WHERE uda.user_id = ?
          ORDER BY d.name`,
        [user.id || 0]
      );
      departments = rows;
    }

    res.render('reports/index', {
      title: 'Informes y Estadísticas',
      departments,
    });
  } catch (e) {
    console.error('GET /reports error:', e);
    res.status(500).render('reports/index', {
      title: 'Informes y Estadísticas',
      departments: [],
      error: 'Error al cargar departamentos'
    });
  }
});

// API demo de KPIs para que tengas algo que graficar
reportsRouter.get('/api/kpis', async (req, res) => {
  try {
    // Ejemplos sencillos; sustituye por queries reales
    const [[{ total_tickets }]] = await pool.query(`SELECT COUNT(*) AS total_tickets FROM tickets`);
    const [[{ abiertos }]]      = await pool.query(`SELECT COUNT(*) AS abiertos FROM tickets WHERE status='abierto'`);
    const [[{ en_progreso }]]   = await pool.query(`SELECT COUNT(*) AS en_progreso FROM tickets WHERE status='en_progreso'`);
    const [[{ solucionado }]]    = await pool.query(`SELECT COUNT(*) AS solucionado FROM tickets WHERE status='solucionado'`);
    const [[{ cerrado }]]        = await pool.query(`SELECT COUNT(*) AS cerrado FROM tickets WHERE status='cerrado'`);
    const [[{ cancelado }]]      = await pool.query(`SELECT COUNT(*) AS cancelado FROM tickets WHERE status='cancelado'`);

    // Top 5 departamentos por volumen
    const [topDepts] = await pool.query(`
      SELECT d.name AS departamento, COUNT(*) AS tickets
      FROM tickets t
      LEFT JOIN departments d ON d.id = t.department_id
      GROUP BY d.name
      ORDER BY tickets DESC
      LIMIT 5
    `);

    res.json({
      totals: { total_tickets, abiertos, en_progreso, solucionado, cerrado, cancelado },
      topDepts
    });
  } catch (e) {
    console.error('GET /reports/api/kpis', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Estadísticas detalladas con filtros
// Devuelve: totals por estado, tiempo medio de resolución, tiempo medio por departamento, tickets resueltos por usuario y top departamentos
reportsRouter.get('/api/stats', async (req, res) => {
  try {
    const user = req.session.user || {};

    // Parámetros de consulta
    const start      = req.query.start ? String(req.query.start).trim() : '';
    const end        = req.query.end   ? String(req.query.end).trim()   : '';
    // Expecta una lista separada por comas (abierto,en_progreso,solucionado,...)
    const statuses   = (req.query.statuses || '').split(',').map(s => s.trim()).filter(Boolean);
    // Departamentos permitidos (ids como string)
    const deptIds    = (req.query.depts || '').split(',').map(s => s.trim()).filter(Boolean);

    // Determina los departamentos accesibles por el usuario para aplicar filtros de seguridad
    let accessibleDeptIds = [];
    if (user.role === 'admin') {
      const [rows] = await pool.query(`SELECT id FROM departments`);
      accessibleDeptIds = rows.map(r => String(r.id));
    } else {
      const [rows] = await pool.query(
        `SELECT department_id AS id
           FROM user_department_access
          WHERE user_id = ?`,
        [user.id || 0]
      );
      accessibleDeptIds = rows.map(r => String(r.id));
    }

    // Si se especifican depts, filtra por intersección con los accesibles
    const filteredDeptIds = deptIds.length
      ? deptIds.filter(id => accessibleDeptIds.includes(id))
      : accessibleDeptIds;

    // Construye partes de WHERE dinámicas para los diferentes queries
    const whereParts = [];
    const params = [];

    // Fecha de inicio y fin sobre created_at (abertura)
    if (start) {
      whereParts.push('t.opened_at >= ?');
      params.push(`${start} 00:00:00`);
    }
    if (end) {
      whereParts.push('t.opened_at <= ?');
      params.push(`${end} 23:59:59`);
    }
    // Filtro de estados (status)
    if (statuses.length) {
      whereParts.push(`t.status IN (${statuses.map(() => '?').join(',')})`);
      params.push(...statuses);
    }
    // Filtro de departamentos accesibles
    if (filteredDeptIds.length) {
      whereParts.push(`t.department_id IN (${filteredDeptIds.map(() => '?').join(',')})`);
      params.push(...filteredDeptIds);
    }

    const whereClause = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

    // Consulta para totales por estado
    const [totalsRows] = await pool.query(
      `SELECT t.status, COUNT(*) AS total
         FROM tickets t
         ${whereClause}
         GROUP BY t.status`,
      params
    );
    const totals = {};
    for (const row of totalsRows) {
      totals[row.status] = row.total;
    }

    // Promedio de tiempo de resolución (en horas) sobre tickets con solved_at
    const whereResParts = [...whereParts];
    const resParams = [...params];
    // Debemos asegurar que seleccionamos sólo tickets resueltos
    whereResParts.push('t.solved_at IS NOT NULL');
    const whereResClause = `WHERE ${whereResParts.join(' AND ')}`;
    const [[avgRow]] = await pool.query(
      `SELECT AVG(TIMESTAMPDIFF(SECOND, t.opened_at, t.solved_at) / 3600) AS avg_resolution_hours
         FROM tickets t
         ${whereResClause}`,
      resParams
    );
    // Convertir a número y redondear con seguridad (evitar toFixed sobre null o strings)
    let avgResolutionHours = null;
    if (avgRow && avgRow.avg_resolution_hours !== null && avgRow.avg_resolution_hours !== undefined) {
      const rawAvg = Number(avgRow.avg_resolution_hours);
      if (Number.isFinite(rawAvg)) {
        avgResolutionHours = Math.round(rawAvg * 100) / 100;
      } else {
        avgResolutionHours = 0;
      }
    } else {
      avgResolutionHours = null;
    }

    // Promedio de tiempo de resolución por departamento
    const [avgByDeptRows] = await pool.query(
      `SELECT t.department_id, d.name AS department, 
              AVG(TIMESTAMPDIFF(SECOND, t.opened_at, t.solved_at) / 3600) AS avg_hours,
              COUNT(*) AS total
         FROM tickets t
         JOIN departments d ON d.id = t.department_id
         ${whereResClause}
         GROUP BY t.department_id, d.name
         ORDER BY avg_hours DESC`,
      resParams
    );
    const avgResolutionByDept = avgByDeptRows.map(r => {
      // Convertir a número de forma segura
      let hours = null;
      if (r.avg_hours !== null && r.avg_hours !== undefined) {
        const raw = Number(r.avg_hours);
        hours = Number.isFinite(raw) ? Math.round(raw * 100) / 100 : 0;
      }
      return {
        department_id: r.department_id,
        department: r.department || 'Sin depto',
        avg_hours: hours,
        total: r.total
      };
    });

    // Tickets resueltos por usuario
    const [solvedByRows] = await pool.query(
      `SELECT t.solved_by_user_id AS user_id, u.full_name AS user_name, COUNT(*) AS tickets
         FROM tickets t
         LEFT JOIN users u ON u.id = t.solved_by_user_id
         ${whereResClause}
         GROUP BY t.solved_by_user_id, u.full_name
         ORDER BY tickets DESC
         LIMIT 10`,
      resParams
    );
    const solvedByUser = solvedByRows.map(r => ({
      user_id: r.user_id,
      user_name: r.user_name || 'Sin asignar',
      tickets: r.tickets
    }));

    // Top departamentos por volumen (filtrado)
    const [topDeptRows] = await pool.query(
      `SELECT d.name AS department, COUNT(*) AS tickets
         FROM tickets t
         LEFT JOIN departments d ON d.id = t.department_id
         ${whereClause}
         GROUP BY d.name
         ORDER BY tickets DESC
         LIMIT 10`,
      params
    );
    const topDepts = topDeptRows.map(r => ({ department: r.department || 'Sin depto', tickets: r.tickets }));

    // Nuevas estadísticas: frecuencia de creación de tickets por reportante (username)
    // y top de categorías y asuntos.  Se calculan aplicando los mismos filtros
    // de fecha, estados y departamentos que el resto de estadísticas.
    // Reutilizamos la cláusula whereClause construida previamente con
    // whereParts y params.
    let reporters = [];
    let topCategories = [];
    let topSubjects   = [];
    try {
      // Tickets creados por usuario (reportante) - limit 10
      const [reporterRows] = await pool.query(
        `SELECT u.username AS username, COUNT(*) AS tickets
           FROM tickets t
           JOIN users u ON u.id = t.created_by
           ${whereClause}
           GROUP BY u.username
           ORDER BY tickets DESC
           LIMIT 10`,
        params
      );
      reporters = reporterRows.map(r => ({ username: r.username || 'Sin usuario', tickets: r.tickets }));

      // Top categorías
      const [catRows] = await pool.query(
        `SELECT t.category AS category, COUNT(*) AS tickets
           FROM tickets t
           ${whereClause}
           GROUP BY t.category
           ORDER BY tickets DESC
           LIMIT 10`,
        params
      );
      topCategories = catRows.map(r => ({ category: r.category || 'Sin categoría', tickets: r.tickets }));

      // Top asuntos (asunto = subject)
      const [subjRows] = await pool.query(
        `SELECT t.subject AS subject, COUNT(*) AS tickets
           FROM tickets t
           ${whereClause}
           GROUP BY t.subject
           ORDER BY tickets DESC
           LIMIT 10`,
        params
      );
      topSubjects = subjRows.map(r => ({ subject: r.subject || 'Sin asunto', tickets: r.tickets }));
    } catch (subErr) {
      console.error('Error calculando estadísticas de reportantes/categorías/asuntos:', subErr);
    }

    res.json({
      totals,
      avgResolutionHours,
      avgResolutionByDept,
      solvedByUser,
      topDepts,
      reporters,
      topCategories,
      topSubjects
    });
  } catch (e) {
    console.error('GET /reports/api/stats error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// -----------------------------------------------------------------------------
// Reporte de tiempo de atención por ticket
// Devuelve, para cada ticket resuelto dentro de los filtros proporcionados, el
// tiempo transcurrido entre su apertura y su solución.  El tiempo se
// expresa en segundos (diff_seconds) para que el cliente lo convierta a
// horas y minutos según necesite.
reportsRouter.get('/api/attention', async (req, res) => {
  try {
    const user = req.session.user || {};
    // Parámetros de consulta
    const start    = req.query.start ? String(req.query.start).trim() : '';
    const end      = req.query.end   ? String(req.query.end).trim()   : '';
    const statuses = (req.query.statuses || '').split(',').map(s => s.trim()).filter(Boolean);
    const deptIds  = (req.query.depts || '').split(',').map(s => s.trim()).filter(Boolean);

    // Determinar departamentos accesibles por el usuario
    let accessibleDeptIds = [];
    if (user.role === 'admin') {
      const [rows] = await pool.query(`SELECT id FROM departments`);
      accessibleDeptIds = rows.map(r => String(r.id));
    } else {
      const [rows] = await pool.query(
        `SELECT department_id AS id
           FROM user_department_access
          WHERE user_id = ?`,
        [user.id || 0]
      );
      accessibleDeptIds = rows.map(r => String(r.id));
    }
    // Filtra depts por intersección con accesibles
    const filteredDeptIds = deptIds.length
      ? deptIds.filter(id => accessibleDeptIds.includes(id))
      : accessibleDeptIds;

    // Construir cláusula WHERE
    const whereParts = [];
    const params = [];
    // Rango de fechas sobre opened_at
    if (start) {
      whereParts.push('t.opened_at >= ?');
      params.push(`${start} 00:00:00`);
    }
    if (end) {
      whereParts.push('t.opened_at <= ?');
      params.push(`${end} 23:59:59`);
    }
    // Filtrar por estados si se proporcionan
    if (statuses.length) {
      whereParts.push(`t.status IN (${statuses.map(() => '?').join(',')})`);
      params.push(...statuses);
    }
    // Filtrar por departamentos accesibles
    if (filteredDeptIds.length) {
      whereParts.push(`t.department_id IN (${filteredDeptIds.map(() => '?').join(',')})`);
      params.push(...filteredDeptIds);
    }
    // Considerar sólo tickets resueltos (solved_at no nulo)
    whereParts.push('t.solved_at IS NOT NULL');
    const whereClause = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

    const [rows] = await pool.query(
      `SELECT t.id        AS ticket_id,
              t.subject   AS subject,
              d.name      AS department,
              t.opened_at AS opened_at,
              t.solved_at AS solved_at,
              TIMESTAMPDIFF(SECOND, t.opened_at, t.solved_at) AS diff_seconds,
              uc.full_name AS creator_name,
              us.full_name AS solver_name
         FROM tickets t
         JOIN departments d ON d.id = t.department_id
         LEFT JOIN users uc ON uc.id = t.created_by
         LEFT JOIN users us ON us.id = t.solved_by_user_id
         ${whereClause}
         ORDER BY t.opened_at`,
      params
    );
    return res.json({ items: rows || [] });
  } catch (e) {
    console.error('GET /reports/api/attention error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// -----------------------------------------------------------------------------
// Exporta el reporte de tiempo de atención a un archivo XLS (CSV)
// GET /reports/api/attention/export?start=YYYY-MM-DD&end=YYYY-MM-DD&statuses=a,b,c&depts=1,2
reportsRouter.get('/api/attention/export', async (req, res) => {
  try {
    const user = req.session.user || {};
    // Parámetros de consulta
    const start    = req.query.start ? String(req.query.start).trim() : '';
    const end      = req.query.end   ? String(req.query.end).trim()   : '';
    const statuses = (req.query.statuses || '').split(',').map(s => s.trim()).filter(Boolean);
    const deptIds  = (req.query.depts || '').split(',').map(s => s.trim()).filter(Boolean);
    // Determinar departamentos accesibles por el usuario
    let accessibleDeptIds = [];
    if (user.role === 'admin') {
      const [rows] = await pool.query(`SELECT id FROM departments`);
      accessibleDeptIds = rows.map(r => String(r.id));
    } else {
      const [rows] = await pool.query(
        `SELECT department_id AS id
           FROM user_department_access
          WHERE user_id = ?`,
        [user.id || 0]
      );
      accessibleDeptIds = rows.map(r => String(r.id));
    }
    const filteredDeptIds = deptIds.length
      ? deptIds.filter(id => accessibleDeptIds.includes(id))
      : accessibleDeptIds;
    // Construir cláusula WHERE
    const whereParts = [];
    const params = [];
    if (start) {
      whereParts.push('t.opened_at >= ?');
      params.push(`${start} 00:00:00`);
    }
    if (end) {
      whereParts.push('t.opened_at <= ?');
      params.push(`${end} 23:59:59`);
    }
    if (statuses.length) {
      whereParts.push(`t.status IN (${statuses.map(() => '?').join(',')})`);
      params.push(...statuses);
    }
    if (filteredDeptIds.length) {
      whereParts.push(`t.department_id IN (${filteredDeptIds.map(() => '?').join(',')})`);
      params.push(...filteredDeptIds);
    }
    whereParts.push('t.solved_at IS NOT NULL');
    const whereClause = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
    // Obtener datos
    const [rows] = await pool.query(
      `SELECT t.id        AS ticket_id,
              d.name      AS department,
              t.subject   AS subject,
              uc.full_name AS creator_name,
              us.full_name AS solver_name,
              t.opened_at AS opened_at,
              t.solved_at AS solved_at,
              TIMESTAMPDIFF(SECOND, t.opened_at, t.solved_at) AS diff_seconds
         FROM tickets t
         JOIN departments d ON d.id = t.department_id
         LEFT JOIN users uc ON uc.id = t.created_by
         LEFT JOIN users us ON us.id = t.solved_by_user_id
         ${whereClause}
         ORDER BY t.opened_at`,
      params
    );
    // Construir CSV usando comas como separador y escapando comillas
    const esc = v => {
      if (v === null || v === undefined) v = '';
      v = String(v).replace(/"/g, '""');
      return '"' + v + '"';
    };
    const lines = [];
    // Cabecera en español
    lines.push([
      'Ticket ID','Departamento','Asunto','Reportante','Solucionado por','Abierto','Solucionado','Tiempo'
    ].map(esc).join(','));
    rows.forEach(r => {
      const openedDate = r.opened_at instanceof Date ? r.opened_at : new Date(r.opened_at);
      const solvedDate = r.solved_at instanceof Date ? r.solved_at : new Date(r.solved_at);
      const openedStr = openedDate.toLocaleString('es-MX');
      const solvedStr = solvedDate.toLocaleString('es-MX');
      const diff  = Number(r.diff_seconds) || 0;
      const hours = Math.floor(diff / 3600);
      const minutes = Math.floor((diff % 3600) / 60);
      const timeStr = `${hours}h ${String(minutes).padStart(2,'0')}m`;
      lines.push([
        r.ticket_id,
        r.department || '',
        r.subject || '',
        r.creator_name || '',
        r.solver_name || '',
        openedStr,
        solvedStr,
        timeStr
      ].map(esc).join(','));
    });
    const csv = '\ufeff' + lines.join('\r\n');
    const fname = `tiempo_atencion_${Date.now()}.xls`;
    res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
    return res.send(csv);
  } catch (e) {
    console.error('GET /reports/api/attention/export error:', e);
    res.status(500).json({ error: 'Error al exportar tiempo de atención' });
  }
});

// -----------------------------------------------------------
// Exporta las estadísticas actuales a un archivo CSV
// GET /reports/api/export?start=YYYY-MM-DD&end=YYYY-MM-DD&statuses=a,b,c&depts=1,2
reportsRouter.get('/api/export', async (req, res) => {
  try {
    const user = req.session.user || {};
    // Ya se aplica requireRole(['admin','manager']) al montar reportsRouter

    // Parámetros de consulta
    const start      = req.query.start ? String(req.query.start).trim() : '';
    const end        = req.query.end   ? String(req.query.end).trim()   : '';
    const statuses   = (req.query.statuses || '').split(',').map(s => s.trim()).filter(Boolean);
    const deptIds    = (req.query.depts || '').split(',').map(s => s.trim()).filter(Boolean);

    // Determina departamentos accesibles por el usuario
    let accessibleDeptIds = [];
    if (user.role === 'admin') {
      const [rows] = await pool.query(`SELECT id FROM departments`);
      accessibleDeptIds = rows.map(r => String(r.id));
    } else {
      const [rows] = await pool.query(
        `SELECT department_id AS id
           FROM user_department_access
          WHERE user_id = ?`,
        [user.id || 0]
      );
      accessibleDeptIds = rows.map(r => String(r.id));
    }

    // Filtra deptIds por accesibles si se especifican
    let filteredDeptIds = [];
    if (deptIds.length) {
      filteredDeptIds = deptIds.filter(id => accessibleDeptIds.includes(id));
    } else {
      filteredDeptIds = accessibleDeptIds;
    }

    // Construir WHERE dinámico igual que en /api/stats
    const whereParts = [];
    const params = [];
    if (start) {
      whereParts.push('t.opened_at >= ?');
      params.push(start + ' 00:00:00');
    }
    if (end) {
      whereParts.push('t.opened_at <= ?');
      params.push(end + ' 23:59:59');
    }
    if (statuses.length) {
      whereParts.push(`t.status IN (${statuses.map(() => '?').join(',')})`);
      params.push(...statuses);
    }
    if (filteredDeptIds.length) {
      whereParts.push(`t.department_id IN (${filteredDeptIds.map(() => '?').join(',')})`);
      params.push(...filteredDeptIds);
    }
    const whereClause = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

    // Totales por estado
    const [totalsRows] = await pool.query(
      `SELECT t.status, COUNT(*) AS total
         FROM tickets t
         ${whereClause}
         GROUP BY t.status`,
      params
    );
    const totals = {};
    for (const row of totalsRows) {
      totals[row.status] = row.total;
    }

    // Promedio de resolución global en horas
    const resWhere = [...whereParts, 't.solved_at IS NOT NULL'];
    const resParams = [...params];
    const whereResClause = resWhere.length ? `WHERE ${resWhere.join(' AND ')}` : '';
    const [[avgRow]] = await pool.query(
      `SELECT AVG(TIMESTAMPDIFF(SECOND, t.opened_at, t.solved_at) / 3600) AS avg_hours
         FROM tickets t
         ${whereResClause}`,
      resParams
    );
    const avgGlobal = avgRow && avgRow.avg_hours !== null ? Number(avgRow.avg_hours) : 0;

    // Promedio por departamento
    const [avgDeptRows] = await pool.query(
      `SELECT t.department_id, d.name AS department,
              AVG(TIMESTAMPDIFF(SECOND, t.opened_at, t.solved_at) / 3600) AS avg_hours,
              COUNT(*) AS solved
         FROM tickets t
         JOIN departments d ON d.id = t.department_id
         ${whereResClause}
         GROUP BY t.department_id, d.name
         ORDER BY avg_hours DESC`,
      resParams
    );

    // Tickets resueltos por usuario
    const [solvedRows] = await pool.query(
      `SELECT t.solved_by_user_id AS user_id, u.full_name AS user_name, COUNT(*) AS tickets
         FROM tickets t
         LEFT JOIN users u ON u.id = t.solved_by_user_id
         ${whereResClause}
         GROUP BY t.solved_by_user_id, u.full_name
         ORDER BY tickets DESC`,
      resParams
    );

    // Top departamentos por volumen
    const [topDeptRows] = await pool.query(
      `SELECT d.name AS department, COUNT(*) AS tickets
         FROM tickets t
         LEFT JOIN departments d ON d.id = t.department_id
         ${whereClause}
         GROUP BY d.name
         ORDER BY tickets DESC`,
      params
    );

    // Generar CSV
    const esc = v => {
      if (v === null || v === undefined) v = '';
      v = String(v).replace(/"/g, '""');
      return `"${v}"`;
    };
    const lines = [];
    const add = cols => lines.push(cols.map(esc).join(','));
    // Metadatos
    const tz = 'America/Mexico_City';
    const now = new Date().toLocaleString('es-MX', { timeZone: tz });
    const roleMapTxt = { admin:'Administrador', manager:'Manager', agent:'Agente', agente:'Agente', user:'Usuario', usuario:'Usuario', system:'Sistema' };
    const who = user.full_name || user.username || '';
    const roleNice = roleMapTxt[(user.role || '').toLowerCase()] || (user.role || '');
    add(['Meta','Reporte','Estadísticas','']);
    add(['Meta','Generado por', who, '']);
    add(['Meta','Rol', roleNice, '']);
    add(['Meta','Fecha/Hora (MX)', now, '']);
    add(['Meta','Rango', (start || '') + ' → ' + (end || ''), '']);
    add(['Meta','Estatus', statuses.length ? statuses.join(', ') : 'Todos', '']);
    // Lista de deptos por nombre
    let deptNice = 'Todos';
    if (deptIds.length) {
      const [deptNames] = await pool.query(
        `SELECT name FROM departments WHERE id IN (${deptIds.map(() => '?').join(',')}) ORDER BY name`,
        deptIds
      );
      deptNice = deptNames.map(r => r.name).join(', ');
    }
    add(['Meta','Departamentos', deptNice, '']);
    lines.push('');

    // Totales
    Object.entries(totals).forEach(([st, val]) => {
      add(['Totales', st, val, '']);
    });
    lines.push('');
    // Promedio global
    const avgGlobalRound = Math.round(avgGlobal * 100) / 100;
    add(['PromedioGlobal','', avgGlobalRound, '']);
    lines.push('');
    // Promedio por departamento
    avgDeptRows.forEach(r => {
      const v = r.avg_hours ? Math.round(Number(r.avg_hours) * 100) / 100 : 0;
      add(['PromedioDepto', r.department || '', v, r.solved]);
    });
    lines.push('');
    // Resueltos por usuario
    solvedRows.forEach(r => {
      add(['ResueltosPorUsuario', r.user_name || 'Sin asignar', r.tickets, '']);
    });
    lines.push('');
    // Top deptos
    topDeptRows.forEach(r => {
      add(['TopDepartamentos', r.department || '', r.tickets, '']);
    });

    // Reportantes (tickets creados por usuario) – se calculan usando el mismo
    // filtro de departamentos, fechas y estados.  Limitamos a los 10 más
    // frecuentes para mantener el reporte manejable.
    try {
      const [reporterRows] = await pool.query(
        `SELECT u.username AS username, COUNT(*) AS tickets
           FROM tickets t
           JOIN users u ON u.id = t.created_by
           ${whereClause}
           GROUP BY u.username
           ORDER BY tickets DESC
           LIMIT 10`,
        params
      );
      reporterRows.forEach(r => {
        add(['Reportantes', r.username || 'Sin usuario', r.tickets, '']);
      });

      // Top categorías
      const [catRows] = await pool.query(
        `SELECT t.category AS category, COUNT(*) AS tickets
           FROM tickets t
           ${whereClause}
           GROUP BY t.category
           ORDER BY tickets DESC
           LIMIT 10`,
        params
      );
        catRows.forEach(r => {
        add(['TopCategorías', r.category || 'Sin categoría', r.tickets, '']);
      });

      // Top asuntos
      const [subjRows] = await pool.query(
        `SELECT t.subject AS subject, COUNT(*) AS tickets
           FROM tickets t
           ${whereClause}
           GROUP BY t.subject
           ORDER BY tickets DESC
           LIMIT 10`,
        params
      );
      subjRows.forEach(r => {
        add(['TopAsuntos', r.subject || 'Sin asunto', r.tickets, '']);
      });
    } catch (errStats) {
      console.error('Error agregando secciones de reportantes/categorías/asuntos al CSV de estadísticas:', errStats);
    }

    // Exportar estadísticas en formato XLS.  Se conserva la estructura de
    // filas separadas por comas y se incluye un BOM UTF-8.  La extensión
    // .xls y el Content-Type adecuado permiten que Excel abra el archivo.
    const csv = '\ufeff' + lines.join('\r\n');
    const fname = `estadisticas_${Date.now()}.xls`;
    res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
    return res.send(csv);
  } catch (e) {
    console.error('GET /reports/api/export error:', e);
    res.status(500).json({ error: 'Error al exportar estadísticas' });
  }
});

// Monta el router protegido por rol (admin/manager)
app.use('/reports', requireAuth, requireRole(['admin','manager']), reportsRouter);

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

    // Formateamos las fechas al estilo día/mes/año para una presentación consistente en la interfaz.
    // created_at incluye hora y minutos; until_date solo la fecha. Utilizamos barras (dd/mm/aaaa) en lugar de guiones.
    const [rows] = await pool.query(
      `SELECT a.id, a.dept, a.title, a.body, a.active,
              DATE_FORMAT(a.created_at,'%d/%m/%Y %H:%i') AS created_at,
              DATE_FORMAT(a.until_date,'%d/%m/%Y')       AS until_date
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
// Crear anuncio
app.post('/api/announcements', requireAuth, async (req, res) => {
  try {
    const user = req.session.user || {};
    // Solo administradores y managers pueden crear anuncios
    if (!['admin', 'manager'].includes(user.role)) {
      return res.status(403).json({ error: 'No autorizado' });
    }
    // Extrae campos del cuerpo
    let { dept = 'ALL', title, body, until_date = null } = req.body || {};
    dept = String(dept || 'ALL').trim();
    title = String(title || '').trim();
    body  = String(body  || '').trim();
    if (!title || !body) {
      return res.status(400).json({ error: 'Faltan campos: title y body' });
    }
    // Los managers solo pueden publicar en sus departamentos asignados y no en general (ALL)
    if (user.role === 'manager') {
      if (dept === 'ALL') {
        return res.status(403).json({ error: 'No autorizado a publicar anuncios generales' });
      }
      try {
        const [rows] = await pool.query(
          `SELECT d.name
             FROM user_department_access uda
             JOIN departments d ON d.id = uda.department_id
            WHERE uda.user_id = ? AND d.is_active = 1`,
          [user.id || 0]
        );
        const accessible = rows.map(r => r.name);
        if (!accessible.includes(dept)) {
          return res.status(403).json({ error: 'No autorizado a publicar en este departamento' });
        }
      } catch (err) {
        console.error('POST /api/announcements (access check)', err);
        return res.status(500).json({ error: 'Server error' });
      }
    }
    // Inserta el anuncio
    await pool.query(
      `INSERT INTO announcements (dept, title, body, until_date, created_by)
       VALUES (?,?,?,?,?)`,
      [dept, title, body, until_date || null, user.id || 0]
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
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: 'ID inválido' });
    // Obtiene el anuncio para verificar permisos
    const [rows] = await pool.query(`SELECT dept FROM announcements WHERE id = ?`, [id]);
    if (!rows.length) return res.status(404).json({ error: 'Anuncio no encontrado' });
    const ann = rows[0];
    // Managers: sólo pueden eliminar anuncios de sus departamentos y no generales
    if (user.role === 'manager') {
      if (ann.dept === 'ALL') {
        return res.status(403).json({ error: 'No autorizado a eliminar anuncios generales' });
      }
      const [accRows] = await pool.query(
        `SELECT d.name
           FROM user_department_access uda
           JOIN departments d ON d.id = uda.department_id
          WHERE uda.user_id = ? AND d.is_active = 1`,
        [user.id || 0]
      );
      const accessible = accRows.map(r => r.name);
      if (!accessible.includes(ann.dept)) {
        return res.status(403).json({ error: 'No autorizado a eliminar este anuncio' });
      }
    }
    // Procede a eliminar
    const [result] = await pool.query(`DELETE FROM announcements WHERE id = ?`, [id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Anuncio no encontrado' });
    res.json({ ok: true });
  } catch (e) {
    console.error('DELETE /api/announcements/:id', e);
    res.status(500).json({ error: 'Server error' });
  }
});

/* ------------------------------------------------------------------ */
/* --------------------------- Comentarios --------------------------- */
/*
  Endpoints de comentarios para anuncios.  Permiten a cualquier usuario
  autenticado dejar comentarios en los anuncios.  Solamente los
  administradores o managers pueden responder a comentarios existentes.
*/

// Obtiene los comentarios de un anuncio
app.get('/api/announcements/:id/comments', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: 'ID inválido' });
    // Verifica que el anuncio exista y esté activo/vigente
    const [[ann]] = await pool.query(
      `SELECT active, until_date
         FROM announcements
        WHERE id = ?`,
      [id]
    );
    if (!ann) return res.status(404).json({ error: 'Anuncio no encontrado' });
    // Si el anuncio está inactivo o expirado, no permitimos comentarios.
    // Para considerar vigente todo el día final (hasta las 23:59:59),
    // calculamos la fecha de expiración agregando 23:59:59 a until_date.
    // Si la fecha actual supera ese momento, el anuncio se considera no vigente.
    if (ann.active === 0) {
      return res.status(404).json({ error: 'Anuncio no vigente' });
    }
    if (ann.until_date) {
      // Construir un objeto Date al final del día de until_date.
      const expiry = new Date(`${ann.until_date}T23:59:59`);
      if (new Date() > expiry) {
        return res.status(404).json({ error: 'Anuncio no vigente' });
      }
    }
    const [rows] = await pool.query(
      `SELECT c.id,
              c.announcement_id,
              c.body,
              c.reply_to_comment_id,
              -- Formateamos created_at al formato dd/mm/aaaa hh:mm
              DATE_FORMAT(c.created_at,'%d/%m/%Y %H:%i') AS created_at,
              u.full_name       AS author,
              u.role            AS author_role
         FROM announcement_comments c
         JOIN users u ON u.id = c.user_id
        WHERE c.announcement_id = ?
        ORDER BY c.created_at ASC`,
      [id]
    );
    res.json(rows);
  } catch (e) {
    console.error('GET /api/announcements/:id/comments', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Crea un comentario para un anuncio
app.post('/api/announcements/:id/comments', requireAuth, async (req, res) => {
  try {
    const user = req.session.user || {};
    const announcementId = parseInt(req.params.id, 10);
    const { body, reply_to_comment_id = null } = req.body || {};
    const commentBody = String(body || '').trim();
    const replyId = reply_to_comment_id ? parseInt(reply_to_comment_id, 10) : null;
    if (!announcementId) return res.status(400).json({ error: 'ID de anuncio inválido' });
    if (!commentBody) return res.status(400).json({ error: 'Falta el cuerpo del comentario' });
    // Verifica que el anuncio exista y esté activo/vigente
    const [[ann]] = await pool.query(
      `SELECT active, until_date
         FROM announcements
        WHERE id = ?`,
      [announcementId]
    );
    if (!ann) return res.status(404).json({ error: 'Anuncio no encontrado' });
    // Si el anuncio está inactivo o expirado, no permitimos comentarios.
    // Igual que en GET, consideramos vigente el día completo hasta las 23:59:59.
    if (ann.active === 0) {
      return res.status(404).json({ error: 'Anuncio no vigente' });
    }
    if (ann.until_date) {
      const expiry = new Date(`${ann.until_date}T23:59:59`);
      if (new Date() > expiry) {
        return res.status(404).json({ error: 'Anuncio no vigente' });
      }
    }
    // Si es respuesta, valida permisos y existencia del comentario padre
    if (replyId) {
      if (!['admin', 'manager'].includes(user.role)) {
        return res.status(403).json({ error: 'No autorizado a responder comentarios' });
      }
      const [[parent]] = await pool.query(
        `SELECT id, announcement_id
           FROM announcement_comments
          WHERE id = ?`,
        [replyId]
      );
      if (!parent || parent.announcement_id !== announcementId) {
        return res.status(404).json({ error: 'Comentario padre no encontrado' });
      }
    }
    // Inserta el comentario
    await pool.query(
      `INSERT INTO announcement_comments (announcement_id, user_id, body, reply_to_comment_id)
       VALUES (?,?,?,?)`,
      [announcementId, user.id || null, commentBody, replyId]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('POST /api/announcements/:id/comments', e);
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
const host = process.env.HOST || '0.0.0.0';

// Prueba rápida de conexión
pool.query('SELECT 1')
  .then(() => console.log('✅ Conexión a MySQL OK'))
  .catch(err => console.error('❌ Error conectando a MySQL:', err.message));

// ---------------------------------------------------------------------------
// Auto-cierre de tickets solucionados
//
// Importamos y ejecutamos la tarea programada que revisa periódicamente los
// tickets con estatus "solucionado" que llevan más de 48 horas en ese estado.
// La frecuencia de ejecución se controla mediante la variable de entorno
// AUTO_CLOSE_FREQUENCY_HOURS.  El módulo se encarga de ejecutar una
// revisión inicial y luego programar la siguiente.
try {
  require('./utils/autoCloseTickets');
  console.log('🔁 Tarea de auto-cierre de tickets cargada');
} catch (err) {
  console.error('⚠️  No se pudo cargar la tarea de auto-cierre de tickets:', err.message);
}

app.listen(port, host, () => {
  const os = require('os');
  const ips = Object.values(os.networkInterfaces())
    .flat()
    .filter(i => i && i.family === 'IPv4' && !i.internal)
    .map(i => i.address);

  console.log('CHC HelpDesk escuchando:');
  console.log(` - Local:  http://localhost:${port}`);
  ips.forEach(ip => console.log(` - Red:    http://${ip}:${port}`));
});

