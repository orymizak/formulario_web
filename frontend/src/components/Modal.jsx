/**
 * Modal genérico reutilizable.
 * Usa el modal nativo de Bootstrap (requiere bootstrap.bundle.min.js en index.html).
 * Alternativa CSS-only para no depender de JS de Bootstrap:
 * usa position:fixed con backdrop.
 */
export default function Modal({ show, title, children, onClose, footer }) {
  if (!show) return null
  return (
    <>
      {/* Backdrop */}
      <div
        className="modal-backdrop fade show"
        style={{ zIndex: 1040 }}
        onClick={onClose}
      />
      {/* Modal */}
      <div
        className="modal fade show d-block"
        style={{ zIndex: 1050 }}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content border-0 shadow" style={{ borderRadius: 'var(--radius)' }}>
            {title && (
              <div className="modal-header" style={{ borderBottom: '1px solid var(--gray-200)' }}>
                <h5 className="modal-title" style={{ fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '0.04em' }}>
                  {title}
                </h5>
                <button type="button" className="btn-close" onClick={onClose} aria-label="Cerrar" />
              </div>
            )}
            <div className="modal-body">{children}</div>
            {footer && (
              <div className="modal-footer" style={{ borderTop: '1px solid var(--gray-200)' }}>
                {footer}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
