# Soporte360 CHC v1.5 RC.1 — guía de despliegue controlado

**Estado: candidato para pruebas (RC), NO certificado para despliegue directo en producción.**
No se ha conectado la aplicación a la base real de Soporte360 ni se han ejecutado
pruebas completas con los usuarios de CHC. Ejecutar primero en una COPIA de pruebas.

## 1. Respaldo y revisión previa

1. Guardar ZIP y versión desplegada actualmente (código funcional, imagen exacta del
   deploy, configuración Railway). NO borrar la versión anterior.
2. Hacer respaldo consistente de **toda la BD** `soportebd`, incluyendo BLOBs,
   tickets, adjuntos, anuncios, transiciones, usuarios, permisos y comentarios.
3. Verificar que el respaldo realmente se pueda restaurar en un MySQL de pruebas.
4. Antes de ejecutar SQL confirmar: `SELECT DATABASE();` y que estás en el servidor
   correcto. Revisar `SHOW CREATE TABLE` de tickets / ticket_attachments / announcements.
5. Clonar la BD a un ambiente de pruebas AISLADO. Los correos reales pueden dispararse
   al crear/cerrar tickets: desactivar SMTP en pruebas o usar cuentas de prueba.
6. Conservar las variables actuales (`.env` / Railway) sin exponer contraseñas.

## 2. Migración de BD — ANTES del código

Ejecutar **solo** `sql/01_MIGRACION_SOPORTE360_V1_5.sql` en la copia de pruebas.
Crea exclusivamente **`ticket_notifications`** y **`announcement_attachments`**;
no ALTER a `tickets` ni a sus tablas asociadas. Después ejecutar
`sql/02_VERIFICAR_MIGRACION.sql` y comprobar que las tablas creadas tienen columnas
correctas. No ejecutar la limpieza `03` durante actualizaciones normales.

No cambiar parámetros de MySQL, usuarios o FKs existentes. Las dos tablas nuevas
no tienen foreign keys hacia las tablas legadas por compatibilidad. Las imágenes
se eliminan al borrar el anuncio desde la aplicación.

## 3. Desplegar código en ambiente de pruebas

1. Mantener la configuración del entorno anterior; el ZIP nuevo omite `.env`.
2. `npm ci` (Node 18+, se requiere `sharp`). Verificar que inicia sin errores de DB.
3. Verificar la versión en **Acerca de: 1.5.0 RC (pruebas)**.
4. Comprobar que los anuncios ya existentes cargan sin fotografías y el Dashboard
   sigue mostrando anuncios vigentes.
5. Verificar creación de anuncios con 0, 1, 4 fotografías, 5 fotografías (rechaza),
   tipos invalidos (rechaza), archivo >5MB (rechaza), miniaturas y ampliación;
   eliminar un anuncio con imágenes y confirmar borrado de sus registros.
6. Comparar fotografía vertical y horizontal al subir evidencia en ticket nuevo
   y posteriormente: el alto no supera 1200 px, el ancho no supera 1600 px,
   y las miniaturas antiguas se siguen visualizando sin re-procesamiento.

## 4. REGRESIÓN OBLIGATORIA: tickets y roles

Probar con **admin, manager, agent y user** cada flujo:

- Levantar ticket con/sin evidencias, tanto en el departamento propio como en otro
  cuando la lógica del rol lo permite. Debe llegar el correo original de creación.
- Bandejas Por atender / Solicitados y acceso a detalles por cada rol.
- Asignar agente y confirmar que solo cambia asignación e historial; campana del
  nuevo agente; no notificar al actor.
- Aceptar -> En progreso -> Solucionado -> Cerrado. Reabrir, liberar y cancelar
  según permisos originales. Verificar historial y tiempo de atención.
- Comentario de usuario: aviso al asignado; comentario de agente: aviso al
  solicitante. Confirmar que la campana persiste tras cerrar/iniciar sesión.
- Nueva evidencia de usuario y agente: aviso a la contraparte, SIN cambiar estatus
  ni alterar historial. Borrado de evidencias con sus permisos actuales.
- Al abrir ticket notificado, la campana disminuye y no borra avisos de otros tickets.
  También se comprueba la ruta `/tickets/requested/:id` para sus propios tickets.
- Verificar que no se pueda abrir foto de un ticket ajeno con ID directo.
- Auto-cierre tras 48 h y reportes/exportes sin cambios.
- Probar el mismo caso con notificaciones deshabilitadas temporalmente en una copia
  (tabla inexistente) para validar que el comentario/transición siguen confirmándose:
  los errores de campana deben quedar en log, no afectar ticket.

## 5. Consideraciones operativas

- Los avisos se registran **después** de confirmar los cambios principales.
  Si falla la escritura de la campana, el ticket NO se revierte; se verá un warning.
  En ese evento el aviso puede no quedar registrado y requerir revisión de logs.
- El SSE en memoria solo informa conexiones del proceso Node que atendió el evento.
  La consulta periódica cada 45 segundos recupera avisos en otros procesos.
- El sistema de correo, reportes y roles de tickets conserva su implementación.
- Las evidencias históricas permanecen con su tamaño original; solo se aplica la
  nueva compresión a las que se adjunten después de actualizar.
- El acceso a miniaturas y archivos requiere login y permiso de lectura al ticket.
- Las fotos de anuncios se guardan en **MySQL** y aumentan tamaño de backups.
- Para evitar mal funcionamiento, no desplegar nueva versión antes de crear tablas.

## 6. Paso a producción (solo al aprobar las pruebas)

1. Reservar ventana y comunicar mantenimiento; **congelar cambios** durante respaldo
   y corte. Tener el ZIP/código anterior listo para revertir.
2. Verificar/restaurar respaldo; ejecutar la misma migración aditiva en PROD.
3. Verificar tablas y su estructura con `02_VERIFICAR_MIGRACION.sql`.
4. Desplegar nueva app; probar inmediatamente: login, bandejas, ticket nuevo,
   comentarios, asignación, estados, adjuntos y anuncios.
5. Observar logs (`ER_NO_SUCH_TABLE`, `sharp`, `multer`, `SSE`) y monitorizar correos,
   CPU/memoria y tamaño de BD por imágenes durante las primeras horas.
6. Si hay fallo crítico: **restaurar el código anterior de inmediato**. Dejar las
   dos tablas nuevas intactas; el código anterior las ignora. Revertir la BD a su
   respaldo SOLO si hay corrupción comprobada y tras evaluar datos posteriores
   al corte (no perder tickets creados durante la prueba).

## 7. Verificaciones SQL puntuales

```sql
SELECT COUNT(*) AS total FROM tickets;
SELECT COUNT(*) AS adjuntos_tickets FROM ticket_attachments;
SELECT COUNT(*) AS cambios FROM ticket_transitions;
SELECT COUNT(*) AS avisos, SUM(read_at IS NULL) AS pendientes FROM ticket_notifications;
SELECT COUNT(*) AS imagenes_de_anuncios FROM announcement_attachments;
```

No asumir que esta versión está probada en producción. Se entrega para validación
funcional por el área de Sistemas antes de aplicar la migración real.
