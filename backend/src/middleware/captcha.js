/**
 * CAPTCHA MIDDLEWARE — modo dual
 *
 * CAPTCHA_PROVIDER=internal  > usa userScoring (sin llamadas externas)
 * CAPTCHA_PROVIDER=recaptcha > verifica con Google reCAPTCHA v3
 * CAPTCHA_PROVIDER=hcaptcha  > verifica con hCaptcha
 *
 */

const logger = require('../utils/logger');
const { getStatus, addScore } = require('../services/userScoring');

// ─── Verificar token con proveedor externo ────────────────────────────────────
function verifyExternal(token, ip) {
  const https = require('https');
  const provider = process.env.CAPTCHA_PROVIDER;
  const secret   = process.env.CAPTCHA_SECRET;

  return new Promise((resolve, reject) => {
    const params = new URLSearchParams({ secret, response: token, remoteip: ip });
    const options = {
      hostname: provider === 'hcaptcha' ? 'hcaptcha.com' : 'www.google.com',
      path: provider === 'hcaptcha' ? '/siteverify' : '/recaptcha/api/siteverify',
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          // reCAPTCHA v2: solo success true/false (sin score)
          // reCAPTCHA v3: requiere score >= 0.5
          // Detectar versión por presencia del campo score
          const isV3 = typeof json.score !== 'undefined';
          resolve(isV3
            ? json.success && json.score >= 0.5
            : json.success === true);
        } catch { reject(new Error('Respuesta inválida del proveedor CAPTCHA')); }
      });
    });
    req.on('error', reject);
    req.setTimeout(5000, () => { req.destroy(); reject(new Error('Timeout CAPTCHA')); });
    req.write(params.toString());
    req.end();
  });
}

// ─── Middleware principal ─────────────────────────────────────────────────────
async function captchaGate(req, res, next) {
  const provider = process.env.CAPTCHA_PROVIDER || 'internal';
  const ip = req.clientIp || req.ip;
  const fp = req.headers['x-device-fingerprint'] || null;

  // Modo interno: delega al score de riesgo, sin llamadas externas
  if (provider === 'internal') {
    const status = req.scoreStatus || await getStatus(ip, fp);

    if (!status.requiresCaptcha) return next();

    // Riesgo medio/alto: verificar si mandaron token de "acknowledgment"
    // (el frontend muestra un aviso y el usuario debe confirmar antes de continuar)
    const ack = req.body?.captchaAck || req.headers['x-captcha-ack'];
    if (!ack) {
      return res.status(400).json({
        success: false,
        code: 'CAPTCHA_REQUIRED',
        message: 'Se detectó comportamiento inusual. Confirma que eres humano.',
        captchaRequired: true,
        riskLevel: status.riskLevel,
      });
    }

    return next();
  }

  // Modo externo (recaptcha / hcaptcha)
  const token = req.body?.captchaToken || req.headers['x-captcha-token'];
  const status = req.scoreStatus || await getStatus(ip, fp);

  if (!status.requiresCaptcha && !token) return next();

  if (!token) {
    return res.status(400).json({
      success: false,
      code: 'CAPTCHA_REQUIRED',
      message: 'Se requiere verificación CAPTCHA.',
      captchaRequired: true,
    });
  }

  try {
    const valid = await verifyExternal(token, ip);
    if (!valid) {
      await addScore(ip, fp, 'CAPTCHA_FAIL');
      logger.warn({ event: 'CAPTCHA_INVALID', ip, provider });
      return res.status(400).json({
        success: false,
        code: 'CAPTCHA_INVALID',
        message: 'CAPTCHA inválido. Intenta de nuevo.',
        captchaRequired: true,
      });
    }
    next();
  } catch (err) {
    logger.error({ event: 'CAPTCHA_ERROR', error: err.message, ip });
    next(); // fail-open
  }
}

module.exports = { captchaGate };
