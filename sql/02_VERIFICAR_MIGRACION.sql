-- Ejecutar despues de 01_MIGRACION y ANTES de actualizar el codigo.
SELECT DATABASE() AS base_en_uso;
SHOW CREATE TABLE ticket_notifications;
SHOW CREATE TABLE announcement_attachments;
SELECT COUNT(*) AS notificaciones_actuales FROM ticket_notifications;
SELECT COUNT(*) AS imagenes_anuncios_actuales FROM announcement_attachments;
-- Confirmar tablas existentes del flujo de tickets NO se alteraron:
SHOW CREATE TABLE tickets;
SHOW CREATE TABLE ticket_attachments;
SHOW CREATE TABLE ticket_transitions;
SHOW CREATE TABLE announcements;
SHOW CREATE TABLE announcement_comments;
