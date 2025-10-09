// src/lib/ticketStatus.js
const STATES = {
  ABIERTO: 'abierto',
  EN_PROGRESO: 'en_progreso',
  SOLUCIONADO: 'solucionado',
  REABIERTO: 'reabierto',
  CERRADO: 'cerrado',
  CANCELADO: 'cancelado',
};

// Canonical roles used throughout the application.
// Normalizamos los nombres de rol para evitar duplicidad
// (ej. “agente” → “agent”, “usuario” → “user”).
const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  AGENT: 'agent',
  USER: 'user',
  SYSTEM: 'system'
};

// Matriz de transiciones permitidas (por rol).
// Se amplió para:
// - permitir que los agentes también puedan cancelar,
// - permitir que los managers puedan cerrar tickets solucionados,
// - mantener la regla extra para managers/agentes creadores.
const TRANSITIONS = {
  [STATES.ABIERTO]: {
    // Aceptar: abierto → en_progreso
    [STATES.EN_PROGRESO]: [ROLES.ADMIN, ROLES.MANAGER, ROLES.AGENT],
    // Cancelar: abierto → cancelado
    [STATES.CANCELADO]:   [ROLES.ADMIN, ROLES.MANAGER, ROLES.AGENT, ROLES.USER],
  },
  [STATES.EN_PROGRESO]: {
    // Liberar: en_progreso → abierto
    [STATES.ABIERTO]:     [ROLES.ADMIN, ROLES.MANAGER, ROLES.AGENT],
    // Solucionar: en_progreso → solucionado
    [STATES.SOLUCIONADO]: [ROLES.ADMIN, ROLES.MANAGER, ROLES.AGENT],
    // Cancelar: en_progreso → cancelado
    [STATES.CANCELADO]:   [ROLES.ADMIN, ROLES.MANAGER, ROLES.AGENT, ROLES.USER],
  },
  [STATES.SOLUCIONADO]: {
    // Cerrar: solucionado → cerrado
    // 🔑 Ahora managers también pueden cerrar directamente
    [STATES.CERRADO]:     [ROLES.ADMIN, ROLES.MANAGER, ROLES.USER], // + auto-cierre (system)
    // Reabrir: solucionado → reabierto
    [STATES.REABIERTO]:   [ROLES.ADMIN, ROLES.MANAGER, ROLES.AGENT, ROLES.USER],
  },
  [STATES.REABIERTO]: {
    // Retomar: reabierto → en_progreso
    [STATES.EN_PROGRESO]: [ROLES.ADMIN, ROLES.MANAGER, ROLES.AGENT],
    // Solucionar: reabierto → solucionado
    [STATES.SOLUCIONADO]: [ROLES.ADMIN, ROLES.MANAGER, ROLES.AGENT],
    // Cancelar: reabierto → cancelado
    [STATES.CANCELADO]:   [ROLES.ADMIN, ROLES.MANAGER, ROLES.AGENT, ROLES.USER],
  },
  [STATES.CERRADO]: {
    // Reabrir: cerrado → reabierto
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
  const r = String(role || '').toLowerCase();
  if (r === 'agente' || r === 'agent') return 'agent';
  if (r === 'usuario' || r === 'user') return 'user';
  return r;
}

function canTransition(from, to, roleRaw, ctx = {}) {
  const role = normRole(roleRaw);
  const allowed = TRANSITIONS[from]?.[to] || [];
  if (allowed.includes(role)) return true;

  // Regla extra: permitir a agent/manager cerrar si son los creadores
  if (
    from === STATES.SOLUCIONADO &&
    to === STATES.CERRADO &&
    (role === ROLES.MANAGER || role === ROLES.AGENT) &&
    ctx && ctx.ticket && ctx.userId &&
    ctx.ticket.created_by === ctx.userId
  ) {
    return true;
  }

  return false;
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
