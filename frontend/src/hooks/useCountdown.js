import { useState, useRef, useCallback } from 'react'

/**
 * useCountdown — countdown timer aislado del componente padre.
 * Al estar en su propio hook, el setInterval solo re-renderiza
 * los consumidores del countdown, NO todo el árbol de App.
 *
 * Uso:
 *   const { seconds, active, start } = useCountdown()
 *   start(60)  // empieza cuenta regresiva de 60s
 */
export function useCountdown() {
  const [seconds, setSeconds] = useState(0)
  const [active, setActive]   = useState(false)
  const timerRef = useRef(null)

  const start = useCallback((duration) => {
    if (timerRef.current) clearInterval(timerRef.current)
    setSeconds(duration)
    setActive(true)

    timerRef.current = setInterval(() => {
      setSeconds(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current)
          timerRef.current = null
          setActive(false)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [])

  return { seconds, active, start }
}