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

module.exports = { canAccessTicket };
