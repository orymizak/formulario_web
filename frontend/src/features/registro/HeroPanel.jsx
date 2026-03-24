import styles from "../../App.module.css";

const BENEFICIOS = [
  ["bi-shield-check",  "Datos cifrados"],
  ["bi-envelope-check","Verificación de correo"],
  ["bi-lock-fill",     "Solo tú tienes acceso"],
  ["bi-eye-slash",     "Tu información es privada"],
  ["bi-shield-shaded", "Protección de identidad"],
];

export default function HeroPanel() {
  return (
    <div className={`col-12 col-lg-5 col-xl-4 text-center text-lg-start mb-4 mb-lg-0 ${styles.stickyPanel}`}>
      <p className="small fw-bold text-uppercase mb-2 hero-enter delay-1"
        style={{ color: "var(--red)", letterSpacing: "0.18em", fontSize: "clamp(0.7rem, 1vw, 0.9rem)" }}>
        Identidad Digital
      </p>
      <h1 className={`fw-bold mb-3 hero-enter-left delay-2 ${styles.heroTitle}`}
        style={{ color: "#fff", fontSize: "clamp(2.2rem, 4vw, 4.5rem)", lineHeight: 1.1 }}>
        Registro de <span style={{ color: "var(--red)" }}>datos</span>
      </h1>
      <p className="mb-4 hero-enter delay-3"
        style={{ color: "rgba(255,255,255,.65)", fontWeight: 300,
          fontSize: "clamp(1rem, 1.2vw, 1.25rem)", maxWidth: "500px", margin: "0 auto 0 auto" }}>
        Completa el formulario para registrar tu identidad de forma segura.
      </p>
      <div className="d-none d-lg-block">
        {BENEFICIOS.map(([icon, text], i) => (
          <div key={icon}
            className={`d-flex align-items-center justify-content-center justify-content-lg-start gap-2 mb-2 hero-enter delay-${i + 3}`}>
            <i className={`bi ${icon} text-danger`}></i>
            <span className="small" style={{ color: "rgba(255,255,255,.55)", fontSize: "clamp(0.8rem, 0.9vw, 1rem)" }}>
              {text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}