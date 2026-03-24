const { body, validationResult } = require('express-validator');
const xss = require('xss');

const sanitize = (v) => (typeof v === 'string' ? xss(v.trim()) : v);
const NOMBRE_RE = /^[a-zA-ZÀ-ÿ\s'-]+$/;

// ─── Contacto (multipart + JSON) ─────────────────────────────────────────────
const contactoRules = [
  body('nombre')
    .trim().notEmpty().withMessage('Nombre requerido')
    .isLength({ min: 2, max: 80 }).withMessage('Nombre: 2-80 caracteres')
    .matches(NOMBRE_RE).withMessage('Nombre: solo letras')
    .customSanitizer(sanitize),

  // apellidoP viene del nuevo frontend; apellido del viejo — acepta ambos
  body('apellidoP')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 2, max: 80 }).withMessage('Apellido paterno: 2-80 caracteres')
    .matches(NOMBRE_RE).withMessage('Apellido paterno: solo letras')
    .customSanitizer(sanitize),

  body('apellidoM')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 80 }).withMessage('Apellido materno: máximo 80 caracteres')
    .matches(NOMBRE_RE).withMessage('Apellido materno: solo letras')
    .customSanitizer(sanitize),

  body('email')
    .trim().notEmpty().withMessage('Correo requerido')
    .isEmail().withMessage('Correo inválido')
    .normalizeEmail()
    .isLength({ max: 254 }),

  body('telefono')
    .trim().notEmpty().withMessage('Teléfono requerido')
    .matches(/^\+?[\d\s\-().]{7,20}$/).withMessage('Teléfono inválido')
    .customSanitizer(sanitize),

  body('curp')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ min: 18, max: 18 }).withMessage('CURP debe tener 18 caracteres')
    .matches(/^[A-Z0-9]{18}$/i).withMessage('CURP: formato inválido')
    .customSanitizer(v => v?.toUpperCase()),

  body('genero')
    .optional({ nullable: true })
    .isIn(['Masculino', 'Femenino', 'No binario', 'Prefiero no decir', ''])
    .withMessage('Género no válido'),

  body('fechaNac')
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601().withMessage('Fecha de nacimiento inválida'),

  body('idempotencyKey')
    .optional()
    .isUUID(4).withMessage('idempotencyKey inválido'),
];

// ─── OTP request ─────────────────────────────────────────────────────────────
const otpRequestRules = [
  body('email')
    .trim().notEmpty().withMessage('Correo requerido')
    .isEmail().withMessage('Correo inválido')
    .normalizeEmail(),
];

// ─── OTP verify ──────────────────────────────────────────────────────────────
const otpVerifyRules = [
  body('email')
    .trim().notEmpty().isEmail().normalizeEmail(),
  body('code')
    .trim().notEmpty().withMessage('Código requerido')
    .matches(/^\d{6}$/).withMessage('Código: 6 dígitos'),
];

// ─── Middleware ───────────────────────────────────────────────────────────────
function validateResult(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      code: 'VALIDATION_ERROR',
      errors: errors.array().map(e => ({ field: e.path, message: e.msg })),
    });
  }
  next();
}

module.exports = { contactoRules, otpRequestRules, otpVerifyRules, validateResult };
