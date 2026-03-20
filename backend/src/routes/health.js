const express = require('express');
const router = express.Router();
const { sequelize } = require('../models');
const redis = require('../config/redis');

// ─── GET /health ──────────────────────────────────────────────────────────────
// Usado por ALB, ECS health checks y CloudWatch
router.get('/', async (_req, res) => {
  const checks = { db: 'ok', redis: 'ok' };
  let healthy = true;

  // Verificar BD
  try {
    await sequelize.query('SELECT 1');
  } catch {
    checks.db = 'error';
    healthy = false;
  }

  // Verificar Redis
  try {
    await redis.ping();
  } catch {
    checks.redis = 'error';
    healthy = false;
  }

  const status = healthy ? 200 : 503;
  res.status(status).json({
    status: healthy ? 'healthy' : 'degraded',
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV,
    checks,
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /health/ready ────────────────────────────────────────────────────────
// Readiness probe (ECS/K8s): solo pasa cuando está listo para recibir tráfico
router.get('/ready', (_req, res) => {
  res.status(200).json({ ready: true });
});

module.exports = router;
