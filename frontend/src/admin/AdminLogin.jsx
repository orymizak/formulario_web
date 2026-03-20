import { useState } from 'react'
import { adminApi } from './adminApi'

export default function AdminLogin({ onLogin }) {
  const [user, setUser]   = useState('')
  const [pass, setPass]   = useState('')
  const [err,  setErr]    = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setErr(''); setLoading(true)
    try {
      const res = await adminApi.login(user, pass)
      onLogin(res.token)
    } catch (e) {
      setErr(e?.message || 'Credenciales incorrectas.')
    } finally { setLoading(false) }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#1a1a1a'
    }}>
      <div style={{
        background: '#fff', borderRadius: 12, padding: '2.5rem 2rem',
        width: '100%', maxWidth: 380, boxShadow: '0 20px 60px rgba(0,0,0,.4)'
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--red)', width: 52, height: 52, borderRadius: 10,
            marginBottom: '0.75rem'
          }}>
            <svg width="26" height="26" fill="none" viewBox="0 0 24 24">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div style={{ fontWeight: 800, fontSize: '1.4rem', letterSpacing: '-0.02em' }}>
            Hu<span style={{ color: 'var(--red)' }}>BOX</span>
            <sup style={{ fontSize: '0.5em', color: 'var(--red)' }}>®</sup>
          </div>
          <div style={{ fontSize: '0.78rem', color: '#888', marginTop: 2 }}>
            Panel de Administración
          </div>
        </div>

        {err && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
            padding: '10px 14px', fontSize: '0.82rem', color: '#b91c1c',
            marginBottom: '1.25rem', display: 'flex', gap: 8, alignItems: 'center'
          }}>
            <span>⚠</span> {err}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600,
              color: '#555', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>
              Usuario
            </label>
            <input
              type="text" value={user} onChange={e => setUser(e.target.value)}
              autoFocus autoComplete="username"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8,
                border: '1.5px solid #e5e7eb', fontSize: '0.9rem',
                outline: 'none', boxSizing: 'border-box',
                fontFamily: 'var(--font-body)' }}
            />
          </div>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600,
              color: '#555', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>
              Contraseña
            </label>
            <input
              type="password" value={pass} onChange={e => setPass(e.target.value)}
              autoComplete="current-password"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8,
                border: '1.5px solid #e5e7eb', fontSize: '0.9rem',
                outline: 'none', boxSizing: 'border-box',
                fontFamily: 'var(--font-body)' }}
            />
          </div>
          <button type="submit" disabled={loading} style={{
            width: '100%', padding: '11px', borderRadius: 8,
            background: loading ? '#ccc' : 'var(--red)', color: '#fff',
            border: 'none', fontWeight: 700, fontSize: '0.9rem',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontFamily: 'var(--font-body)'
          }}>
            {loading ? 'Verificando…' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  )
}
