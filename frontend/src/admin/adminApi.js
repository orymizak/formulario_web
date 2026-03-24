// ── Admin API client ──────────────────────────────────────────────────────────
const BASE = (import.meta.env.VITE_API_URL || '') + '/api/v1/admin'
const PUB  = (import.meta.env.VITE_API_URL || '') + '/api/v1'

function getToken() { return sessionStorage.getItem('admin_token') }
export function saveToken(t) { sessionStorage.setItem('admin_token', t) }
export function clearToken() { sessionStorage.removeItem('admin_token') }
export function hasToken() { return !!getToken() }

async function req(path, opts = {}, base = BASE) {
  const res = await fetch(`${base}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      ...opts.headers,
    },
  })
  const data = await res.json()
  if (!res.ok) throw data
  return data
}

function buildQs(params = {}) {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v !== undefined))
  ).toString()
  return qs ? '?' + qs : ''
}

export const adminApi = {
  login: (username, password) =>
    req('/login', { method: 'POST', body: JSON.stringify({ username, password }) }),

  // Vista pública — sin token, datos censurados (sin ?raw)
  getContactosPublic: (params = {}) =>
    req(`/contactos${buildQs(params)}`),

  // Vista admin — con token, datos completos (?raw=1)
  getContactosAdmin: (params = {}) =>
    req(`/contactos${buildQs({ ...params, raw: 1 })}`),

  getContacto: (id, raw = false) =>
    req(`/contactos/${id}${raw ? '?raw=1' : ''}`),

  getAudit: (limit = 50) => req(`/audit?limit=${limit}`),

  getFileUrl: (key) => req(`/file-url?key=${encodeURIComponent(key)}`),
}