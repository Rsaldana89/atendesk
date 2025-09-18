// src/routes/tickets.js
const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { buildTicketScope } = require('../lib/ticketScope');
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

// ------------------------------ Listado ------------------------------ //
// GET /tickets  → con búsqueda (q) y ordenamiento (sort/dir) e incluye categoría
router.get('/', async (req, res) => {
  const user = req.session.user;
  try {
    // Visibilidad por rol / alcance
    const { whereSql, params } = await buildTicketScope(pool, user);

    // Controles de UI
    const q      = String(req.query.q || '').trim();
    const sort   = String(req.query.sort || 'opened_at').toLowerCase();
    const dirStr = String(req.query.dir || 'desc').toLowerCase();
    const status = String(req.query.status || '').trim();
    const department = String(req.query.department || '').trim();

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
    };
    const orderBy   = orderMap[sort] || 't.opened_at';
    const direction = dirStr === 'asc' ? 'ASC' : 'DESC';

    // WHERE
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

    const sql = `
      SELECT
        t.id,
        t.subject,
        t.category AS categoria,
        d.name     AS department,
        t.status,
        t.opened_at,
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
      title: 'Tickets',
      tickets: rows,
      q, sort, dir: direction.toLowerCase(),
      qs, dirFor
    });
  } catch (err) {
    console.error('GET /tickets', err);
    res.status(500).send('Error listando tickets');
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
router.post('/new', upload.array('evidencias', MAX_FILES), async (req, res) => {
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
    if (!description || description.trim().length < 20) errors.push('La descripción es obligatoria (mín. 20).');

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
      console.log('Ticket creado', { ticketId, files: req.files?.length || 0 });
      res.redirect(`/tickets/${ticketId}`);
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

    // Historial de transiciones
    const [history] = await pool.query(
      `SELECT actor_id, actor_role, from_status, to_status, note, created_at
         FROM ticket_transitions
        WHERE ticket_id = ?
        ORDER BY created_at ASC`,
      [id]
    );

    // Rol del usuario actual (normalizado)
    const userRole = normRole(req.session.user?.role || '');

    res.render('ticket_show', {
      title: `Ticket #${row.id}`,
      t: row,
      attachments,
      history,
      statusLabels: LABELS,
      userRole,
      userId: req.session.user?.id || null
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
    // Cargar estado y asignación actual
    const [[ticket]] = await pool.query('SELECT id, status, assigned_to FROM tickets WHERE id=?', [ticketId]);
    if (!ticket) return res.status(404).json({ ok: false, msg: 'Ticket no encontrado' });

    // Verificar acceso
    const allowed = await canAccessTicket(pool, user, ticketId);
    if (!allowed) return res.status(403).json({ ok: false, msg: 'No autorizado' });

    // Nuevo estado (normalizado a minúsculas)
    const toRaw = req.body?.to_status || '';
    const to    = String(toRaw).toLowerCase();
    const note  = (req.body?.note || '').slice(0, 500);

    // Validar transición permitida según rol
    if (!canTransition(ticket.status, to, user.role)) {
      return res.status(400).json({ ok: false, msg: 'Transición no permitida' });
    }

    // Verificación adicional para liberar un ticket: sólo quien atiende, un manager o un admin pueden hacerlo
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

      // Asignación: al pasar de abierto/reabierto a en_progreso asignamos, y al pasar de en_progreso a abierto liberamos
      if (to === STATES.EN_PROGRESO) {
        sql += ', assigned_to=?';
        params.push(user.id);
      }
      if (to === STATES.ABIERTO) {
        sql += ', assigned_to=NULL';
      }

      sql += ' WHERE id=?';
      params.push(ticketId);

      await conn.query(sql, params);

      // Inserta en historial
      const actorId   = user.id || null;
      const actorRole = user ? normRole(user.role) : ROLES.SYSTEM;
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

module.exports = router;
