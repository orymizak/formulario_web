/**
 * useFormGuard — rastrea intentos fallidos y decide si mostrar CAPTCHA.
 * Umbral configurable, persistido en sessionStorage para sobrevivir
 * recargas accidentales pero no sesiones nuevas.
 */
import { useState, useCallback } from 'react'

const KEY = 'hbx_fail_count'
const THRESHOLD = 3

function load()  { return parseInt(sessionStorage.getItem(KEY) || '0') }
function save(n) { sessionStorage.setItem(KEY, n) }

export function useFormGuard() {
  const [failCount, setFailCount] = useState(load)
  const needsCaptcha = failCount >= THRESHOLD

  const recordFail = useCallback(() => {
    setFailCount(prev => { const n = prev + 1; save(n); return n })
  }, [])

  const clearFails = useCallback(() => {
    setFailCount(0); save(0)
  }, [])

  return { failCount, needsCaptcha, recordFail, clearFails }
}
