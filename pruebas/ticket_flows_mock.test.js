// Pruebas de regresion de rutas REALES, pero con MySQL y middleware simulados.
// No usar para declarar compatibilidad con produccion; no reemplaza E2E contra copia BD.
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const calls = [];
const notifications = [];
let autoId = 300;
let currentTicket = {
  id: 44, status: 'abierto', created_by: 21, assigned_to: null,
  department_id: 1, department: 'Sistemas', category: 'Software',
  subject: 'Ticket para pruebas', description: 'Descripcion de prueba',
  created_by_name: 'Solicitante', creator_name: 'Solicitante', creator_phone: null
};

const connection = {
  async beginTransaction() { calls.push('begin'); },
  async query(sql, params) {
    calls.push({ sql, params, connection: true });
    if (/SELECT name FROM departments WHERE id/i.test(sql)) return [[{ name: 'Sistemas' }]];
    if (/INSERT INTO tickets\s*\(/i.test(sql)) return [{ insertId: autoId }];
    return [{ affectedRows: 1 }];
  },
  async commit() { calls.push('commit'); },
  async rollback() { calls.push('rollback'); },
  release() { calls.push('release'); }
};
const pool = {
  async getConnection() { calls.push('connection'); return connection; },
  async query(sql, params) {
    calls.push({ sql, params, connection: false });
    if (/SELECT name FROM departments WHERE id/i.test(sql)) return [[{ name: 'Sistemas' }]];
    if (/SELECT .*status.*assigned_to.*created_by.*department_id FROM tickets/i.test(sql) ||
      /SELECT id, status, assigned_to, created_by, department_id FROM tickets/i.test(sql)) return [[currentTicket]];
    if (/SELECT id, status, created_by, assigned_to FROM tickets/i.test(sql)) return [[currentTicket]];
    if (/SELECT id, status, department_id, assigned_to FROM tickets/i.test(sql)) return [[currentTicket]];
    if (/FROM users u\s+JOIN user_department_access uda/i.test(sql)) {
      return [[{ id: 5, role: 'agent', full_name: 'Agente de pruebas' }]];
    }
    if (/SELECT 1 FROM tickets t/i.test(sql)) return [[{ 1: 1 }]];
    if (/FROM ticket_attachments/i.test(sql)) return [[]];
    if (/FROM ticket_transitions/i.test(sql)) return [[]];
    if (/FROM tickets t\s+JOIN departments/i.test(sql)) return [[currentTicket]];
    return [[]];
  }
};
const router = {
  gets: {}, posts: {},
  get(path, fn) { this.gets[path] = fn; },
  post(path, fn) { this.posts[path] = fn; }
};
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  const from = parent && parent.filename.endsWith('/src/routes/tickets.js');
  if (!from) return originalLoad.apply(this, arguments);
  if (request === 'express') return { Router: () => router };
  if (request === '../db') return { pool };
  if (request === '../lib/ticketAccess') return { canAccessTicket: async () => true };
  if (request === '../lib/notifications') return { notifyByConfig: async (...args) => notifications.push(['correo', ...args]) };
  if (request === './events') return { notifyNewTicket: data => notifications.push(['nuevo-ticket', data]) };
  if (request === '../lib/ticketNotifications') return {
    publishTicketActivity: async (_pool, data) => notifications.push(['campana', data]),
    markTicketNotificationsRead: async (_pool, uid, tid) => notifications.push(['revisado', uid, tid])
  };
  if (request === 'multer') {
    const stub = () => ({ array: () => (req, _res, cb) => { req.files = req.files || []; cb(); } });
    stub.memoryStorage = () => ({});
    stub.MulterError = class MulterError extends Error {};
    return stub;
  }
  return originalLoad.apply(this, arguments);
};
require('../src/routes/tickets.js');
Module._load = originalLoad;

function response() {
  return {
    result: null, code: 200,
    status(n) { this.code = n; return this; },
    json(value) { this.result = ['json', value]; return this; },
    send(value) { this.result = ['send', value]; return this; },
    redirect(value) { this.result = ['redirect', value]; return this; },
    render(name, props) { this.result = ['render', name, props]; return this; }
  };
}
function request(user = { id: 6, role: 'admin', username: 'admin' }, params = { id: '44' }, body = {}) {
  return { params, body, session: { user }, headers: { 'user-agent': 'test' }, ip: '127.0.0.1', files: [] };
}
function reset() { calls.length = 0; notifications.length = 0; }

test('creacion de ticket: conserva transaccion, correo, SSE y redireccion original', async () => {
  reset();
  const req = request({ id: 21, role: 'user', username: 'tienda1' }, {}, {
    subject: 'No funciona impresora', description: 'La impresora no imprime ni un documento',
    department_id: '1', creator_name: 'Gerente Prueba', category: 'Impresion'
  });
  const res = response();
  await router.posts['/new'](req, res);
  assert.deepEqual(res.result, ['redirect', '/tickets/requested/300']);
  assert.ok(calls.some(c => c.sql && /INSERT INTO tickets/i.test(c.sql)));
  assert.ok(calls.includes('commit'));
  assert.equal(notifications.filter(entry => entry[0] === 'correo').length, 1);
  assert.equal(notifications.filter(entry => entry[0] === 'nuevo-ticket').length, 1);
});

test('cambio de estatus: responde OK, historial original; emite campana sin bloquear commit', async () => {
  reset();
  currentTicket = { ...currentTicket, status: 'abierto', assigned_to: null };
  const req = request({ id: 6, role: 'admin' }, { id: '44' }, { to_status: 'en_progreso', note: 'Atendido' });
  const res = response();
  await router.posts['/:id/transition'](req, res);
  assert.equal(res.result[0], 'json');
  assert.equal(res.result[1].ok, true);
  assert.ok(calls.some(c => c.sql && /UPDATE tickets SET status=/i.test(c.sql)));
  assert.ok(calls.some(c => c.sql && /INSERT INTO ticket_transitions/i.test(c.sql)));
  assert.ok(calls.includes('commit'));
  assert.ok(calls.includes('release'));
  await new Promise(setImmediate);
  assert.equal(notifications.filter(entry => entry[0] === 'campana').length, 1);
});

test('comentario: inserta transicion sin cambio de estado y conserva redireccion', async () => {
  reset();
  currentTicket = { ...currentTicket, status: 'en_progreso', created_by: 21, assigned_to: 5 };
  const req = request({ id: 21, role: 'user' }, { id: '44' }, { comment: 'Favor de confirmarme el cambio' });
  const res = response();
  await router.posts['/:id(\\d+)/comment'](req, res);
  assert.deepEqual(res.result, ['redirect', '/tickets/44']);
  assert.ok(calls.some(c => c.sql && /UPDATE tickets SET updated_at=NOW/i.test(c.sql)));
  assert.ok(calls.some(c => c.sql && /INSERT INTO ticket_transitions/i.test(c.sql)));
  assert.ok(calls.includes('commit'));
  assert.equal(notifications.filter(entry => entry[0] === 'campana')[0][1].eventType, 'comment');
});

test('asignacion: conserva transaccion, historial y respuesta JSON', async () => {
  reset();
  currentTicket = { ...currentTicket, status: 'abierto', assigned_to: null };
  const req = request({ id: 6, role: 'admin' }, { id: '44' }, { agent_id: '5' });
  req.xhr = true;
  req.headers.accept = 'application/json';
  const res = response();
  await router.posts['/:id/assign'](req, res);
  assert.equal(res.result[0], 'json');
  assert.equal(res.result[1].ok, true);
  assert.ok(calls.some(c => c.sql && /UPDATE tickets SET assigned_to/i.test(c.sql)));
  assert.ok(calls.some(c => c.sql && /INSERT INTO ticket_transitions/i.test(c.sql)));
  assert.ok(calls.includes('commit'));
  await new Promise(setImmediate);
  assert.equal(notifications.filter(entry => entry[0] === 'campana')[0][1].eventType, 'assignment');
});

test('detalle ticket: se marca la lectura sin modificar ticket ni adjuntos', async () => {
  reset();
  currentTicket = { ...currentTicket, status: 'en_progreso', created_by: 21, assigned_to: 5 };
  const req = request({ id: 6, role: 'admin' });
  const res = response();
  await router.gets['/:id(\\d+)'](req, res);
  assert.equal(res.result[0], 'render');
  assert.equal(res.result[1], 'ticket_show');
  assert.equal(notifications.filter(entry => entry[0] === 'revisado').length, 1);
  assert.ok(!calls.some(c => c.sql && /UPDATE tickets/i.test(c.sql)));
});

test('detalle Solicitados: marca lectura del propio ticket', async () => {
  reset();
  currentTicket = { ...currentTicket, status: 'abierto', created_by: 21, assigned_to: null };
  const req = request({ id: 21, role: 'user' });
  const res = response();
  await router.gets['/requested/:id(\\d+)'](req, res);
  assert.equal(res.result[0], 'render');
  assert.equal(res.result[2].viewMode, 'requested');
  assert.deepEqual(notifications.find(entry => entry[0] === 'revisado'), ['revisado', 21, 44]);
});
