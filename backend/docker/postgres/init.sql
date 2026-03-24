-- Script de inicialización para entorno de desarrollo
-- Se ejecuta automáticamente al crear el contenedor de Postgres

-- Otorgar permisos completos sobre el schema public al usuario de la app
GRANT ALL PRIVILEGES ON SCHEMA public TO app_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO app_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- Asegurarse que los objetos futuros también tengan permisos (Postgres 15+)
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO app_user;