import { useState, useEffect, useRef, useCallback } from 'react'

export function useOtpTimer(initialSeconds = 600) {
  const [seconds, setSeconds] = useState(0)
  const [running, setRunning] = useState(false)
  const ref = useRef(null)

  const start = useCallback((s = initialSeconds) => {
    clearInterval(ref.current)
    setSeconds(s)
    setRunning(true)
  }, [initialSeconds])

  const stop = useCallback(() => {
    clearInterval(ref.current)
    setRunning(false)
  }, [])

  useEffect(() => {
    if (!running) return
    ref.current = setInterval(() => {
      setSeconds(prev => {
        if (prev <= 1) { clearInterval(ref.current); setRunning(false); return 0 }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(ref.current)
  }, [running])

  const formatted = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`

  return { seconds, formatted, running, expired: !running && seconds === 0, start, stop }
}
