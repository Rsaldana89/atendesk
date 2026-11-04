// Imagenes privadas de anuncios: se sirven desde MySQL, no desde /public.
const express = require('express');
const { pool } = require('../db');
const router = express.Router();

router.get('/:announcementId(\\d+)/images/:imageId(\\d+)/:kind(raw|thumb)', async (req, res) => {
  try {
    const id = Number(req.params.announcementId);
    const imageId = Number(req.params.imageId);
    if (!Number.isSafeInteger(id) || !Number.isSafeInteger(imageId) || id < 1 || imageId < 1) {
      return res.status(400).end();
    }
    const column = req.params.kind === 'thumb' ? 'thumb' : 'data';
    const [rows] = await pool.query(
      `SELECT ai.${column} AS payload
         FROM announcement_attachments ai
         JOIN announcements a ON a.id=ai.announcement_id
        WHERE ai.id=? AND ai.announcement_id=? AND a.active=1
          AND (a.until_date IS NULL OR a.until_date>=CURDATE()) LIMIT 1`,
      [imageId, id]
    );
    if (!rows.length || !rows[0].payload) return res.status(404).end();
    res.set({
      'Content-Type': 'image/jpeg',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
      'Content-Disposition': 'inline'
    });
    return res.end(rows[0].payload);
  } catch (err) {
    console.error('GET /api/announcements/:id/images/:imageId:', err);
    return res.status(500).end();
  }
});

module.exports = router;
