/**
 * SERVICIO OTP — integrado con scoring
 *
 * Cada fallo de código suma puntos al score del usuario.
 * Un OTP exitoso resta puntos (recompensa buen comportamiento).
 */

const crypto   = require('crypto');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const redis    = require('../config/redis');
const emailService = require('./emailService');
const { addScore, clearScore } = require('./userScoring');
const logger   = require('../utils/logger');

const OTP_EXPIRES     = parseInt(process.env.OTP_EXPIRES_MINUTES || '10') * 60;
const OTP_MAX_ATTEMPTS = parseInt(process.env.OTP_MAX_ATTEMPTS   || '3');
const OTP_LENGTH      = parseInt(process.env.OTP_LENGTH          || '6');

function generateCode(length = OTP_LENGTH) {
  return crypto.randomInt(0, Math.pow(10, length)).toString().padStart(length, '0');
}

function maskEmail(email) {
  const [user, domain] = email.split('@');
  return `${user.slice(0, 2)}****@${domain}`;
}

// ─── Solicitar OTP ────────────────────────────────────────────────────────────
async function requestOtp(email, ip = null) {
  const cooldownKey = `otp:ip:${ip}:cooldown`;
  const cooldown = await redis.get(cooldownKey);

  if (cooldown) {
    const ttl = await redis.ttl(cooldownKey);
    throw Object.assign(new Error('Espera antes de solicitar otro código'), {
      code: 'OTP_COOLDOWN', status: 429, retryAfter: ttl,
    });
  }

  const code = generateCode();
  const hash = await bcrypt.hash(code, 10);

  await redis.pipeline()
    .set(`otp:${email}:code`,     hash,              'EX', OTP_EXPIRES)
    .set(`otp:${email}:attempts`, OTP_MAX_ATTEMPTS,  'EX', OTP_EXPIRES)
    .set(cooldownKey, 1, 'EX', 60)
    .exec();

  await emailService.sendOtp(email, code);
  logger.info({ event: 'OTP_REQUESTED', email: maskEmail(email), ip });

  return { expiresInSeconds: OTP_EXPIRES, maskedEmail: maskEmail(email) };
}

// ─── Verificar OTP ────────────────────────────────────────────────────────────
async function verifyOtp(email, code, ip = null, fingerprint = null) {
  const codeKey     = `otp:${email}:code`;
  const attemptsKey = `otp:${email}:attempts`;
  const [storedHash, attemptsStr] = await redis.mget(codeKey, attemptsKey);

  if (!storedHash) {
    throw Object.assign(new Error('El código expiró o no existe. Solicita uno nuevo.'), {
      code: 'OTP_EXPIRED', status: 400,
    });
  }

  const attempts = parseInt(attemptsStr || '0');
  if (attempts <= 0) {
    await redis.del(codeKey, attemptsKey);
    throw Object.assign(new Error('Sin intentos restantes. Solicita un nuevo código.'), {
      code: 'OTP_EXHAUSTED', status: 429,
    });
  }

  const valid = await bcrypt.compare(code, storedHash);

  if (!valid) {
    const remaining = attempts - 1;
    if (remaining <= 0) {
      await redis.del(codeKey, attemptsKey);
    } else {
      await redis.set(attemptsKey, remaining, 'KEEPTTL');
    }
    // Sumar puntos de riesgo
    if (ip) await addScore(ip, fingerprint, 'OTP_FAIL');
    logger.warn({ event: 'OTP_INVALID', email: maskEmail(email), remaining });

    throw Object.assign(
      new Error(remaining > 0
        ? `Código incorrecto. Intentos restantes: ${remaining}`
        : 'Código incorrecto. Sin intentos restantes.'),
      { code: remaining > 0 ? 'OTP_INVALID' : 'OTP_EXHAUSTED', status: 400, remaining }
    );
  }

  // ✅ Correcto
  await redis.del(codeKey, attemptsKey);
  if (ip) await clearScore(ip, fingerprint); // recompensar

  const sessionToken = jwt.sign(
    { email, verified: true, purpose: 'contact_submission' },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );
  await redis.set(`otp:${email}:verified`, sessionToken, 'EX', 900);

  logger.info({ event: 'OTP_VERIFIED', email: maskEmail(email) });
  return { sessionToken, expiresIn: 900 };
}

// ─── Validar sesión JWT ───────────────────────────────────────────────────────
async function validateSession(token) {
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const stored  = await redis.get(`otp:${payload.email}:verified`);
    if (!stored || stored !== token) throw new Error('Sesión inválida');
    return payload;
  } catch {
    throw Object.assign(new Error('Token de sesión inválido'), {
      code: 'INVALID_SESSION', status: 401,
    });
  }
}

// ─── Middleware ───────────────────────────────────────────────────────────────
async function requireVerifiedSession(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({
      success: false, code: 'SESSION_REQUIRED',
      message: 'Se requiere verificación OTP antes de enviar el formulario',
    });
  }
  try {
    req.session = await validateSession(token);
    next();
  } catch (err) {
    res.status(err.status || 401).json({
      success: false, code: err.code || 'INVALID_SESSION', message: err.message,
    });
  }
}

module.exports = { requestOtp, verifyOtp, requireVerifiedSession, maskEmail };
