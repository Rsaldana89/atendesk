// src/routes/events.js
//
// Este módulo implementa un endpoint Server‑Sent Events (SSE) para
// notificar en tiempo real la llegada de nuevos tickets a los
// usuarios que están autenticados en la aplicación.  Cada cliente
// establece una conexión persistente vía GET /events y se mantiene
// abierta hasta que el navegador cierra la pestaña o se desconecta.
// Cuando se crea un ticket nuevo, se invoca la función
// notifyNewTicket() que recorre todas las conexiones activas y
// envía la notificación a aquellos usuarios que correspondan según
// su rol y departamentos accesibles.

const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Almacena las conexiones SSE por cliente.  Cada entrada es un
// objeto { res, userId, role, deptIds }.  deptIds es una lista de
// IDs de departamento (números) a los que el usuario tiene acceso.
// Para administradores se utiliza el valor '*' para indicar que
// reciben notificaciones de todos los departamentos.
const clients = new Set();

// Suscripción SSE.  Esta ruta debe montarse con requireAuth para
// garantizar que el usuario esté autenticado.  Inicia la
// conexión SSE y registra los departamentos accesibles del usuario.
router.get('/', async (req, res) => {
  const user = req.session.user;
  if (!user) {
    return res.status(401).end();
  }
  // Configura cabeceras para SSE
  res.status(200).set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });
  // Flusha cabeceras y envía un comentario inicial para abrir el stream
  if (res.flushHeaders) res.flushHeaders();
  res.write(':\n\n');
  // Determina los departamentos accesibles para managers y agentes
  let deptIds = [];
  try {
    const role = (user.role || '').toLowerCase();
    if (role === 'admin') {
      deptIds = ['*'];
    } else if (role === 'manager' || role === 'agent') {
      const [rows] = await pool.query(
        'SELECT department_id AS id FROM user_department_access WHERE user_id=?',
        [user.id]
      );
      deptIds = rows.map(r => Number(r.id));
    }
  } catch (err) {
    console.error('Error obteniendo departamentos para SSE:', err);
  }
  // Registra cliente
  const client = { res, userId: user.id, role: user.role, deptIds };
  clients.add(client);
  // Elimina cliente al cerrar conexión
  req.on('close', () => {
    clients.delete(client);
  });
});

/**
 * Envía una notificación SSE a los clientes conectados cuando se crea
 * un ticket nuevo.  Evalúa el rol y los departamentos accesibles de
 * cada cliente para decidir si debe recibir la notificación.  Se
 * omiten usuarios cuyo rol no sea admin, manager o agent.  Al enviar
 * se serializa el objeto de datos a JSON y se construye un evento
 * SSE simple (sin nombre específico).
 *
 * @param {object} ticket Objeto que contiene id, department_id,
 *   department_name, category y subject del ticket.
 */
function notifyNewTicket(ticket) {
  const payload = {
    type: 'newTicket',
    id: ticket.id,
    departmentId: ticket.department_id,
    department: ticket.department_name || '',
    category: ticket.category || '',
    subject: ticket.subject || ''
  };
  const dataStr = `data: ${JSON.stringify(payload)}\n\n`;
  for (const client of clients) {
    const role = (client.role || '').toLowerCase();
    if (role !== 'admin' && role !== 'manager' && role !== 'agent') continue;
    const allowed = client.deptIds.includes('*') || client.deptIds.includes(ticket.department_id);
    if (!allowed) continue;
    try {
      client.res.write(dataStr);
    } catch (err) {
      clients.delete(client);
    }
  }
}

module.exports = { router, notifyNewTicket };