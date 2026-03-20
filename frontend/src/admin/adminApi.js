// ── Admin API client ──────────────────────────────────────────────────────────
const BASE = 'http://localhost:8080/api/v1/admin'

function getToken() { return sessionStorage.getItem('admin_token') }
export function saveToken(t) { sessionStorage.setItem('admin_token', t) }
export function clearToken() { sessionStorage.removeItem('admin_token') }
export function hasToken() { return !!getToken() }

async function req(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
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

export const adminApi = {
  login: (username, password) =>
    req('/login', { method: 'POST', body: JSON.stringify({ username, password }) }),

  getContactos: (params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v !== undefined))
    ).toString()
    return req(`/contactos${qs ? '?' + qs : ''}`)
  },

  getContacto: (id) => req(`/contactos/${id}`),

  getStats: () => req('/stats'),

  getAudit: (limit = 50) => req(`/audit?limit=${limit}`),
}
