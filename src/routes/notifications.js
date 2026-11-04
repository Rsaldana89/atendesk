// GET /api/ticket-notifications: campana persistente para el usuario autenticado.
const express = require('express');
const { pool } = require('../db');
const { buildTicketScope } = require('../lib/ticketScope');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const user = req.session.user;
    if (!user || !user.id) return res.status(401).json({ error: 'No autenticado' });
    const { whereSql, params } = await buildTicketScope(pool, user);
    // Un empleado tambien puede consultar sus propios tickets desde /requested.
    const visibility = `((${whereSql}) OR t.created_by=?)`;
    const visibilityParams = [...params, user.id];
    const [[{ unread }]] = await pool.query(
      `SELECT COUNT(*) AS unread
         FROM ticket_notifications n JOIN tickets t ON t.id=n.ticket_id
        WHERE n.user_id=? AND n.read_at IS NULL AND ${visibility}`,
      [user.id, ...visibilityParams]
    );
    const [items] = await pool.query(
      `SELECT n.id, n.ticket_id, n.event_type, n.message, DATE_FORMAT(n.created_at,'%d/%m/%Y %H:%i') AS created_at, n.read_at,
              t.subject, t.created_by
         FROM ticket_notifications n JOIN tickets t ON t.id=n.ticket_id
        WHERE n.user_id=? AND ${visibility}
        ORDER BY n.id DESC LIMIT 20`,
      [user.id, ...visibilityParams]
    );
    const data = items.map(item => ({
      id: item.id,
      ticket_id: item.ticket_id,
      message: item.message,
      subject: item.subject,
      event_type: item.event_type,
      created_at: item.created_at,
      read: item.read_at != null,
      url: Number(item.created_by) === Number(user.id)
        ? `/tickets/requested/${item.ticket_id}`
        : `/tickets/${item.ticket_id}`
    }));
    res.set('Cache-Control', 'no-store');
    return res.json({ unread: Number(unread) || 0, items: data });
  } catch (err) {
    console.error('GET /api/ticket-notifications:', err);
    return res.status(503).json({ error: 'No se pudieron cargar las notificaciones' });
  }
});

module.exports = router;
