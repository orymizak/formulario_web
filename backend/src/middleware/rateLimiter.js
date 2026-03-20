/**
 * RATE LIMITING + BLOQUEO PROGRESIVO
 *
 * Arquitectura de contadores en Redis:
 *
 *   rl:ip:{ip}:min    > intentos en los últimos 60s     (TTL: 60s)
 *   rl:ip:{ip}:hour   > intentos en la última hora      (TTL: 3600s)
 *   rl:ip:{ip}:block  > nivel de bloqueo actual (0-4)   (TTL: variable)
 *   rl:fp:{fp}:hour   > intentos por fingerprint/hora   (TTL: 3600s)
 *   rl:fp:{fp}:block  > bloqueo por fingerprint         (TTL: variable)
 *
 * Niveles de bloqueo y tiempos:
 *   0 > libre
 *   1 > 5 minutos  (primer aviso)
 *   2 > 30 minutos (reincidente)
 *   3 > 2 horas    (atacante)
 *   4 > 24 horas   (bloqueado permanente-día)
 */

const logger = require('../utils/logger');
const redis = require('../config/redis');

const BLOCK_DURATIONS = [0, 300, 1800, 7200, 86400]; // segundos por nivel
const LIMITS = {
  perMinute: parseInt(process.env.RL_MAX_PER_MINUTE) || 10,
  perHour:   parseInt(process.env.RL_MAX_PER_HOUR)   || 50,
};

// ─── Helper: obtener IP real considerando proxies ────────────────────────────
function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];

  if (forwarded) return forwarded.split(',')[0].trim();
  return req.ip || req.connection.remoteAddress || 'unknown';
}

// ─── Helper: respuesta estándar de bloqueo ───────────────────────────────────
function blockedResponse(res, retryAfter, reason = 'RATE_LIMITED') {
  res.set('Retry-After', retryAfter);
  res.set('X-RateLimit-Reason', reason);
  return res.status(429).json({
    success: false,
    code: reason,
    message: 'Demasiados intentos. Por favor espera antes de intentar de nuevo.',
    retryAfterSeconds: retryAfter,
  });
}

// ─── Middleware principal ────────────────────────────────────────────────────
async function rateLimiter(req, res, next) {
  const ip = getClientIp(req);
  const fingerprint = req.headers['x-device-fingerprint'] || null;

  try {
    // 1. Verificar bloqueo activo por IP
    const ipBlockLevel = await redis.get(`rl:ip:${ip}:block`);

    if (ipBlockLevel) {
      const level = parseInt(ipBlockLevel);
      const ttl = await redis.ttl(`rl:ip:${ip}:block`);
      logger.warn({ event: 'BLOCKED_IP', ip, level, ttl });
      return blockedResponse(res, ttl, 'IP_BLOCKED');
    }

    // 2. Verificar bloqueo activo por fingerprint
    if (fingerprint) {
      const fpBlock = await redis.get(`rl:fp:${fingerprint}:block`);

      if (fpBlock) {
        const ttl = await redis.ttl(`rl:fp:${fingerprint}:block`);
        logger.warn({ event: 'BLOCKED_FP', ip, fingerprint, ttl });
        return blockedResponse(res, ttl, 'DEVICE_BLOCKED');
      }
    }

    // 3. Contador por minuto (ventana deslizante)
    const minKey = `rl:ip:${ip}:min`;
    const minCount = await redis.incr(minKey);

    if (minCount === 1) {
      await redis.expire(minKey, 60);
    };

    if (minCount > LIMITS.perMinute) {
      await escalateBlock(ip, fingerprint);
      const ttl = await redis.ttl(`rl:ip:${ip}:block`);
      logger.warn({ event: 'RATE_EXCEEDED_MIN', ip, minCount, fingerprint });

      return blockedResponse(res, ttl || 300);
    }

    // 4. Contador por hora
    const hourKey = `rl:ip:${ip}:hour`;
    const hourCount = await redis.incr(hourKey);
    if (hourCount === 1) await redis.expire(hourKey, 3600);

    if (hourCount > LIMITS.perHour) {
      await escalateBlock(ip, fingerprint, 2); // saltar directo a nivel 2
      const ttl = await redis.ttl(`rl:ip:${ip}:block`);
      logger.warn({ event: 'RATE_EXCEEDED_HOUR', ip, hourCount, fingerprint });

      return blockedResponse(res, ttl || 1800);
    }

    // 5. Contador por fingerprint (detección de VPNs rotando IPs)
    if (fingerprint) {
      const fpKey = `rl:fp:${fingerprint}:hour`;
      const fpCount = await redis.incr(fpKey);
      if (fpCount === 1) await redis.expire(fpKey, 3600);

      if (fpCount > LIMITS.perHour) { // Bloquear fingerprint independiente de la IP
        await redis.set(`rl:fp:${fingerprint}:block`, 3, 'EX', BLOCK_DURATIONS[3]);
        logger.warn({ event: 'DEVICE_RATE_EXCEEDED', fingerprint, fpCount, ip });

        return blockedResponse(res, BLOCK_DURATIONS[3], 'DEVICE_BLOCKED');
      }
    }

    // Adjuntar info para uso en controladores
    req.clientIp = ip;
    req.deviceFingerprint = fingerprint;
    req.rateLimitInfo = { minCount, hourCount };

    // Headers informativos (sin revelar los límites exactos a bots)
    res.set('X-RateLimit-Remaining', Math.max(0, LIMITS.perMinute - minCount));

    next();
  } catch (err) {
    // Si Redis falla, dejar pasar (fail-open) pero loggear
    logger.error({ event: 'RATE_LIMITER_ERROR', error: err.message, ip });
    next();
  }
}

// ─── Escalar nivel de bloqueo progresivo ─────────────────────────────────────
async function escalateBlock(ip, fingerprint = null, minLevel = 1) {
  const blockKey = `rl:ip:${ip}:block`;
  const currentLevel = parseInt(await redis.get(blockKey) || '0');
  const newLevel = Math.min(Math.max(currentLevel + 1, minLevel), BLOCK_DURATIONS.length - 1);
  const duration = BLOCK_DURATIONS[newLevel];

  await redis.set(blockKey, newLevel, 'EX', duration);

  if (fingerprint) {
    const fpBlockKey = `rl:fp:${fingerprint}:block`;
    await redis.set(fpBlockKey, newLevel, 'EX', duration);
  }

  logger.info({
    event: 'BLOCK_ESCALATED',
    ip,
    fingerprint,
    level: newLevel,
    durationSeconds: duration,
  });

  return newLevel;
}

// ─── Middleware liviano para rutas de solo lectura ────────────────────────────
async function softRateLimit(req, res, next) {
  const ip = getClientIp(req);

  try {
    const block = await redis.get(`rl:ip:${ip}:block`);

    if (block) {
      const ttl = await redis.ttl(`rl:ip:${ip}:block`);

      return blockedResponse(res, ttl, 'IP_BLOCKED');
    }

    req.clientIp = ip;
    next();
  } catch {
    next();
  }
}

module.exports = { rateLimiter, softRateLimit, getClientIp, escalateBlock };
