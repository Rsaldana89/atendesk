/*
 * Tarea de autocierre de tickets.
 *
 * Este módulo revisa periódicamente los tickets con estatus "solucionado"
 * que fueron marcados como solucionados hace más de 48 horas y los cierra
 * automáticamente.  También registra una entrada en la tabla
 * `ticket_transitions` con el actor "system" para que quede un historial
 * de esta transición.  No envía notificaciones de correo; si se desean
 * notificar cierres automáticos se puede extender este módulo para usar
 * `notifyByConfig`.
 *
 * La frecuencia de ejecución se controla mediante la variable de entorno
 * `AUTO_CLOSE_FREQUENCY_HOURS`.  Por defecto ejecuta cada 12 horas (dos
 * veces al día).  Puedes establecer, por ejemplo, `AUTO_CLOSE_FREQUENCY_HOURS=6`
 * para revisiones cada 6 horas.
 */

const { pool } = require('../db');
const { STATES, ROLES } = require('../lib/ticketStatus');

// Obtiene la frecuencia en horas desde la variable de entorno.
const freq = Math.max(parseInt(process.env.AUTO_CLOSE_FREQUENCY_HOURS || '12', 10) || 12, 1);
const intervalMs = freq * 60 * 60 * 1000;

async function autoCloseTickets() {
  try {
    // Selecciona tickets en estado solucionado con solved_at hace 48 horas o más
    const [toClose] = await pool.query(
      `SELECT id
         FROM tickets
        WHERE status = ?
          AND solved_at IS NOT NULL
          AND solved_at <= DATE_SUB(NOW(), INTERVAL 48 HOUR)`,
      [STATES.SOLUCIONADO]
    );
    if (!toClose.length) return;

    for (const row of toClose) {
      const ticketId = row.id;
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        // Verificar nuevamente dentro de la transacción que el ticket siga en estado solucionado
        const [[ticket]] = await conn.query(
          'SELECT status FROM tickets WHERE id=? FOR UPDATE',
          [ticketId]
        );
        if (!ticket || ticket.status !== STATES.SOLUCIONADO) {
          await conn.rollback();
          continue;
        }
        const now = new Date();
        // Actualiza el ticket a cerrado y registra timestamps
        await conn.query(
          `UPDATE tickets
              SET status = ?,
                  closed_at = ?,
                  closed_by_user_id = NULL,
                  last_state_change_at = ?
            WHERE id = ?`,
          [STATES.CERRADO, now, now, ticketId]
        );
        // Inserta la transición en el historial
        await conn.query(
          `INSERT INTO ticket_transitions
             (ticket_id, actor_id, actor_role, from_status, to_status, note, ip_address, user_agent)
           VALUES (?, NULL, ?, ?, ?, ?, ?, ?)`,
          [
            ticketId,
            ROLES.SYSTEM,
            STATES.SOLUCIONADO,
            STATES.CERRADO,
            'Cierre automático después de 48 horas',
            null,
            'auto-close'
          ]
        );
        await conn.commit();
        console.log(`Ticket #${ticketId} cerrado automáticamente por haber estado solucionado más de 48 horas`);
      } catch (err) {
        await conn.rollback();
        console.error('Error al cerrar ticket automáticamente', ticketId, err.message);
      } finally {
        conn.release();
      }
    }
  } catch (err) {
    console.error('autoCloseTickets error', err.message);
  }
}

// Ejecuta una revisión al iniciar
autoCloseTickets().catch(() => {});
// Programa la ejecución periódica
setInterval(() => {
  autoCloseTickets().catch(() => {});
}, intervalMs);

module.exports = { autoCloseTickets };