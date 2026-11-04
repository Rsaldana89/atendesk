-- Soporte360 CHC 1.5 RC - migracion ADITIVA para MySQL 8 / MariaDB 10+
-- REALIZAR RESPALDO DE soportebd ANTES DE EJECUTAR.
-- Ejecutar EN LA BASE SOPORTE360 CORRECTA (ver SELECT DATABASE()).
-- No modifica tickets, ticket_attachments, ticket_transitions ni anuncios previos.
-- No borra ni actualiza datos existentes; solamente crea dos tablas.
-- No ejecutar con cuentas no autorizadas.

SELECT DATABASE() AS base_en_uso;

CREATE TABLE IF NOT EXISTS `ticket_notifications` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED NOT NULL,
  `ticket_id` BIGINT UNSIGNED NOT NULL,
  `actor_id` INT UNSIGNED DEFAULT NULL,
  `event_type` VARCHAR(24) NOT NULL,
  `message` VARCHAR(160) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `read_at` DATETIME DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_tn_user_read_id` (`user_id`, `read_at`, `id`),
  KEY `idx_tn_ticket_user_read` (`ticket_id`, `user_id`, `read_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `announcement_attachments` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `announcement_id` INT NOT NULL,
  `seq` TINYINT UNSIGNED NOT NULL,
  `original_name` VARCHAR(255) DEFAULT NULL,
  `mime_type` VARCHAR(50) NOT NULL DEFAULT 'image/jpeg',
  `data` LONGBLOB NOT NULL,
  `thumb` LONGBLOB NOT NULL,
  `size_bytes` INT UNSIGNED NOT NULL,
  `width` INT DEFAULT NULL,
  `height` INT DEFAULT NULL,
  `uploaded_by` INT UNSIGNED DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_aa_announcement_seq` (`announcement_id`, `seq`),
  KEY `idx_aa_announcement_id` (`announcement_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Por compatibilidad con instalaciones existentes NO se agregan FKs a tablas
-- legadas. La aplicacion elimina las imagenes en la misma transaccion que
-- elimina el anuncio. Se evita asi tocar la estructura de anuncios actual.

SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME IN ('ticket_notifications','announcement_attachments')
 ORDER BY TABLE_NAME;
