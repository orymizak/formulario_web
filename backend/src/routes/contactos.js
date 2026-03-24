const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const path     = require('path');

const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl }     = require('@aws-sdk/s3-request-presigner');

const { contactoRules, validateResult } = require('../middleware/validators');
const { requireVerifiedSession }        = require('../services/otpService');
const { rateLimiter, softRateLimit }    = require('../middleware/rateLimiter');
const { captchaGate }                   = require('../middleware/captcha');
const { scoringGuard, addScore }        = require('../services/userScoring');
const emailService = require('../services/emailService');
const { Op } = require('sequelize');
const { Contacto, AuditLog } = require('../models');
const logger = require('../utils/logger');
const redis  = require('../config/redis');
const { requireAdmin } = require('./admin');

// --- NUEVO: Cliente S3 ---
const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-2' });

// GET /api/v1/admin/file-url?key=fotos/123-foto.jpg
// Genera una URL firmada de 15 min para ver el archivo desde el frontend

// GET /api/v1/contactos/file-url?key=fotos/xxx&folio=uuid
// Valida que el folio existe y la key le pertenece antes de firmar
router.get('/file-url', softRateLimit, async (req, res) => {
  const { key, folio } = req.query;
  if (!key || !folio) return res.status(400).json({ success: false });

  const contacto = await Contacto.findByPk(folio, {
    attributes: ['fotoKey', 'ineKey']
  });
  // Solo firma si la key pertenece a ese folio (evita enumerar archivos de otros)
  if (!contacto || (contacto.fotoKey !== key && contacto.ineKey !== key)) {
    return res.status(403).json({ success: false, message: 'No autorizado.' });
  }
  const cmd = new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key });
  const url = await getSignedUrl(s3, cmd, { expiresIn: 900 });
  res.json({ success: true, url });
});

// ─── Multer: archivos en memoria ─────────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 2 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
});

// --- NUEVO: Función auxiliar para subir a S3 ---
async function uploadToS3(file, folder) {
  if (!file) return null;
  // Generamos una clave única: folder/timestamp-nombreoriginal
  const key = `${folder}/${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`;
  
  await s3.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
  }));
  
  return key; // Retornamos la ruta/key para guardarla en la BD
}

// ─── POST /api/v1/contactos ───────────────────────────────────────────────────
router.post('/',
  rateLimiter,
  scoringGuard,
  upload.fields([{ name: 'foto', maxCount: 1 }, { name: 'ine', maxCount: 1 }]),
  captchaGate,
  contactoRules,
  validateResult,
  requireVerifiedSession,
  async (req, res, next) => {
    const ip = req.clientIp || req.ip;
    const fp = req.headers['x-device-fingerprint'] || null;

    const {
      nombre, apellidoP, apellidoM, apellido: apellidoRaw,
      email, telefono,
      curp, genero, fechaNac,
      idempotencyKey,
    } = req.body;

    const apellido = apellidoRaw?.trim() || [apellidoP, apellidoM].filter(Boolean).join(' ');
    const curpNorm = curp?.trim()?.toUpperCase() || null;

    try {
      // 1. Idempotencia (Check previo)
      if (idempotencyKey) {
        const existing = await Contacto.findOne({
          where: { idempotencyKey },
          attributes: ['id', 'createdAt'],
        });
        if (existing) {
          return res.status(200).json({
            success: true, code: 'ALREADY_REGISTERED',
            message: 'Tu información ya fue registrada.',
            data: { id: existing.id, createdAt: existing.createdAt },
          });
        }
      }

      // 2. Validación de sesión OTP
      if (req.session.email !== email?.toLowerCase()?.trim()) {
        await addScore(ip, fp, 'VALIDATION_ERROR');
        return res.status(403).json({
          success: false, code: 'EMAIL_MISMATCH',
          message: 'El correo no coincide con el verificado por OTP.',
        });
      }

      // ─── NUEVO: Subida de archivos a S3 ───
      let fotoKey = null;
      let ineKey = null;

      try {
        fotoKey = await uploadToS3(req.files?.foto?.[0], 'fotos');
        ineKey  = await uploadToS3(req.files?.ine?.[0],  'ines');
      } catch (s3Error) {
        logger.error({ event: 'S3_UPLOAD_FAILED', error: s3Error.message });
        return res.status(500).json({ success: false, message: 'Error al subir documentos.' });
      }

      // 3. Crear contacto con las llaves de S3
      const contacto = await Contacto.create({
        nombre:            nombre?.trim(),
        apellido:          apellido,
        email:             email?.toLowerCase()?.trim(),
        telefono:          telefono?.trim(),
        curp:              curpNorm,
        ipOrigen:          ip,
        deviceFingerprint: fp,
        emailVerificado:   true,
        idempotencyKey:    idempotencyKey || null,
        // NUEVOS CAMPOS (Asegúrate de agregarlos a tu modelo Sequelize y migración)
        fotoKey:           fotoKey,
        ineKey:            ineKey,
        notas: [
          genero   ? `${genero}`       : null,
          fechaNac ? `${fechaNac}`     : null,
        ].filter(Boolean).join(' | ') || null,
      });

      // Registro de Auditoría
      await AuditLog.create({
        event: 'CONTACT_CREATED', status: 'success',
        email, ip, fingerprint: fp,
        requestId: req.requestId,
        metadata: { contactoId: contacto.id, hasFiles: !!(fotoKey || ineKey) },
      }).catch(() => {});

      emailService.sendConfirmation(email, nombre, contacto.id).catch(() => {});
      logger.info({ event: 'CONTACT_CREATED', id: contacto.id, requestId: req.requestId });

      return res.status(201).json({
        success: true,
        message: '¡Registro exitoso! Pronto estaremos en contacto.',
        data: { id: contacto.id, nombre, email, createdAt: contacto.createdAt },
      });

    } catch (err) {
      if (err.name === 'SequelizeUniqueConstraintError') {
        await addScore(ip, fp, 'DUPLICATE_ATTEMPT').catch(() => {});
        return res.status(409).json({
          success: false, code: 'DUPLICATE_ENTRY',
          message: 'El usuario ya se encuentra registrado.',
        });
      }
      await addScore(ip, fp, 'VALIDATION_ERROR').catch(() => {});
      next(err);
    }
  }
);

// ─── GET /api/v1/contactos ────────────────────────────────────────────────────
router.get('/', /* requireAdmin, */ softRateLimit, async (req, res, next) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page  || '1'));
    const limit  = Math.min(100, parseInt(req.query.limit || '20'));
    const offset = (page - 1) * limit;

    const { count, rows } = await Contacto.findAndCountAll({
      attributes: { exclude: ['ipOrigen', 'deviceFingerprint', 'deletedAt'] },
      order: [['createdAt', 'DESC']],
      limit, offset,
    });

    res.json({ success: true, data: rows, pagination: { total: count, page, limit, pages: Math.ceil(count / limit) } });
  } catch (err) { next(err); }
});

// ─── GET /api/v1/contactos/:id — buscar por folio (máx 1 por minuto por IP) ──
router.get('/:id', softRateLimit, async (req, res, next) => {
  const ip = req.clientIp || req.ip;

  // Rate limit estricto: 1 búsqueda por minuto por IP
  const folioKey = `folio:${ip}`;
  try {
    const count = await redis.incr(folioKey);
    if (count === 1) await redis.expire(folioKey, 60);
    if (count > 1) {
      const ttl = await redis.ttl(folioKey);
      res.set('Retry-After', ttl);
      return res.status(429).json({
        success: false,
        code: 'FOLIO_RATE_LIMITED',
        message: 'Solo se permite una búsqueda por minuto. Intenta de nuevo en un momento.',
        retryAfterSeconds: ttl,
      });
    }
  } catch { /* fail-open si Redis falla */ }

  try {
    const { id } = req.params;

    // Validar que es un UUID válido para evitar inyección
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(id)) {
      return res.status(400).json({ success: false, code: 'INVALID_FOLIO', message: 'Folio inválido.' });
    }

    const contacto = await Contacto.findOne({
      where: { id },
      attributes: ['id', 'nombre', 'apellido', 'email', 'telefono', 'createdAt', 'fotoKey', 'ineKey'],
    });

    if (!contacto) {
      return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'No se encontró ningún registro con ese folio.' });
    }

    res.json({ success: true, data: contacto });
  } catch (err) { next(err); }
});



// ─── POST /api/v1/contactos/check-duplicates ─────────────────────────────────
// Verifica si email, teléfono o CURP ya existen en la BD.
// Devuelve { exists: bool, field: 'email'|'telefono'|'curp'|null }
// Se usa antes del OTP para evitar que el usuario complete todo el flujo
// y solo al final descubra que ya está registrado.
router.post('/check-duplicates', softRateLimit, async (req, res, next) => {
  const { email, telefono, curp } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, code: 'INVALID_PAYLOAD', message: 'Email requerido.' });
  }
  try {
    const conditions = [{ email: email.toLowerCase().trim() }];
    if (telefono?.trim()) conditions.push({ telefono: telefono.trim() });
    if (curp?.trim())     conditions.push({ curp: curp.trim().toUpperCase() });

    const match = await Contacto.findOne({
      where: { [Op.or]: conditions },
      attributes: ['id', 'email', 'telefono', 'curp'],
    });

    if (!match) return res.json({ success: true, exists: false, field: null });

    // Determinar qué campo coincidió (para el frontend)
    let field = null;
    if (match.email === email.toLowerCase().trim())            field = 'email';
    else if (telefono && match.telefono === telefono.trim())   field = 'telefono';
    else if (curp && match.curp === curp.trim().toUpperCase()) field = 'curp';

    return res.json({ success: true, exists: true });
  } catch (err) { next(err); }
});

// ─── POST /api/v1/contactos/folio-reminder — reenviar folio al correo ─────────
// Rate limit: máx 2 reenvíos por email cada 10 minutos
router.post('/folio-reminder', softRateLimit, async (req, res, next) => {
  const { email, telefono, curp } = req.body;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ success: false, code: 'INVALID_EMAIL', message: 'Correo inválido.' });
  }

  const emailNorm = email.toLowerCase().trim();

  const REMINDER_TTL = 6 * 60 * 60; // 6 horas en segundos
  const reminderKey  = `folio-reminder:${emailNorm}`;
  try {
    const already = await redis.get(reminderKey);
    if (already) {
      // Ya se envió en las últimas 6h — responder igual que si se enviara (anti-enumeración)
      // El frontend mostrará el mensaje genérico sin saber que fue bloqueado
      return res.json({
        success: true,
        message: 'Si ese correo tiene un registro, recibirás tu folio en unos momentos.',
        hint: 'already_sent',  // el frontend puede leer esto opcionalmente
      });
    }
    // Marcar como enviado ANTES de enviar (evita doble envío por race condition)
    await redis.set(reminderKey, 1, 'EX', REMINDER_TTL);
  } catch { /* fail-open */ }

  try {
    // Buscar el contacto por email — siempre responder igual aunque no exista (anti-enumeración)
    const conditions = [{ email: emailNorm }];
    if (telefono?.trim()) conditions.push({ telefono: telefono.trim() });
    if (curp?.trim())     conditions.push({ curp: curp.trim().toUpperCase() });

    const contacto = await Contacto.findOne({
      where: { [Op.or]: conditions },
      attributes: ['id', 'nombre', 'email'],  // email = el del registro ORIGINAL
    });

    if (contacto) {
      // Enviar en background, no bloquear la respuesta
      emailService.sendFolioReminder(contacto.email, contacto.nombre, contacto.id).catch(() => {});
      logger.info({ event: 'FOLIO_REMINDER_SENT', email: emailNorm });
    } else {
      logger.info({ event: 'FOLIO_REMINDER_NOT_FOUND', email: emailNorm });
    }

    // Siempre responder exitosamente para no revelar si el email existe
    return res.json({
      success: true,
      message: 'Se ha enviado tu folio al correo original.',
    });
  } catch (err) { next(err); }
});

module.exports = router;