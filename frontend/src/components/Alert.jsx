export default function Alert({ message, type = 'error' }) {
  if (!message) return null
  const bsClass = type === 'error' ? 'alert-danger' : type === 'info' ? 'alert-info' : 'alert-success'
  return (
    <div className={`alert ${bsClass} py-2 small`} role="alert" style={{ animation: 'slideDown 0.2s ease' }}>
      <i className={`bi ${type === 'error' ? 'bi-exclamation-triangle-fill' : 'bi-info-circle-fill'} me-2`}></i>
      {message}
    </div>
  )
}
