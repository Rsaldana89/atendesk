// src/lib/ticketScope.js

async function buildTicketScope(pool, user) {
  if (user.role === 'admin') {
    return { whereSql: '1=1', params: [] }; // Solo admin ve todo
  }

  if (user.role === 'manager' || user.role === 'agent') {
    // Manager y Agent: ven tickets de sus departamentos o asignados a ellos
    const whereSql = `
      (t.department_id IN (
         SELECT department_id FROM user_department_access WHERE user_id = ?
       )
       OR t.assigned_to = ?)
    `;
    return { whereSql, params: [user.id, user.id] };
  }

  // Usuario final (rol "user"): solo sus tickets
  return { whereSql: 't.created_by = ?', params: [user.id] };
}

module.exports = { buildTicketScope };
