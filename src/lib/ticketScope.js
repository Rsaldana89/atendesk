// src/lib/ticketScope.js
/**
 * Construye el alcance para mostrar tickets a los que el actor puede dar
 * seguimiento ("tickets por atender").  El administrador puede ver todos
 * los tickets.  Los managers y agentes ven los tickets de sus
 * departamentos o asignados a ellos, **excluyendo** los tickets que
 * ellos mismos levantaron.  Los usuarios finales (rol "user") sólo
 * ven los tickets que ellos crearon.
 *
 * @param {object} pool - Conexión a la base de datos
 * @param {object} user - Usuario autenticado
 * @returns {object} Objeto con propiedades whereSql y params para la consulta
 */
async function buildTicketScope(pool, user) {
  // Admin: acceso total
  if (user.role === 'admin') {
    return { whereSql: '1=1', params: [] };
  }

  // Managers y agentes: tickets de sus departamentos o asignados a ellos,
  // pero **no** incluyen los tickets creados por ellos mismos.  La idea es
  // que los tickets que levantaron se muestren en su bandeja de "tickets
  // solicitados" (ver buildRequestedScope()).
  if (user.role === 'manager' || user.role === 'agent') {
    const whereSql = `
      (
        (t.department_id IN (
           SELECT department_id FROM user_department_access WHERE user_id = ?
         )
         OR t.assigned_to = ?
        )
        AND t.created_by <> ?
      )
    `;
    return { whereSql, params: [user.id, user.id, user.id] };
  }

  // Usuarios finales (rol user): sólo ven los tickets que crearon
  return { whereSql: 't.created_by = ?', params: [user.id] };
}

/**
 * Construye el alcance para mostrar únicamente los tickets solicitados por
 * el usuario ("tickets solicitados").  Aquí no se consideran los tickets
 * del departamento ni los asignados; simplemente se filtra por
 * created_by.  Utilizar esta función cuando se desee listar únicamente
 * los tickets creados por el actor actual (independientemente de su rol).
 *
 * @param {object} user - Usuario autenticado
 * @returns {object} Objeto con propiedades whereSql y params para la consulta
 */
function buildRequestedScope(user) {
  if (!user || !user.id) {
    return { whereSql: '0', params: [] };
  }
  return { whereSql: 't.created_by = ?', params: [user.id] };
}

module.exports = { buildTicketScope, buildRequestedScope };

