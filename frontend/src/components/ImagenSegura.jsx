import { useState, useEffect } from 'react'
import { api } from '../services/api'

export default function ImagenSegura({ fileKey, folio, label }) {
  const [url, setUrl]     = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    api.getFileUrl(fileKey, folio)
      .then(r => setUrl(r.url))
      .catch(() => setError(true))
  }, [fileKey, folio])

  if (error) return <p className="small text-muted mb-0 text-center">{label}: no disponible</p>

  const isPdf = fileKey.endsWith('.pdf')

  // Skeleton mientras carga — dimensiones fijas evitan CLS
  if (!url) return (
    <div style={{
      width: '100%', height: '100%', minHeight: 140,
      background: 'linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s ease infinite',
      borderRadius: 6,
    }} />
  )

  return isPdf
    ? <a href={url} target="_blank" rel="noreferrer"
        className="btn btn-sm btn-outline-secondary d-flex align-items-center justify-content-center gap-2"
        style={{ width: '100%' }}>
        <i className="bi bi-file-pdf"></i>Ver PDF
      </a>
    : <img
        src={url}
        alt={label}
        width="300"
        height="200"
        loading="lazy"
        decoding="async"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          borderRadius: 6,
          border: '1px solid var(--gray-200)',
          display: 'block',
        }}
      />
}