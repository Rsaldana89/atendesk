const multer = require('multer');
const sharp = require('sharp');
const { normalizeToJpgWithThumb } = require('./image');

const MAX_IMAGES = 4;
const MAX_IMAGE_MB = 5;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: MAX_IMAGES, fileSize: MAX_IMAGE_MB * 1024 * 1024, fields: 10, fieldSize: 100 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png'].includes(file.mimetype)) return cb(null, true);
    const err = new Error('Solo se aceptan imagenes JPG o PNG');
    err.status = 400;
    cb(err);
  }
});

// Multer ignora JSON: mantiene compatibilidad con integraciones preexistentes.
function uploadAnnouncementImages(req, res, next) {
  upload.array('images', MAX_IMAGES)(req, res, err => {
    if (!err) return next();
    if (err instanceof multer.MulterError || err.status === 400) {
      const message = err.code === 'LIMIT_FILE_SIZE'
        ? `Cada imagen debe pesar maximo ${MAX_IMAGE_MB} MB`
        : err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE'
          ? `Se permiten maximo ${MAX_IMAGES} imagenes, en el campo images`
          : err.message;
      return res.status(400).json({ error: message });
    }
    console.error('POST /api/announcements (multer):', err);
    return res.status(500).json({ error: 'Error procesando archivos' });
  });
}

async function processAnnouncementImages(files = []) {
  if (files.length > MAX_IMAGES) throw new Error(`Maximo ${MAX_IMAGES} imagenes`);
  const result = [];
  for (const file of files) {
    // Validar contenido real, no fiarse del MIME declarado por el navegador.
    const metadata = await sharp(file.buffer, { limitInputPixels: 40000000 }).metadata();
    if (!['jpeg','png'].includes(metadata.format)) {
      throw new Error('Solo se aceptan archivos JPG o PNG validos');
    }
    const converted = await normalizeToJpgWithThumb(file.buffer, { thumbWidth: 320, thumbHeight: 240 });
    result.push({ ...converted, original_name: String(file.originalname || '').slice(0, 255) });
  }
  return result;
}

function imageDescriptor(announcementId, row) {
  const base = `/api/announcements/${announcementId}/images/${row.id}`;
  return { id: row.id, seq: row.seq, thumb_url: `${base}/thumb`, raw_url: `${base}/raw` };
}

async function attachAnnouncementImageLists(db, announcements) {
  if (!announcements.length) return;
  for (const announcement of announcements) announcement.images = [];
  const ids = announcements.map(announcement => announcement.id);
  let images;
  try {
    [images] = await db.query(
      `SELECT id, announcement_id, seq FROM announcement_attachments
        WHERE announcement_id IN (${ids.map(() => '?').join(',')})
        ORDER BY announcement_id ASC, seq ASC`,
      ids
    );
  } catch (err) {
    // Permite que la consulta de anuncios antiguos siga operando durante el
    // despliegue escalonado si el DBA todavia no ha creado la nueva tabla.
    if (err.code === 'ER_NO_SUCH_TABLE') {
      console.warn('[anuncios 1.5] Falta la tabla announcement_attachments; revisar migracion SQL.');
      return;
    }
    throw err;
  }
  const index = new Map(announcements.map(announcement => [String(announcement.id), announcement]));
  for (const row of images) {
    const parent = index.get(String(row.announcement_id));
    if (parent) parent.images.push(imageDescriptor(parent.id, row));
  }
}

module.exports = {
  MAX_IMAGES, MAX_IMAGE_MB, uploadAnnouncementImages,
  processAnnouncementImages, attachAnnouncementImageLists
};
