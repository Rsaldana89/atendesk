// Pruebas sin BD real: validan reduccion de imagenes, reglas de destinatarios,
// persistencia / marcado y formato de la API de notificaciones.
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const sharp = require('sharp');
const { normalizeToJpgWithThumb } = require('../src/lib/image');

const eventCalls = [];
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === '../routes/events' && parent && parent.filename.endsWith('ticketNotifications.js')) {
    return { notifyTicketActivity: (userId, ticketId) => eventCalls.push([userId, ticketId]) };
  }
  if (request === 'multer') {
    const stub = () => ({ array: () => (_req, _res, next) => next() });
    stub.MulterError = class MulterError extends Error {};
    stub.memoryStorage = () => ({});
    return stub;
  }
  return originalLoad.apply(this, arguments);
};
const {
  getRecipients, publishTicketActivity, markTicketNotificationsRead
} = require('../src/lib/ticketNotifications');
const {
  processAnnouncementImages, attachAnnouncementImageLists, MAX_IMAGES
} = require('../src/lib/announcementImages');
Module._load = originalLoad;

function fakeDb(ticket = { created_by: 10, assigned_to: 20 }, activeIds = [10, 20]) {
  const sqlCalls = [];
  return {
    sqlCalls,
    async query(sql, params) {
      sqlCalls.push({ sql, params });
      if (sql.startsWith('SELECT created_by')) return [[ticket]];
      if (sql.startsWith('SELECT id FROM users')) {
        return [params.filter(id => activeIds.includes(id)).map(id => ({ id }))];
      }
      if (sql.includes('FROM announcement_attachments')) {
        return [[{ id: 100, seq: 1, announcement_id: 21 }]];
      }
      return [{ affectedRows: 1 }];
    }
  };
}

test('foto vertical 3000x4000 se limita a 900x1200 y thumb dentro de 240x180', async () => {
  const original = await sharp({ create: { width: 3000, height: 4000, channels: 3, background: 'white' } }).jpeg().toBuffer();
  const result = await normalizeToJpgWithThumb(original);
  assert.equal(result.height, 1200);
  assert.equal(result.width, 900);
  assert.equal(result.mime, 'image/jpeg');
  const thumb = await sharp(result.thumb).metadata();
  assert.ok(thumb.width <= 240 && thumb.height <= 180);
});

test('foto horizontal 4000x1500 se limita a 1600x600; foto pequena no se agranda', async () => {
  const input = await sharp({ create: { width: 4000, height: 1500, channels: 3, background: 'blue' } }).png().toBuffer();
  const normal = await normalizeToJpgWithThumb(input);
  assert.equal(normal.width, 1600);
  assert.equal(normal.height, 600);
  const small = await sharp({ create: { width: 320, height: 200, channels: 3, background: 'red' } }).png().toBuffer();
  const preserved = await normalizeToJpgWithThumb(small);
  assert.equal(preserved.width, 320);
  assert.equal(preserved.height, 200);
});

test('reglas campana: comentario/evidencia de usuario al asignado, de agente al creador', () => {
  const ticket = { created_by: 10, assigned_to: 20 };
  assert.deepEqual(getRecipients(ticket, 10, 'comment'), [20]);
  assert.deepEqual(getRecipients(ticket, 10, 'evidence'), [20]);
  assert.deepEqual(getRecipients(ticket, 20, 'comment'), [10]);
  assert.deepEqual(getRecipients(ticket, 30, 'comment'), [10]);
  assert.deepEqual(getRecipients(ticket, 10, 'status'), [20]);
  assert.deepEqual(getRecipients(ticket, 20, 'status'), [10]);
  assert.deepEqual(getRecipients(ticket, 30, 'status'), [10, 20]);
  assert.deepEqual(getRecipients(ticket, 30, 'assignment'), [10, 20]);
  assert.deepEqual(getRecipients({ created_by: 10, assigned_to: null }, 10, 'comment'), []);
});

test('notificacion persiste por destinatario activo; excluye autor; dispara SSE', async () => {
  eventCalls.length = 0;
  const db = fakeDb();
  const count = await publishTicketActivity(db, { ticketId: 27, actorId: 10, eventType: 'comment' });
  assert.equal(count, 1);
  const insert = db.sqlCalls.find(call => call.sql.startsWith('INSERT INTO ticket_notifications'));
  assert.ok(insert);
  assert.deepEqual(insert.params, [20, 27, 10, 'comment', 'Nuevo comentario']);
  assert.deepEqual(eventCalls, [[20, 27]]);
  const n = await publishTicketActivity(fakeDb({ created_by: 10, assigned_to: null }), {
    ticketId: 27, actorId: 10, eventType: 'comment'
  });
  assert.equal(n, 0);
});

test('lectura cambia solo notificaciones del usuario y ticket elegido', async () => {
  const db = fakeDb();
  await markTicketNotificationsRead(db, 20, 35);
  const sql = db.sqlCalls[0];
  assert.match(sql.sql, /read_at IS NULL/);
  assert.deepEqual(sql.params, [20, 35]);
});

test('procesador anuncios: 4 fotos y rechazo de contenido no JPG o PNG', async () => {
  const png = await sharp({ create: { width: 1500, height: 1000, channels: 3, background: 'green' } }).png().toBuffer();
  const images = await processAnnouncementImages(Array.from({ length: 4 }, (_, index) => ({
    buffer: png, originalname: `foto${index + 1}.png`, mimetype: 'image/png'
  })));
  assert.equal(MAX_IMAGES, 4);
  assert.equal(images.length, 4);
  for (const image of images) {
    assert.equal(image.mime, 'image/jpeg');
    assert.ok(image.width <= 1600 && image.height <= 1200);
    const thumb = await sharp(image.thumb).metadata();
    assert.ok(thumb.width <= 320 && thumb.height <= 240);
  }
  await assert.rejects(
    () => processAnnouncementImages([{ buffer: Buffer.from('fake'), originalname: 'archivo.jpg' }]),
    /input|image|format|unsupported|buffer/i
  );
  await assert.rejects(
    () => processAnnouncementImages(Array.from({ length: 5 }, () => ({ buffer: png }))),
    /Maximo 4/
  );
});

test('listado de anuncios anexa miniaturas sin consultar BLOB', async () => {
  const db = fakeDb();
  const rows = [{ id: 21, title: 'prueba' }];
  await attachAnnouncementImageLists(db, rows);
  assert.equal(rows[0].images.length, 1);
  assert.equal(rows[0].images[0].raw_url, '/api/announcements/21/images/100/raw');
  assert.equal(rows[0].images[0].thumb_url, '/api/announcements/21/images/100/thumb');
  assert.doesNotMatch(db.sqlCalls[0].sql, /SELECT\s+data/i);
});

test('sin tabla de anuncios, el listado viejo se mantiene operativo', async () => {
  const rows = [{ id: 1 }];
  const db = { async query() { const err = new Error('table absent'); err.code = 'ER_NO_SUCH_TABLE'; throw err; } };
  await attachAnnouncementImageLists(db, rows);
  assert.deepEqual(rows[0].images, []);
});
