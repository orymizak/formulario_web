import { useRef, useEffect } from "react";
import ImagenSegura from "../../components/ImagenSegura";
import { useFolioSearch } from "../../hooks/useFolioSearch";
import { useCopy } from "../../hooks/useCopy";
import styles from "../../App.module.css";

export default function VistaConsulta() {
  const {
    folioSearch, setFolioSearch,
    folioResult, folioError, folioSearching,
    lockout, cooldown,
    handleSearch, clearSearch, downloadComprobante,
  } = useFolioSearch();

  const { copy: copyFolio, copied: folioCopiado } = useCopy();
  const inputRef = useRef(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  return (
    <div className={`card border-0 overflow-hidden ${styles.fadeKeyframe}`} style={{ borderRadius: "16px" }}>
      <div className="card-body p-0 bg-transparent">
        {/* Header */}
        <div className="d-flex align-items-center gap-3 px-4 py-3"
          style={{ borderBottom: "1px solid var(--gray-200)", background: "#fff" }}>
          <div style={{ width: 4, height: 28, background: "var(--red)", borderRadius: 2, flexShrink: 0 }} />
          <div>
            <h2 className="h6 mb-0 fw-bold"
              style={{ fontFamily: "var(--font-display)", letterSpacing: "0.04em" }}>
              Consultar mi registro
            </h2>
            <p className="mb-0 small text-muted">Ingresa el folio que recibiste al registrarte</p>
          </div>
        </div>

        <div className="bg-white p-4">
          {/* Buscador */}
          <form onSubmit={handleSearch}>
            <div className="d-flex gap-2 mb-3">
              <input
                ref={inputRef}
                type="text"
                className="form-control"
                placeholder={lockout ? `Espera ${cooldown}s...` : "Ingresa tu folio"}
                value={folioSearch}
                onChange={(e) => { setFolioSearch(e.target.value); }}
                disabled={lockout}
                required
              />
              <button type="submit" className="btn-hubox flex-shrink-0"
                disabled={folioSearching || lockout}>
                {folioSearching
                  ? <span className="spinner-border spinner-border-sm" />
                  : lockout
                    ? <><i className="bi bi-clock-history me-1"></i>{cooldown}s</>
                    : <><i className="bi bi-search me-1"></i>Buscar</>}
              </button>
              {folioResult && (
                <button type="button" className="btn-hubox flex-shrink-0" onClick={clearSearch}>
                  Limpiar
                </button>
              )}
            </div>
          </form>

          {folioError && (
            <div className="alert alert-warning small d-flex gap-2 align-items-center mb-3">
              <i className="bi bi-exclamation-triangle-fill flex-shrink-0"></i>
              {folioError}
            </div>
          )}

          {/* Resultado */}
          {folioResult ? (
            <ResultadoFolio
              result={folioResult}
              copied={folioCopiado}
              onCopy={() => copyFolio(folioResult?.id)}
              onDownload={downloadComprobante}
            />
          ) : !folioError && (
            <div className="text-center py-4" style={{ color: "#bbb" }}>
              <i className="bi bi-file-earmark-text" style={{ fontSize: "2.5rem", display: "block", marginBottom: 10 }}></i>
              <p className="small mb-0">Ingresa tu folio para ver tu información</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ResultadoFolio({ result, copied, onCopy, onDownload }) {
  const rows = [
    ["Nombre",     `${result.nombre} ${result.apellido || ""}`.trim()],
    ["Correo",     result.email],
    ["Teléfono",   result.telefono],
    ["Registrado", result.createdAt
      ? new Date(result.createdAt).toLocaleDateString("es-MX", { dateStyle: "long" })
      : null],
  ].filter(([, v]) => v);

  return (
    <div className="overflow-hidden"
      style={{ borderRadius: "var(--radius)", boxShadow: "0 2px 12px rgba(0,0,0,0.08)", border: "1px solid var(--gray-200)" }}>
      {/* Header resultado */}
      <div className="d-flex align-items-center justify-content-between px-4 py-3 bg-white"
        style={{ borderBottom: "1px solid var(--gray-200)" }}>
        <div className="d-flex align-items-center gap-2">
          <i className="bi bi-person-check-fill text-danger"></i>
          <span className="fw-semibold small text-uppercase" style={{ letterSpacing: "0.08em" }}>
            Información de registro
          </span>
        </div>
        <div className="d-flex align-items-center gap-2">
          <button type="button" className="btn btn-sm d-flex align-items-center gap-1"
            onClick={onCopy}
            style={{
              background: copied ? "#dcfce7" : "#f3f4f6",
              border: `1px solid ${copied ? "#86efac" : "#e5e7eb"}`,
              color: copied ? "#16a34a" : "#555",
              transition: "all 0.25s ease",
            }}>
            <i className={`bi bi-${copied ? "check2" : "clipboard"}`}></i>
            <span className="d-none d-sm-inline">{copied ? "¡Copiado!" : "Copiar folio"}</span>
          </button>
          <button type="button" className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
            onClick={onDownload}>
            <i className="bi bi-download"></i>
            <span className="d-none d-sm-inline">Comprobante</span>
          </button>
        </div>
      </div>

      {/* Datos */}
      <div className="card-body px-4 py-3">
        {rows.map(([label, value]) => (
          <div key={label} className="d-flex gap-3 py-2"
            style={{ borderBottom: "1px solid var(--gray-200)" }}>
            <span className="text-muted small" style={{ minWidth: 100 }}>{label}</span>
            <span className="small fw-semibold text-dark">{value}</span>
          </div>
        ))}
      </div>

      {/* Documentos */}
      {(result.fotoKey || result.ineKey) && (
        <div className="px-4 pb-4 pt-2">
          <p className="small text-muted text-uppercase fw-semibold mb-3"
            style={{ letterSpacing: "0.08em", fontSize: "0.65rem" }}>
            Documentos adjuntos
          </p>
          <div className="row g-3 justify-content-center">
            {[
              { key: result.fotoKey, label: "Fotografía", icon: "bi-person-bounding-box" },
              { key: result.ineKey,  label: "INE",         icon: "bi-card-text" },
            ].filter(({ key }) => key).map(({ key, label, icon }) => (
              <div key={label} className="col-12 col-sm-6">
                <div className="border rounded-3 overflow-hidden bg-white d-flex flex-column"
                  style={{ boxShadow: "0 1px 4px rgba(0,0,0,.06)", height: 220 }}>
                  <div className="px-3 pt-3 pb-1 text-center flex-shrink-0">
                    <span className="badge bg-light text-muted small" style={{ fontSize: "0.65rem" }}>
                      <i className={`bi ${icon} me-1`}></i>{label}
                    </span>
                  </div>
                  <div className="p-2 flex-grow-1 d-flex align-items-center justify-content-center overflow-hidden">
                    <ImagenSegura fileKey={key} folio={result.id} label={label} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}