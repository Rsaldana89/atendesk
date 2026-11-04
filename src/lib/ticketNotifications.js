// Notificaciones internas independientes del flujo transaccional de tickets.
// Solo se invoca DESPUES del commit; cualquier error se trata en el llamador
// y nunca debe revertir una transicion o un comentario ya confirmados.
const { notifyTicketActivity } = require('../routes/events');

const STATUS_LABELS = Object.freeze({
  abierto: 'Abierto', en_progreso: 'En progreso', solucionado: 'Solucionado',
  reabierto: 'Reabierto', cerrado: 'Cerrado', cancelado: 'Cancelado'
});
const EVENT_MESSAGES = Object.freeze({
  comment: 'Nuevo comentario',
  evidence: 'Nueva evidencia',
  status: 'Cambio de estatus',
  assignment: 'Cambio de asignacion'
});

function getRecipients(ticket, actorId, eventType) {
  const creator = Number(ticket.created_by) || 0;
  const assigned = Number(ticket.assigned_to) || 0;
  const actor = Number(actorId) || 0;
  let ids;
  if (eventType === 'comment' || eventType === 'evidence') {
    // El solicitante informa al responsable; personal de atencion informa al solicitante.
    ids = actor === creator ? [assigned] : [creator];
  } else {
    // Estatus y asignacion: notificar a ambas partes, nunca al actor.
    ids = [creator, assigned];
  }
  return [...new Set(ids)].filter(id => id > 0 && id !== actor);
}

async function publishTicketActivity(db, { ticketId, actorId = null, eventType }) {
  if (!Object.hasOwn(EVENT_MESSAGES, eventType)) throw new Error('Tipo de notificacion invalido');
  const [[ticket]] = await db.query(
    'SELECT created_by, assigned_to, status FROM tickets WHERE id=? LIMIT 1',
    [ticketId]
  );
  if (!ticket) return 0;
  const recipientIds = getRecipients(ticket, actorId, eventType);
  if (!recipientIds.length) return 0;

  // Evita avisar a cuentas desactivadas (sin modificar el registro del ticket).
  const [active] = await db.query(
    `SELECT id FROM users WHERE is_active=1 AND id IN (${recipientIds.map(() => '?').join(',')})`,
    recipientIds
  );
  const ids = active.map(row => Number(row.id)).filter(Boolean);
  if (!ids.length) return 0;
  const fields = ids.map(() => '(?,?,?,?,?)').join(',');
  const values = [];
  const message = eventType === 'status'
    ? `Cambio de estatus: ${STATUS_LABELS[ticket.status] || 'actualizado'}`
    : EVENT_MESSAGES[eventType];
  ids.forEach(id => values.push(id, ticketId, Number(actorId) || null, eventType, message));
  await db.query(
    `INSERT INTO ticket_notifications (user_id, ticket_id, actor_id, event_type, message) VALUES ${fields}`,
    values
  );
  // SSE solo acelera la actualizacion: la tabla es la fuente persistente.
  for (const id of ids) {
    try { notifyTicketActivity(id, ticketId); } catch (err) {
      console.warn('[notificaciones] No se pudo emitir evento SSE:', err.message);
    }
  }
  return ids.length;
}

async function markTicketNotificationsRead(db, userId, ticketId) {
  if (!Number(userId) || !Number(ticketId)) return;
  await db.query(
    'UPDATE ticket_notifications SET read_at=NOW() WHERE user_id=? AND ticket_id=? AND read_at IS NULL',
    [userId, ticketId]
  );
}

module.exports = { getRecipients, publishTicketActivity, markTicketNotificationsRead };
