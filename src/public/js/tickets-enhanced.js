// Mejoras visuales seguras para listados de tickets.
// No cambia endpoints, reportes ni navegación; solo agrega interacciones de UI.

document.addEventListener('DOMContentLoaded', () => {
  const table = document.querySelector('.tickets-table');
  if (!table) return;

  const statusIsActive = status => ['abierto', 'en_progreso', 'reabierto'].includes(status);

  function safeText(value) {
    return (value || '').toString().trim();
  }

  function truncate(value, max = 220) {
    const text = safeText(value) || 'Sin descripción disponible';
    return text.length > max ? `${text.slice(0, max)}…` : text;
  }

  function getCellText(row, label) {
    const cell = row.querySelector(`td[data-label="${label}"]`);
    return cell ? safeText(cell.innerText) : '';
  }

  /* Tooltip / popover de descripción */
  let activeTooltip = null;

  function closeTooltip() {
    if (activeTooltip) {
      activeTooltip.remove();
      activeTooltip = null;
    }
  }

  function openTooltip(button) {
    closeTooltip();

    const tooltip = document.createElement('div');
    tooltip.className = 'ticket-tooltip';
    tooltip.textContent = truncate(button.dataset.description);
    document.body.appendChild(tooltip);

    const rect = button.getBoundingClientRect();
    const tipRect = tooltip.getBoundingClientRect();
    const margin = 10;

    let top = rect.bottom + window.scrollY + 8;
    let left = rect.left + window.scrollX + (rect.width / 2) - (tipRect.width / 2);

    if (left < margin) left = margin;
    if (left + tipRect.width > window.innerWidth - margin) {
      left = window.innerWidth - tipRect.width - margin;
    }

    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
    activeTooltip = tooltip;
  }

  document.querySelectorAll('.info-btn').forEach(button => {
    button.addEventListener('mouseenter', () => openTooltip(button));
    button.addEventListener('mouseleave', closeTooltip);
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();

      if (activeTooltip) {
        closeTooltip();
      } else {
        openTooltip(button);
      }
    });
  });

  document.addEventListener('click', event => {
    if (activeTooltip && !event.target.closest('.info-btn')) closeTooltip();
  });

  window.addEventListener('scroll', closeTooltip, { passive: true });
  window.addEventListener('resize', closeTooltip);

  /* Modal de vista rápida */
  const overlay = document.createElement('div');
  overlay.className = 'ticket-quick-overlay';
  overlay.innerHTML = `
    <div class="ticket-quick-modal" role="dialog" aria-modal="true" aria-label="Vista rápida de ticket">
      <button type="button" class="ticket-quick-close" aria-label="Cerrar">×</button>
      <div class="ticket-quick-content"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  const modalContent = overlay.querySelector('.ticket-quick-content');

  function addField(list, label, value) {
    const dt = document.createElement('dt');
    const dd = document.createElement('dd');
    dt.textContent = label;
    dd.textContent = safeText(value) || '—';
    list.appendChild(dt);
    list.appendChild(dd);
  }

  function openQuickView(row) {
    const id = getCellText(row, 'ID');
    const subjectLink = row.querySelector('td[data-label="Asunto"] .subject-text a');
    const subject = subjectLink ? safeText(subjectLink.textContent) : getCellText(row, 'Asunto');
    const description = row.querySelector('.info-btn')?.dataset.description || '';

    modalContent.innerHTML = '';

    const title = document.createElement('h3');
    title.textContent = `Ticket #${id}`;
    modalContent.appendChild(title);

    const list = document.createElement('dl');
    addField(list, 'Asunto', subject);
    addField(list, 'Descripción', safeText(description) || 'Sin descripción disponible');
    addField(list, 'Categoría', getCellText(row, 'Categoría'));
    addField(list, 'Departamento', getCellText(row, 'Departamento'));
    addField(list, 'Estatus', getCellText(row, 'Estatus'));
    addField(list, 'Atendiendo', getCellText(row, 'Atendiendo'));
    addField(list, 'Reportante', getCellText(row, 'Reportante'));
    addField(list, 'Ubicación / sucursal', 'No disponible en este listado');
    addField(list, 'Fecha de apertura', getCellText(row, 'Abierto'));
    addField(list, 'Fecha de solución', getCellText(row, 'Solucionado'));
    addField(list, 'Prioridad', getCellText(row, 'Urgencia'));
    modalContent.appendChild(list);

    overlay.classList.add('is-open');
    document.body.classList.add('ticket-modal-open');
  }

  function closeQuickView() {
    overlay.classList.remove('is-open');
    document.body.classList.remove('ticket-modal-open');
  }

  table.querySelectorAll('.quick-view-btn').forEach(button => {
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();

      const row = button.closest('tr');
      if (row) openQuickView(row);
    });
  });

  overlay.addEventListener('click', event => {
    if (event.target === overlay || event.target.closest('.ticket-quick-close')) {
      closeQuickView();
    }
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeQuickView();
  });

  /* Antigüedad visual */
  const today = new Date();

  table.querySelectorAll('tbody tr[data-status]').forEach(row => {
    const openedCell = row.querySelector('td[data-label="Abierto"]');
    if (!openedCell) return;

    const rawText = safeText(openedCell.childNodes[0]?.textContent || openedCell.textContent);
    const openedDate = new Date(rawText);
    if (Number.isNaN(openedDate.getTime())) return;

    const diffDays = Math.max(0, Math.floor((today - openedDate) / 86400000));
    const ageLabel = diffDays === 0 ? 'Hoy' : diffDays === 1 ? 'Hace 1 día' : `Hace ${diffDays} días`;

    const age = document.createElement('span');
    age.className = 'ticket-age';
    age.textContent = ageLabel;
    openedCell.appendChild(age);

    if (statusIsActive(row.dataset.status) && diffDays >= 3) {
      row.classList.add('ticket-stale');
    }
  });
});
