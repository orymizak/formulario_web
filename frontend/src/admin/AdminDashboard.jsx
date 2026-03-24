import { useState, useEffect, useCallback, useRef } from "react";
import { adminApi } from "./adminApi";
import { useCopy } from "../hooks/useCopy";
import { createPortal } from "react-dom";

// ── Estilos base ──────────────────────────────────────────────────────────────
const S = {
  wrap:     { minHeight: "100vh", background: "#f3f4f6", fontFamily: "var(--font-body)" },
  topbar:   { background: "#1a1a1a", color: "#ccc", fontSize: "0.75rem", padding: "6px 1.25rem",
              display: "flex", justifyContent: "space-between", alignItems: "center" },
  navbar:   { background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "0.7rem 1.25rem",
              display: "flex", justifyContent: "space-between", alignItems: "center",
              position: "sticky", top: 0, zIndex: 100, boxShadow: "0 1px 4px rgba(0,0,0,.06)" },
  brand:    { fontWeight: 800, fontSize: "1.15rem", letterSpacing: "-0.02em" },
  main:     { padding: "1rem" },
  card:     { background: "#fff", borderRadius: 10, boxShadow: "0 1px 6px rgba(0,0,0,.07)",
              border: "1px solid #e5e7eb", overflow: "hidden" },
  cardHead: { background: "#1a1a1a", color: "#fff", padding: "0.7rem 1rem",
              fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: ".1em",
              display: "flex", justifyContent: "space-between", alignItems: "center" },
  th:       { padding: "0.6rem 0.8rem", fontSize: "0.7rem", textTransform: "uppercase",
              letterSpacing: ".08em", color: "#666", background: "#fafafa",
              borderBottom: "2px solid #e5e7eb", whiteSpace: "nowrap" },
  td:       { padding: "0.6rem 0.8rem", fontSize: "0.875rem",
              borderBottom: "1px solid #f3f4f6", verticalAlign: "middle" },
  input:    { padding: "8px 12px", borderRadius: 7, border: "1.5px solid #e5e7eb",
              fontSize: "0.875rem", fontFamily: "var(--font-body)", outline: "none", width: "100%" },
  btn:      { padding: "8px 16px", borderRadius: 7, border: "none", cursor: "pointer",
              fontSize: "0.875rem", fontWeight: 600, fontFamily: "var(--font-body)" },
  badge:    { display: "inline-block", padding: "3px 9px", borderRadius: 4,
              fontSize: "0.7rem", fontWeight: 600 },
};

const EVENT_COLORS = {
  CONTACT_CREATED: "#dcfce7", OTP_VERIFIED: "#dbeafe", OTP_FAILED: "#fee2e2",
  ADMIN_LOGIN: "#fef9c3", OTP_REQUESTED: "#e0e7ff", FOLIO_REMINDER_SENT: "#ffedd5",
};

function Badge({ label, colorMap }) {
  const bg = colorMap?.[label] || "#f3f4f6";
  return <span style={{ ...S.badge, background: bg, color: "#333" }}>{label || "—"}</span>;
}
function Spinner() {
  return <div style={{ textAlign: "center", padding: "2rem", color: "#aaa", fontSize: "0.875rem" }}>
    Cargando…
  </div>;
}

// ── Modal de Login ────────────────────────────────────────────────────────────
function LoginModal({ onLogin, onClose }) {
  const [user, setUser]       = useState("");
  const [pass, setPass]       = useState("");
  const [err, setErr]         = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setErr(""); setLoading(true);
    try {
      const res = await adminApi.login(user, pass);
      onLogin(res.token);
    } catch {
      setErr("Usuario o contraseña incorrectos.");
    } finally { setLoading(false); }
  }

  return createPortal(
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.6)",
        zIndex: 400,
        backdropFilter: "blur(3px)",
      }} />

      {/* Modal */}
      <div style={{
        position: "fixed",
        top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 401,
        background: "#fff",
        borderRadius: 14,
        width: "min(90vw, 380px)",
        boxShadow: "0 24px 80px rgba(0,0,0,0.35)",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          background: "#1a1a1a",
          padding: "1.1rem 1.25rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: "1.1rem", color: "#fff", letterSpacing: "-0.02em" }}>
              Hu<span style={{ color: "var(--red)" }}>BOX</span>
              <sup style={{ fontSize: "0.5em", color: "var(--red)" }}>®</sup>
            </div>
            <div style={{ fontSize: "0.72rem", color: "#888", marginTop: 2 }}>
              Acceso de administrador
            </div>
          </div>
          <button onClick={onClose} style={{
            background: "rgba(255,255,255,0.1)", border: "none", color: "#fff",
            borderRadius: "50%", width: 32, height: 32, fontSize: "1rem",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          }}>×</button>
        </div>

        {/* Body */}
        <div style={{ padding: "1.5rem 1.25rem" }}>
          {err && (
            <div style={{
              background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8,
              padding: "10px 14px", fontSize: "0.82rem", color: "#b91c1c",
              marginBottom: "1.25rem", display: "flex", gap: 8, alignItems: "center",
            }}>
              <span>⚠</span> {err}
            </div>
          )}
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700,
                color: "#555", marginBottom: 6, textTransform: "uppercase", letterSpacing: ".06em" }}>
                Usuario
              </label>
              <input
                type="text" value={user} onChange={e => setUser(e.target.value)}
                autoFocus autoComplete="username"
                style={{ ...S.input, boxSizing: "border-box" }}
              />
            </div>
            <div style={{ marginBottom: "1.5rem" }}>
              <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700,
                color: "#555", marginBottom: 6, textTransform: "uppercase", letterSpacing: ".06em" }}>
                Contraseña
              </label>
              <input
                type="password" value={pass} onChange={e => setPass(e.target.value)}
                autoComplete="current-password"
                style={{ ...S.input, boxSizing: "border-box" }}
              />
            </div>
            <button type="submit" disabled={loading} style={{
              ...S.btn,
              width: "100%", padding: "11px",
              background: loading ? "#ccc" : "var(--red)",
              color: "#fff",
              cursor: loading ? "not-allowed" : "pointer",
              borderRadius: 8,
              fontSize: "0.9rem",
            }}>
              {loading ? "Verificando…" : "Ingresar"}
            </button>
          </form>
        </div>
      </div>
    </>,
    document.body
  );
}

// ── Visor de imagen con lightbox (solo admin) ─────────────────────────────────
function ImagenAdmin({ fileKey, label }) {
  const [url, setUrl]         = useState(null);
  const [error, setError]     = useState(false);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState(false);

  useEffect(() => {
    adminApi.getFileUrl(fileKey)
      .then(r => { setUrl(r.url); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, [fileKey]);

  if (loading) return (
    <div style={{ background: "#f9fafb", border: "1px dashed #e5e7eb", borderRadius: 8,
      height: 120, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ fontSize: "0.75rem", color: "#9ca3af" }}>Cargando…</span>
    </div>
  );
  if (error) return (
    <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8,
      height: 80, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ fontSize: "0.75rem", color: "#ef4444" }}>✗ No disponible</span>
    </div>
  );

  const isPdf = fileKey?.toLowerCase().endsWith(".pdf");

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#555",
          textTransform: "uppercase", letterSpacing: ".06em" }}>{label}</span>
        <a href={url} target="_blank" rel="noreferrer"
          style={{ fontSize: "0.7rem", color: "var(--red)", textDecoration: "none" }}>
          ↗ Abrir
        </a>
      </div>
      {isPdf ? (
        <a href={url} target="_blank" rel="noreferrer"
          style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px",
            borderRadius: 8, background: "#fff5f5", border: "1px solid #fecdd3",
            color: "#be123c", fontSize: "0.875rem", textDecoration: "none", fontWeight: 500 }}>
          <span style={{ fontSize: "1.5rem" }}>📄</span>
          <div>
            <div style={{ fontWeight: 700 }}>Ver PDF</div>
            <div style={{ fontSize: "0.7rem", color: "#9ca3af", marginTop: 1 }}>
              {fileKey.split("/").pop()}
            </div>
          </div>
        </a>
      ) : (
        <div style={{ position: "relative", borderRadius: 8, overflow: "hidden",
          border: "1px solid #e5e7eb", cursor: "zoom-in" }}
          onClick={() => setLightbox(true)}>
          <img src={url} alt={label}
            style={{ width: "100%", display: "block", height: 130, objectFit: "cover" }} />
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0,
            background: "linear-gradient(transparent,rgba(0,0,0,0.45))",
            padding: "6px 8px", fontSize: "0.65rem", color: "rgba(255,255,255,0.85)" }}>
            Clic para ampliar
          </div>
        </div>
      )}
      {lightbox && createPortal(
        <div onClick={() => setLightbox(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)",
            zIndex: 9999, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", padding: "1rem" }}>
          <button onClick={() => setLightbox(false)}
            style={{ position: "absolute", top: 16, right: 16,
              background: "rgba(255,255,255,0.15)", border: "none", color: "#fff",
              borderRadius: "50%", width: 40, height: 40, fontSize: "1.1rem",
              cursor: "pointer" }}>✕</button>
          <p style={{ color: "rgba(255,255,255,0.65)", fontSize: "0.8rem", marginBottom: 12 }}>{label}</p>
          <img src={url} alt={label}
            style={{ maxWidth: "95%", maxHeight: "80vh", borderRadius: 8, objectFit: "contain" }} />
        </div>,
        document.body
      )}
    </>
  );
}

// ── Modal de detalle ──────────────────────────────────────────────────────────
function DetailModal({ detail, isAdmin, onClose, isMobile }) {
  const { copy, copied } = useCopy();
  if (!detail) return null;

  // Campos que se censuran en vista pública
  const sensitiveFields = ["email", "telefono", "curp", "ipOrigen"];

  const rows = [
    ["Folio",      detail.id],
    ["Nombre",     `${detail.nombre} ${detail.apellido || ""}`.trim()],
    ["Email",      detail.email],
    ["Teléfono",   detail.telefono || "—"],
    ["CURP",       detail.curp || "—"],
    ["Notas",      detail.notas || "—"],
    ["Verificado", detail.emailVerificado ? "✓ Sí" : "✗ No"],
    ["IP origen",  detail.ipOrigen || "—"],
    ["Registrado", new Date(detail.createdAt).toLocaleString("es-MX")],
  ];

  return (
    <>
      <div onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
          zIndex: 300, backdropFilter: "blur(2px)" }} />
      <div style={{
        position: "fixed",
        top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 301,
        background: "#fff",
        borderRadius: 14,
        width: isMobile ? "95vw" : "min(90vw, 640px)",
        maxHeight: "90vh",
        overflowY: "auto",
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        display: "flex",
        flexDirection: "column",
      }}>
        {/* Header */}
        <div style={{ background: "#1a1a1a", color: "#fff", padding: "1rem 1.25rem",
          borderRadius: "14px 14px 0 0", display: "flex",
          justifyContent: "space-between", alignItems: "center",
          position: "sticky", top: 0, zIndex: 1, flexShrink: 0 }}>
          <div>
            <span style={{ fontSize: "0.8rem", textTransform: "uppercase",
              letterSpacing: ".1em", fontWeight: 600 }}>Detalle del registro</span>
            {!isAdmin && (
              <span style={{
                marginLeft: 10, background: "#f59e0b", color: "#000",
                borderRadius: 4, padding: "2px 8px", fontSize: "0.62rem",
                fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase",
              }}>Vista pública</span>
            )}
          </div>
          <button onClick={onClose}
            style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff",
              borderRadius: "50%", width: 32, height: 32, fontSize: "1rem",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "1.25rem", flex: 1 }}>
          <div style={{ marginBottom: "1.25rem" }}>
            {rows.map(([l, v]) => {
              const fieldKey = l === "Email" ? "email" : l === "Teléfono" ? "telefono"
                : l === "CURP" ? "curp" : l === "IP origen" ? "ipOrigen" : null;
              const isSensitive = fieldKey && sensitiveFields.includes(fieldKey);

              return (
                <div key={l} style={{ padding: "10px 0", borderBottom: "1px solid #f3f4f6" }}>
                  <span style={{ display: "block", fontSize: "0.68rem", textTransform: "uppercase",
                    letterSpacing: ".08em", color: "#aaa", fontWeight: 600, marginBottom: 3 }}>
                    {l}
                  </span>
                  <span style={{ display: "block", fontSize: "0.95rem", fontWeight: 500,
                    color: "#1a1a1a", wordBreak: "break-word",
                    ...(isSensitive && !isAdmin ? { fontFamily: "monospace", letterSpacing: ".05em" } : {})
                  }}>
                    {v}
                    {/* Indicador de dato censurado en vista pública */}
                    {isSensitive && !isAdmin && (
                      <span style={{ marginLeft: 8, fontSize: "0.62rem", color: "#f59e0b",
                        fontFamily: "var(--font-body)", fontWeight: 700,
                        textTransform: "uppercase", letterSpacing: ".06em" }}>
                        censurado
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Documentos — solo admin */}
          {isAdmin && (detail.fotoKey || detail.ineKey) && (
            <div style={{ marginBottom: "1.25rem" }}>
              <p style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: ".08em",
                color: "#888", margin: "0 0 10px" }}>Documentos adjuntos</p>
              <div style={{ display: "grid",
                gridTemplateColumns: detail.fotoKey && detail.ineKey ? "1fr 1fr" : "1fr",
                gap: 12 }}>
                {detail.fotoKey && <ImagenAdmin fileKey={detail.fotoKey} label="Fotografía" />}
                {detail.ineKey  && <ImagenAdmin fileKey={detail.ineKey}  label="INE" />}
              </div>
            </div>
          )}

          {/* Placeholder documentos en vista pública */}
          {!isAdmin && (detail.fotoKey || detail.ineKey) && (
            <div style={{ background: "#fffbeb", border: "1px solid #fde68a",
              borderRadius: 8, padding: "12px 14px", fontSize: "0.82rem", color: "#92400e" }}>
              🔒 Los documentos adjuntos solo son visibles para administradores.
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "1rem 1.25rem",
          borderTop: "1px solid #e5e7eb",
          background: "#fff",
          borderRadius: "0 0 14px 14px",
          position: "sticky", bottom: 0,
          flexShrink: 0,
          gap: 10,
        }}>
          <button onClick={onClose}
            style={{ ...S.btn, padding: isMobile ? "12px 20px" : "9px 18px",
              fontSize: isMobile ? "1rem" : "0.875rem",
              background: "#f3f4f6", color: "#555",
              flex: isMobile ? 1 : "0 0 auto", borderRadius: 9 }}>
            Cerrar
          </button>
          <button onClick={() => copy(detail.id)}
            style={{ ...S.btn, padding: isMobile ? "12px 20px" : "9px 18px",
              fontSize: isMobile ? "1rem" : "0.875rem",
              background: copied ? "#16a34a" : "var(--red)",
              color: "#fff",
              flex: isMobile ? 1 : "0 0 auto",
              borderRadius: 9,
              transition: "background 0.25s ease",
              display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
            {copied ? "¡Copiado!" : "Copiar folio"}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function AdminDashboard({ isAdmin, onLogin, onLogout }) {
  const [showLogin,  setShowLogin]  = useState(false);
  const [tab,        setTab]        = useState("registros");
  const [audit,      setAudit]      = useState([]);
  const [contactos,  setContactos]  = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1 });
  const [loading,    setLoading]    = useState(false);
  const [detail,     setDetail]     = useState(null);
  const [isMobile,   setIsMobile]   = useState(window.innerWidth < 768);
  const [q,          setQ]          = useState("");
  const [verified,   setVerified]   = useState("");
  const [sort,       setSort]       = useState("createdAt");
  const [order,      setOrder]      = useState("desc");
  const [page,       setPage]       = useState(1);
  const searchTimer = useRef(null);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  const fetchContactos = useCallback(async (p = page) => {
    setLoading(true);
    try {
      const params = { q, emailVerificado: verified, sort, order, page: p, limit: 25 };
      // Si es admin pide datos completos (?raw=1), si no, censurados
      const res = isAdmin
        ? await adminApi.getContactosAdmin(params)
        : await adminApi.getContactosPublic(params);
      setContactos(res.data);
      setPagination(res.pagination);
    } catch (e) {
      if (e?.code === "INVALID_TOKEN") onLogout();
    } finally { setLoading(false); }
  }, [q, verified, sort, order, page, isAdmin]);

  // Re-fetch cuando cambia el rol (login/logout)
  useEffect(() => { if (tab === "registros") fetchContactos(1); }, [isAdmin]);
  useEffect(() => { if (tab === "registros") fetchContactos(1); }, [verified, sort, order]);
  useEffect(() => { if (tab === "registros") fetchContactos(page); }, [page]);
  useEffect(() => {
    if (tab === "audit" && isAdmin)
      adminApi.getAudit(100).then(r => setAudit(r.data)).catch(() => {});
  }, [tab, isAdmin]);

  function handleSearch(v) {
    setQ(v);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setPage(1); fetchContactos(1); }, 400);
  }

  function handleLoginSuccess(token) {
    onLogin(token);
    setShowLogin(false);
    // Re-fetch con datos completos
    setDetail(null);
  }

  function handleSort(col) {
    if (sort === col) setOrder(o => o === "asc" ? "desc" : "asc");
    else { setSort(col); setOrder("desc"); }
  }
  function SortIcon({ col }) {
    if (sort !== col) return <span style={{ opacity: 0.3 }}> ⇅</span>;
    return <span style={{ color: "var(--red)" }}> {order === "asc" ? "↑" : "↓"}</span>;
  }

  function exportCSV() {
    if (!contactos.length) return;
    const headers = ["ID","Nombre","Apellido","Email","Teléfono","CURP","Verificado","Fecha"];
    const rows = contactos.map(r =>
      [r.id, r.nombre, r.apellido||"", r.email, r.telefono||"",
       r.curp||"", r.emailVerificado?"Sí":"No",
       new Date(r.createdAt).toLocaleString("es-MX")]
      .map(v => `"${String(v).replace(/"/g,'""')}"`)
      .join(",")
    );
    const csv = "\uFEFF" + [headers.join(","), ...rows].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `registros-hubox-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  }

  // ── Tab Registros ──────────────────────────────────────────────────────────
  function TabRegistros() {
    return (
      <div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: "1rem",
          background: "#fff", padding: "0.75rem", borderRadius: 10,
          border: "1px solid #e5e7eb", alignItems: "center" }}>
          <input placeholder="Buscar nombre, email, CURP…" value={q}
            onChange={e => handleSearch(e.target.value)}
            style={{ ...S.input, minWidth: 180, flex: 1, fontSize: "0.875rem" }} />
          <select value={verified} onChange={e => { setVerified(e.target.value); setPage(1); }}
            style={{ ...S.input, width: "auto", flex: "0 0 auto" }}>
            <option value="">Todos</option>
            <option value="true">Verificados</option>
            <option value="false">No verificados</option>
          </select>
          <div style={{ display: "flex", gap: 6, marginLeft: "auto", flexShrink: 0, alignItems: "center" }}>
            <span style={{ fontSize: "0.8rem", color: "#888" }}>{pagination.total} reg.</span>
            {isAdmin && (
              <button onClick={exportCSV}
                style={{ ...S.btn, background: "#1a1a1a", color: "#fff", padding: "7px 12px" }}>
                ↓ CSV
              </button>
            )}
            <button onClick={() => fetchContactos(page)}
              style={{ ...S.btn, background: "var(--red)", color: "#fff", padding: "7px 12px" }}>
              ↺
            </button>
          </div>
        </div>

        <div style={S.card}>
          <div style={S.cardHead}>
            <span>Contactos registrados</span>
            <span style={{ background: "#333", borderRadius: 12,
              padding: "2px 10px", fontSize: "0.75rem" }}>{pagination.total}</span>
          </div>
          <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 360 }}>
              <thead>
                <tr>
                  <th style={{ ...S.th, cursor: "pointer" }} onClick={() => handleSort("nombre")}>
                    Nombre <SortIcon col="nombre" />
                  </th>
                  {!isMobile && (
                    <th style={{ ...S.th, cursor: "pointer" }} onClick={() => handleSort("email")}>
                      Correo <SortIcon col="email" />
                    </th>
                  )}
                  {!isMobile && <th style={S.th}>Teléfono</th>}
                  <th style={{ ...S.th, cursor: "pointer" }} onClick={() => handleSort("createdAt")}>
                    Fecha <SortIcon col="createdAt" />
                  </th>
                  <th style={S.th}></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={isMobile ? 3 : 5}><Spinner /></td></tr>
                ) : !contactos.length ? (
                  <tr><td colSpan={isMobile ? 3 : 5}
                    style={{ ...S.td, textAlign: "center", color: "#aaa", padding: "2.5rem",
                      fontSize: "0.875rem" }}>Sin resultados</td></tr>
                ) : contactos.map(r => (
                  <tr key={r.id} onClick={() => setDetail(r)}
                    style={{ cursor: "pointer",
                      background: detail?.id === r.id ? "#fef2f2" : undefined,
                      transition: "background 0.15s" }}
                    onMouseEnter={e => { if (detail?.id !== r.id) e.currentTarget.style.background = "#fafafa"; }}
                    onMouseLeave={e => { if (detail?.id !== r.id) e.currentTarget.style.background = ""; }}>
                    <td style={S.td}>
                      <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{r.nombre}</div>
                      <div style={{ fontSize: "0.78rem", color: "#888", marginTop: 1 }}>{r.apellido || ""}</div>
                      {isMobile && (
                        <div style={{ fontSize: "0.78rem", color: "#555", marginTop: 2,
                          fontFamily: isAdmin ? undefined : "monospace" }}>
                          {r.email}
                        </div>
                      )}
                    </td>
                    {!isMobile && (
                      <td style={S.td}>
                        <div style={{ fontSize: "0.875rem",
                          fontFamily: isAdmin ? undefined : "monospace" }}>{r.email}</div>
                        <div style={{ fontSize: "0.75rem",
                          color: r.emailVerificado ? "#16a34a" : "#ef4444", marginTop: 1 }}>
                          {r.emailVerificado ? "✓ verificado" : "✗ no verificado"}
                        </div>
                      </td>
                    )}
                    {!isMobile && (
                      <td style={{ ...S.td, fontVariantNumeric: "tabular-nums", fontSize: "0.875rem",
                        fontFamily: isAdmin ? undefined : "monospace" }}>
                        {r.telefono || "—"}
                      </td>
                    )}
                    <td style={{ ...S.td, color: "#888", fontSize: "0.8rem", whiteSpace: "nowrap" }}>
                      {new Date(r.createdAt).toLocaleDateString("es-MX", {
                        day: "2-digit", month: "short",
                        year: isMobile ? "2-digit" : "numeric"
                      })}
                    </td>
                    <td style={S.td}>
                      <button onClick={e => { e.stopPropagation(); setDetail(r); }}
                        style={{ ...S.btn, background: "#f3f4f6", color: "#555",
                          padding: isMobile ? "8px 14px" : "5px 12px",
                          fontSize: isMobile ? "0.875rem" : "0.78rem" }}>
                        Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination.pages > 1 && (
            <div style={{ padding: "0.75rem 1rem", borderTop: "1px solid #f3f4f6",
              display: "flex", gap: 6, justifyContent: "center",
              flexWrap: "wrap", alignItems: "center", fontSize: "0.8rem", color: "#888" }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                style={{ ...S.btn, padding: "5px 14px", background: "#f3f4f6",
                  color: "#555", opacity: page === 1 ? 0.4 : 1 }}>‹</button>
              <span style={{ padding: "0 8px", fontSize: "0.875rem" }}>
                Pág {page} / {pagination.pages}
              </span>
              <button onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                disabled={page === pagination.pages}
                style={{ ...S.btn, padding: "5px 14px", background: "#f3f4f6",
                  color: "#555", opacity: page === pagination.pages ? 0.4 : 1 }}>›</button>
            </div>
          )}
        </div>

        <DetailModal detail={detail} isAdmin={isAdmin} onClose={() => setDetail(null)} isMobile={isMobile} />
      </div>
    );
  }

  // ── Tab Audit (solo admin) ─────────────────────────────────────────────────
  function TabAudit() {
    if (!isAdmin) return (
      <div style={{ ...S.card, padding: "3rem", textAlign: "center" }}>
        <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>🔒</div>
        <div style={{ fontWeight: 700, fontSize: "1rem", marginBottom: 6 }}>Acceso restringido</div>
        <div style={{ color: "#888", fontSize: "0.875rem", marginBottom: "1.5rem" }}>
          La bitácora de eventos solo es visible para administradores.
        </div>
        <button onClick={() => setShowLogin(true)}
          style={{ ...S.btn, background: "var(--red)", color: "#fff", padding: "10px 24px" }}>
          Iniciar sesión
        </button>
      </div>
    );

    return (
      <div style={S.card}>
        <div style={S.cardHead}>
          <span>Bitácora de eventos</span>
          <span style={{ fontSize: "0.75rem", color: "#aaa" }}>{audit.length} eventos</span>
        </div>
        <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 320 }}>
            <thead>
              <tr>
                <th style={S.th}>Evento</th>
                {!isMobile && <th style={S.th}>Estado</th>}
                <th style={S.th}>Email</th>
                {!isMobile && <th style={S.th}>IP</th>}
                <th style={S.th}>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {!audit.length ? (
                <tr><td colSpan={isMobile ? 3 : 5}><Spinner /></td></tr>
              ) : audit.map(a => (
                <tr key={a.id}>
                  <td style={S.td}><Badge label={a.event} colorMap={EVENT_COLORS} /></td>
                  {!isMobile && (
                    <td style={S.td}>
                      <span style={{ color: a.status==="success"?"#16a34a":a.status==="error"?"#ef4444":"#888",
                        fontSize: "0.875rem" }}>
                        {a.status || "—"}
                      </span>
                    </td>
                  )}
                  <td style={{ ...S.td, color: "#555" }}>{a.email || "—"}</td>
                  {!isMobile && (
                    <td style={{ ...S.td, fontFamily: "monospace", fontSize: "0.78rem", color: "#888" }}>
                      {a.ip || "—"}
                    </td>
                  )}
                  <td style={{ ...S.td, color: "#888", whiteSpace: "nowrap" }}>
                    {new Date(a.createdAt).toLocaleDateString("es-MX", {
                      day: "2-digit", month: "short",
                      ...(!isMobile && { year: "numeric" })
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  const tabs = [
    { key: "registros", label: "Registros" },
    ...(isAdmin ? [{ key: "audit", label: "Bitácora" }] : []),
  ];

  return (
    <div style={S.wrap}>
      {/* Banner público / topbar admin */}
      {isAdmin ?? (
        !isMobile && (
          <div style={S.topbar}>
            <span>HuBOX® · Panel de administración · Solo uso interno</span>
            <span>{new Date().toLocaleDateString("es-MX", { dateStyle: "long" })}</span>
          </div>
        )
      )}

      {/* Navbar */}
      <div style={S.navbar}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <div style={S.brand}>
            Hu<span style={{ color: "var(--red)" }}>BOX</span>
            <sup style={{ fontSize: "0.5em", color: "var(--red)" }}>®</sup>
          </div>
          <div style={{ display: "flex", gap: 2 }}>
            {tabs.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                ...S.btn,
                padding: isMobile ? "7px 12px" : "7px 16px",
                fontSize: isMobile ? "0.8rem" : "0.875rem",
                background: tab === t.key ? "var(--red)" : "transparent",
                color: tab === t.key ? "#fff" : "#555",
              }}>{t.label}</button>
            ))}
          </div>
        </div>

        {/* Botón derecho: Login o Cerrar sesión */}
        {isAdmin ? (
          <button onClick={onLogout}
            style={{ ...S.btn, background: "#f3f4f6", color: "#555",
              padding: isMobile ? "7px 12px" : "7px 16px",
              fontSize: isMobile ? "0.8rem" : "0.875rem" }}>
            {isMobile ? "Salir" : "Cerrar sesión"}
          </button>
        ) : (
          <button onClick={() => setShowLogin(true)}
            style={{ ...S.btn, background: "var(--red)", color: "#fff",
              padding: isMobile ? "7px 14px" : "7px 20px",
              fontSize: isMobile ? "0.8rem" : "0.875rem" }}>
            Iniciar sesión
          </button>
        )}
      </div>

      <div style={S.main}>
        {tab === "registros" && <TabRegistros />}
        {tab === "audit"     && <TabAudit />}
      </div>

      {/* Modal de login */}
      {showLogin && (
        <LoginModal
          onLogin={handleLoginSuccess}
          onClose={() => setShowLogin(false)}
        />
      )}
    </div>
  );
}