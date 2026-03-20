const express = require('express');
const router  = express.Router();
const { rateLimiter, getClientIp }                      = require('../middleware/rateLimiter');
const { otpRequestRules, otpVerifyRules, validateResult } = require('../middleware/validators');
const { requestOtp, verifyOtp }                          = require('../services/otpService');
const { scoringGuard, getStatus }                        = require('../services/userScoring');
const { AuditLog }                                       = require('../models');
const logger = require('../utils/logger');

// ─── POST /api/v1/otp/request ────────────────────────────────────────────────
router.post('/request',
  rateLimiter,
  scoringGuard,
  otpRequestRules,
  validateResult,
  async (req, res) => {
    const { email } = req.body;
    const ip = req.clientIp || getClientIp(req);
    try {
      const result = await requestOtp(email, ip);
      AuditLog.create({
        event: 'OTP_REQUESTED', email, ip,
        fingerprint: req.headers['x-device-fingerprint'],
        requestId: req.requestId,
      }).catch(() => {});
      return res.status(200).json({
        success: true,
        message: `Código enviado a ${result.maskedEmail}`,
        expiresInSeconds: result.expiresInSeconds,
      });
    } catch (err) {
      if (err.code === 'OTP_COOLDOWN') {
        return res.status(429).json({
          success: false, code: 'OTP_COOLDOWN',
          message: err.message, retryAfterSeconds: err.retryAfter,
        });
      }
      if (err.code === 'EMAIL_ERROR') {
        return res.status(503).json({ success: false, code: 'EMAIL_ERROR', message: err.message });
      }
      logger.error({ event: 'OTP_REQUEST_ERROR', error: err.message });
      throw err;
    }
  }
);

// ─── POST /api/v1/otp/verify ─────────────────────────────────────────────────
router.post('/verify',
  rateLimiter,
  otpVerifyRules,
  validateResult,
  async (req, res) => {
    const { email, code } = req.body;
    const ip = req.clientIp || getClientIp(req);
    const fp = req.headers['x-device-fingerprint'] || null;
    try {
      const { sessionToken, expiresIn } = await verifyOtp(email, code, ip, fp);
      AuditLog.create({
        event: 'OTP_VERIFIED', status: 'success',
        email, ip, fingerprint: fp, requestId: req.requestId,
      }).catch(() => {});
      return res.status(200).json({
        success: true,
        message: 'Correo verificado correctamente',
        sessionToken, expiresIn,
      });
    } catch (err) {
      AuditLog.create({
        event: 'OTP_FAILED', status: 'error',
        email, ip, fingerprint: fp, requestId: req.requestId,
        metadata: { code: err.code },
      }).catch(() => {});
      return res.status(err.status || 400).json({
        success: false, code: err.code || 'OTP_ERROR', message: err.message,
        ...(err.remaining !== undefined && { attemptsRemaining: err.remaining }),
        ...(err.retryAfter  !== undefined && { retryAfterSeconds: err.retryAfter }),
      });
    }
  }
);

// ─── GET /api/v1/otp/score ───────────────────────────────────────────────────
router.get('/score', rateLimiter, async (req, res) => {
  const ip = req.clientIp || req.ip;
  const fp = req.deviceFingerprint || null; // adjunto por rateLimiter

  try {
    const status = await getStatus(ip, fp);
    return res.json({
      success: true,
      riskLevel:       status.riskLevel,
      requiresCaptcha: status.requiresCaptcha,
      blocked:         status.blocked,
      ...(status.blocked && { retryAfterSeconds: status.blockTtl }),
    });
  } catch {
    return res.json({ success: true, riskLevel: 'low', requiresCaptcha: false, blocked: false });
  }
});

module.exports = router;
