/**
 * SISTEMA DE SCORING DE USUARIO (anti-abuso interno)
 *
 * Califica el comportamiento de una IP/fingerprint en Redis.
 * Cada acción sospechosa suma puntos. Al superar el umbral > bloqueo temporal.
 *
 * Redis keys:
 *   score:ip:{ip}          > puntuación actual (TTL: 1h)
 *   score:fp:{fingerprint} > puntuación por fingerprint (TTL: 1h)
 *   score:block:{ip}       > bloqueo activo (TTL: SCORE_BLOCK_DURATION)
 *
 * Eventos y sus puntos (configurables vía .env):
 *   OTP_FAIL          > 20 pts  (fallo de código)
 *   VALIDATION_ERROR  >  5 pts  (campo inválido)
 *   CAPTCHA_FAIL      > 30 pts  (CAPTCHA incorrecto)
 *   RATE_EXCEEDED     > 50 pts  (superar límite de peticiones)
 */

const redis = require('../config/redis');
const logger = require('../utils/logger');

const POINTS = {
  OTP_FAIL:          parseInt(process.env.SCORE_OTP_FAIL          || '20'),
  VALIDATION_ERROR:  parseInt(process.env.SCORE_VALIDATION_ERROR  || '5'),
  CAPTCHA_FAIL:      parseInt(process.env.SCORE_CAPTCHA_FAIL      || '30'),
  DUPLICATE_ATTEMPT: parseInt(process.env.SCORE_DUPLICATE_ATTEMPT || '15'), // registro duplicado
  RATE_EXCEEDED:     50,
  OTP_SUCCESS:       -10,  // recompensar éxito
};

const BLOCK_THRESHOLD = parseInt(process.env.SCORE_BLOCK_THRESHOLD || '60');
const BLOCK_DURATION  = parseInt(process.env.SCORE_BLOCK_DURATION  || '600');
const SCORE_TTL       = 3600; // ventana de 1 hora

// ─── Sumar puntos ─────────────────────────────────────────────────────────────
async function addScore(ip, fingerprint, event) {
  const pts = POINTS[event] ?? 5;
  if (pts === 0) return;

  const ipKey = `score:ip:${ip}`;
  const fpKey = fingerprint ? `score:fp:${fingerprint}` : null;

  try {
    const ipScore = await redis.incrby(ipKey, pts);
    if (ipScore === pts) await redis.expire(ipKey, SCORE_TTL); // primera vez > TTL

    if (fpKey) {
      const fpScore = await redis.incrby(fpKey, pts);
      if (fpScore === pts) await redis.expire(fpKey, SCORE_TTL);
    }

    logger.debug({ event: 'SCORE_UPDATED', ip, fingerprint, action: event, pts, ipScore });

    // ¿Supera el umbral?
    if (ipScore >= BLOCK_THRESHOLD) {
      await blockIp(ip, fingerprint, ipScore);
    }

    return ipScore;
  } catch (err) {
    logger.error({ event: 'SCORE_ERROR', error: err.message });
  }
}

// ─── Bloquear IP ──────────────────────────────────────────────────────────────
async function blockIp(ip, fingerprint, score) {
  const blockKey = `score:block:${ip}`;
  const existing = await redis.get(blockKey);
  if (existing) return; // ya bloqueado

  await redis.set(blockKey, score, 'EX', BLOCK_DURATION);
  logger.warn({ event: 'SCORE_BLOCKED', ip, fingerprint, score, durationSeconds: BLOCK_DURATION });
}

// ─── Consultar estado ─────────────────────────────────────────────────────────
async function getStatus(ip, fingerprint) {
  try {
    const [blocked, ipScore, fpScore] = await Promise.all([
      redis.get(`score:block:${ip}`),
      redis.get(`score:ip:${ip}`),
      fingerprint ? redis.get(`score:fp:${fingerprint}`) : Promise.resolve(null),
    ]);

    const score = Math.max(parseInt(ipScore || '0'), parseInt(fpScore || '0'));
    const blockTtl = blocked ? await redis.ttl(`score:block:${ip}`) : 0;

    return {
      blocked: !!blocked,
      score,
      blockTtl,
      // Nivel de riesgo para el frontend (sin exponer el score exacto)
      riskLevel: score >= BLOCK_THRESHOLD ? 'blocked'
               : score >= BLOCK_THRESHOLD * 0.6 ? 'high'
               : score >= BLOCK_THRESHOLD * 0.3 ? 'medium'
               : 'low',
      // ¿Mostrar CAPTCHA? si el riesgo es medio o alto
      requiresCaptcha: score >= BLOCK_THRESHOLD * 0.3,
    };
  } catch (err) {
    logger.error({ event: 'SCORE_STATUS_ERROR', error: err.message });
    return { blocked: false, score: 0, riskLevel: 'low', requiresCaptcha: false };
  }
}

// ─── Limpiar historial ────────────────────────────────────────────────────────
async function clearScore(ip, fingerprint) {
  try {
    const keys = [`score:ip:${ip}`, `score:block:${ip}`];
    if (fingerprint) keys.push(`score:fp:${fingerprint}`);
    await redis.del(...keys);
  } catch (err) {
    logger.error({ event: 'SCORE_CLEAR_ERROR', error: err.message });
  }
}

// ─── Middleware: bloqueo por scoring ─────────────────────────────────────────
async function scoringGuard(req, res, next) {
  const ip = req.clientIp || req.ip;
  const fp = req.headers['x-device-fingerprint'] || null;

  try {
    const status = await getStatus(ip, fp);

    if (status.blocked) {
      return res.status(429).json({
        success: false,
        code: 'SCORE_BLOCKED',
        message: 'Demasiados intentos fallidos. Intenta más tarde.',
        retryAfterSeconds: status.blockTtl,
      });
    }

    // Adjuntar al request para que los controladores puedan leer el estado
    req.scoreStatus = status;
    next();
  } catch {
    next(); // fail-open
  }
}

module.exports = { addScore, getStatus, clearScore, scoringGuard, POINTS };
