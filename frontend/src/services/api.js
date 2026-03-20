const BASE = '/api/v1'

// ── reCAPTCHA v2 ─────────────────────────────────────────────────────────────
// Clave pública del sitio
export const RECAPTCHA_SITE_KEY = '6LcdeZAsAAAAAGRxIQAsN3ddKD7QKLH8u6JMbMfJ'

export function loadRecaptchaScript() {
  if (document.getElementById('recaptcha-script')) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.id = 'recaptcha-script';
    s.src = 'https://www.google.com/recaptcha/api.js?render=explicit&hl=es';
    s.async = true;
    s.defer = true;
    s.onload = () => {
      // Verificación de seguridad: a veces onload dispara antes de que window.grecaptcha exista
      const interval = setInterval(() => {
        if (window.grecaptcha && window.grecaptcha.ready) {
          clearInterval(interval);
          resolve();
        }
      }, 50);
    };
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

// ── Device fingerprint ───────────────────────────────────────────────────────
function getFingerprint() {
  const parts = [
    navigator.userAgent, navigator.language,
    navigator.hardwareConcurrency, screen.width, screen.height,
    screen.colorDepth, Intl.DateTimeFormat().resolvedOptions().timeZone,
    navigator.platform,
  ]
  let hash = 0
  const str = parts.join('|')
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i); hash |= 0
  }
  return Math.abs(hash).toString(36)
}

export const FINGERPRINT = getFingerprint()

// ── Request base ─────────────────────────────────────────────────────────────
async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'X-Device-Fingerprint': FINGERPRINT,
      ...options.headers,
    },
  })
  let data = {}
  try {
    data = await res.json()
  } catch {
    data = { message: `Error del servidor (${res.status}). Intenta de nuevo.` }
  }
  if (!res.ok) throw { status: res.status, ...data }
  return data
}

// ── API ───────────────────────────────────────────────────────────────────────
export const api = {
  getRiskScore: () =>
    request('/otp/score'),

  requestOtp: (email) =>
    request('/otp/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    }),

  verifyOtp: (email, code) =>
    request('/otp/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code }),
    }),

  // Envío multipart (foto + INE como archivos)
  // captchaToken: token obtenido del widget reCAPTCHA v2 (puede ser null si no se requiere)
  submitRegistro: (payload, token, captchaToken = null) => {
    const form = new FormData()
    Object.entries(payload).forEach(([k, v]) => {
      if (v === undefined || v === null) return
      if (v instanceof File) form.append(k, v, v.name)
      else form.append(k, String(v))
    })
    if (captchaToken) form.append('captchaToken', captchaToken)

    return request('/contactos', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    })
  },

  // Buscar registro por folio (UUID)
  buscarPorFolio: (folio) =>
    request(`/contactos/${encodeURIComponent(folio)}`),

  // Verificar si email, teléfono o CURP ya están registrados (antes del OTP)
  checkDuplicates: ({ email, telefono, curp }) =>
    request('/contactos/check-duplicates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, telefono, curp }),
    }),

  // Reenviar folio al correo registrado
  sendFolioReminder: (payload) =>
    request('/contactos/folio-reminder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // enviar el objeto completo: { email, telefono, curp }
      body: JSON.stringify(payload),
    }),
}