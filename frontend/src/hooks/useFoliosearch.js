import { useState, useCallback } from "react";
import { api } from "../services/api";
import { useCountdown } from "./useCountdown";

/**
 * useFolioSearch — encapsula búsqueda por folio y generación de comprobante.
 */
export function useFolioSearch() {
  const [folioSearch,    setFolioSearch]    = useState("");
  const [folioResult,    setFolioResult]    = useState(null);
  const [folioError,     setFolioError]     = useState("");
  const [folioSearching, setFolioSearching] = useState(false);

  const countdown   = useCountdown();
  const lockout     = countdown.active;
  const cooldown    = countdown.seconds;

  const handleSearch = useCallback(async (e) => {
    e?.preventDefault();
    if (lockout || folioSearching || !folioSearch.trim()) return;

    setFolioSearching(true);
    setFolioError("");
    setFolioResult(null);

    try {
      const data = await api.buscarPorFolio(folioSearch.trim());
      setFolioResult(data.data);
      countdown.start(60);
    } catch (err) {
      if (err?.status === 429) {
        setFolioError("Demasiados intentos. Reintenta más tarde.");
        countdown.start(err.retryAfterSeconds || 60);
      } else {
        setFolioError(err?.message || "No se encontró ningún registro.");
      }
    } finally {
      setFolioSearching(false);
    }
  }, [lockout, folioSearching, folioSearch, countdown]);

  const clearSearch = useCallback(() => {
    setFolioSearch("");
    setFolioResult(null);
    setFolioError("");
  }, []);

  const downloadComprobante = useCallback(() => {
    if (!folioResult) return;
    const fecha  = folioResult.createdAt
      ? new Date(folioResult.createdAt).toLocaleDateString("es-MX", { dateStyle: "long" })
      : "—";
    const nombre = `${folioResult.nombre} ${folioResult.apellido || ""}`.trim();

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Comprobante de Registro — HuBOX</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Inter',Arial,sans-serif;background:#f5f5f5;display:flex;justify-content:center;padding:2rem}
    .card{background:#fff;border-radius:12px;max-width:480px;width:100%;box-shadow:0 4px 20px rgba(0,0,0,.12);overflow:hidden}
    .header{background:#f53c3e;padding:1.5rem;text-align:center}
    .header-logo{color:#fff;font-size:1.6rem;font-weight:800;letter-spacing:2px}
    .header-sub{color:rgba(255,255,255,.75);font-size:.75rem;margin-top:4px}
    .badge{display:inline-flex;align-items:center;gap:6px;background:#fff;color:#f53c3e;padding:4px 12px;border-radius:20px;font-size:.7rem;font-weight:700;margin-top:10px}
    .body{padding:1.5rem}
    .title{font-size:.65rem;text-transform:uppercase;letter-spacing:.12em;color:#888;margin-bottom:1rem}
    .folio-box{background:#fff8e1;border:1px solid #ffe082;border-radius:8px;padding:1rem;margin-bottom:1.25rem;text-align:center}
    .folio-label{font-size:.6rem;text-transform:uppercase;letter-spacing:.1em;color:#888;margin-bottom:6px}
    .folio-value{font-family:monospace;font-size:.78rem;font-weight:700;color:#1a1a1a;word-break:break-all}
    .row{display:flex;padding:8px 0;border-bottom:1px solid #f3f4f6}
    .row:last-child{border-bottom:none}
    .label{min-width:110px;font-size:.7rem;color:#888}
    .value{font-size:.82rem;font-weight:600;color:#222}
    .footer{background:#fafafa;border-top:1px solid #f0f0f0;padding:1rem 1.5rem;text-align:center}
    .footer p{font-size:.65rem;color:#aaa}
    .stamp{display:inline-flex;align-items:center;gap:6px;background:#dcfce7;color:#16a34a;padding:3px 10px;border-radius:20px;font-size:.65rem;font-weight:700;margin-top:8px}
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="header-logo">HuBOX®</div>
      <div class="header-sub">Comprobante de Registro de Identidad Digital</div>
      <div class="badge">✓ Registro verificado</div>
    </div>
    <div class="body">
      <p class="title">Datos del registro</p>
      <div class="folio-box">
        <p class="folio-label">Número de folio</p>
        <p class="folio-value">${folioResult.id}</p>
      </div>
      <div class="row"><span class="label">Nombre</span><span class="value">${nombre}</span></div>
      <div class="row"><span class="label">Correo</span><span class="value">${folioResult.email || "—"}</span></div>
      <div class="row"><span class="label">Teléfono</span><span class="value">${folioResult.telefono || "—"}</span></div>
      <div class="row"><span class="label">Registrado el</span><span class="value">${fecha}</span></div>
    </div>
    <div class="footer">
      <div class="stamp">✓ Email verificado</div>
      <p style="margin-top:8px">Este comprobante acredita el registro en el sistema HuBOX®.<br>Guárdalo como respaldo de tu información.</p>
      <p style="margin-top:6px">© ${new Date().getFullYear()} HuBOX® · Disrupción Digital · hubox.com</p>
    </div>
  </div>
</body>
</html>`;

    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
    a.download = `comprobante-hubox-${folioResult.id.slice(0, 8)}.html`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [folioResult]);

  return {
    folioSearch, setFolioSearch,
    folioResult, folioError, folioSearching,
    lockout, cooldown,
    handleSearch, clearSearch, downloadComprobante,
  };
}