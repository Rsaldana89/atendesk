// src/lib/ticketAccess.js

const { buildTicketScope } = require('./ticketScope');

async function canAccessTicket(pool, user, ticketId) {
  const { whereSql, params } = await buildTicketScope(pool, user);
  const [rows] = await pool.query(
    `SELECT 1 FROM tickets t WHERE t.id = ? AND ${whereSql} LIMIT 1`,
    [ticketId, ...params]
  );
  return rows.length > 0;
}

// Los empleados que crearon un ticket lo ven en 'Solicitados', no en 'Por atender'.
// Este permiso de lectura es necesario para mostrar sus propias evidencias.
async function canReadTicket(pool, user, ticketId) {
  if (!user || !user.id) return false;
  if (await canAccessTicket(pool, user, ticketId)) return true;
  const [rows] = await pool.query(
    'SELECT 1 FROM tickets WHERE id=? AND created_by=? LIMIT 1',
    [ticketId, user.id]
  );
  return rows.length > 0;
}

module.exports = { canAccessTicket, canReadTicket };
