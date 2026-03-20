import styles from './StepIndicator.module.css'

const STEPS = [
  { n: 1, label: 'Tus datos' },
  { n: 2, label: 'Verificación' },
  { n: 3, label: 'Listo' },
]

export default function StepIndicator({ current }) {
  return (
    // Añadimos justify-content-center para alinear al medio
    <div className="d-flex align-items-center justify-content-center mb-4 w-100">
      {STEPS.map(({ n, label }, idx) => {
        const done   = n < current
        const active = n === current
        return (
          <div key={n} className={[
            'd-flex align-items-center',
            styles.step,
            done   ? styles.done   : '',
            active ? styles.active : '',
          ].join(' ')}>
            <div className={styles.num}>
              {done ? <i className="bi bi-check-lg" /> : n}
            </div>
            <span className={`d-none d-sm-inline ${styles.label}`}>{label}</span>
            {idx < STEPS.length - 1 && (
              <div className={`${styles.line} ${done ? styles.lineDone : ''}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}
