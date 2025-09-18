// src/lib/ticketStatus.js
const STATES = {
  ABIERTO: 'abierto',
  EN_PROGRESO: 'en_progreso',
  SOLUCIONADO: 'solucionado',
  REABIERTO: 'reabierto',
  CERRADO: 'cerrado',
  CANCELADO: 'cancelado',
};

// Canonical roles used throughout the application.  We normalise any
// incoming role to these values.  Spanish role names such as
// "agente" and "usuario" will be converted to their English
// equivalents ("agent" and "user") in normRole().
const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  AGENT: 'agent',
  USER: 'user',
  SYSTEM: 'system'
};

// Matriz de transiciones permitidas (por rol)
const TRANSITIONS = {
  [STATES.ABIERTO]: {
    [STATES.EN_PROGRESO]: [ROLES.ADMIN, ROLES.MANAGER, ROLES.AGENT],
    [STATES.CANCELADO]:   [ROLES.ADMIN, ROLES.MANAGER, ROLES.USER],
  },
  [STATES.EN_PROGRESO]: {
    [STATES.ABIERTO]:     [ROLES.ADMIN, ROLES.MANAGER, ROLES.AGENT],
    [STATES.SOLUCIONADO]: [ROLES.ADMIN, ROLES.MANAGER, ROLES.AGENT],
    [STATES.CANCELADO]:   [ROLES.ADMIN, ROLES.MANAGER, ROLES.USER],
  },
  [STATES.SOLUCIONADO]: {
    [STATES.CERRADO]:     [ROLES.ADMIN, ROLES.USER], // + auto-cierre (system)
    [STATES.REABIERTO]:   [ROLES.ADMIN, ROLES.MANAGER, ROLES.AGENT, ROLES.USER],
  },
  [STATES.REABIERTO]: {
    [STATES.EN_PROGRESO]: [ROLES.ADMIN, ROLES.MANAGER, ROLES.AGENT],
    [STATES.SOLUCIONADO]: [ROLES.ADMIN, ROLES.MANAGER, ROLES.AGENT],
    [STATES.CANCELADO]:   [ROLES.ADMIN, ROLES.MANAGER, ROLES.USER],
  },
  [STATES.CERRADO]: {
    [STATES.REABIERTO]:   [ROLES.ADMIN, ROLES.MANAGER, ROLES.AGENT, ROLES.USER],
  },
  [STATES.CANCELADO]: { /* final */ },
};

const LABELS = {
  [STATES.ABIERTO]: 'Abierto',
  [STATES.EN_PROGRESO]: 'En progreso',
  [STATES.SOLUCIONADO]: 'Solucionado',
  [STATES.REABIERTO]: 'Reabierto',
  [STATES.CERRADO]: 'Cerrado',
  [STATES.CANCELADO]: 'Cancelado',
};

function normRole(role = '') {
  // Normalise role strings to canonical values.  Spanish role names are
  // converted to English equivalents.
  const r = String(role || '').toLowerCase();
  if (r === 'agente' || r === 'agent') return 'agent';
  if (r === 'usuario' || r === 'user') return 'user';
  return r;
}

function canTransition(from, to, roleRaw) {
  const role = normRole(roleRaw);
  const allowed = TRANSITIONS[from]?.[to] || [];
  return allowed.includes(role);
}

// Calcula qué timestamps actualizar en cada transición
function nextTimestamps(from, to, now, userId=null) {
  const t = { last_state_change_at: now };
  if (from === STATES.ABIERTO && to === STATES.EN_PROGRESO) t.first_response_at = now;
  if ([STATES.EN_PROGRESO, STATES.REABIERTO].includes(from) && to === STATES.SOLUCIONADO) {
    t.solved_at = now; t.solved_by_user_id = userId;
  }
  if (from === STATES.SOLUCIONADO && to === STATES.CERRADO) {
    t.closed_at = now; t.closed_by_user_id = userId;
  }
  if (to === STATES.CANCELADO) {
    t.canceled_at = now; t.canceled_by_user_id = userId;
  }
  if (to === STATES.REABIERTO) t.reopened_count = { $inc: 1 };
  return t;
}

module.exports = { STATES, ROLES, LABELS, canTransition, nextTimestamps, normRole };
