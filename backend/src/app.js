const logger  = require('./utils/logger');
const express = require('express');
const helmet  = require('helmet');
const morgan  = require('morgan');
const cors    = require('cors');
const hpp     = require('hpp');

const contactosRouter = require('./routes/contactos');
const healthRouter    = require('./routes/health');
const otpRouter       = require('./routes/otp');

const app = express();
app.set('trust proxy', 1);

// ─── Security headers ────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'", 'https://www.google.com', 'https://www.gstatic.com'],
      frameSrc:   ["'self'", 'https://www.google.com'],
      imgSrc:     ["'self'", 'data:'],
      styleSrc:   ["'self'", "'unsafe-inline'"],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  // Desactivar permissionsPolicy por defecto de Helmet — incluye Origin Trial features
  // (browsing-topics, run-ad-auction, join-ad-interest-group, private-aggregation)
  // que no aplican a esta app y generan advertencias en la consola del navegador.
  permissionsPolicy: {
    features: {
      camera:           ["'none'"],
      microphone:       ["'none'"],
      geolocation:      ["'none'"],
      payment:          ["'none'"],
      usb:              ["'none'"],
    },
  },
}));

// ─── CORS ────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173').split(',').map(s => s.trim());

app.use(cors({
  origin: (origin, callback) => {
    // Permitir peticiones sin origen (como Postman o health checks internos)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn(`CORS bloqueado para: ${origin}`);
      callback(new Error('No permitido por CORS'));
    }
  },
  methods: ['GET', 'POST'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Request-ID',
    'X-Device-Fingerprint',  // requerido por rateLimiter y scoringGuard
    'X-Captcha-Ack',         // captchaGate interno
    'X-Captcha-Token',       // captchaGate externo
  ],
  credentials: true
}));

// ─── Body parsing ─────────────────────────────────────────────────────────────
// JSON solo para rutas que lo usen (OTP). 
// multipart/form-data lo maneja multer directamente en la ruta de contactos.
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: false, limit: '50kb' }));
app.use(hpp());

// ─── HTTP logging ─────────────────────────────────────────────────────────────
app.use(morgan('combined', {
  stream: { write: msg => logger.http(msg.trim()) },
  skip: req => req.url === '/health',
}));

// ─── Request ID ───────────────────────────────────────────────────────────────
app.use((req, _res, next) => {
  req.requestId = req.headers['x-request-id'] || require('uuid').v4();
  next();
});

// ─── Rutas ───────────────────────────────────────────────────────────────────
const API = `/api/${process.env.API_VERSION || 'v1'}`;

app.use('/health', healthRouter);
app.use(`${API}/contactos`, contactosRouter);
app.use(`${API}/otp`, otpRouter);
app.use(`${API}/admin`, require('./routes/admin').router);

// ─── 404 ─────────────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Ruta no encontrada' }));

// ─── Error handler ────────────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || 500;
  logger.error({ requestId: req.requestId, method: req.method, url: req.url, status, error: err.message });
  res.status(status).json({
    success: false, code: err.code || 'INTERNAL_ERROR',
    message: process.env.NODE_ENV === 'production' ? 'Ocurrió un error, intenta más tarde' : err.message,
    requestId: req.requestId,
  });
});

module.exports = app;
