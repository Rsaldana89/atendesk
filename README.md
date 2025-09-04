# CHC HelpDesk Minimal (AtenDesk)

Proyecto mínimo listo para VS Code: Express + MySQL + EJS.

## Requisitos
- Node.js 18+
- MySQL 8+ (o MariaDB 10+)
- Base de datos creada con el script `soportebd_minimal.sql` (o el que te generé en el chat).

## Instalación
```bash
npm install
copy .env.sample .env   # (en PowerShell: copy .env.sample .env)
# Edita .env con tus credenciales de MySQL
npm run dev
# o
npm start
```

## Usuarios de prueba
- admin / B1Admin
- ruben / 123456
- soporte / 123456
- tienda1 / 123456

> Nota: Credenciales en texto plano solo para prototipo.

## Rutas
- `GET /login` - formulario de login
- `POST /login` - valida y crea sesión
- `POST /logout` - cierra sesión
- `GET /tickets` - listado de tickets (admin/manager/agent ven todos, user ve los suyos)
- `GET /tickets/new` - formulario de ticket
- `POST /tickets/new` - crea ticket
