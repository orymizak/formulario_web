const logger = require('../utils/logger');
const Redis = require('ioredis');

const config = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
  retryStrategy: (times) => {
    if (times > 10) {
      logger.error('Redis: demasiados reintentos, abandonando');

      return null;
    }

    return Math.min(times * 200, 3000); // backoff exponencial
  },
  lazyConnect: true,
  enableReadyCheck: true,
};

const redis = new Redis(config);

redis.on('connect', () => logger.info('Redis: conectado'));
redis.on('error', (err) => logger.error('Redis error:', err.message));
redis.on('reconnecting', () => logger.warn('Redis: reconectando...'));

module.exports = redis;