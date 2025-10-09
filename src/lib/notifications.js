const nodemailer = (() => {
  try {
    return require('nodemailer');
  } catch (err) {
    // Si nodemailer no está instalado, devolvemos null para usar un stub de envío
    console.warn('nodemailer no está instalado; los correos se imprimirán en consola.');
    return null;
  }
})();

let transporter;

function getTransporter() {
  if (transporter) return transporter;
  if (nodemailer) {
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    if (host && user && pass) {
      transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass }
      });
    }
  }
  if (!transporter) {
    // Fallback: stub que imprime en consola en lugar de enviar
    transporter = {
      async sendMail(opts) {
        console.log('Correo simulado:', opts);
      }
    };
  }
  return transporter;
}

const fs   = require('fs');
const path = require('path');

// Carga de reglas de notificaciones a partir de un archivo JSON.
//
// Se busca un archivo llamado "notificaciones.json" en la raíz del proyecto.
// Este JSON permite definir reglas finas para administradores, managers y agentes.
//
// La estructura soporta tres claves de primer nivel: "admins", "managers" y
// "agents".  Cada una de estas puede tomar diferentes formas según el grado
// de control deseado:
//
//   • Booleano (true/false):
//     - true  → todos los usuarios de ese rol serán notificados para
//               cualquier categoría.
//     - false → ningún usuario de ese rol será notificado.
//
//   • Objeto: permite reglas por usuario (clave) y una regla por defecto
//     mediante el carácter "*".  El valor asignado a cada clave puede ser:
//       - "all" o true  → notificar al usuario para cualquier categoría.
//       - false         → nunca notificar a ese usuario.
//       - Array de cadenas → notificar sólo si la categoría del ticket está
//                            incluida (comparación insensible a mayúsculas).
//
// Un ejemplo completo podría verse así:
// {
//   "admins": true,
//   "managers": {
//     "*": "all",                      // todos los managers reciben todas las categorías
//     "jefe_logistica": false,        // pero el usuario jefe_logistica nunca recibe
//     "luis.garcia": ["Software", "Red"]
//   },
//   "agents": {
//     "*": "all",
//     "agente_cedis": ["PEDIDOS", "MERCANCIA"]
//   }
// }
//
// Si una clave de rol no está presente, se asume false (no notificar).  Si
// está presente pero es undefined o null, también se considera false.
//
// Esta configuración ofrece flexibilidad para excluir a usuarios específicos
// o restringir notificaciones a categorías concretas.
let _notifRules = {};
(() => {
  try {
    const cfgPath = path.join(__dirname, '..', '..', 'notificaciones.json');
    if (fs.existsSync(cfgPath)) {
      const raw = fs.readFileSync(cfgPath, 'utf8');
      _notifRules = JSON.parse(raw) || {};
    } else {
      console.warn('Archivo notificaciones.json no encontrado; no se aplicarán reglas personalizadas de notificación.');
    }
  } catch (err) {
    console.error('Error cargando notificaciones.json:', err);
    _notifRules = {};
  }
})();

/**
 * Notifica a los usuarios adecuados según las reglas definidas en notificaciones.json.
 * Se consideran administradores, managers y agentes del departamento del ticket.
 * Para los agentes se pueden definir reglas por nombre de usuario o una regla
 * predeterminada mediante la clave "*".  Si una regla es "all" o true, se
 * envía la notificación para cualquier categoría; si es un arreglo, se evalúa
 * si la categoría del ticket coincide (ignorando mayúsculas/minúsculas).
 *
 * @param {object} pool - pool de conexiones MySQL
 * @param {object} ticket - Objeto con los datos mínimos del ticket: id, department_id, category, subject, creator_name
 * @param {string} eventType - Tipo de evento: "created" o "closed"
 * @param {object} [options]
 * @param {number[]} [options.skipUserIds] - IDs de usuarios que no deben recibir la notificación
 */
async function notifyByConfig(pool, ticket, eventType = 'created', { skipUserIds = [] } = {}) {
  const rules = _notifRules || {};
  // Recopilaremos los destinatarios en este objeto, indexados por id de usuario
  const recipients = {};

  /**
   * Determina si un valor de regla habilita la notificación para la categoría
   * indicada.  Devuelve true para "all" o true, false para null/undefined/
   * false, y para arreglos devuelve true si incluye la categoría (case
   * insensitive).
   *
   * @param {any} ruleValue Valor de la regla (booleano, string, array)
   * @param {string} category Categoría del ticket
   * @returns {boolean}
   */
  function shouldNotify(ruleValue, category) {
    if (!ruleValue) return false;
    if (ruleValue === true || ruleValue === 'all') return true;
    if (Array.isArray(ruleValue)) {
      const cat = String(category || '').toLowerCase();
      return ruleValue.some(c => String(c).toLowerCase() === cat);
    }
    return false;
  }

  // ------------------ Administradores ------------------
  // Permite booleano o objeto similar a managers/agents
  const adminRules = rules.admins;
  if (adminRules) {
    // Si es booleano true → todos los admins
    // Si es objeto → reglas por usuario (igual que managers/agents)
    const [admins] = await pool.query(
      `SELECT id, username, full_name, email
         FROM users
        WHERE role='admin' AND email IS NOT NULL AND email <> ''`
    );
    if (typeof adminRules === 'object' && adminRules !== null) {
      // Objeto de reglas
      for (const u of admins) {
        if (skipUserIds.includes(u.id)) continue;
        let rule;
        if (Object.prototype.hasOwnProperty.call(adminRules, u.username)) {
          rule = adminRules[u.username];
        } else if (Object.prototype.hasOwnProperty.call(adminRules, u.full_name)) {
          rule = adminRules[u.full_name];
        } else if (Object.prototype.hasOwnProperty.call(adminRules, '*')) {
          rule = adminRules['*'];
        }
        if (shouldNotify(rule, ticket.category)) recipients[u.id] = u;
      }
    } else if (adminRules === true || adminRules === 'all') {
      // Todos los admins reciben notificación para cualquier categoría
      for (const u of admins) {
        if (!skipUserIds.includes(u.id)) recipients[u.id] = u;
      }
    }
  }

  // ------------------ Managers del departamento ------------------
  const mgrRules = rules.managers;
  if (mgrRules) {
    const [managers] = await pool.query(
      `SELECT u.id, u.username, u.full_name, u.email
         FROM users u
         JOIN user_department_access uda ON uda.user_id = u.id
        WHERE u.role='manager' AND uda.department_id = ? AND u.email IS NOT NULL AND u.email <> ''`,
      [ticket.department_id]
    );
    if (typeof mgrRules === 'object' && mgrRules !== null) {
      for (const u of managers) {
        if (skipUserIds.includes(u.id)) continue;
        let rule;
        if (Object.prototype.hasOwnProperty.call(mgrRules, u.username)) {
          rule = mgrRules[u.username];
        } else if (Object.prototype.hasOwnProperty.call(mgrRules, u.full_name)) {
          rule = mgrRules[u.full_name];
        } else if (Object.prototype.hasOwnProperty.call(mgrRules, '*')) {
          rule = mgrRules['*'];
        }
        if (shouldNotify(rule, ticket.category)) recipients[u.id] = u;
      }
    } else if (mgrRules === true || mgrRules === 'all') {
      for (const u of managers) {
        if (!skipUserIds.includes(u.id)) recipients[u.id] = u;
      }
    }
  }

  // ------------------ Agentes del departamento ------------------
  let agRules = rules.agents;
  if (agRules) {
    // Convertir booleanos en un objeto con "*" para uniformidad
    if (agRules === true || agRules === 'all') {
      agRules = { '*': 'all' };
    }
    const [agents] = await pool.query(
      `SELECT u.id, u.username, u.full_name, u.email
         FROM users u
         JOIN user_department_access uda ON uda.user_id = u.id
        WHERE u.role='agent' AND uda.department_id = ? AND u.email IS NOT NULL AND u.email <> ''`,
      [ticket.department_id]
    );
    if (typeof agRules === 'object' && agRules !== null) {
      for (const ag of agents) {
        if (skipUserIds.includes(ag.id)) continue;
        let rule;
        if (Object.prototype.hasOwnProperty.call(agRules, ag.username)) {
          rule = agRules[ag.username];
        } else if (Object.prototype.hasOwnProperty.call(agRules, ag.full_name)) {
          rule = agRules[ag.full_name];
        } else if (Object.prototype.hasOwnProperty.call(agRules, '*')) {
          rule = agRules['*'];
        }
        if (shouldNotify(rule, ticket.category)) recipients[ag.id] = ag;
      }
    }
  }

  // Filtra destinatarios por email válido y elimina duplicados
  const recList = Object.values(recipients).filter(r => r.email);
  if (!recList.length) return;
  // Obtener nombre del departamento si no lo trae el ticket
  let departmentName = ticket.department_name;
  if (!departmentName && ticket.department_id) {
    try {
      const [[row]] = await pool.query('SELECT name FROM departments WHERE id = ?', [ticket.department_id]);
      departmentName = row ? row.name : '';
    } catch (e) {
      departmentName = '';
    }
  }
  const actionStr = eventType === 'closed' ? 'cerrado' : 'creado';
  const subject = `[${departmentName}] ${ticket.category} · Ticket #${ticket.id} — ${ticket.subject}`;
  const html = `
    <p>Se ha ${actionStr} un ticket de tu departamento.</p>
    <ul>
      <li><strong>ID:</strong> ${ticket.id}</li>
      <li><strong>Departamento:</strong> ${departmentName}</li>
      <li><strong>Categoría:</strong> ${ticket.category}</li>
      <li><strong>Asunto:</strong> ${ticket.subject}</li>
      <li><strong>Reportado por:</strong> ${ticket.creator_name || ''}</li>
    </ul>
    <p><a href="${process.env.APP_BASE_URL || ''}/tickets/${ticket.id}">Ver ticket</a></p>
  `;
  await Promise.all(recList.map(u => sendMail(u.email, subject, html)));
}

/**
 * Envía un correo utilizando el transporter configurado. Si no hay transporter, se imprime en consola.
 * @param {string|string[]} to - destinatario(s)
 * @param {string} subject - asunto del correo
 * @param {string} html - cuerpo del correo en HTML
 */
async function sendMail(to, subject, html) {
  const t = getTransporter();
  const from = process.env.NOTIFY_FROM || process.env.SMTP_FROM || 'helpdesk@example.com';
  await t.sendMail({ from, to, subject, html });
}

/**
 * Notifica a los suscriptores de una categoría cuando se crea un ticket.
 * @param {object} pool - pool de conexiones MySQL
 * @param {object} ticket - Objeto con info del ticket (id, department_id, department_name, category, subject, creator_name)
 * @param {object} [options]
 * @param {number[]} [options.skipUserIds] - IDs de usuarios a excluir del envío (por ejemplo, quien crea el ticket)
 */
async function notifyCategory(pool, ticket, { skipUserIds = [] } = {}) {
  const subs = await getCategorySubscribers(pool, ticket.department_id, ticket.category);
  const recipients = subs.filter(u => !skipUserIds.includes(u.id));
  if (!recipients.length) return;
  const subject = `[${ticket.department_name}] ${ticket.category} · Ticket #${ticket.id} — ${ticket.subject}`;
  const html = `
    <p>Se ha creado un nuevo ticket de tu categoría suscrita.</p>
    <ul>
      <li><strong>ID:</strong> ${ticket.id}</li>
      <li><strong>Departamento:</strong> ${ticket.department_name}</li>
      <li><strong>Categoría:</strong> ${ticket.category}</li>
      <li><strong>Asunto:</strong> ${ticket.subject}</li>
      <li><strong>Reportado por:</strong> ${ticket.creator_name}</li>
    </ul>
    <p><a href="${process.env.APP_BASE_URL || ''}/tickets/${ticket.id}">Ver ticket</a></p>
  `;
  await Promise.all(recipients.map(u => sendMail(u.email, subject, html)));
}

module.exports = { notifyByConfig };
// test comment