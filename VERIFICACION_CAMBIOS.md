# Auditoria de cambios — Soporte360 CHC 1.5.0 RC.1

## Base utilizada

Archivo suministrado: `Soporte360chc1.04act.zip`. Se utilizo el codigo recibido,
no una reconstruccion a partir de capturas. Los cambios son puntuales.

## Modulos de tickets conservados

- Las mismas rutas de nuevo ticket, comentario, asignacion, transicion y detalle.
- La misma matriz de estados (`src/lib/ticketStatus.js`, sin cambios).
- El mismo alcance por roles (`src/lib/ticketScope.js`, sin cambios).
- Las mismas inserciones en `tickets`, `ticket_transitions` y `ticket_attachments`.
- Los mismos avisos existentes por correo y SSE de tickets nuevos.
- Sin cambio alguno en los archivos de reportes, login, catalogos ni usuarios.
- Los eventos de campana son posteriores al commit o estan aislados con try/catch,
  para no convertir una falla de notificaciones en un fallo de ticket.

## Cambios por archivo

| Area | Archivo | Alcance |
|---|---|---|
| Imagenes | `src/lib/image.js` | 1600x1200 y miniaturas existentes |
| Campana | `src/lib/ticketNotifications.js` | Registros persistentes y destinatarios |
| Campana | `src/routes/notifications.js` | Consulta privada de novedades |
| SSE | `src/routes/events.js` | Evento dirigido por usuario, heartbeat |
| Interfaz | `src/views/partials/layout.ejs` | Campana visible desktop y movil |
| Interfaz | `src/public/js/ticket-notifications.js` | Feed, contador y polling |
| Tickets | `src/routes/tickets.js` | Solo hooks de cambio y lectura |
| Evidencias | `src/routes/attachments.js` | Hook de subida y control de lectura |
| Auto-cierre | `src/utils/autoCloseTickets.js` | Aviso posterior al auto-cierre |
| Anuncios | `src/lib/announcementImages.js` | Procesado y miniaturas |
| Anuncios | `src/routes/announcementImages.js` | Lectura de imagenes vigentes |
| Anuncios | `src/app.js` | Crear, listar y borrar imagenes con transaccion |
| Anuncios UI | `src/views/announcements.ejs` | Formulario de fotos, galeria, escape HTML |
| Dashboard | `src/views/dashboard.ejs` | Galeria en anuncios destacados |
| UI | `src/public/js/announcement-gallery.js` | Galeria/modal compartido |
| UI | `src/public/css/styles.css` | Estilos de galeria |
| Acceso | `src/lib/ticketAccess.js` | Lectura para solicitantes staff |
| SQL | `sql/*.sql` | 2 tablas nuevas, verificacion, limpieza comentada |

## Validaciones ejecutadas en ambiente de construccion

- `node --check` para **todos los archivos .js** del codigo.
- Validacion de sintaxis JS de los scripts embebidos de las tres vistas modificadas.
- `npm test`: **14 pruebas automatizadas correctas**. Incluyen:
  compresion real con Sharp de imagenes verticales/horizontales,
  hasta 4 fotos por anuncio, rechazo de formato invalido, destinatarios de
  notificaciones, marcado de lectura, consulta de metadatos de imagenes,
  y simulacion de creacion de ticket, cambio de estatus, comentario,
  asignacion y apertura de ambas vistas de detalle.
- Ninguna de esas pruebas utiliza la base de datos real de CHC. No se realizaron
  pruebas E2E con servidor MySQL, cuenta SMTP, Railway ni navegador real.
  Antes de produccion SON OBLIGATORIAS las pruebas indicadas en la guia.

## Reversion segura

Volver a desplegar el codigo anterior. Las dos tablas nuevas no afectan el
codigo previo y no se deben borrar por defecto. Un rollback de base completo
podria perder tickets posteriores a la migracion: evitarlo salvo incidente
real de integridad y recuperacion coordinada con respaldo.
