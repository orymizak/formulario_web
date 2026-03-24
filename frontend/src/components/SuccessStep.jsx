import styles from './SuccessStep.module.css'
import { useCopy } from '../hooks/useCopy'

export default function SuccessStep({ registroId, email }) {
  const { copy, copied } = useCopy()

  return (
    <div className="p-5 text-center" style={{ animation: 'fadeUp 0.3s ease both' }}>
      <div className={`d-inline-flex align-items-center justify-content-center rounded-circle mb-4 ${styles.check}`}>
        <i className="bi bi-check-lg text-white" style={{ fontSize: '2rem' }}></i>
      </div>

      <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 300, fontSize: '2rem' }}>
        ¡Registro completado!
      </h2>

      <p className="text-muted mt-3 mb-4 mx-auto" style={{ maxWidth: 440 }}>
        Hemos recibido tu información correctamente.
        {email && (
          <> Te enviamos una confirmación a <strong className="text-dark">{email}</strong> con tu folio.</>
        )}
      </p>

      {registroId && (
        <div className="mx-auto mb-4" style={{ maxWidth: 480 }}>
          {/* Caja del folio — clickeable completa para copiar */}
          <button
            onClick={() => copy(registroId)}
            title="Clic para copiar tu folio"
            style={{
              display: 'block',
              width: '100%',
              background: copied ? '#f0fdf4' : '#fff8e1',
              border: `2px solid ${copied ? '#86efac' : '#ffe082'}`,
              borderRadius: 'var(--radius)',
              padding: '1rem 1.25rem',
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'all 0.25s ease',
              marginBottom: '0.5rem',
            }}
          >
            {/* Label */}
            <p style={{
              fontSize: '0.72rem',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              fontWeight: 600,
              color: copied ? '#16a34a' : '#888',
              transition: 'color 0.25s ease',
              margin: '0 0 0.5rem',
            }}>
              {copied
                ? <><i className="bi bi-check2 me-1"></i>¡Folio copiado al portapapeles!</>
                : <>Tu folio de registro · <span style={{ fontWeight: 400, opacity: 0.8 }}>clic para copiar</span></>
              }
            </p>

            {/* Folio + icono */}
            <div className="d-flex align-items-center justify-content-center gap-3">
              <code style={{
                fontSize: '0.88rem',
                fontWeight: 700,
                wordBreak: 'break-all',
                color: copied ? '#15803d' : '#1a1a1a',
                transition: 'color 0.25s ease',
                letterSpacing: '0.02em',
              }}>
                {registroId}
              </code>
              <span style={{
                flexShrink: 0,
                width: 34,
                height: 34,
                borderRadius: 8,
                background: copied ? '#dcfce7' : 'rgba(0,0,0,0.07)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.05rem',
                color: copied ? '#16a34a' : '#555',
                transition: 'all 0.25s ease',
              }}>
                <i className={`bi bi-${copied ? 'check2' : 'clipboard'}`}></i>
              </span>
            </div>
          </button>

          {/* Advertencia sobre el folio */}
          <div className="alert alert-info d-flex gap-2 align-items-start text-start py-2 px-3 small mb-0">
            <i className="bi bi-info-circle-fill flex-shrink-0 mt-1"></i>
            <span>
              <strong>Guarda este folio.</strong> Lo necesitarás para consultar tu información
              en la sección <em>"Consultar mi registro"</em> que aparece debajo del formulario.
            </span>
          </div>
        </div>
      )}

      <button
        className="btn btn-outline-secondary btn-sm"
        onClick={() => window.location.reload()}
      >
        <i className="bi bi-plus-circle me-1"></i> Nuevo registro
      </button>
    </div>
  )
}