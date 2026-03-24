const OPCIONES = [
  { key: "registro", icon: "bi-person-plus", label: "Registrarme" },
  { key: "consulta", icon: "bi-search",      label: "Consultar registro" },
];

export default function VistaToggle({ vista, disabled, onChange }) {
  return (
    <div className="mb-4 d-flex justify-content-center">
      <div style={{
        display: "inline-flex",
        background: disabled ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.08)",
        borderRadius: 999, padding: 4, gap: 2,
        border: "1px solid rgba(255,255,255,0.12)",
        opacity: disabled ? 0.45 : 1,
        transition: "opacity 0.25s ease",
        pointerEvents: disabled ? "none" : "auto",
      }}>
        {OPCIONES.map(({ key, icon, label }) => (
          <button key={key} type="button"
            onClick={() => onChange(key)}
            disabled={disabled}
            style={{
              background: vista === key ? "#fff" : "transparent",
              color: vista === key ? "var(--red)" : "rgba(255,255,255,0.65)",
              border: "none", borderRadius: 999,
              padding: "8px 20px", fontSize: "0.82rem", fontWeight: 600,
              fontFamily: "var(--font-body)",
              cursor: disabled ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", gap: 7,
              transition: "all 0.2s ease", whiteSpace: "nowrap",
              boxShadow: vista === key ? "0 2px 8px rgba(0,0,0,0.18)" : "none",
            }}>
            <i className={`bi ${icon}`} style={{ fontSize: "0.85rem" }}></i>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}