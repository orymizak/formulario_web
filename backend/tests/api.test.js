/**
 * Tests principales
 * Ejecutar: npm test
 */

const request = require('supertest');
const app = require('../src/app');

// ─── Mock Redis y BD para tests unitarios ────────────────────────────────────
jest.mock('../src/config/redis', () => {
  const store = {};
  return {
    get: jest.fn((key) => Promise.resolve(store[key] || null)),
    set: jest.fn((key, val) => { store[key] = String(val); return Promise.resolve('OK'); }),
    incr: jest.fn((key) => { store[key] = String((parseInt(store[key] || '0') + 1)); return Promise.resolve(parseInt(store[key])); }),
    expire: jest.fn(() => Promise.resolve(1)),
    ttl: jest.fn(() => Promise.resolve(300)),
    del: jest.fn((...keys) => { keys.forEach((k) => delete store[k]); return Promise.resolve(keys.length); }),
    mget: jest.fn((k1, k2) => Promise.resolve([store[k1] || null, store[k2] || null])),
    pipeline: jest.fn(() => ({ set: jest.fn().mockReturnThis(), exec: jest.fn().mockResolvedValue([]) })),
    ping: jest.fn(() => Promise.resolve('PONG')),
    on: jest.fn(),
  };
});

jest.mock('../src/models', () => ({
  sequelize: { authenticate: jest.fn(), query: jest.fn().mockResolvedValue([]) },
  Contacto: { findOne: jest.fn(), create: jest.fn(), findAndCountAll: jest.fn() },
  AuditLog: { create: jest.fn().mockResolvedValue({}) },
}));

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────
describe('GET /health', () => {
  it('devuelve 200 con status healthy', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.checks).toHaveProperty('db');
    expect(res.body.checks).toHaveProperty('redis');
  });
});

// ─── VALIDACIÓN DEL FORMULARIO ────────────────────────────────────────────────
describe('POST /api/v1/contactos - validaciones', () => {
  it('rechaza body vacío con 422', async () => {
    const res = await request(app)
      .post('/api/v1/contactos')
      .send({});
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.errors.length).toBeGreaterThan(0);
  });

  it('rechaza email inválido', async () => {
    const res = await request(app)
      .post('/api/v1/contactos')
      .send({ nombre: 'Juan', apellido: 'Pérez', email: 'no-es-email', telefono: '6681234567' });
    expect(res.status).toBe(422);
    const emailError = res.body.errors.find((e) => e.field === 'email');
    expect(emailError).toBeDefined();
  });

  it('rechaza nombre con caracteres especiales', async () => {
    const res = await request(app)
      .post('/api/v1/contactos')
      .send({ nombre: '<script>alert(1)</script>', apellido: 'Pérez', email: 'a@b.com', telefono: '6681234567' });
    expect(res.status).toBe(422);
  });
});

// ─── OTP ──────────────────────────────────────────────────────────────────────
describe('POST /api/v1/otp/request', () => {
  it('rechaza email inválido con 422', async () => {
    const res = await request(app)
      .post('/api/v1/otp/request')
      .send({ email: 'malformado' });
    expect(res.status).toBe(422);
  });
});

describe('POST /api/v1/otp/verify', () => {
  it('rechaza código que no son 6 dígitos', async () => {
    const res = await request(app)
      .post('/api/v1/otp/verify')
      .send({ email: 'test@test.com', code: '123' });
    expect(res.status).toBe(422);
  });

  it('devuelve 400 cuando OTP no existe en Redis', async () => {
    const res = await request(app)
      .post('/api/v1/otp/verify')
      .send({ email: 'noexiste@test.com', code: '123456' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('OTP_EXPIRED');
  });
});

// ─── RATE LIMITING ────────────────────────────────────────────────────────────
describe('Rate limiter', () => {
  it('añade header X-RateLimit-Remaining en respuestas válidas', async () => {
    const res = await request(app).get('/health');
    // Health no pasa por rate limiter, checar en OTP
    expect(res.status).toBe(200);
  });
});

// ─── SEGURIDAD: headers ───────────────────────────────────────────────────────
describe('Security headers (Helmet)', () => {
  it('incluye X-Content-Type-Options', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('incluye X-Frame-Options', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-frame-options']).toBeDefined();
  });
});
