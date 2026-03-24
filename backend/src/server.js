require('dotenv').config();
const app = require('./app');
const { sequelize, AdminUser } = require('./models');
const logger = require('./utils/logger');
const bcrypt = require('bcryptjs');

const PORT = process.env.PORT || 8080;

async function seedAdmin() {
  const username = process.env.ADMIN_USER;
  const password = process.env.ADMIN_PASS;
  const exists   = await AdminUser.findOne({ where: { username } });
  if (!exists) {
    const passwordHash = await bcrypt.hash(password, 10);
    await AdminUser.create({ username, passwordHash });
    logger.info(`✓ Admin creado: ${username}`);
  }
}

// ─── First-boot sync ──────────────────────────────────────────────────────────
// Corre sequelize.sync() una sola vez usando una tabla centinela (_schema_boot).
// En boots subsecuentes la tabla ya existe → salta el sync.
// Para forzar un re-sync (p.ej. después de un cambio de schema), elimina la
// tabla manualmente: DROP TABLE _schema_boot;
async function syncOnce() {
  const FLAG_TABLE = '_schema_boot';

  // QueryTypes.SELECT devuelve array de rows directamente (no [rows, meta])
  const rows = await sequelize.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = '${FLAG_TABLE}'`,
    { type: sequelize.QueryTypes.SELECT }
  );

  if (rows.length > 0) {
    logger.info('✓ Schema ya inicializado, omitiendo sync');
    return;
  }

  logger.info('⚙ Primer boot detectado — sincronizando schema...');
  await sequelize.sync({ alter: true });
  await sequelize.query(
    `CREATE TABLE ${FLAG_TABLE} (initialized_at TIMESTAMPTZ DEFAULT now())`
  );
  logger.info('✓ Schema sincronizado y flag guardada');
}

async function bootstrap() {
  try {
    await sequelize.authenticate();
    logger.info('✓ Base de datos conectada');

    await syncOnce();
    await seedAdmin();

    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`✓ API corriendo en http://0.0.0.0:${PORT} [${process.env.NODE_ENV}]`);
    });
  } catch (err) {
    logger.error('✗ Error al iniciar:', { message: err.message, stack: err.stack });
    process.exit(1);
  }
}

process.on('unhandledRejection', (r) => { logger.error('unhandledRejection:', r); process.exit(1); });
process.on('uncaughtException',  (e) => { logger.error('uncaughtException:',  e); process.exit(1); });

bootstrap();