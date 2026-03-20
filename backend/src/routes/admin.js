/**
 * RUTAS DE ADMINISTRACIÓN
 * POST /api/v1/admin/login
 * GET  /api/v1/admin/contactos      (paginado, buscable, filtrable)
 * GET  /api/v1/admin/contactos/:id
 * GET  /api/v1/admin/stats
 * GET  /api/v1/admin/audit
 */
const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { Op, fn, col, literal } = require('sequelize');
const { AdminUser, Contacto, AuditLog } = require('../models');
const logger  = require('../utils/logger');

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
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ success: false, message: 'Credenciales requeridas.' });
  try {
    const admin = await AdminUser.findOne({ where: { username: username.trim() } });
    const valid = admin && await bcrypt.compare(password, admin.passwordHash);
    if (!valid) {
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
router.get('/contactos', requireAdmin, async (req, res) => {
  const page     = Math.max(1, parseInt(req.query.page  || '1'));
  const limit    = Math.min(100, parseInt(req.query.limit || '25'));
  const offset   = (page - 1) * limit;
  const q        = req.query.q?.trim();
  const fuente   = req.query.fuente?.trim();
  const verified = req.query.emailVerificado;
  const sortCol  = ['createdAt','nombre','email','apellido'].includes(req.query.sort)
                   ? req.query.sort : 'createdAt';
  const sortDir  = req.query.order === 'asc' ? 'ASC' : 'DESC';

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
  if (fuente)  where.fuente = fuente;
  if (verified !== undefined && verified !== '')
    where.emailVerificado = verified === 'true';

  const { count, rows } = await Contacto.findAndCountAll({
    where,
    attributes: { exclude: ['deletedAt'] },
    order: [[sortCol, sortDir]],
    limit, offset,
  });

  res.json({ success: true, data: rows,
    pagination: { total: count, page, limit, pages: Math.ceil(count / limit) } });
});

// ─── GET /contactos/:id ───────────────────────────────────────────────────────
router.get('/contactos/:id', requireAdmin, async (req, res) => {
  const row = await Contacto.findByPk(req.params.id, {
    attributes: { exclude: ['deletedAt'] }
  });
  if (!row) return res.status(404).json({ success: false, message: 'No encontrado.' });
  res.json({ success: true, data: row });
});

// ─── GET /stats ───────────────────────────────────────────────────────────────
router.get('/stats', requireAdmin, async (req, res) => {
  const hoy   = new Date(); hoy.setHours(0,0,0,0);
  const week  = new Date(hoy); week.setDate(week.getDate() - 7);
  const month = new Date(hoy); month.setDate(1);

  const [total, hoyN, semana, mes, verificados, fuenteRows] = await Promise.all([
    Contacto.count(),
    Contacto.count({ where: { createdAt: { [Op.gte]: hoy   } } }),
    Contacto.count({ where: { createdAt: { [Op.gte]: week  } } }),
    Contacto.count({ where: { createdAt: { [Op.gte]: month } } }),
    Contacto.count({ where: { emailVerificado: true } }),
    Contacto.findAll({
      attributes: ['fuente', [fn('COUNT', col('id')), 'total']],
      group: ['fuente'], raw: true,
    }),
  ]);

  res.json({ success: true, data: { total, hoy: hoyN, semana, mes, verificados, fuentes: fuenteRows } });
});

// ─── GET /audit ───────────────────────────────────────────────────────────────
router.get('/audit', requireAdmin, async (req, res) => {
  const limit = Math.min(200, parseInt(req.query.limit || '50'));
  const rows  = await AuditLog.findAll({ order: [['createdAt', 'DESC']], limit });
  res.json({ success: true, data: rows });
});

module.exports = { router };
