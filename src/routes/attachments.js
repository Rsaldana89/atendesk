// src/routes/attachments.js
const express = require('express');
const multer  = require('multer');
const crypto  = require('crypto');
const { pool } = require('../db');

const router = express.Router();

const MAX_FILES = parseInt(process.env.MAX_FILES_PER_TICKET || '2', 10);
const MAX_MB    = parseInt(process.env.MAX_FILE_MB || '5', 10);

/* ----- Normalizador de imágenes (opcional) ----- */
let normalizeToJpgWithThumb;
let HAS_NORMALIZER = true;
try {
  // Si ../lib/image (sharp) no está disponible, este require lanzará y caeremos al fallback
  ({ normalizeToJpgWithThumb } = require('../lib/image'));
} catch (e) {
  HAS_NORMALIZER = false;
  console.warn('[attachments] Normalizador no disponible; usando fallback. Motivo:', e.message);
  // Fallback: no convierte; devuelve los mismos bytes y mime del archivo
  normalizeToJpgWithThumb = async (buffer, mimetype = 'application/octet-stream') => ({
    data: buffer,
    thumb: buffer,     // si quieres, aquí podrías hacer un slice a los primeros ~200KB
    size: buffer.length,
    width: null,
    height: null,
    mime: mimetype
  });
}

/* ----- Multer (memoria) ----- */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_MB * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (['image/jpeg', 'image/png'].includes(file.mimetype)) cb(null, true);
    else cb(new Error('Solo JPG o PNG'));
  }
});

/* Agregar 1 o 2 evidencias a un ticket existente */
router.post('/tickets/:id/attachments', upload.array('evidencias', MAX_FILES), async (req, res) => {
  const ticketId = Number(req.params.id);
  if (!Number.isInteger(ticketId) || ticketId <= 0) {
    return res.status(400).json({ error: 'ID de ticket inválido' });
  }
  const userId = req.session?.user?.id || 0;

  try {
    const [rowsCnt] = await pool.query(
      'SELECT COUNT(*) AS cnt FROM ticket_attachments WHERE ticket_id=?',
      [ticketId]
    );
    const cnt = rowsCnt[0]?.cnt || 0;
    if (cnt >= 2) {
      return res.status(400).json({ error: 'Ya hay 2 adjuntos en este ticket' });
    }

    let nextSeq = cnt + 1;

    for (const f of (req.files || [])) {
      if (nextSeq > 2) break;

      // Normaliza si hay normalizador, si no, pasa tal cual
      const img = await normalizeToJpgWithThumb(f.buffer, f.mimetype);
      // Si hay normalizador, el destino será JPG; si no, conserva el mimetype original
      const targetMime = img.mime || (HAS_NORMALIZER ? 'image/jpeg' : (f.mimetype || 'application/octet-stream'));

      const checksum = crypto.createHash('sha256').update(img.data).digest('hex');

      // Evita duplicado exacto
      const [dup] = await pool.query(
        'SELECT id FROM ticket_attachments WHERE ticket_id=? AND checksum_sha256=?',
        [ticketId, checksum]
      );
      if (dup.length) continue;

      await pool.query(
        `INSERT INTO ticket_attachments
           (ticket_id, seq, original_name, mime_type, data, thumb,
            size_bytes, width, height, checksum_sha256, uploaded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [ticketId, nextSeq, f.originalname || null, targetMime,
         img.data, img.thumb, img.size, img.width, img.height, checksum, userId]
      );

      nextSeq++;
    }

    res.json({ ok: true });
  } catch (e) {
    console.error('POST /tickets/:id/attachments', e);
    // Si el error vino de Multer (peso, etc.)
    if (e instanceof multer.MulterError) {
      return res.status(400).json({ error: e.message });
    }
    res.status(500).json({ error: 'Error subiendo evidencias' });
  }
});

/* Miniatura */
router.get('/attachments/:attId/thumb', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT mime_type, thumb FROM ticket_attachments WHERE id=?',
      [req.params.attId]
    );
    if (!rows.length || !rows[0].thumb) return res.status(404).send('No encontrado');
    res.set('Content-Type', rows[0].mime_type || 'application/octet-stream');
    res.set('Cache-Control', 'private, max-age=600');
    res.end(rows[0].thumb);
  } catch (e) {
    console.error('GET /attachments/:attId/thumb', e);
    res.status(500).send('Error sirviendo miniatura');
  }
});

/* Imagen completa */
router.get('/attachments/:attId/raw', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT mime_type, data FROM ticket_attachments WHERE id=?',
      [req.params.attId]
    );
    if (!rows.length) return res.status(404).send('No encontrado');
    res.set('Content-Type', rows[0].mime_type || 'application/octet-stream');
    res.set('Cache-Control', 'private, max-age=600');
    res.end(rows[0].data);
  } catch (e) {
    console.error('GET /attachments/:attId/raw', e);
    res.status(500).send('Error sirviendo imagen');
  }
});

/* Eliminar evidencia y compactar secuencia */
router.delete('/attachments/:attId', async (req, res) => {
  try {
    const [[row]] = await pool.query(
      'SELECT ticket_id, seq FROM ticket_attachments WHERE id=?',
      [req.params.attId]
    );
    if (!row) return res.status(404).json({ error: 'No encontrado' });

    await pool.query('DELETE FROM ticket_attachments WHERE id=?', [req.params.attId]);
    await pool.query(
      `UPDATE ticket_attachments SET seq=1
         WHERE ticket_id=? AND seq=2
           AND NOT EXISTS (SELECT 1 FROM ticket_attachments WHERE ticket_id=? AND seq=1)`,
      [row.ticket_id, row.ticket_id]
    );

    res.json({ ok: true });
  } catch (e) {
    console.error('DELETE /attachments/:attId', e);
    res.status(500).json({ error: 'No se pudo eliminar' });
  }
});

module.exports = router;
