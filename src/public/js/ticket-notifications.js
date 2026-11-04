// Campana 1.5. No modifica estados ni tickets; solo lee el feed persistente.
(() => {
  const holder = document.getElementById('ticket-notify-holder');
  if (!holder) return;
  const button = document.getElementById('ticket-notify-button');
  const badge = document.getElementById('ticket-notify-badge');
  const panel = document.getElementById('ticket-notify-panel');
  const content = document.getElementById('ticket-notify-content');
  let refreshing = false;

  async function refresh() {
    if (refreshing) return;
    refreshing = true;
    try {
      const response = await fetch('/api/ticket-notifications', {
        credentials: 'same-origin', cache: 'no-store'
      });
      if (!response.ok) throw new Error('Servicio no disponible');
      const result = await response.json();
      const unread = Number(result.unread) || 0;
      badge.textContent = unread > 99 ? '99+' : String(unread);
      badge.hidden = unread < 1;
      button.setAttribute('aria-label', `Notificaciones: ${unread} sin revisar`);
      const items = Array.isArray(result.items) ? result.items : [];
      content.replaceChildren();
      if (!items.length) {
        const empty = document.createElement('p');
        empty.className = 'ticket-notify-empty';
        empty.textContent = 'Sin novedades en tus tickets.';
        content.append(empty);
        return;
      }
      items.forEach(item => {
        const link = document.createElement('a');
        link.className = `ticket-notify-item${item.read ? '' : ' is-unread'}`;
        const ticketId = Number(item.ticket_id);
        // No utilizar enlaces o HTML arbitrarios devueltos por el servidor.
        link.href = Number.isSafeInteger(ticketId) && ticketId > 0 &&
          /^\/tickets\/(requested\/)?\d+$/.test(String(item.url || ''))
          ? item.url : '/tickets/requested';
        const title = document.createElement('strong');
        title.textContent = `${item.message || 'Novedad'} · Ticket #${ticketId}`;
        const subject = document.createElement('span');
        subject.textContent = item.subject || '';
        const date = document.createElement('small');
        date.textContent = item.created_at || '';
        link.append(title, subject, date);
        content.append(link);
      });
    } catch (err) {
      if (!panel.hidden) {
        content.replaceChildren();
        const message = document.createElement('p');
        message.className = 'ticket-notify-empty';
        message.textContent = 'No se pudieron consultar las notificaciones. Intenta actualizar.';
        content.append(message);
      }
    } finally {
      refreshing = false;
    }
  }

  button.addEventListener('click', () => {
    const opening = panel.hidden;
    panel.hidden = !opening;
    button.setAttribute('aria-expanded', String(opening));
    if (opening) refresh();
  });
  document.addEventListener('click', event => {
    if (!holder.contains(event.target)) {
      panel.hidden = true;
      button.setAttribute('aria-expanded', 'false');
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      panel.hidden = true;
      button.setAttribute('aria-expanded', 'false');
    }
  });
  window.addEventListener('soporte360:ticketActivity', refresh);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refresh();
  });
  refresh();
  // Fallback para conexiones SSE interrumpidas o despliegues con varias instancias.
  setInterval(() => { if (!document.hidden) refresh(); }, 45000);
})();
