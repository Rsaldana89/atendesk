(function(){
  // Obtiene ticketId y raíz opcional para el fetch
  const script = document.currentScript;
  const ticketId = script?.dataset?.ticketId;
  const root = script?.dataset?.root || '';
  const box = document.querySelector('.controls');
  if (!box || !ticketId) return;

  async function send(to) {
    // Recolecta una nota opcional y, para el caso de tickets solucionados de
    // determinados departamentos, solicita información adicional sobre
    // cambios de piezas.  La nota resultante se enviará al servidor para
    // registrarse en el historial (ticket_transitions.note).
    let note = '';
    try {
      if (to === 'solucionado') {
        // Obtiene el nombre del departamento del dataset; si no existe, usa cadena vacía
        const dept = (script?.dataset?.department || '').trim().toLowerCase();
        // Determina si se debe preguntar por cambios de piezas.  Sólo los
        // departamentos "sistemas" y "mantenimiento" requieren este flujo.
        const requiresChangePrompt = ['sistemas', 'mantenimiento'].includes(dept);
        // Solicita una nota opcional primero.  El usuario puede dejarla vacía.
        const baseNote = prompt('Nota (opcional):') || '';
        if (requiresChangePrompt) {
          // Para estos departamentos, se pide un detalle adicional sobre
          // componentes reemplazados.  Si el usuario introduce una cadena no
          // vacía, se registrará precedida de "Cambio: ".
          const change = prompt('¿Se cambió algo? Indica la pieza cambiada (deja vacío si no)') || '';
          if (change && change.trim()) {
            // Combina la nota opcional con el cambio.  Si existe una nota
            // previa, separa con salto de línea para mayor legibilidad.
            note = baseNote ? `${baseNote}\nCambio: ${change.trim()}` : `Cambio: ${change.trim()}`;
          } else {
            // No hubo cambio, sólo la nota opcional
            note = baseNote;
          }
        } else {
          // Otros departamentos: sólo tomar la nota opcional
          note = baseNote;
        }
      } else {
        // Cualquier otra transición: sólo solicitar nota opcional
        note = prompt('Nota (opcional):') || '';
      }

      const res = await fetch(`${root}/tickets/${ticketId}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to_status: to, note })
      });
      // Puede que el servidor devuelva HTML en caso de error.  Intentamos
      // parsear JSON pero capturamos excepción en caso contrario.
      let data;
      try {
        data = await res.json();
      } catch (_) {
        data = null;
      }
      if (!res.ok || !data || !data.ok) {
        const msg = (data && data.msg) || 'Error al cambiar estado';
        alert(msg);
        return;
      }
      // Para fines de depuración, muestra en consola la acción realizada
      // junto con el ID del ticket
      console.log(`Transición realizada: ${to} (ticket ${ticketId})`);
      // Recarga la página para reflejar los cambios en la UI
      location.reload();
    } catch (e) {
      console.error(e);
      alert('Error de red');
    }
  }

  box.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-to]');
    if (!btn) return;
    const to = btn.dataset.to;
    // Si se está aceptando un ticket y existe un agente seleccionado en el
    // formulario de asignación, primero asigna el ticket antes de cambiar
    // el estado.  Esto evita que los managers dejen el ticket sin asignar
    // accidentalmente cuando hacen clic en "Aceptar".
    if (to === 'en_progreso') {
      try {
        const assignSelect = document.querySelector('.assign-form select[name="agent_id"]');
        const selectedId = assignSelect && assignSelect.value;
        if (selectedId) {
          // Realiza la asignación mediante una petición al backend.
          const assignRes = await fetch(`${root}/tickets/${ticketId}/assign`, {
            method: 'POST',
            // Indicamos explícitamente que esperamos JSON en la respuesta para
            // evitar redirecciones HTML desde el backend.
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ agent_id: selectedId })
          });
          let assignData;
          try { assignData = await assignRes.json(); } catch (_) { assignData = null; }
          if (!assignRes.ok || !assignData || !assignData.ok) {
            const msg = (assignData && assignData.msg) || 'Error al asignar ticket';
            alert(msg);
            return;
          }
        }
      } catch (err) {
        console.error(err);
        alert('Error de red al asignar');
        return;
      }
    }
    // Finalmente envía la transición de estado
    send(to);
  });
})();