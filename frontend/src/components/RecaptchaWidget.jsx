/**
 * RecaptchaWidget — reCAPTCHA v2 "No soy un robot"
 *
 * Props:
 *   onVerify(token)  — se llama cuando el usuario resuelve el captcha
 *   onExpire()       — se llama cuando el token expira (cada ~2 min)
 *   onError()        — se llama si hay error de red
 */
import { useEffect, useRef } from 'react'
import { RECAPTCHA_SITE_KEY, loadRecaptchaScript } from '../services/api'

export default function RecaptchaWidget({ onVerify, onExpire, onError }) {
  const containerRef = useRef(null)
  const widgetIdRef  = useRef(null)

  useEffect(() => {
    let cancelled = false

async function init() {
  try {
    await loadRecaptchaScript();
    if (cancelled || !containerRef.current) return;

    // COMPROBACIÓN EXTRA: Si por alguna razón grecaptcha no está, reintento en 100ms
    if (!window.grecaptcha || !window.grecaptcha.ready) {
      setTimeout(init, 100);
      return;
    }

    window.grecaptcha.ready(() => {
      if (cancelled || !containerRef.current) return;
      if (widgetIdRef.current !== null) return;

      requestAnimationFrame(() => {
        if (cancelled || !containerRef.current) return;
        if (containerRef.current) containerRef.current.innerHTML = '';

        try {
          widgetIdRef.current = window.grecaptcha.render(containerRef.current, {
            sitekey: RECAPTCHA_SITE_KEY,
            theme: 'light',
            callback: onVerify,
            'expired-callback': onExpire || (() => {}),
            'error-callback': onError || (() => {}),
          });
        } catch (err) {
          console.warn('reCAPTCHA render skipped:', err.message);
        }
      });
    });
  } catch (err) {
    console.error("Error cargando reCAPTCHA:", err);
    onError?.();
  }
}

    init()
    return () => { cancelled = true }
  }, []) // eslint-disable-line

  return (
    <div
      ref={containerRef}
      className="d-flex justify-content-center my-2"
      // Altura mínima para que Google no descarte el contenedor por tener h=0
      style={{ minHeight: 78 }}
    />
  )
}