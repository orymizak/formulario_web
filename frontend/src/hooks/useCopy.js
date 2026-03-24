import { useState, useCallback, useRef } from 'react'

/**
 * useCopy — copia texto al portapapeles y expone un estado `copied`
 * que vuelve a false después de `resetMs` milisegundos (default 2000).
 *
 * Uso:
 *   const { copy, copied } = useCopy()
 *   <button onClick={() => copy(miTexto)}>{copied ? '¡Copiado!' : 'Copiar'}</button>
 */
export function useCopy(resetMs = 5000) {
  const [copied, setCopied] = useState(false)
  const timer = useRef(null)

  const copy = useCallback((text) => {
    if (!text) return
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), resetMs)
    }).catch(() => {})
  }, [resetMs])

  return { copy, copied }
}