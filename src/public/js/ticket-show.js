(function(){
  // Obtiene ticketId y raíz opcional para el fetch
  const script = document.currentScript;
  const ticketId = script?.dataset?.ticketId;
  const root = script?.dataset?.root || '';
  const box = document.querySelector('.controls');
  if (!box || !ticketId) return;

  async function send(to) {
    // Solicita nota opcional
    const note = prompt('Nota (opcional):') || '';
    try {
      const res = await fetch(`${root}/tickets/${ticketId}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to_status: to, note })
      });
      const data = await res.json();
      if (!data.ok) return alert(data.msg || 'Error');
      // Recarga la página para ver los cambios
      location.reload();
    } catch (e) {
      console.error(e);
      alert('Error de red');
    }
  }

  box.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-to]');
    if (!btn) return;
    send(btn.dataset.to);
  });
})();