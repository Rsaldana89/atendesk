// src/routes/tickets.js
const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { buildTicketScope, buildRequestedScope } = require('../lib/ticketScope');
const { canAccessTicket } = require('../lib/ticketAccess');

// Importa definición de estados y helpers para transiciones
const {
  STATES,
  LABELS,
  canTransition,
  nextTimestamps,
  normRole,
  ROLES
} = require('../lib/ticketStatus');

// Notificaciones basadas en reglas definidas en notificaciones.json
const { notifyByConfig } = require('../lib/notifications');

// Adjuntos: deps y config
const multer  = require('multer');
const crypto  = require('crypto');
const { normalizeToJpgWithThumb } = require('../lib/image');

const MAX_FILES = parseInt(process.env.MAX_FILES_PER_TICKET || '2', 10);
const MAX_MB    = parseInt(process.env.MAX_FILE_MB || '5', 10);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_MB * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (['image/jpeg', 'image/png'].includes(file.mimetype)) return cb(null, true);
    return cb(new Error('Solo JPG o PNG'));
  }
});

// ----------------------------- Helpers ----------------------------- //
function computeCategory(subject, depName = '') {
  const s = (subject || '').toLowerCase();
  const d = (depName || '').toUpperCase();
  const rules = [
    [/impresora|printer|toner/, 'Impresión'],
    [/correo|email|outlook/, 'Correo'],
    [/acceso|usuario|contrase(ña|na)|password|login/, 'Accesos'],
    [/sap|retail|sistema|software|licencia/, 'Software'],
    [/internet|red|wifi|switch|router|cable/, 'Red'],
    [/pc|equipo|teclado|mouse|monitor/, 'Hardware'],
    [/compra|pedido|cotizaci[oó]n|proveedor/, 'Compras']
  ];
  for (const [re, cat] of rules) if (re.test(s)) return cat;
  const byDept = { 'SISTEMAS': 'Soporte', 'CEDIS': 'Logística', 'COMPRAS': 'Compras' };
  return byDept[d] || 'General';
}

function sanitizeCategory(raw) {
  if (!raw) return '';
  return String(raw).trim().slice(0, 60);
}

function sanitizePhone(raw) {
  if (!raw) return null;
  const v = String(raw).trim().slice(0, 25);
  return v.length ? v : null;
}
function ensureInt(id) {
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// === Mapeo a los valores que existen en la BD ===
const roleMap = {
  admin:   'admin',
  manager: 'manager',
  agent:   'agente',
  user:    'usuario',
  system:  'system'
};

// ── Helper: ¿puede aceptar este ticket? (en_progreso) ─────────────────────────
async function canAcceptTicket(pool, user, departmentId) {
  const role = (user?.role || '').toLowerCase();
  if (role === 'admin') return true; // admin siempre puede

  if (role === 'manager' || role === 'agent') {
    const [rows] = await pool.query(
      'SELECT 1 FROM user_department_access WHERE user_id=? AND department_id=? LIMIT 1',
      [user.id, departmentId]
    );
    return rows.length > 0;
  }
  return false;
}

// ------------------------------ Listado ------------------------------ //
// GET /tickets  → con búsqueda (q) y ordenamiento (sort/dir) e incluye categoría
// -----------------------------------------------------------------------------
// Listado de tickets por atender (o redirección a solicitados para usuarios)
// GET /tickets  → listado principal.  Para roles admin/manager/agent se
// muestra "Tickets por atender"; para rol user se redirige a /tickets/requested.
router.get('/', async (req, res) => {
  const user = req.session.user;
  try {
    // Si el actor es un usuario final, redirigir a su listado de tickets solicitados
    const normalizedRole = (user?.role || '').toLowerCase();
    if (normalizedRole === 'user' || normalizedRole === 'usuario') {
      return res.redirect('/tickets/requested');
    }

    // Visibilidad por rol / alcance para tickets por atender
    const { whereSql, params } = await buildTicketScope(pool, user);

    // Controles de UI
    const q      = String(req.query.q || '').trim();
    const sort   = String(req.query.sort || 'opened_at').toLowerCase();
    const dirStr = String(req.query.dir || 'desc').toLowerCase();
    const status = String(req.query.status || '').trim();
    const department = String(req.query.department || '').trim();
    // Filtros de fechas: permite seleccionar un rango de fechas de apertura.  Si
    // no se proporcionan en la query, se establece por defecto el rango de los
    // últimos 30 días (incluyendo la fecha actual) tal y como ocurre en la
    // pantalla de estadísticas.  Se aceptan tanto `start_date`/`end_date` como
    // `start`/`end` por compatibilidad con rutas de exportación existentes.
    const now = new Date();
    // Fin del rango por defecto: hoy
    const defaultEndDate = now.toISOString().slice(0, 10);
    // Inicio del rango por defecto: 29 días antes (30 días en total)
    const prev = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
    const defaultStartDate = prev.toISOString().slice(0, 10);
    const startDate = String(req.query.start_date || req.query.start || defaultStartDate).trim();
    const endDate   = String(req.query.end_date   || req.query.end   || defaultEndDate).trim();

    // Whitelist de columnas para ORDER BY
    const orderMap = {
      id: 't.id',
      subject: 't.subject',
      categoria: 't.category',
      category: 't.category',
      department: 'd.name',
      departamento: 'd.name',
      status: 't.status',
      opened_at: 't.opened_at',
      abierto: 't.opened_at',
      reporter: 'u.full_name',
      reportante: 'u.full_name',
      solved_at: 't.solved_at',
      solucionado: 't.solved_at'
    };
    const orderBy   = orderMap[sort] || 't.opened_at';
    const direction = dirStr === 'asc' ? 'ASC' : 'DESC';

    // Construir cláusulas WHERE
    const whereParts = [`(${whereSql})`];
    const allParams = [...params];

    if (q) {
      const like = `%${q}%`;
      whereParts.push(`(
        t.id = ? OR
        t.subject LIKE ? OR
        t.category LIKE ? OR
        d.name LIKE ? OR
        t.status LIKE ? OR
        u.full_name LIKE ?
      )`);
      allParams.push(Number(q) || 0, like, like, like, like, like);
    }

    if (status) {
      whereParts.push('t.status = ?');
      allParams.push(status);
    }

    if (department) {
      // Permite id o nombre
      whereParts.push('(d.id = ? OR d.name = ?)');
      allParams.push(Number(department) || 0, department);
    }

    // Filtrar por fecha de apertura.  Se utiliza DATE(t.opened_at) para ignorar
    // la hora y comparar únicamente la fecha.  Si los parámetros no existen
    // (porque se usan los valores por defecto), de todas formas se aplicarán
    // para limitar la consulta al rango seleccionado.
    if (startDate) {
      whereParts.push('DATE(t.opened_at) >= ?');
      allParams.push(startDate);
    }
    if (endDate) {
      whereParts.push('DATE(t.opened_at) <= ?');
      allParams.push(endDate);
    }

    const sql = `
      SELECT
        t.id,
        t.subject,
        t.category AS categoria,
        d.name     AS department,
        t.status,
        t.opened_at,
        t.solved_at,
        u.full_name AS created_by_name,
        a.full_name AS assigned_to_name
      FROM tickets t
      JOIN departments d ON d.id = t.department_id
      JOIN users u       ON u.id = t.created_by
      LEFT JOIN users a  ON a.id = t.assigned_to
      WHERE ${whereParts.join(' AND ')}
      ORDER BY ${orderBy} ${direction}
      LIMIT 500
    `;

    const [rows] = await pool.query(sql, allParams);

    // Helpers para la vista (conservar/restaurar querystring)
    const qs = (obj = {}) => {
      const current = new URLSearchParams(req.query);
      Object.entries(obj).forEach(([k, v]) => {
        if (v === undefined || v === null || v === '') current.delete(k);
        else current.set(k, v);
      });
      return current.toString();
    };
    const dirFor = key =>
      ((sort === key && direction === 'ASC') ? 'desc' : 'asc');

    res.render('tickets', {
      title: 'Tickets por atender',
      listTitle: 'Tickets por atender',
      listType: 'attend',
      tickets: rows,
      q,
      sort,
      dir: direction.toLowerCase(),
      qs,
      dirFor,
      // Role normalizado para la vista (ej. admin, manager, agente, usuario)
      userRole: (req.session.user?.role || '').toLowerCase(),
      // Propaga las fechas seleccionadas a la vista para prellenar los
      // campos de filtro en el formulario
      startDate,
      endDate
    });
  } catch (err) {
    console.error('GET /tickets', err);
    res.status(500).send('Error listando tickets');
  }
});

// -----------------------------------------------------------------------------
// Listado de tickets solicitados por el usuario
// GET /tickets/requested → muestra únicamente los tickets creados por el actor
router.get('/requested', async (req, res) => {
  const user = req.session.user;
  try {
    // Determinar alcance: sólo tickets creados por el usuario
    const { whereSql, params } = buildRequestedScope(user);

    // Controles de UI
    const q      = String(req.query.q || '').trim();
    const sort   = String(req.query.sort || 'opened_at').toLowerCase();
    const dirStr = String(req.query.dir || 'desc').toLowerCase();
    const status = String(req.query.status || '').trim();
    const department = String(req.query.department || '').trim();
    // Filtros de fechas: igual que en el listado por atender.  Si no se provee
    // se utilizará por defecto el rango de los últimos 30 días (incluyendo
    // la fecha actual) para mostrar resultados recientes.  Se aceptan
    // `start_date`/`end_date` o `start`/`end` como aliases.
    const now = new Date();
    const defaultEndDate = now.toISOString().slice(0, 10);
    const prev = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
    const defaultStartDate = prev.toISOString().slice(0, 10);
    const startDate = String(req.query.start_date || req.query.start || defaultStartDate).trim();
    const endDate   = String(req.query.end_date   || req.query.end   || defaultEndDate).trim();

    // Whitelist de columnas para ORDER BY
    const orderMap = {
      id: 't.id',
      subject: 't.subject',
      categoria: 't.category',
      category: 't.category',
      department: 'd.name',
      departamento: 'd.name',
      status: 't.status',
      opened_at: 't.opened_at',
      abierto: 't.opened_at',
      reporter: 'u.full_name',
      reportante: 'u.full_name',
      solved_at: 't.solved_at',
      solucionado: 't.solved_at'
    };
    const orderBy   = orderMap[sort] || 't.opened_at';
    const direction = dirStr === 'asc' ? 'ASC' : 'DESC';

    // Construir cláusulas WHERE
    const whereParts = [`(${whereSql})`];
    const allParams = [...params];

    if (q) {
      const like = `%${q}%`;
      whereParts.push(`(
        t.id = ? OR
        t.subject LIKE ? OR
        t.category LIKE ? OR
        d.name LIKE ? OR
        t.status LIKE ? OR
        u.full_name LIKE ?
      )`);
      allParams.push(Number(q) || 0, like, like, like, like, like);
    }

    if (status) {
      whereParts.push('t.status = ?');
      allParams.push(status);
    }

    if (department) {
      whereParts.push('(d.id = ? OR d.name = ?)');
      allParams.push(Number(department) || 0, department);
    }

    // Filtrar por rango de fechas de apertura
    if (startDate) {
      whereParts.push('DATE(t.opened_at) >= ?');
      allParams.push(startDate);
    }
    if (endDate) {
      whereParts.push('DATE(t.opened_at) <= ?');
      allParams.push(endDate);
    }

    const sql = `
      SELECT
        t.id,
        t.subject,
        t.category AS categoria,
        d.name     AS department,
        t.status,
        t.opened_at,
        t.solved_at,
        u.full_name AS created_by_name,
        a.full_name AS assigned_to_name
      FROM tickets t
      JOIN departments d ON d.id = t.department_id
      JOIN users u       ON u.id = t.created_by
      LEFT JOIN users a  ON a.id = t.assigned_to
      WHERE ${whereParts.join(' AND ')}
      ORDER BY ${orderBy} ${direction}
      LIMIT 500
    `;

    const [rows] = await pool.query(sql, allParams);

    // Helpers para la vista (conservar/restaurar querystring)
    const qs = (obj = {}) => {
      const current = new URLSearchParams(req.query);
      Object.entries(obj).forEach(([k, v]) => {
        if (v === undefined || v === null || v === '') current.delete(k);
        else current.set(k, v);
      });
      return current.toString();
    };
    const dirFor = key =>
      ((sort === key && direction === 'ASC') ? 'desc' : 'asc');

    res.render('tickets', {
      title: 'Tickets solicitados',
      listTitle: 'Tickets solicitados',
      listType: 'requested',
      tickets: rows,
      q,
      sort,
      dir: direction.toLowerCase(),
      qs,
      dirFor,
      userRole: (req.session.user?.role || '').toLowerCase(),
      startDate,
      endDate
    });
  } catch (err) {
    console.error('GET /tickets/requested', err);
    res.status(500).send('Error listando tickets solicitados');
  }
});

// ------------------------------ Nuevo ------------------------------ //
// GET /tickets/new
router.get('/new', async (req, res) => {
  try {
    const [depts] = await pool.query(
      'SELECT id, name FROM departments WHERE is_active=1 ORDER BY name'
    );
    res.render('ticket_new', {
      title: 'Nuevo Ticket',
      departments: depts,
      selectedDepartment: req.query.department || '',
      subject: '', description: '',
      creatorName: '', contactPhone: '',
      category: '',         // ← permite repoblar el hidden en la vista
      error: null
    });
  } catch (err) {
    console.error('GET /tickets/new', err);
    res.status(500).send('Error cargando formulario');
  }
});

// POST /tickets/new — crea ticket + (0..2) adjuntos
router.post('/new', async (req, res) => {
  // Procesar subida de archivos (hasta MAX_FILES) y capturar errores de Multer
  try {
    await new Promise((resolve, reject) => {
      upload.array('evidencias', MAX_FILES)(req, res, function(err) {
        if (err) return reject(err);
        resolve();
      });
    });
  } catch (err) {
    // Si excede el número de archivos, tipo o peso, Multer arroja un error
    if (err instanceof multer.MulterError) {
      console.error('Error de carga en ticket nuevo:', err);
      // Renderiza el formulario nuevamente con el mensaje de error
      try {
        const [depts] = await pool.query('SELECT id, name FROM departments WHERE is_active=1 ORDER BY name');
        return res.status(400).render('ticket_new', {
          title: 'Nuevo Ticket', departments: depts,
          selectedDepartment: req.body?.department_id || '',
          subject: req.body?.subject || '',
          description: req.body?.description || '',
          creatorName: req.body?.creator_name || '',
          contactPhone: req.body?.contact_phone || '',
          category: req.body?.category || '',
          error: err.message || 'Error al subir evidencia'
        });
      } catch (deptsErr) {
        console.error('Error cargando departamentos tras fallo de carga', deptsErr);
        return res.status(400).send(err.message || 'Error al subir evidencia');
      }
    }
    console.error('Error inesperado durante carga de evidencias', err);
    return res.status(500).send('Error al subir evidencias');
  }
  try {
    const userId = req.session.user?.id;
    if (!userId) return res.status(401).send('No autenticado');

    // ✅ lee también category del body
    const {
      subject,
      description,
      department_id,
      creator_name,
      contact_phone,
      category
    } = req.body || {};
    const depId = ensureInt(department_id);

    // Validaciones básicas (el front ya previene pero aquí no estorban)
    const errors = [];
    if (!creator_name || creator_name.trim().length < 3) errors.push('El nombre es obligatorio (mín. 3).');
    if (!depId) errors.push('Selecciona un departamento válido.');
    if (!subject || subject.trim().length < 5) errors.push('El asunto es obligatorio (mín. 5).');
    if (!description || description.trim().length < 10) errors.push('La descripción es obligatoria (mín. 10).');

    if (errors.length) {
      const [depts] = await pool.query('SELECT id, name FROM departments WHERE is_active=1 ORDER BY name');
      return res.status(400).render('ticket_new', {
        title: 'Nuevo Ticket', departments: depts,
        selectedDepartment: depId || '',
        subject, description,
        creatorName: creator_name || '',
        contactPhone: contact_phone || '',
        category: category || '',     // ← repoblar la categoría elegida
        error: errors.join(' ')
      });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [[destDept]] = await conn.query('SELECT name FROM departments WHERE id=?', [depId]);

      // ✅ Prioriza la categoría elegida; si viene vacía, usa fallback
      const finalCategory =
        sanitizeCategory(category) || computeCategory(subject, destDept?.name || '');

      const phone = sanitizePhone(contact_phone);

      // Inserta ticket
      const [ins] = await conn.query(
        `INSERT INTO tickets
          (subject, description, department_id, category,
           creator_name, contact_phone, created_by, assigned_to, status,
           opened_at, updated_at)
         VALUES (?,?,?,?,?,?,
                 ?, NULL, 'abierto',
                 NOW(), NOW())`,
        [subject.trim(), description.trim(), depId, finalCategory,
         creator_name.trim(), phone, userId]
      );
      const ticketId = ins.insertId;

      // Adjuntos (0..2)
      if (req.files?.length) {
        let seq = 1;
        for (const f of req.files) {
          if (seq > 2) break;
          try {
            const img = await normalizeToJpgWithThumb(f.buffer); // JPG + thumb
            const checksum = crypto.createHash('sha256').update(img.data).digest('hex');

            const [dup] = await conn.query(
              'SELECT id FROM ticket_attachments WHERE ticket_id=? AND checksum_sha256=?',
              [ticketId, checksum]
            );
            if (dup.length) continue;

            await conn.query(
              `INSERT INTO ticket_attachments
                 (ticket_id, seq, original_name, mime_type, data, thumb,
                  size_bytes, width, height, checksum_sha256, uploaded_by)
               VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
              [ticketId, seq, f.originalname || null, 'image/jpeg',
               img.data, img.thumb, img.size, img.width, img.height, checksum, userId]
            );
            seq++;
          } catch (imgErr) {
            console.error('Error procesando imagen:', f.originalname, imgErr);
          }
        }
      }

      await conn.commit();

      // Notificar a los usuarios según reglas de notificaciones.
      try {
      await notifyByConfig(pool, {
          id: ticketId,
          department_id: depId,
          department_name: destDept?.name || '',
          category: finalCategory,
          subject: subject.trim(),
          creator_name: creator_name.trim(),
          // Incluye también el nombre de usuario del reportante para ser
          // mostrado en las notificaciones de correo
          creator_username: req.session.user?.username || '',
          // Pasar el teléfono de contacto al sistema de notificaciones para
          // incluirlo en el correo si está disponible
          contact_phone: phone || null
        }, 'created', { skipUserIds: [userId] });
      } catch (notifyErr) {
        console.error('Error notificando ticket:', notifyErr);
      }

      console.log('Ticket creado', { ticketId, files: req.files?.length || 0 });
      // Redirección según rol: solo los administradores van a la vista de atención
      // Los managers, agentes y usuarios finales se redirigen a la vista de solicitados
      const roleRaw = req.session.user?.role || '';
      const normalizedRoleNew = roleRaw.toLowerCase();
      const isAdmin = normalizedRoleNew === 'admin';
      const destUrl = isAdmin ? `/tickets/${ticketId}` : `/tickets/requested/${ticketId}`;
      return res.redirect(destUrl);
    } catch (txnErr) {
      await conn.rollback();
      throw txnErr;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('POST /tickets/new', err);
    try {
      const [depts] = await pool.query('SELECT id, name FROM departments WHERE is_active=1 ORDER BY name');
      return res.status(500).render('ticket_new', {
        title: 'Nuevo Ticket', departments: depts,
        selectedDepartment: req.body?.department_id || '',
        subject: req.body?.subject || '',
        description: req.body?.description || '',
        creatorName: req.body?.creator_name || '',
        contactPhone: req.body?.contact_phone || '',
        category: req.body?.category || '',   // ← repoblar en fallback
        error: 'Error al crear ticket'
      });
    } catch (e2) {
      console.error('Render fallback /tickets/new', e2);
      return res.status(500).send('Error al crear ticket');
    }
  }
});

// ------------------------------ Detalle ------------------------------ //
// GET /tickets/:id
router.get('/:id(\\d+)', async (req, res) => {
  try {
    const id = ensureInt(req.params.id);
    if (!id) return res.status(400).send('ID inválido');

    const allowed = await canAccessTicket(pool, req.session.user, id);
    if (!allowed) return res.status(403).send('No autorizado');

    // Carga datos del ticket, incluyendo marcas de tiempo adicionales
    const [[row]] = await pool.query(
      `SELECT t.id, t.subject, t.description,
              t.department_id, d.name AS department,
              t.category,
              t.creator_name, t.contact_phone,
              t.status, t.comments,
              t.created_by, u.full_name AS created_by_name,
              t.assigned_to, a.full_name AS assigned_to_name,
              t.opened_at, t.updated_at, t.closed_at,
              t.first_response_at, t.solved_at, t.canceled_at, t.last_state_change_at, t.reopened_count
         FROM tickets t
         JOIN departments d ON d.id = t.department_id
         JOIN users u       ON u.id = t.created_by
         LEFT JOIN users a  ON a.id = t.assigned_to
        WHERE t.id = ?`,
      [id]
    );
    if (!row) return res.status(404).send('Ticket no encontrado');

    // Adjuntos
    const [attachments] = await pool.query(
      'SELECT id, seq FROM ticket_attachments WHERE ticket_id=? ORDER BY seq ASC, id ASC',
      [id]
    );

    // Historial de transiciones con el nombre del actor (si existe)
    const [history] = await pool.query(
      `SELECT tt.actor_id, tt.actor_role, tt.from_status, tt.to_status, tt.note, tt.created_at,
              u.full_name AS actor_name
         FROM ticket_transitions tt
         LEFT JOIN users u ON u.id = tt.actor_id
        WHERE tt.ticket_id = ?
        ORDER BY tt.created_at ASC`,
      [id]
    );

    // Rol del usuario actual (normalizado)
    const userRole = normRole(req.session.user?.role || '');

    // Si es admin o manager, arma lista de asignables del mismo depto.
    // Para managers: sólo deben poder asignar a sí mismos o a agentes del
    // departamento (no a otros managers).  Para admin mantenemos el
    // comportamiento actual, permitiendo ver tanto agentes como managers.
    let assignables = [];
    try {
      if (userRole === ROLES.ADMIN) {
        const [rows2] = await pool.query(
          `SELECT u.id, u.full_name, u.role
             FROM users u
             JOIN user_department_access uda ON uda.user_id = u.id
            WHERE u.role IN ('agent','manager') AND uda.department_id = ?
            ORDER BY u.full_name`,
          [row.department_id]
        );
        assignables = rows2 || [];
      } else if (userRole === ROLES.MANAGER) {
        // Selecciona agentes del departamento o el propio manager (por su id).
        const currentUserId = req.session.user?.id || 0;
        const [rows2] = await pool.query(
          `SELECT u.id, u.full_name, u.role
             FROM users u
             JOIN user_department_access uda ON uda.user_id = u.id
            WHERE (u.role IN ('agent','agente') OR u.id = ?) AND uda.department_id = ?
            ORDER BY u.full_name`,
          [currentUserId, row.department_id]
        );
        assignables = rows2 || [];
      }
    } catch (e) {
      console.error('Error cargando usuarios asignables', e);
      assignables = [];
    }

    // Permiso para ACEPTAR (pasar a en_progreso)
    const canAccept = await canAcceptTicket(pool, req.session.user, row.department_id);

    const viewerId   = req.session.user?.id || null;
    const viewerRole = req.session.user?.role || '';
    const canClose = canTransition(
      row.status,
      STATES.CERRADO,
      viewerRole,
      { ticket: row, userId: viewerId }
    );

    res.render('ticket_show', {
      title: `Ticket #${row.id}`,
      t: row,
      attachments,
      history,
      statusLabels: LABELS,
      userRole,
      userId: req.session.user?.id || null,
      assignables,
      canClose,
      canAccept, // ← para la vista (ocultar botón Aceptar)
      viewMode: 'attend',
      roleMap
    });
  } catch (err) {
    console.error('GET /tickets/:id', err);
    res.status(500).send('Error mostrando ticket');
  }
});

// ------------------------ Transición de estado ------------------------ //
// POST /tickets/:id/transition — cambia el estado del ticket
router.post('/:id/transition', async (req, res) => {
  try {
    const ticketId = ensureInt(req.params.id);
    if (!ticketId) return res.status(400).json({ ok: false, msg: 'ID inválido' });

    const user = req.session.user || {};
    // Cargar estado y asignación actual (+ department_id para validar aceptación)
    const [[ticket]] = await pool.query(
      'SELECT id, status, assigned_to, created_by, department_id FROM tickets WHERE id=?',
      [ticketId]
    );
    if (!ticket) return res.status(404).json({ ok: false, msg: 'Ticket no encontrado' });

    // Verificar acceso
    const allowed = await canAccessTicket(pool, user, ticketId);
    if (!allowed) return res.status(403).json({ ok: false, msg: 'No autorizado' });

    // Nuevo estado (normalizado a minúsculas)
    const toRaw = req.body?.to_status || '';
    const to    = String(toRaw).toLowerCase();
    const note  = (req.body?.note || '').slice(0, 500);

    // Validar transición según rol/reglas
    if (!canTransition(ticket.status, to, user.role, { ticket, userId: user.id })) {
      return res.status(400).json({ ok: false, msg: 'Transición no permitida' });
    }

    // ⛔ Regla de negocio: para pasar a EN_PROGRESO (aceptar),
    // el actor debe tener acceso al departamento del ticket (o ser admin)
    if (to === STATES.EN_PROGRESO) {
      const okAccept = await canAcceptTicket(pool, user, ticket.department_id);
      if (!okAccept) {
        return res.status(403).json({ ok: false, msg: 'No puedes aceptar tickets de un departamento que no es tuyo.' });
      }
    }

    // Verificación adicional para liberar: sólo quien atiende, manager o admin
    if (ticket.status === STATES.EN_PROGRESO && to === STATES.ABIERTO) {
      const normalizedRole = normRole(user.role);
      const isManagerOrAdmin = normalizedRole === ROLES.ADMIN || normalizedRole === ROLES.MANAGER;
      const isAssignedAgent  = normalizedRole === ROLES.AGENT && ticket.assigned_to === user.id;
      if (!(isManagerOrAdmin || isAssignedAgent)) {
        return res.status(403).json({ ok: false, msg: 'Sólo quien atiende o un administrador/manager puede liberar este ticket' });
      }
    }

    // Calcular marcas de tiempo
    const now    = new Date();
    const stamps = nextTimestamps(ticket.status, to, now, user.id);

    // Ejecuta actualización y registra transición
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Construye UPDATE dinámico
      let sql = 'UPDATE tickets SET status=?, last_state_change_at=?';
      const params = [to, now];

      if (stamps.first_response_at) {
        sql += ', first_response_at=?';
        params.push(stamps.first_response_at);
      }
      if (stamps.solved_at) {
        sql += ', solved_at=?, solved_by_user_id=?';
        params.push(stamps.solved_at, stamps.solved_by_user_id);
      }
      if (stamps.closed_at) {
        sql += ', closed_at=?, closed_by_user_id=?';
        params.push(stamps.closed_at, stamps.closed_by_user_id);
      }
      if (stamps.canceled_at) {
        sql += ', canceled_at=?, canceled_by_user_id=?';
        params.push(stamps.canceled_at, stamps.canceled_by_user_id);
      }
      if (to === STATES.REABIERTO) {
        sql += ', reopened_count = reopened_count + 1';
      }

      // Asignación al pasar a EN_PROGRESO
      if (to === STATES.EN_PROGRESO) {
        const actorRoleTmp = normRole(user.role);
        if (!ticket.assigned_to || actorRoleTmp === ROLES.AGENT) {
          sql += ', assigned_to=?';
          params.push(user.id);
        }
      }
      // Liberar asignación al volver a ABIERTO
      if (to === STATES.ABIERTO) {
        sql += ', assigned_to=NULL';
      }

      sql += ' WHERE id=?';
      params.push(ticketId);

      await conn.query(sql, params);

      // Historial
      const actorId   = user.id || null;
      const normalizedRole = user ? normRole(user.role) : ROLES.SYSTEM;
      const actorRole = roleMap[normalizedRole] || normalizedRole;
      const ip        = req.ip || null;
      const ua        = (req.headers['user-agent'] || '').slice(0, 255);
      await conn.query(
        `INSERT INTO ticket_transitions
           (ticket_id, actor_id, actor_role, from_status, to_status, note, ip_address, user_agent)
         VALUES (?,?,?,?,?,?,?,?)`,
        [ticketId, actorId, actorRole, ticket.status, to, note || null, ip, ua]
      );

      await conn.commit();
      res.json({ ok: true, to_status: to, label: LABELS[to] });

      // Post: notificar si fue cerrado
      try {
        if (to === STATES.CERRADO) {
          const [[trow]] = await pool.query(
            `SELECT t.id, t.department_id, d.name AS department_name, t.category,
                    t.subject, u.full_name AS creator_name, u.username AS creator_username,
                    t.contact_phone
               FROM tickets t
               JOIN departments d ON d.id = t.department_id
               JOIN users u ON u.id = t.created_by
              WHERE t.id = ?`,
            [ticketId]
          );
          if (trow) {
            await notifyByConfig(pool, {
              id: trow.id,
              department_id: trow.department_id,
              department_name: trow.department_name,
              category: trow.category,
              subject: trow.subject,
              creator_name: trow.creator_name,
              creator_username: trow.creator_username,
              // Pasar el teléfono de contacto para que se incluya como enlace en el correo
              contact_phone: trow.contact_phone || null
            }, 'closed', { skipUserIds: [user.id] });
          }
        }
      } catch (notifyErr) {
        console.error('Error notificando cierre de ticket:', notifyErr);
      }
    } catch (e) {
      await conn.rollback();
      console.error('POST /tickets/:id/transition error:', e);
      res.status(500).json({ ok: false, msg: 'Error al cambiar estado' });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error('POST /tickets/:id/transition fatal', e);
    res.status(500).json({ ok: false, msg: 'Error interno' });
  }
});

// -----------------------------------------------------------------------------
// Exporta los detalles de un ticket y su historial a un archivo CSV
// GET /tickets/:id/export
router.get('/:id/export', async (req, res) => {
  try {
    const id = ensureInt(req.params.id);
    if (!id) return res.status(400).send('ID inválido');

    const user = req.session.user || {};
    const userRole = (user.role || '').toLowerCase();
    // Sólo admin, manager o agente pueden exportar
    if (!['admin','manager','agent','agente'].includes(userRole)) {
      return res.status(403).send('No autorizado');
    }

    // Verificar acceso al ticket
    const allowed = await canAccessTicket(pool, user, id);
    if (!allowed) return res.status(403).send('No autorizado');

    // Consultar detalles del ticket
    const [[ticket]] = await pool.query(
      `SELECT t.id, t.subject, t.description,
              t.department_id, d.name AS department,
              t.category, t.creator_name, t.contact_phone,
              t.status, t.comments,
              t.created_by, u.full_name AS created_by_name,
              t.assigned_to, a.full_name AS assigned_to_name,
              t.opened_at, t.updated_at, t.closed_at,
              t.first_response_at, t.solved_at, t.canceled_at, t.last_state_change_at, t.reopened_count
         FROM tickets t
         JOIN departments d ON d.id = t.department_id
         JOIN users u       ON u.id = t.created_by
         LEFT JOIN users a  ON a.id = t.assigned_to
        WHERE t.id = ?`,
      [id]
    );
    if (!ticket) return res.status(404).send('Ticket no encontrado');

    // Historial de transiciones con nombre del actor
    const [history] = await pool.query(
      `SELECT tt.actor_id, tt.actor_role, tt.from_status, tt.to_status, tt.note, tt.created_at,
              u.full_name AS actor_name
         FROM ticket_transitions tt
         LEFT JOIN users u ON u.id = tt.actor_id
        WHERE tt.ticket_id = ?
        ORDER BY tt.created_at ASC`,
      [id]
    );

    // Preparar CSV
    const esc = v => {
      if (v === null || v === undefined) v = '';
      v = String(v).replace(/"/g, '""');
      return `"${v}"`;
    };
    const rows = [];
    const add = cols => rows.push(cols.map(esc).join(','));

    // Metadatos
    const tz = 'America/Mexico_City';
    const when = new Date().toLocaleString('es-MX', { timeZone: tz });
    const roleMapTxt = { admin:'Administrador', manager:'Manager', agent:'Agente', agente:'Agente', user:'Usuario', usuario:'Usuario', system:'Sistema' };
    const who = user.full_name || user.username || '';
    const roleNice = roleMapTxt[userRole] || userRole;
    add(['Meta','Reporte','Detalles de ticket','']);
    add(['Meta','Generado por', who, '']);
    add(['Meta','Rol', roleNice, '']);
    add(['Meta','Fecha/Hora (MX)', when, '']);
    add(['Meta','Ticket ID', ticket.id, '']);
    add(['Meta','Estatus', ticket.status, '']);
    add(['Meta','Departamento', ticket.department, '']);
    rows.push('');

    // Detalles del ticket
    add(['Ticket','Asunto', ticket.subject, '']);
    add(['Ticket','Categoría', ticket.category, '']);
    add(['Ticket','Departamento', ticket.department, '']);
    add(['Ticket','Reportante', ticket.creator_name, '']);
    add(['Ticket','Teléfono', ticket.contact_phone || '', '']);
    add(['Ticket','Asignado a', ticket.assigned_to_name || '', '']);
    add(['Ticket','Estatus', ticket.status, '']);
    add(['Ticket','Abierto', ticket.opened_at, '']);
    if (ticket.updated_at) add(['Ticket','Actualizado', ticket.updated_at, '']);
    if (ticket.closed_at) add(['Ticket','Cerrado', ticket.closed_at, '']);
    if (ticket.solved_at) add(['Ticket','Solucionado', ticket.solved_at, '']);
    add(['Ticket','Descripción', ticket.description, '']);
    rows.push('');

    // Historial
    if (history && history.length) {
      // Cabecera de historial
      add(['Historial','Actor','Estado de → a','Fecha / Nota']);
      history.forEach(h => {
        const actor = h.actor_name ? `${h.actor_role || ''} ${h.actor_name}`.trim() : (h.actor_role || '');
        const transition = `${h.from_status || ''} → ${h.to_status || ''}`;
        const dateStr = h.created_at ? new Date(h.created_at).toLocaleString('es-MX', { timeZone: tz }) : '';
        const note = h.note || '';
        add(['Historial', actor, transition, `${dateStr}${note ? ' - ' + note : ''}`]);
      });
    }

    // Exportar detalles del ticket en formato XLS.  Mantenemos el
    // contenido separado por comas y agregamos BOM.  Cambiamos la
    // extensión a .xls y el Content-Type para compatibilidad con Excel.
    const csv = '\ufeff' + rows.join('\r\n');
    const fname = `ticket_${ticket.id}.xls`;
    res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
    return res.send(csv);
  } catch (err) {
    console.error('GET /tickets/:id/export error:', err);
    return res.status(500).send('Error exportando ticket');
  }
});

// -----------------------------------------------------------------------------
// Exporta un listado de tickets (por atender o solicitados) a CSV
// GET /tickets/export?listType=attend|requested&statuses=a,b,c
router.get('/export', async (req, res) => {
  try {
    const user = req.session.user || {};
    const userRole = (user.role || '').toLowerCase();
    // Sólo admin, manager o agente pueden exportar listados
    if (!['admin','manager','agent','agente'].includes(userRole)) {
      return res.status(403).send('No autorizado');
    }

    // Determinar si es listado por atender o solicitados
    const listType = String(req.query.listType || 'attend');
    let whereSql = '';
    let params = [];
    if (listType === 'requested') {
      // Tickets creados por el usuario
      const scope = buildRequestedScope(user);
      whereSql = scope.whereSql;
      params = scope.params;
    } else {
      // Tickets por atender según permisos
      const scope = await buildTicketScope(pool, user);
      whereSql = scope.whereSql;
      params = scope.params;
    }

    // Parámetros de búsqueda
    const q = String(req.query.q || '').trim();
    const sort = String(req.query.sort || 'opened_at').toLowerCase();
    const dirStr = String(req.query.dir || 'desc').toLowerCase();
    const department = String(req.query.department || '').trim();
    const statusesParam = String(req.query.statuses || '').trim();
    const statusList = statusesParam ? statusesParam.split(',').map(s => s.trim()).filter(Boolean) : [];
    // Rango de fechas opcional: acepta `start_date`/`end_date` (preferidos) o
    // `start`/`end` como alias.  Dejar vacío significa sin filtro de fecha.
    const start = String(req.query.start_date || req.query.start || '').trim();
    const end   = String(req.query.end_date   || req.query.end   || '').trim();

    // Construir WHERE con filtros
    const whereParts = [];
    if (whereSql) whereParts.push(`(${whereSql})`);
    const allParams = [...params];
    if (q) {
      const like = `%${q}%`;
      whereParts.push(`(
        t.id = ? OR
        t.subject LIKE ? OR
        t.category LIKE ? OR
        d.name LIKE ? OR
        t.status LIKE ? OR
        u.full_name LIKE ?
      )`);
      allParams.push(Number(q) || 0, like, like, like, like, like);
    }
    if (department) {
      whereParts.push('(d.id = ? OR d.name = ?)');
      allParams.push(Number(department) || 0, department);
    }
    if (statusList.length) {
      whereParts.push(`t.status IN (${statusList.map(() => '?').join(',')})`);
      allParams.push(...statusList);
    }

    // Filtros por fecha de apertura, si se proporcionan.  Se utilizan
    // comparaciones inclusivas sobre DATE(t.opened_at) para evitar considerar
    // la hora.  Si ambos valores están vacíos, no se aplica filtro.
    if (start) {
      whereParts.push('DATE(t.opened_at) >= ?');
      allParams.push(start);
    }
    if (end) {
      whereParts.push('DATE(t.opened_at) <= ?');
      allParams.push(end);
    }

    const whereClause = whereParts.length ? ('WHERE ' + whereParts.join(' AND ')) : '';

    // Ordenamiento
    const orderMap = {
      id: 't.id',
      subject: 't.subject',
      categoria: 't.category',
      category: 't.category',
      department: 'd.name',
      departamento: 'd.name',
      status: 't.status',
      opened_at: 't.opened_at',
      abierto: 't.opened_at',
      reporter: 'u.full_name',
      reportante: 'u.full_name',
      solved_at: 't.solved_at',
      solucionado: 't.solved_at'
    };
    const orderBy   = orderMap[sort] || 't.opened_at';
    const direction = dirStr === 'asc' ? 'ASC' : 'DESC';

    // Consulta de tickets (sin límite de 500, se podría limitar si se considera)
    const [rows] = await pool.query(
      `SELECT
         t.id,
         t.subject,
         t.category AS categoria,
         d.name     AS department,
         t.status,
         t.opened_at,
         t.solved_at,
         u.full_name AS created_by_name,
         a.full_name AS assigned_to_name
       FROM tickets t
       JOIN departments d ON d.id = t.department_id
       JOIN users u       ON u.id = t.created_by
       LEFT JOIN users a  ON a.id = t.assigned_to
       ${whereClause}
       ORDER BY ${orderBy} ${direction}`,
      allParams
    );

    // Construir CSV
    const esc = v => {
      if (v === null || v === undefined) v = '';
      v = String(v).replace(/"/g, '""');
      return `"${v}"`;
    };
    const out = [];
    const add = cols => out.push(cols.map(esc).join(','));

    // Metadatos
    const tz = 'America/Mexico_City';
    const when = new Date().toLocaleString('es-MX', { timeZone: tz });
    const roleMapTxt = { admin:'Administrador', manager:'Manager', agent:'Agente', agente:'Agente', user:'Usuario', usuario:'Usuario', system:'Sistema' };
    const who = user.full_name || user.username || '';
    const roleNice = roleMapTxt[userRole] || userRole;
    const listName = listType === 'requested' ? 'Tickets solicitados' : 'Tickets por atender';
    add(['Meta','Reporte', listName, '']);
    add(['Meta','Generado por', who, '']);
    add(['Meta','Rol', roleNice, '']);
    add(['Meta','Fecha/Hora (MX)', when, '']);
    // Filtros aplicados
    add(['Meta','Búsqueda', q || '', '']);
    add(['Meta','Estatus', statusList.length ? statusList.join(', ') : 'Todos', '']);
    add(['Meta','Departamento', department || 'Todos', '']);
    // Si se especificó un rango de fechas, agregarlo a los metadatos; de lo
    // contrario se mostrará un guión para indicar que no hay filtro.
    add(['Meta','Fecha desde', start || '—', '']);
    add(['Meta','Fecha hasta', end   || '—', '']);
    out.push('');

    // Encabezado de datos: incluye columna de fecha de solución
    add(['ID','Asunto','Categoría','Departamento','Estatus','Atendiendo','Abierto','Solucionado','Reportante']);
    // Filas de datos
    rows.forEach(r => {
      add([
        r.id,
        r.subject,
        r.categoria,
        r.department,
        r.status,
        r.assigned_to_name || '',
        r.opened_at ? new Date(r.opened_at).toLocaleString('es-MX', { timeZone: tz }) : '',
        r.solved_at ? new Date(r.solved_at).toLocaleString('es-MX', { timeZone: tz }) : '',
        r.created_by_name || ''
      ]);
    });

    // Generar contenido XLS.  Se conserva el formato de salida (CSV con BOM)
    // pero se envía como application/vnd.ms-excel para que Excel lo abra
    // correctamente.  Cambiamos la extensión a .xls según el requisito.
    const csv = '\ufeff' + out.join('\r\n');
    const fname = `tickets_${listType}_${Date.now()}.xls`;
    res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
    return res.send(csv);
  } catch (err) {
    console.error('GET /tickets/export error:', err);
    return res.status(500).send('Error exportando listados');
  }
});

// -----------------------------------------------------------------------------
// Exporta un listado detallado de tickets, incluyendo su historial completo
// GET /tickets/exportDetailed
// Acepta los mismos parámetros que /tickets/export (q, sort, dir, department,
// statuses, listType) y además puede filtrar por fechas de apertura con
// start=AAAA-MM-DD y end=AAAA-MM-DD.  Para cada ticket resultante se
// consultan todas las transiciones (historial) y se generan múltiples
// registros en el CSV.
router.get('/exportDetailed', async (req, res) => {
  try {
    const user = req.session.user || {};
    const userRole = (user.role || '').toLowerCase();
    // Sólo admin, manager o agente pueden exportar listados
    if (!['admin','manager','agent','agente'].includes(userRole)) {
      return res.status(403).send('No autorizado');
    }

    // Determinar si es listado por atender o solicitados
    const listType = String(req.query.listType || 'attend');
    let whereSql = '';
    let params = [];
    if (listType === 'requested') {
      // Tickets creados por el usuario
      const scope = buildRequestedScope(user);
      whereSql = scope.whereSql;
      params = scope.params;
    } else {
      // Tickets por atender según permisos
      const scope = await buildTicketScope(pool, user);
      whereSql = scope.whereSql;
      params = scope.params;
    }

    // Parámetros de búsqueda y filtros
    const q      = String(req.query.q || '').trim();
    const sort   = String(req.query.sort || 'opened_at').toLowerCase();
    const dirStr = String(req.query.dir || 'desc').toLowerCase();
    const department = String(req.query.department || '').trim();
    const statusesParam = String(req.query.statuses || '').trim();
    const statusList = statusesParam ? statusesParam.split(',').map(s => s.trim()).filter(Boolean) : [];
    // Permite recibir rangos de fecha bajo las claves `start_date` y `end_date`
    // o los nombres históricos `start` y `end` para compatibilidad.  Si se
    // omiten se dejarán vacíos, lo que implica sin filtro en la consulta.
    const start = String(req.query.start_date || req.query.start || '').trim();
    const end   = String(req.query.end_date   || req.query.end   || '').trim();

    // Construir WHERE con filtros
    const whereParts = [];
    if (whereSql) whereParts.push(`(${whereSql})`);
    const allParams = [...params];
    if (q) {
      const like = `%${q}%`;
      whereParts.push(`(
        t.id = ? OR
        t.subject LIKE ? OR
        t.category LIKE ? OR
        d.name LIKE ? OR
        t.status LIKE ? OR
        u.full_name LIKE ?
      )`);
      allParams.push(Number(q) || 0, like, like, like, like, like);
    }
    if (department) {
      whereParts.push('(d.id = ? OR d.name = ?)');
      allParams.push(Number(department) || 0, department);
    }
    if (statusList.length) {
      whereParts.push(`t.status IN (${statusList.map(() => '?').join(',')})`);
      allParams.push(...statusList);
    }
    // Filtro por fecha de apertura
    if (start) {
      whereParts.push('t.opened_at >= ?');
      allParams.push(`${start} 00:00:00`);
    }
    if (end) {
      whereParts.push('t.opened_at <= ?');
      allParams.push(`${end} 23:59:59`);
    }

    const whereClause = whereParts.length ? ('WHERE ' + whereParts.join(' AND ')) : '';

    // Ordenamiento
    const orderMap = {
      id: 't.id',
      subject: 't.subject',
      categoria: 't.category',
      category: 't.category',
      department: 'd.name',
      departamento: 'd.name',
      status: 't.status',
      opened_at: 't.opened_at',
      abierto: 't.opened_at',
      reporter: 'u.full_name',
      reportante: 'u.full_name'
    };
    const orderBy   = orderMap[sort] || 't.opened_at';
    const direction = dirStr === 'asc' ? 'ASC' : 'DESC';

    // Consulta de tickets con información detallada
    const [tickets] = await pool.query(
      `SELECT
         t.id,
         t.subject,
         t.description,
         t.category      AS categoria,
         d.name          AS department,
         t.department_id AS department_id,
         t.creator_name,
         t.contact_phone,
         t.status,
         t.comments,
         t.created_by,
         u.full_name AS created_by_name,
         t.assigned_to,
         a.full_name AS assigned_to_name,
         t.opened_at,
         t.updated_at,
         t.closed_at,
         t.first_response_at,
         t.solved_at,
         t.canceled_at,
         t.last_state_change_at,
         t.reopened_count
       FROM tickets t
       JOIN departments d ON d.id = t.department_id
       JOIN users u       ON u.id = t.created_by
       LEFT JOIN users a  ON a.id = t.assigned_to
       ${whereClause}
       ORDER BY ${orderBy} ${direction}`,
      allParams
    );

    // Obtiene todas las transiciones para los tickets seleccionados en una sola consulta
    const ticketIds = tickets.map(t => t.id);
    let transitionsMap = {};
    if (ticketIds.length) {
      const [historyRows] = await pool.query(
        `SELECT tt.ticket_id, tt.actor_id, tt.actor_role, tt.from_status, tt.to_status, tt.note, tt.created_at,
                usr.full_name AS actor_name
           FROM ticket_transitions tt
           LEFT JOIN users usr ON usr.id = tt.actor_id
          WHERE tt.ticket_id IN (${ticketIds.map(() => '?').join(',')})
          ORDER BY tt.ticket_id ASC, tt.created_at ASC`,
        ticketIds
      );
      transitionsMap = historyRows.reduce((acc, row) => {
        (acc[row.ticket_id] = acc[row.ticket_id] || []).push(row);
        return acc;
      }, {});
    }

    // Construir CSV
    const esc = v => {
      if (v === null || v === undefined) v = '';
      v = String(v).replace(/"/g, '""');
      return `"${v}"`;
    };
    const rows = [];
    const add = cols => rows.push(cols.map(esc).join(','));

    // Metadatos generales
    const tz = 'America/Mexico_City';
    const when = new Date().toLocaleString('es-MX', { timeZone: tz });
    const roleMapTxt = { admin:'Administrador', manager:'Manager', agent:'Agente', agente:'Agente', user:'Usuario', usuario:'Usuario', system:'Sistema' };
    const who = user.full_name || user.username || '';
    const roleNice = roleMapTxt[userRole] || userRole;
    add(['Meta','Reporte','Tickets detallados','']);
    add(['Meta','Generado por', who, '']);
    add(['Meta','Rol', roleNice, '']);
    add(['Meta','Fecha/Hora (MX)', when, '']);
    // Filtros aplicados
    add(['Meta','Búsqueda', q || '', '']);
    add(['Meta','Estatus', statusList.length ? statusList.join(', ') : 'Todos', '']);
    add(['Meta','Departamento', department || 'Todos', '']);
    add(['Meta','Fecha desde', start || '—', '']);
    add(['Meta','Fecha hasta', end   || '—', '']);
    rows.push('');

    // Para cada ticket, añadir detalles y su historial
    tickets.forEach(ticket => {
      // Encabezados y valores del ticket
      add(['Meta','Ticket ID', ticket.id, '']);
      add(['Meta','Departamento', ticket.department, '']);
      rows.push('');
      add(['Ticket','Asunto', ticket.subject, '']);
      add(['Ticket','Categoría', ticket.categoria, '']);
      add(['Ticket','Departamento', ticket.department, '']);
      add(['Ticket','Reportante', ticket.creator_name || '', '']);
      add(['Ticket','Teléfono', ticket.contact_phone || '', '']);
      add(['Ticket','Asignado a', ticket.assigned_to_name || '', '']);
      add(['Ticket','Estatus', ticket.status || '', '']);
      // Formatear fechas a zona MX
      const fmt = (dt) => dt ? new Date(dt).toLocaleString('es-MX', { timeZone: tz }) : '';
      add(['Ticket','Abierto', fmt(ticket.opened_at), '']);
      if (ticket.updated_at) add(['Ticket','Actualizado', fmt(ticket.updated_at), '']);
      if (ticket.closed_at) add(['Ticket','Cerrado', fmt(ticket.closed_at), '']);
        if (ticket.solved_at) add(['Ticket','Solucionado', fmt(ticket.solved_at), '']);
      add(['Ticket','Descripción', ticket.description || '', '']);
      rows.push('');
      // Historial
      const history = transitionsMap[ticket.id] || [];
      if (history.length) {
        add(['Historial','Actor','Estado de → a','Fecha / Nota']);
        history.forEach(h => {
          const actor = h.actor_name ? `${h.actor_role || ''} ${h.actor_name}`.trim() : (h.actor_role || '');
          const transition = `${h.from_status || ''} → ${h.to_status || ''}`;
          const dateStr = h.created_at ? fmt(h.created_at) : '';
          const note = h.note || '';
          const lastCol = note ? `${dateStr} - ${note}` : dateStr;
          add(['Historial', actor, transition, lastCol]);
        });
      }
      rows.push('');
    });

    // Generar contenido XLS para reporte detallado.  Aunque mantenemos el
    // formato de salida en filas separadas por comas, la cabecera se ajusta
    // para que Excel lo interprete como .xls.  El BOM asegura correcta
    // lectura de UTF-8.
    const csv = '\ufeff' + rows.join('\r\n');
    const fname = `tickets_detallados_${Date.now()}.xls`;
    res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
    return res.send(csv);
  } catch (err) {
    console.error('GET /tickets/exportDetailed error:', err);
    return res.status(500).send('Error exportando listados detallados');
  }
});

// -----------------------------------------------------------------------------
// Exporta únicamente los cambios de piezas registrados en tickets de los
// departamentos Mantenimiento y Sistemas.  Cada registro representa una
// transición cuyo note comienza con "Cambio:".  Permite filtrar por los
// mismos parámetros que /tickets/export (q, department, statuses, listType) y
// fechas de apertura (start y end).  Únicamente admin, manager y agentes
// pueden descargar este reporte.
router.get('/exportChanges', async (req, res) => {
  try {
    const user = req.session.user || {};
    const userRole = (user.role || '').toLowerCase();
    if (!['admin','manager','agent','agente'].includes(userRole)) {
      return res.status(403).send('No autorizado');
    }
    const listType = String(req.query.listType || 'attend');
    let whereSql = '';
    let params = [];
    if (listType === 'requested') {
      const scope = buildRequestedScope(user);
      whereSql = scope.whereSql;
      params = scope.params;
    } else {
      const scope = await buildTicketScope(pool, user);
      whereSql = scope.whereSql;
      params = scope.params;
    }
    // Parámetros comunes
    const q      = String(req.query.q || '').trim();
    const department = String(req.query.department || '').trim();
    const statusesParam = String(req.query.statuses || '').trim();
    const statusList = statusesParam ? statusesParam.split(',').map(s => s.trim()).filter(Boolean) : [];
    // Permite recibir rangos de fecha bajo las claves `start_date` y `end_date`
    // o los nombres históricos `start` y `end` para compatibilidad.
    const start = String(req.query.start_date || req.query.start || '').trim();
    const end   = String(req.query.end_date   || req.query.end   || '').trim();
    const whereParts = [];
    if (whereSql) whereParts.push(`(${whereSql})`);
    const allParams = [...params];
    if (q) {
      const like = `%${q}%`;
      whereParts.push(`(
        t.id = ? OR
        t.subject LIKE ? OR
        t.category LIKE ? OR
        d.name LIKE ? OR
        t.status LIKE ? OR
        u.full_name LIKE ?
      )`);
      allParams.push(Number(q) || 0, like, like, like, like, like);
    }
    // Si se especifica department param, se filtrará pero de todas formas
    // luego se limitará a Mantenimiento/Sistemas.
    if (department) {
      whereParts.push('(d.id = ? OR d.name = ?)');
      allParams.push(Number(department) || 0, department);
    }
    if (statusList.length) {
      whereParts.push(`t.status IN (${statusList.map(() => '?').join(',')})`);
      allParams.push(...statusList);
    }
    // Filtros por fecha de cambio: se utilizan las fechas de las transiciones
    // (tt.created_at) en lugar de la fecha de apertura del ticket para que el
    // rango seleccionado corresponda a los cambios realizados.  Se formatean
    // como fechas completas para la consulta.
    if (start) {
      whereParts.push('tt.created_at >= ?');
      allParams.push(`${start} 00:00:00`);
    }
    if (end) {
      whereParts.push('tt.created_at <= ?');
      allParams.push(`${end} 23:59:59`);
    }
    // Restricción para departamentos Mantenimiento y Sistemas
    // No usamos parámetros dinámicos para los nombres fijos, para evitar
    // mezclarlos con otros filtros de departamentos.  Si existen mayúsculas o
    // minúsculas distintas en la BD, se normaliza con BINARY o COLLATE.
    const deptNames = ['Mantenimiento', 'Sistemas'];
    whereParts.push(`d.name IN (${deptNames.map(() => '?').join(',')})`);
    allParams.push(...deptNames);
    const whereClause = whereParts.length ? ('WHERE ' + whereParts.join(' AND ')) : '';

    // Consulta de cambios: combina tickets y transiciones cuyo note inicia con "Cambio:"
    const [rows] = await pool.query(
      `SELECT
         t.id           AS ticket_id,
         t.subject      AS subject,
         d.name         AS department,
         tt.created_at  AS change_date,
         tt.note        AS note
       FROM tickets t
       JOIN departments d       ON d.id = t.department_id
       JOIN users u             ON u.id = t.created_by
       JOIN ticket_transitions tt ON tt.ticket_id = t.id
       ${whereClause}
         AND tt.note LIKE 'Cambio:%'
       ORDER BY t.id ASC, tt.created_at ASC`,
      allParams
    );

    // Construye CSV
    const esc = v => {
      if (v === null || v === undefined) v = '';
      v = String(v).replace(/"/g, '""');
      return `"${v}"`;
    };
    const out = [];
    const add = cols => out.push(cols.map(esc).join(','));
    const tz = 'America/Mexico_City';
    const when = new Date().toLocaleString('es-MX', { timeZone: tz });
    const roleMapTxt = { admin:'Administrador', manager:'Manager', agent:'Agente', agente:'Agente', user:'Usuario', usuario:'Usuario', system:'Sistema' };
    const who = user.full_name || user.username || '';
    const roleNice = roleMapTxt[userRole] || userRole;
    add(['Meta','Reporte','Cambios de piezas','']);
    add(['Meta','Generado por', who, '']);
    add(['Meta','Rol', roleNice, '']);
    add(['Meta','Fecha/Hora (MX)', when, '']);
    add(['Meta','Búsqueda', q || '', '']);
    add(['Meta','Estatus', statusList.length ? statusList.join(', ') : 'Todos', '']);
    add(['Meta','Departamento (filtro)', department || '—', '']);
    add(['Meta','Fecha desde', start || '—', '']);
    add(['Meta','Fecha hasta', end   || '—', '']);
    // Especificamos que sólo se consideran los departamentos Mantenimiento y Sistemas
    add(['Meta','Departamentos incluidos', deptNames.join(', '), '']);
    out.push('');
    // Encabezado de datos
    add(['Ticket','Departamento','Fecha','Cambio']);
    rows.forEach(r => {
      // Convierte la fecha a formato local
      const dateStr = r.change_date ? new Date(r.change_date).toLocaleString('es-MX', { timeZone: tz }) : '';
      // Elimina el prefijo "Cambio:" del note para mostrar sólo la descripción
      let cambio = r.note || '';
      if (cambio.toLowerCase().startsWith('cambio:')) {
        cambio = cambio.slice(7).trim();
      }
      add([
        r.ticket_id,
        r.department || '',
        dateStr,
        cambio
      ]);
    });
    // Exportar cambios en formato XLS.  Conservamos los datos separados por
    // comas y agregamos BOM para UTF-8.  Ajustamos la extensión y el
    // Content-Type para que Excel lo abra automáticamente.
    const csv = '\ufeff' + out.join('\r\n');
    const fname = `tickets_cambios_${Date.now()}.xls`;
    res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
    return res.send(csv);
  } catch (err) {
    console.error('GET /tickets/exportChanges error:', err);
    return res.status(500).send('Error exportando cambios de piezas');
  }
});

// -------------------------------------------------------------------------------
// Asignación manual de ticket a un agente
// POST /tickets/:id/assign — asigna el ticket a un agente específico
router.post('/:id/assign', async (req, res) => {
  try {
    const ticketId = ensureInt(req.params.id);
    if (!ticketId) {
      return res.status(400).json({ ok: false, msg: 'ID inválido' });
    }

    const user = req.session.user || {};
    const normalizedRole = normRole(user.role);
    // Sólo admin o manager pueden asignar
    if (!(normalizedRole === ROLES.ADMIN || normalizedRole === ROLES.MANAGER)) {
      return res.status(403).json({ ok: false, msg: 'No autorizado' });
    }

    // Verificar acceso al ticket
    const allowed = await canAccessTicket(pool, user, ticketId);
    if (!allowed) {
      return res.status(403).json({ ok: false, msg: 'No autorizado' });
    }

    // Obtener el ID del agente
    const agentId = ensureInt(req.body?.agent_id);
    if (!agentId) {
      return res.status(400).json({ ok: false, msg: 'Agente no válido' });
    }

    // Cargar info del ticket (depto/estado/asignación)
    const [[ticketRow]] = await pool.query(
      'SELECT id, status, department_id, assigned_to FROM tickets WHERE id = ?',
      [ticketId]
    );
    if (!ticketRow) {
      return res.status(404).json({ ok: false, msg: 'Ticket no encontrado' });
    }
    if ([STATES.CANCELADO, STATES.CERRADO].includes(ticketRow.status)) {
      return res.status(400).json({ ok: false, msg: 'No se puede asignar un ticket cerrado o cancelado' });
    }

    // Verificar que el usuario a asignar pertenece al mismo depto y es rol válido
    const [[assignee]] = await pool.query(
      `SELECT u.id, u.full_name, u.role
         FROM users u
         JOIN user_department_access uda ON uda.user_id = u.id
        WHERE u.id = ? AND u.role IN ('agent','manager') AND uda.department_id = ?
        LIMIT 1`,
      [agentId, ticketRow.department_id]
    );
    if (!assignee) {
      return res.status(400).json({ ok: false, msg: 'El usuario seleccionado no pertenece al departamento o no es asignable' });
    }

    // Si ya está asignado, no hacer nada
    if (ticketRow.assigned_to === assignee.id) {
      const wantsJson = req.xhr ||
                        (req.headers.accept && req.headers.accept.includes('application/json'));
      if (wantsJson) {
        return res.json({ ok: true, msg: 'Asignado sin cambios', assigned_to: assignee.id, assigned_to_name: assignee.full_name });
      }
      return res.redirect(`/tickets/${ticketId}`);
    }

    // Transacción: actualizar asignación y registrar historial
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(
        'UPDATE tickets SET assigned_to = ? WHERE id = ?',
        [assignee.id, ticketId]
      );

      const actorId   = user.id || null;
      const actorRole = roleMap[normalizedRole] || normalizedRole;
      const ip        = req.ip || null;
      const ua        = (req.headers['user-agent'] || '').slice(0, 255);
      const note      = `Asignado a ${assignee.full_name}`;
      await conn.query(
        `INSERT INTO ticket_transitions
           (ticket_id, actor_id, actor_role, from_status, to_status, note, ip_address, user_agent)
         VALUES (?,?,?,?,?,?,?,?)`,
        [ticketId, actorId, actorRole, ticketRow.status, ticketRow.status, note, ip, ua]
      );

      await conn.commit();

      const wantsJson = req.xhr ||
                        (req.headers.accept && req.headers.accept.includes('application/json'));
      if (wantsJson) {
        return res.json({ ok: true, msg: 'Ticket asignado', assigned_to: assignee.id, assigned_to_name: assignee.full_name });
      }
      return res.redirect(`/tickets/${ticketId}`);
    } catch (e) {
      await conn.rollback();
      console.error('POST /tickets/:id/assign error:', e);
      return res.status(500).json({ ok: false, msg: 'Error al asignar ticket' });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error('POST /tickets/:id/assign fatal', e);
    return res.status(500).json({ ok: false, msg: 'Error interno' });
  }
});

// -----------------------------------------------------------------------------
// Detalle de un ticket solicitado por el usuario
// GET /tickets/requested/:id — muestra el ticket si el actor es el creador
router.get('/requested/:id(\\d+)', async (req, res) => {
  try {
    const id = ensureInt(req.params.id);
    if (!id) return res.status(400).send('ID inválido');
    const user = req.session.user;

    // Validar que el ticket pertenezca al usuario (created_by)
    const { whereSql, params } = buildRequestedScope(user);
    const [allowedRows] = await pool.query(
      `SELECT 1 FROM tickets t WHERE t.id = ? AND ${whereSql} LIMIT 1`,
      [id, ...params]
    );
    if (!allowedRows || !allowedRows.length) {
      return res.status(403).send('No autorizado');
    }

    // Cargar datos del ticket, incluyendo marcas de tiempo adicionales
    const [[row]] = await pool.query(
      `SELECT t.id, t.subject, t.description,
              t.department_id, d.name AS department,
              t.category,
              t.creator_name, t.contact_phone,
              t.status, t.comments,
              t.created_by, u.full_name AS created_by_name,
              t.assigned_to, a.full_name AS assigned_to_name,
              t.opened_at, t.updated_at, t.closed_at,
              t.first_response_at, t.solved_at, t.canceled_at, t.last_state_change_at, t.reopened_count
         FROM tickets t
         JOIN departments d ON d.id = t.department_id
         JOIN users u       ON u.id = t.created_by
         LEFT JOIN users a  ON a.id = t.assigned_to
        WHERE t.id = ?`,
      [id]
    );
    if (!row) return res.status(404).send('Ticket no encontrado');

    // Adjuntos
    const [attachments] = await pool.query(
      'SELECT id, seq FROM ticket_attachments WHERE ticket_id=? ORDER BY seq ASC, id ASC',
      [id]
    );

    // Historial de transiciones con el nombre del actor (si existe)
    const [history] = await pool.query(
      `SELECT tt.actor_id, tt.actor_role, tt.from_status, tt.to_status, tt.note, tt.created_at,
              u.full_name AS actor_name
         FROM ticket_transitions tt
         LEFT JOIN users u ON u.id = tt.actor_id
        WHERE tt.ticket_id = ?
        ORDER BY tt.created_at ASC`,
      [id]
    );

    // Rol del usuario actual (normalizado)
    const userRole = normRole(req.session.user?.role || '');

    // En el modo "solicitado" no hay asignables ni se puede aceptar
    const assignables = [];
    const canAccept   = false;

    // ¿Puede cerrar este ticket el usuario?  (Se aplica la regla extra si es
    // agent/manager creador).  userId se pasa vía ctx.
    const viewerId   = req.session.user?.id || null;
    const viewerRole = req.session.user?.role || '';
    const canClose = canTransition(
      row.status,
      STATES.CERRADO,
      viewerRole,
      { ticket: row, userId: viewerId }
    );

    res.render('ticket_show', {
      title: `Ticket #${row.id}`,
      t: row,
      attachments,
      history,
      statusLabels: LABELS,
      userRole,
      userId: req.session.user?.id || null,
      assignables,
      canClose,
      canAccept,
      viewMode: 'requested',
      roleMap
    });
  } catch (err) {
    console.error('GET /tickets/requested/:id', err);
    res.status(500).send('Error mostrando ticket');
  }
});

module.exports = router;
