# Soporte360 CHC — 1.5.0 RC.1 (paquete para pruebas)

Código basado en **Soporte360chc1.04act.zip**, sin reemplazar el flujo de creación,
asignación, comentarios, transiciones, correo, informes ni auto-cierre de tickets.

## Cambios de esta versión

- Evidencias (tickets): procesado de fotografías hasta **1600 px ancho × 1200 px alto**,
  sin ampliarlas ni deformarlas; miniaturas de 240 × 180 px.
- Anuncios: **0 a 4 imágenes** JPG o PNG por publicación, 5 MB máximo por archivo,
  compresión en MySQL, miniaturas y ampliación al hacer clic. Los anuncios existentes
  continúan funcionando sin imágenes; API JSON de creación se conserva.
- Campana visible para todos los roles, historial persistente de novedades, eventos
  SSE más consulta periódica cada 45 segundos, lectura por ticket al abrir el detalle.
  Se notifican comentarios, nuevas evidencias, cambios de estatus y asignaciones;
  nunca se envía una notificación al actor de su propia modificación.
- Permisos de lectura de evidencias reforzados: los adjuntos únicamente se sirven
  a quienes pueden ver el ticket o a su creador en la pestaña Solicitados.
- Escapado seguro de títulos/textos/comentarios al dibujar anuncios.
- **No incluye mensajería interna**: reservada para versión posterior.

## Despliegue

Leer **`GUIA_DESPLIEGUE_SEGURO.md`** ANTES de instalar. La migración de base
**`sql/01_MIGRACION_SOPORTE360_V1_5.sql`** debe ejecutarse sobre la base correcta
antes de desplegar la nueva versión. Es aditiva y no modifica tablas existentes.

Este paquete **NO contiene `.env`, contraseñas ni tokens**: conservar las
variables reales del servidor/Railway. Nunca pegar un `.env` real en repositorios.

## Instalación local

1. Crear una copia de pruebas de la base de producción (sin compartir credenciales).
2. Ejecutar los SQL de la carpeta `sql/` contra esa copia.
3. Copiar `.env.example` a `.env` y completar las credenciales del entorno de pruebas.
4. `npm ci`, `npm start`.
5. Comprobar `GUIA_DESPLIEGUE_SEGURO.md`, pruebas por rol y casos de regresión.

Node.js 18 o superior; MySQL 8 o MariaDB compatible; sharp se instala desde
package-lock. En este entorno no se hizo una prueba contra la BD real de CHC.
