import styles from './SuccessStep.module.css'

export default function SuccessStep({ registroId, email }) {
  function copyFolio() {
    if (!registroId) return
    navigator.clipboard.writeText(registroId).catch(() => {})
  }

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
          {/* Caja del folio */}
          <div className="p-3 rounded mb-2"
            style={{ background: '#fff8e1', border: '1px solid #ffe082', borderRadius: 'var(--radius)' }}>
            <p className="small text-muted mb-1 text-uppercase fw-semibold" style={{ letterSpacing: '0.08em' }}>
              Tu folio de registro
            </p>
            <div className="d-flex align-items-center justify-content-center gap-2 flex-wrap">
              <code className="text-dark fw-bold" style={{ fontSize: '0.85rem', wordBreak: 'break-all' }}>
                {registroId}
              </code>
              <button
                className="btn btn-sm btn-outline-secondary"
                onClick={copyFolio}
                title="Copiar folio"
                style={{ flexShrink: 0 }}
              >
                <i className="bi bi-clipboard"></i>
              </button>
            </div>
          </div>

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
