// src/routes/tickets.js
const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { buildTicketScope } = require('../lib/ticketScope');
const { canAccessTicket } = require('../lib/ticketAccess');

/* ----------------------------- Helpers ----------------------------- */

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
  if (byDept[d]) return byDept[d];

  return 'General';
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

/* ------------------------------ Listado ------------------------------ */
// GET /tickets  (usa tu buildTicketScope)
router.get('/', async (req, res) => {
  const user = req.session.user;
  try {
    const { whereSql, params } = await buildTicketScope(pool, user);

    const [rows] = await pool.query(
      `SELECT
         t.id,
         t.subject,
         t.status,
         t.opened_at,
         d.name        AS department,
         u.full_name   AS created_by_name
       FROM tickets t
       JOIN departments d ON d.id = t.department_id
       JOIN users u       ON u.id = t.created_by
       WHERE ${whereSql}
       ORDER BY t.opened_at DESC`,
      params
    );

    res.render('tickets', { title: 'Tickets', tickets: rows });
  } catch (err) {
    console.error('GET /tickets', err);
    res.status(500).send('Error listando tickets');
  }
});

/* ------------------------------ Nuevo ------------------------------ */
// GET /tickets/new  (sin prerellenar nombre/teléfono)
router.get('/new', async (req, res) => {
  try {
    const [depts] = await pool.query(
      'SELECT id, name FROM departments WHERE is_active=1 ORDER BY name'
    );

    res.render('ticket_new', {
      title: 'Nuevo Ticket',
      departments: depts,
      selectedDepartment: req.query.department || '',
      subject: '',
      description: '',
      creatorName: '',
      contactPhone: '',
      error: null
    });
  } catch (err) {
    console.error('GET /tickets/new', err);
    res.status(500).send('Error cargando formulario');
  }
});

// POST /tickets/new  (guarda creator_name/contact_phone y calcula category)
router.post('/new', async (req, res) => {
  try {
    const userId = req.session.user?.id;
    const {
      subject,
      description,
      department_id,      // destino
      creator_name,       // 🔹 campo nuevo obligatorio
      contact_phone       // 🔹 campo nuevo opcional
    } = req.body || {};

    // Validaciones básicas
    const errors = [];
    const depId = ensureInt(department_id);

    if (!creator_name || creator_name.trim().length < 3)
      errors.push('El nombre es obligatorio (mín. 3).');
    if (!depId)
      errors.push('Selecciona un departamento válido.');
    if (!subject || subject.trim().length < 5)
      errors.push('El asunto es obligatorio (mín. 5).');
    if (!description || description.trim().length < 20)
      errors.push('La descripción es obligatoria (mín. 20).');

    if (errors.length) {
      const [depts] = await pool.query(
        'SELECT id, name FROM departments WHERE is_active=1 ORDER BY name'
      );
      return res.status(400).render('ticket_new', {
        title: 'Nuevo Ticket',
        departments: depts,
        selectedDepartment: depId || '',
        subject,
        description,
        creatorName: creator_name || '',
        contactPhone: contact_phone || '',
        error: errors.join(' ')
      });
    }

    // Nombre del departamento para la categoría
    const [[destDept]] = await pool.query(
      'SELECT name FROM departments WHERE id=?',
      [depId]
    );

    const category = computeCategory(subject, destDept?.name || '');
    const phone = sanitizePhone(contact_phone);

    // INSERT con tu esquema (subject/opened_at/updated_at) y estatus 'abierto'
    await pool.query(
      `INSERT INTO tickets
        (subject, description,
         department_id, category,
         creator_name, contact_phone,
         created_by, assigned_to, status,
         opened_at, updated_at)
       VALUES (?,?,?,?,?,?,
               ?, NULL, 'abierto',
               NOW(), NOW())`,
      [
        subject.trim(),
        description.trim(),
        depId,
        category,
        creator_name.trim(),
        phone,
        userId
      ]
    );

    res.redirect('/tickets');
  } catch (err) {
    console.error('POST /tickets/new', err);
    try {
      const [depts] = await pool.query(
        'SELECT id, name FROM departments WHERE is_active=1 ORDER BY name'
      );
      return res.status(500).render('ticket_new', {
        title: 'Nuevo Ticket',
        departments: depts,
        selectedDepartment: req.body?.department_id || '',
        subject: req.body?.subject || '',
        description: req.body?.description || '',
        creatorName: req.body?.creator_name || '',
        contactPhone: req.body?.contact_phone || '',
        error: 'Error al crear ticket'
      });
    } catch (e2) {
      console.error('Render fallback /tickets/new', e2);
      return res.status(500).send('Error al crear ticket');
    }
  }
});

/* ------------------------------ Detalle ------------------------------ */
// (Opcional pero útil) GET /tickets/:id  — respeta permisos con canAccessTicket
router.get('/:id(\\d+)', async (req, res) => {
  try {
    const id = ensureInt(req.params.id);
    if (!id) return res.status(400).send('ID inválido');

    const allowed = await canAccessTicket(pool, req.session.user, id);
    if (!allowed) return res.status(403).send('No autorizado');

    const [[row]] = await pool.query(
      `SELECT
         t.id, t.subject, t.description,
         t.department_id, d.name AS department,
         t.category,
         t.creator_name, t.contact_phone,
         t.status, t.comments,
         t.created_by, u.full_name AS created_by_name,
         t.assigned_to, a.full_name AS assigned_to_name,
         t.opened_at, t.updated_at, t.closed_at
       FROM tickets t
       JOIN departments d ON d.id = t.department_id
       JOIN users u       ON u.id = t.created_by
       LEFT JOIN users a  ON a.id = t.assigned_to
       WHERE t.id = ?`,
      [id]
    );

    if (!row) return res.status(404).send('Ticket no encontrado');

    res.render('ticket_show', { title: `Ticket #${row.id}`, t: row });
  } catch (err) {
    console.error('GET /tickets/:id', err);
    res.status(500).send('Error mostrando ticket');
  }
});

module.exports = router;
