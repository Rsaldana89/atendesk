Base se datos

Tabla	Campo	Tipo de Dato	Comentarios
users	id	INT UNSIGNED (PK, AI)	Identificador único del usuario
users	username	VARCHAR(50) (UNI)	Nombre de usuario
users	password_plain	VARCHAR(255)	Contraseña
users	full_name	VARCHAR(120)	Nombre completo del usuario
users	email	VARCHAR(120) (UNI)	Correo electrónico
users	role	ENUM('admin','manager','agent','user')	Rol del usuario (default = user)
users	is_active	TINYINT(1)	Indica si el usuario está activo (default 1)
users	created_at	TIMESTAMP	Fecha de creación (CURRENT_TIMESTAMP)

departments	id	INT UNSIGNED (PK, AI)	Identificador único del departamento
departments	dept_code	VARCHAR(20) (UNI)	Código único del departamento
departments	name	VARCHAR(120)	Nombre del departamento
departments	is_active	TINYINT(1)	Indica si el departamento está activo (default 1)
departments	created_at	TIMESTAMP	Fecha de creación (CURRENT_TIMESTAMP)

user_department_access	id	INT UNSIGNED (PK, AI)	Identificador de la relación
user_department_access	user_id	INT UNSIGNED (FK)	Usuario con acceso
user_department_access	department_id	INT UNSIGNED (FK)	Departamento al que tiene acceso

user_category_subscriptions	id	INT UNSIGNED (PK, AI)	Identificador de la suscripción
user_category_subscriptions	user_id	INT UNSIGNED (FK)	Usuario suscrito
user_category_subscriptions	department_id	INT UNSIGNED (FK)	Departamento relacionado
user_category_subscriptions	category	VARCHAR(120)	Categoría suscrita
user_category_subscriptions	created_at	TIMESTAMP	Fecha de creación (CURRENT_TIMESTAMP)

tickets	id	BIGINT UNSIGNED (PK, AI)	ID del ticket
tickets	subject	VARCHAR(200)	Título del ticket
tickets	description	TEXT	Descripción del problema o solicitud
tickets	creator_name	VARCHAR(120)	Nombre del solicitante
tickets	contact_phone	VARCHAR(25)	Teléfono de contacto
tickets	department_id	INT UNSIGNED (FK)	Departamento relacionado
tickets	category	VARCHAR(60)	Categoría del ticket
tickets	status	ENUM('abierto','en_progreso','solucionado','reabierto','cerrado','cancelado')	Estado del ticket (default abierto)
tickets	comments	TEXT	Comentarios adicionales
tickets	created_by	INT UNSIGNED (FK)	Usuario que creó el ticket
tickets	assigned_to	INT UNSIGNED (FK)	Usuario asignado al ticket
tickets	solved_by_user_id	INT UNSIGNED (FK)	Usuario que marcó como solucionado
tickets	closed_by_user_id	INT UNSIGNED (FK)	Usuario que cerró el ticket
tickets	canceled_by_user_id	INT UNSIGNED (FK)	Usuario que canceló el ticket
tickets	opened_at	TIMESTAMP	Fecha de apertura (CURRENT_TIMESTAMP)
tickets	first_response_at	DATETIME	Fecha de primera respuesta
tickets	solved_at	DATETIME	Fecha de solución
tickets	canceled_at	DATETIME	Fecha de cancelación
tickets	last_state_change_at	DATETIME	Último cambio de estado (CURRENT_TIMESTAMP)
tickets	reopened_count	INT	Contador de reaperturas (default 0)
tickets	updated_at	TIMESTAMP	Última actualización (on update CURRENT_TIMESTAMP)
tickets	closed_at	DATETIME	Fecha de cierre

tickets_backup	id	BIGINT UNSIGNED (PK, AI)	ID del ticket en respaldo
tickets_backup	subject	VARCHAR(200)	Título del ticket
tickets_backup	description	TEXT	Descripción
tickets_backup	department_id	INT UNSIGNED (FK)	Departamento relacionado
tickets_backup	category	VARCHAR(60)	Categoría
tickets_backup	status	ENUM('abierto','en_proceso','resuelto','cerrado','cancelado')	Estado (default abierto)
tickets_backup	comments	TEXT	Comentarios
tickets_backup	created_by	INT UNSIGNED (FK)	Usuario que creó el ticket
tickets_backup	assigned_to	INT UNSIGNED (FK)	Usuario asignado
tickets_backup	opened_at	TIMESTAMP	Fecha de apertura (CURRENT_TIMESTAMP)
tickets_backup	updated_at	TIMESTAMP	Última actualización (on update CURRENT_TIMESTAMP)
tickets_backup	closed_at	DATETIME	Fecha de cierre

ticket_attachments	id	BIGINT UNSIGNED (PK, AI)	Identificador único del adjunto
ticket_attachments	ticket_id	BIGINT UNSIGNED (FK)	ID del ticket
ticket_attachments	seq	TINYINT UNSIGNED	Número de secuencia (default 1)
ticket_attachments	original_name	VARCHAR(255)	Nombre original del archivo
ticket_attachments	mime_type	VARCHAR(50)	Tipo MIME
ticket_attachments	data	LONGBLOB	Datos binarios del archivo
ticket_attachments	thumb	LONGBLOB	Miniatura
ticket_attachments	size_bytes	INT UNSIGNED	Tamaño en bytes
ticket_attachments	width	INT	Ancho (si es imagen)
ticket_attachments	height	INT	Altura (si es imagen)
ticket_attachments	checksum_sha256	CHAR(64)	Checksum SHA256
ticket_attachments	uploaded_by	INT UNSIGNED (FK)	Usuario que subió el archivo
ticket_attachments	created_at	TIMESTAMP	Fecha de carga (CURRENT_TIMESTAMP)

ticket_transitions	id	BIGINT UNSIGNED (PK, AI)	Identificador único de la transición
ticket_transitions	ticket_id	BIGINT UNSIGNED (FK)	ID del ticket
ticket_transitions	actor_id	INT UNSIGNED (FK)	Usuario que realizó la acción
ticket_transitions	actor_role	ENUM('ADMIN','MANAGER','AGENTE','USUARIO','SYSTEM')	Rol del actor
ticket_transitions	from_status	ENUM('abierto','en_progreso','solucionado','reabierto','cerrado','cancelado')	Estado anterior
ticket_transitions	to_status	ENUM('abierto','en_progreso','solucionado','reabierto','cerrado','cancelado')	Estado nuevo
ticket_transitions	note	VARCHAR(500)	Nota de la transición
ticket_transitions	created_at	DATETIME	Fecha de la transición (CURRENT_TIMESTAMP)
ticket_transitions	ip_address	VARCHAR(45)	Dirección IP
ticket_transitions	user_agent	VARCHAR(255)	Navegador o agente de usuario

announcements	id	INT (PK, AI)	Identificador único del anuncio
announcements	dept	VARCHAR(80)	Departamento al que va dirigido (ALL = todos)
announcements	title	VARCHAR(120)	Título del anuncio
announcements	body	VARCHAR(500)	Cuerpo o contenido del anuncio
announcements	until_date	DATE	Fecha de vigencia del anuncio
announcements	active	TINYINT(1)	Indica si el anuncio está activo (default 1)
announcements	created_by	INT (FK)	Usuario que creó el anuncio
announcements	created_at	TIMESTAMP	Fecha de creación (CURRENT_TIMESTAMP)

announcement_comments	id	INT UNSIGNED (PK, AI)	Identificador único del comentario
announcement_comments	announcement_id	INT UNSIGNED (FK)	Anuncio al que pertenece el comentario
announcement_comments	user_id	INT UNSIGNED (FK)	Usuario que realizó el comentario
announcement_comments	body	TEXT	Contenido del comentario
announcement_comments	reply_to_comment_id	INT UNSIGNED	ID del comentario al que responde (null si es comentario raíz)
announcement_comments	created_at	TIMESTAMP	Fecha de creación del comentario (CURRENT_TIMESTAMP)
