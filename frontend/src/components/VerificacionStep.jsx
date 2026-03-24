import { useRef, useState, useEffect } from 'react'
import { api } from '../services/api'
import { useOtpTimer } from '../hooks/useOtpTimer'
import CardHeader from './CardHeader'
import Alert from './Alert'
import styles from './OtpStep.module.css'

function maskEmail(email) {
  const [user, domain] = email.split('@')
  return `${user.slice(0, 2)}****@${domain}`
}

export default function VerificacionStep({ email, expiresIn, onSuccess, onBack, onResend }) {
  const [digits,  setDigits]  = useState(['','','','','',''])
  const [error,   setError]   = useState('')
  const [shake,   setShake]   = useState(false)
  const [loading, setLoading] = useState(false)
  const refs  = useRef([])
  const timer = useOtpTimer(expiresIn)

  useEffect(() => { timer.start(expiresIn) }, []) // eslint-disable-line

  async function verify(code) {
    if (loading) return
    setError(''); setLoading(true)
    try {
      const data = await api.verifyOtp(email, code)
      onSuccess(data.sessionToken)
    } catch (err) {
      setShake(true); setTimeout(() => setShake(false), 400)
      setError(err.attemptsRemaining !== undefined
        ? `Código incorrecto. Intentos restantes: ${err.attemptsRemaining}`
        : err.message || 'Código inválido')
      setDigits(['','','','','',''])
      setTimeout(() => refs.current[0]?.focus(), 50)
    } finally { setLoading(false) }
  }

  function handleChange(idx, val) {
    const digits6 = val.replace(/\D/g, '').slice(0, 6)
    if (digits6.length > 1) {
      const next = Array(6).fill('').map((_, i) => digits6[i] || '')
      setDigits(next)
      const lastIdx = Math.min(digits6.length - 1, 5)
      refs.current[lastIdx]?.focus()
      if (digits6.length === 6) verify(digits6)
      return
    }
    const ch = digits6.slice(-1)
    const next = [...digits]; next[idx] = ch; setDigits(next)
    if (ch && idx < 5) refs.current[idx + 1]?.focus()
    if (ch && idx === 5 && next.join('').length === 6) verify(next.join(''))
  }

  function handleKeyDown(idx, e) {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) {
      const next = [...digits]; next[idx - 1] = ''; setDigits(next)
      refs.current[idx - 1]?.focus()
    }
  }

  function handlePaste(e) {
    const text = (e.clipboardData || window.clipboardData)?.getData('text')
    if (!text) return
    const code = text.replace(/\D/g, '').slice(0, 6)
    if (code.length === 6) {
      e.preventDefault()
      setDigits([...code])
      refs.current[5]?.focus()
      verify(code)
    }
  }

  async function handleResend() {
    setDigits(['','','','','','']); setError('')
    try { await onResend(); timer.start(expiresIn) }
    catch (err) { setError(err.message || 'Error al reenviar el código.') }
  }

  return (
    <div style={{ animation: 'fadeUp 0.3s ease both' }}>
      <CardHeader title="Verificación de correo" subtitle="Ingresa el código de 6 dígitos que enviamos" />
      <div className="p-4">
        <Alert message={error} />
        <div className="text-center" style={{ maxWidth: 420, margin: '0 auto' }}>
          <div className={`d-inline-flex align-items-center justify-content-center rounded-circle mb-3 ${styles.iconCircle}`}>
            <i className="bi bi-envelope-check fs-3 text-danger"></i>
          </div>
          <p className="text-muted small mb-1">Código enviado a</p>
          <p className="fw-bold text-dark mb-4">{maskEmail(email)}</p>

          <div className={`d-flex gap-2 justify-content-center mb-3 ${shake ? styles.shake : ''}`}>
            {digits.map((d, i) => (
              <input key={i} ref={el => refs.current[i] = el}
                className={`form-control text-center fw-bold ${styles.digit} ${d ? styles.filled : ''}`}
                type="text" inputMode="numeric" pattern="[0-9]"
                maxLength={i === 0 ? 6 : 1}
                autoComplete={i === 0 ? "one-time-code" : "off"}
                value={d}
                onChange={e => handleChange(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                onPaste={handlePaste}
                disabled={loading}
                autoFocus={i === 0}
              />
            ))}
          </div>

          <p className="text-muted small mb-2">
            {timer.expired
              ? <span className="text-danger">El código expiró</span>
              : <>Expira en <strong className="text-danger">{timer.formatted}</strong></>}
          </p>

          {timer.expired && (
            <button type="button" className="btn btn-link btn-sm text-danger p-0 mb-3" onClick={handleResend}>
              <i className="bi bi-arrow-clockwise me-1"></i>Reenviar código
            </button>
          )}
        </div>

        <div className="d-flex justify-content-center pt-3 mt-3"
          style={{ borderTop: '1px solid var(--gray-200)' }}>
          <button type="button" className="btn btn-outline-secondary btn-sm"
            onClick={onBack} disabled={loading}>
            <i className="bi bi-arrow-left me-1"></i> Volver y corregir datos
          </button>
        </div>
      </div>
    </div>
  )
}