/**
 * Reutilizable: franja superior de cada tarjeta con acento rojo.
 */
export default function CardHeader({ title, subtitle }) {
  return (
    <div className="d-flex align-items-center gap-3 px-4 py-3"
      style={{ borderBottom: '1px solid var(--gray-200)' }}>
      <div style={{ width: 4, height: 28, background: 'var(--red)', borderRadius: 2, flexShrink: 0 }} />
      <div>
        <h2 className="h6 mb-0 fw-bold"
          style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.04em' }}>
          {title}
        </h2>
        {subtitle && <p className="mb-0 small text-muted">{subtitle}</p>}
      </div>
    </div>
  )
}
