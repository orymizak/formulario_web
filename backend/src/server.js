require('dotenv').config();
const app = require('./app');
const { sequelize, AdminUser } = require('./models');
const logger = require('./utils/logger');
const bcrypt = require('bcryptjs');

const PORT = process.env.PORT || 8080;

async function seedAdmin() {
  const username = process.env.ADMIN_USER || 'admin';
  const password = process.env.ADMIN_PASS || '1234';
  const exists   = await AdminUser.findOne({ where: { username } });
  if (!exists) {
    const passwordHash = await bcrypt.hash(password, 10);
    await AdminUser.create({ username, passwordHash });
    logger.info(`✓ Admin creado: ${username}`);
  }
}

async function bootstrap() {
  try {
    await sequelize.authenticate();
    logger.info('✓ Base de datos conectada');

    if (process.env.NODE_ENV !== 'production') {
      await sequelize.sync({ alter: true });
      logger.info('✓ Modelos sincronizados');
    }

    await seedAdmin();

    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`✓ API corriendo en http://0.0.0.0:${PORT} [${process.env.NODE_ENV}]`);
    });
  } catch (err) {
    logger.error('✗ Error al iniciar:', err.message);
    process.exit(1);
  }
}

process.on('unhandledRejection', (r) => { logger.error('unhandledRejection:', r); process.exit(1); });
process.on('uncaughtException',  (e) => { logger.error('uncaughtException:',  e); process.exit(1); });

bootstrap();
