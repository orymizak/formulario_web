/**
 * RUTAS DE ADMINISTRACIÓN
 * POST /api/v1/admin/login
 * GET  /api/v1/admin/contactos      (paginado, buscable, filtrable)
 * GET  /api/v1/admin/contactos/:id
 * GET  /api/v1/admin/audit
 */
const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { Op }  = require('sequelize');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl }               = require('@aws-sdk/s3-request-presigner');
const { AdminUser, Contacto, AuditLog } = require('../models');
const logger  = require('../utils/logger');
const { rateLimiter } = require('../middleware/rateLimiter');
const { censorContacto, censorContactos } = require('../utils/censor');

const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-2' });

// ─── Middleware auth ──────────────────────────────────────────────────────────
function requireAdmin(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ success: false, code: 'UNAUTHORIZED' });
  try {
    const p = jwt.verify(token, process.env.JWT_SECRET);
    if (!p.isAdmin) throw new Error();
    req.admin = p;
    next();
  } catch {
    res.status(401).json({ success: false, code: 'INVALID_TOKEN', message: 'Sesión expirada.' });
  }
}

// ─── POST /login ──────────────────────────────────────────────────────────────
router.post('/login', rateLimiter, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ success: false, message: 'Credenciales requeridas.' });
  try {
    const admin = await AdminUser.findOne({ where: { username: username.trim() } });
    const valid = admin && await bcrypt.compare(password, admin.passwordHash);
    if (!valid) {
      await new Promise(r => setTimeout(r, 1000));
      logger.warn({ event: 'ADMIN_LOGIN_FAILED', username });
      return res.status(401).json({ success: false, code: 'INVALID_CREDENTIALS', message: 'Usuario o contraseña incorrectos.' });
    }
    const token = jwt.sign(
      { id: admin.id, username: admin.username, isAdmin: true },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );
    logger.info({ event: 'ADMIN_LOGIN', username });
    res.json({ success: true, token, username: admin.username });
  } catch (err) {
    logger.error({ event: 'ADMIN_LOGIN_ERROR', error: err.message });
    res.status(500).json({ success: false, message: 'Error interno.' });
  }
});

// ─── GET /contactos ───────────────────────────────────────────────────────────
router.get('/contactos', /* requireAdmin,*/ async (req, res) => {
  const page     = Math.max(1, parseInt(req.query.page  || '1'));
  const limit    = Math.min(100, parseInt(req.query.limit || '25'));
  const offset   = (page - 1) * limit;
  const q        = req.query.q?.trim();
  const verified = req.query.emailVerificado;
  const sortCol  = ['createdAt','nombre','email','apellido'].includes(req.query.sort)
                   ? req.query.sort : 'createdAt';
  const sortDir  = req.query.order === 'asc' ? 'ASC' : 'DESC';

  // raw=1 solo disponible para admins autenticados — devuelve datos sin censurar
  const raw = req.query.raw === '1';

  const where = {};
  if (q) {
    where[Op.or] = [
      { nombre:   { [Op.iLike]: `%${q}%` } },
      { apellido: { [Op.iLike]: `%${q}%` } },
      { email:    { [Op.iLike]: `%${q}%` } },
      { telefono: { [Op.iLike]: `%${q}%` } },
      { curp:     { [Op.iLike]: `%${q}%` } },
    ];
  }
  if (verified !== undefined && verified !== '')
    where.emailVerificado = verified === 'true';

  const { count, rows } = await Contacto.findAndCountAll({
    where,
    attributes: { exclude: ['deletedAt'] },
    order: [[sortCol, sortDir]],
    limit, offset,
  });

  const data = raw ? rows.map(r => r.toJSON()) : censorContactos(rows);

  res.json({
    success: true,
    data,
    pagination: { total: count, page, limit, pages: Math.ceil(count / limit) },
  });
});

// ─── GET /contactos/:id ───────────────────────────────────────────────────────
router.get('/contactos/:id', /* requireAdmin,*/ async (req, res) => {
  const row = await Contacto.findByPk(req.params.id, {
    attributes: { exclude: ['deletedAt'] }
  });
  if (!row) return res.status(404).json({ success: false, message: 'No encontrado.' });

  const raw = req.query.raw === '1';
  const data = raw ? row.toJSON() : censorContacto(row);

  res.json({ success: true, data });
});

// ─── GET /audit ───────────────────────────────────────────────────────────────
router.get('/audit', /* requireAdmin,*/ async (req, res) => {
  const limit = Math.min(200, parseInt(req.query.limit || '50'));
  const rows  = await AuditLog.findAll({ order: [['createdAt', 'DESC']], limit });
  res.json({ success: true, data: rows });
});

// ─── GET /file-url — presigned URL para ver foto/INE (admin autenticado) ─────
router.get('/file-url', /* requireAdmin,*/ async (req, res) => {
  const { key } = req.query;
  if (!key) return res.status(400).json({ success: false, message: 'Key requerida.' });
  try {
    const cmd = new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key });
    const url = await getSignedUrl(s3, cmd, { expiresIn: 900 });
    res.json({ success: true, url });
  } catch (err) {
    logger.error({ event: 'ADMIN_FILE_URL_ERROR', error: err.message });
    res.status(500).json({ success: false, message: 'No se pudo generar la URL del archivo.' });
  }
});

module.exports = { router, requireAdmin };