/**
 * Paso 1 — Todos los datos del usuario en un solo formulario.
 * Incluye: datos personales, contacto e identificación (CURP + archivos).
 * Al enviar, llama onNext(formData) para pasar al paso de verificación.
 */
import { useState, useRef, useCallback } from "react";
import { api } from "../services/api";
import CardHeader from "./CardHeader";
import Alert from "./Alert";
import RecaptchaWidget from "./RecaptchaWidget";

/* ── Constantes ─────────────────────────────────────────── */
const GENEROS = ["Masculino", "Femenino", "No binario", "Prefiero no decir"];
const NOMBRE_RE = /^[a-záéíóúüñA-ZÁÉÍÓÚÜÑ\s'-]{2,60}$/;
const CURP_REGEX =
  /^[A-Z]{1}[AEIOU]{1}[A-Z]{2}\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])[HM]{1}(AS|BC|BS|CC|CL|CM|CS|CH|DF|DG|GT|GR|HG|JC|MC|MN|MS|NT|NL|OC|PL|QT|QR|SP|SL|SR|TC|TS|TL|VZ|YN|ZS|NE)[B-DF-HJ-NP-TV-Z]{3}[0-9A-Z]{1}\d{1}$/i;
const MAX_FOTO = 5; // MB
const MAX_INE = 10; // MB
const FOTO_TIPOS = ["image/jpeg", "image/png", "image/webp"];
const INE_TIPOS = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

/* ── Helpers ────────────────────────────────────────────── */
function calcEdad(f) {
  if (!f) return null;
  const hoy = new Date(),
    nac = new Date(f);
  let e = hoy.getFullYear() - nac.getFullYear();
  const m = hoy.getMonth() - nac.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) e--;
  return e;
}

const formatPhoneNumber = (value) => {
  if (!value) return value;
  // Limpia el valor de cualquier carácter que no sea número
  const phoneNumber = value.replace(/[^\d]/g, "");
  const len = phoneNumber.length;

  // Formato: (123) 456 - 7890
  if (len < 4) return phoneNumber;
  if (len < 7) return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
  return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)} - ${phoneNumber.slice(6, 10)}`;
};

function humanSize(b) {
  return b < 1048576
    ? `${(b / 1024).toFixed(0)} KB`
    : `${(b / 1048576).toFixed(1)} MB`;
}

/* ── Sub-componente: zona drag & drop ───────────────────── */
function FileZone({
  label,
  hint,
  tipos,
  maxMB,
  value,
  error,
  preview,
  onChange,
}) {
  const ref = useRef();
  const [over, setOver] = useState(false);

  function handle(file) {
    if (!file) return;
    if (!tipos.includes(file.type))
      return onChange(
        null,
        `Tipo no permitido. Acepta: ${tipos.map((t) => t.split("/")[1].toUpperCase()).join(", ")}`,
      );
    if (file.size > maxMB * 1048576)
      return onChange(null, `El archivo supera ${maxMB} MB`);
    onChange(file, null);
  }

  const border = error
    ? "border-danger"
    : over
      ? "border-danger"
      : "border-secondary";

  return (
    <div>
      <label
        className="form-label fw-semibold small text-uppercase"
        style={{ letterSpacing: "0.08em" }}
      >
        {label} <span className="text-danger">*</span>
      </label>
      <div
        className={`border rounded p-3 text-center ${border}`}
        style={{
          borderStyle: "dashed",
          cursor: "pointer",
          background: over ? "var(--red-dim)" : "var(--gray-100)",
          transition: "all .15s",
        }}
        onClick={() => ref.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          handle(e.dataTransfer.files[0]);
        }}
      >
        {value ? (
          <div className="d-flex align-items-center justify-content-center gap-3 flex-wrap">
            {preview && value.type?.startsWith("image/") && (
              <img
                src={URL.createObjectURL(value)}
                alt="preview"
                className="rounded"
                style={{ width: 56, height: 56, objectFit: "cover" }}
              />
            )}
            <div className="text-start">
              <div className="small fw-semibold text-dark">{value.name}</div>
              <div className="small text-muted">{humanSize(value.size)}</div>
              <button
                type="button"
                className="btn btn-link btn-sm text-danger p-0 mt-1"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(null, null);
                }}
              >
                <i className="bi bi-trash me-1" />
                Quitar
              </button>
            </div>
          </div>
        ) : (
          <div className="text-muted small py-1">
            <i className="bi bi-cloud-upload fs-4 d-block mb-1 text-secondary" />
            Arrastra aquí o{" "}
            <span className="text-danger fw-semibold">
              haz clic para seleccionar
            </span>
            <div className="mt-1" style={{ fontSize: "0.7rem" }}>
              {hint}
            </div>
          </div>
        )}
        <input
          ref={ref}
          type="file"
          className="d-none"
          accept={tipos.join(",")}
          onChange={(e) => handle(e.target.files[0])}
        />
      </div>
      {error && (
        <div className="text-danger small mt-1">
          <i className="bi bi-exclamation-circle me-1" />
          {error}
        </div>
      )}
    </div>
  );
}

/* ── Separador de sección ───────────────────────────────── */
function SectionLabel({ icon, text }) {
  return (
    <div className="col-12 mt-2">
      <p
        className="small fw-bold text-uppercase mb-0"
        style={{ color: "var(--red)", letterSpacing: "0.12em" }}
      >
        <i className={`bi ${icon} me-2`} />
        {text}
      </p>
      <hr className="mt-1 mb-0" style={{ borderColor: "var(--gray-200)" }} />
    </div>
  );
}

/* ── Componente principal ───────────────────────────────── */
export default function DatosPersonalesStep({
  data,
  onNext,
  onRecordFail,
  loading = false,
  onCaptchaVerify,
  regLockout,
  regCooldown,
}) {
  const [form, setForm] = useState({
    nombre: data.nombre || "",
    apellidoP: data.apellidoP || "",
    apellidoM: data.apellidoM || "",
    fechaNac: data.fechaNac || "",
    genero: data.genero || "",
    email: data.email || "",
    telefono: data.telefono || "",
    curp: data.curp || "",
  });
  const [foto, setFoto] = useState(data.foto || null);
  const [ine, setIne] = useState(data.ine || null);
  const [fotoErr, setFotoErr] = useState("");
  const [ineErr, setIneErr] = useState("");
  const [errors, setErrors] = useState({});
  const [alert, setAlert] = useState("");
  const [captchaToken, setCaptchaToken] = useState(null);

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setErrors((ev) => ({ ...ev, [key]: "" }));
  };

  function validateCurp(v) {
    if (!v.trim()) return "CURP requerida";
    if (v.trim().length !== 18) return "La CURP debe tener 18 caracteres";
    if (!CURP_REGEX.test(v.trim())) return "Formato de CURP inválido";
    return null;
  }

  function validate() {
    const e = {};
    if (!NOMBRE_RE.test(form.nombre.trim()))
      e.nombre = "Solo letras, mínimo 2 caracteres";
    if (!NOMBRE_RE.test(form.apellidoP.trim()))
      e.apellidoP = "Requerido, solo letras";
    if (form.apellidoM && !NOMBRE_RE.test(form.apellidoM.trim()))
      e.apellidoM = "Solo letras válidas";
    if (!form.fechaNac) e.fechaNac = "Requerida";
    else {
      const edad = calcEdad(form.fechaNac);
      if (edad < 18) e.fechaNac = "Debes ser mayor de 18 años";
      if (edad > 110) e.fechaNac = "Fecha no válida";
    }
    if (!form.genero) e.genero = "Selecciona una opción";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      e.email = "Correo inválido";
    if (form.telefono.trim().length !== 10) {
      e.telefono = "El teléfono debe tener 10 dígitos";
    }
    const ce = validateCurp(form.curp);
    if (ce) e.curp = ce;
    if (!foto) (setFotoErr("Fotografía requerida"), (e._foto = true));
    if (!ine) (setIneErr("Documento INE requerido"), (e._ine = true));
    return e;
  }

  function handleNext(ev) {
    ev.preventDefault();
    setAlert("");
    setFotoErr(foto ? "" : fotoErr);
    setIneErr(ine ? "" : ineErr);
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      onRecordFail?.();
      setAlert("Revisa los campos marcados antes de continuar.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (!captchaToken) {
      setAlert(
        'Completa la verificación "No soy un robot" antes de continuar.',
      );
      window.scrollTo({ top: 99999, behavior: "smooth" });
      return;
    }
    onNext({
      ...form,
      email: form.email.trim(),
      curp: form.curp.trim().toUpperCase(),
      foto,
      ine,
    });
  }

  const hoy = new Date().toISOString().split("T")[0];

  const handleTelefonoChange = (e) => {
    const input = e.target.value;
    // Formatear para la vista del usuario
    const formatted = formatPhoneNumber(input);
    // Extraer solo números para el estado (máximo 10 dígitos)
    const raw = input.replace(/[^\d]/g, "").slice(0, 10);

    setForm((f) => ({ ...f, telefono: raw }));
    setErrors((ev) => ({ ...ev, telefono: "" }));
  };

  return (
    <div style={{ animation: "fadeUp 0.3s ease both" }}>
      <CardHeader
        title="Formulario"
        subtitle="Llena la siguiente información para continuar"
      />
      <div className="p-4">
        <Alert message={alert} />
        <form onSubmit={handleNext} noValidate>
          <div className="row g-3">
            {/* ── DATOS PERSONALES ── */}
            <SectionLabel icon="bi-person-fill" text="Datos personales" />

            <div className="col-12">
              <label
                className="form-label fw-semibold small text-uppercase"
                style={{ letterSpacing: "0.08em" }}
              >
                Nombre(s) <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                placeholder="Ej. María Elena"
                className={`form-control ${errors.nombre ? "is-invalid" : ""}`}
                value={form.nombre}
                onChange={set("nombre")}
                autoComplete="given-name"
              />
              {errors.nombre && (
                <div className="invalid-feedback">{errors.nombre}</div>
              )}
            </div>

            <div className="col-md-6">
              <label
                className="form-label fw-semibold small text-uppercase"
                style={{ letterSpacing: "0.08em" }}
              >
                Apellido paterno <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                placeholder="Ej. García"
                className={`form-control ${errors.apellidoP ? "is-invalid" : ""}`}
                value={form.apellidoP}
                onChange={set("apellidoP")}
                autoComplete="family-name"
              />
              {errors.apellidoP && (
                <div className="invalid-feedback">{errors.apellidoP}</div>
              )}
            </div>

            <div className="col-md-6">
              <label
                className="form-label fw-semibold small text-uppercase"
                style={{ letterSpacing: "0.08em" }}
              >
                Apellido materno
              </label>
              <input
                type="text"
                placeholder="Ej. López"
                className={`form-control ${errors.apellidoM ? "is-invalid" : ""}`}
                value={form.apellidoM}
                onChange={set("apellidoM")}
                autoComplete="additional-name"
              />
              {errors.apellidoM && (
                <div className="invalid-feedback">{errors.apellidoM}</div>
              )}
            </div>

            <div className="col-md-6">
              <label
                className="form-label fw-semibold small text-uppercase"
                style={{ letterSpacing: "0.08em" }}
              >
                Fecha de nacimiento <span className="text-danger">*</span>
              </label>
              <input
                type="date"
                className={`form-control ${errors.fechaNac ? "is-invalid" : ""}`}
                value={form.fechaNac}
                onChange={set("fechaNac")}
                min="1910-01-01"
                max={hoy}
              />
              {errors.fechaNac ? (
                <div className="invalid-feedback">{errors.fechaNac}</div>
              ) : (
                form.fechaNac && (
                  <div className="form-text">
                    {calcEdad(form.fechaNac)} años
                  </div>
                )
              )}
            </div>

            <div className="col-md-6">
              <label
                className="form-label fw-semibold small text-uppercase"
                style={{ letterSpacing: "0.08em" }}
              >
                Género <span className="text-danger">*</span>
              </label>
              <select
                className={`form-select ${errors.genero ? "is-invalid" : ""}`}
                value={form.genero}
                onChange={set("genero")}
              >
                <option value="">— Seleccionar —</option>
                {GENEROS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
              {errors.genero && (
                <div className="invalid-feedback">{errors.genero}</div>
              )}
            </div>

            {/* ── CONTACTO ── */}
            <SectionLabel icon="bi-envelope-fill" text="Contacto" />

            <div className="col-md-6">
              <label
                className="form-label fw-semibold small text-uppercase"
                style={{ letterSpacing: "0.08em" }}
              >
                Correo electrónico <span className="text-danger">*</span>
              </label>
              <div className="input-group">
                <span className="input-group-text">
                  <i className="bi bi-envelope" />
                </span>
                <input
                  type="email"
                  placeholder="correo@ejemplo.com"
                  className={`form-control ${errors.email ? "is-invalid" : ""}`}
                  value={form.email}
                  onChange={set("email")}
                  autoComplete="email"
                />
                {errors.email && (
                  <div className="invalid-feedback">{errors.email}</div>
                )}
              </div>
              <div className="form-text">
                <i className="bi bi-info-circle me-1" />
                Recibirás un código de verificación en este correo
              </div>
            </div>

            <div className="col-md-6">
              <label
                className="form-label fw-semibold small text-uppercase"
                style={{ letterSpacing: "0.08em" }}
              >
                Teléfono <span className="text-danger">*</span>
              </label>
              <div className="input-group">
                <span className="input-group-text">
                  <i className="bi bi-phone" />
                </span>
                <input
                  type="tel"
                  placeholder="(668) 000 - 0000"
                  className={`form-control ${errors.telefono ? "is-invalid" : ""}`}
                  value={formatPhoneNumber(form.telefono)}
                  onChange={handleTelefonoChange}
                  maxLength={16}
                  autoComplete="tel"
                />
                {errors.telefono && (
                  <div className="invalid-feedback">{errors.telefono}</div>
                )}
              </div>
            </div>

            {/* ── IDENTIFICACIÓN ── */}
            <div className="col-12">
              <label
                className="form-label fw-semibold small text-uppercase"
                style={{ letterSpacing: "0.08em" }}
              >
                CURP <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                placeholder="GARJ850101HMCRCN09"
                maxLength={18}
                className={`form-control text-uppercase ${
                  errors.curp
                    ? "is-invalid"
                    : form.curp.length === 18
                      ? "is-valid"
                      : ""
                }`}
                value={form.curp}
                onChange={(e) => {
                  const v = e.target.value.toUpperCase();
                  setForm((f) => ({ ...f, curp: v }));
                  setErrors((er) => ({ ...er, curp: "" }));
                }}
              />
            </div>

            <div className="col-md-6">
              <FileZone
                label="Fotografía reciente"
                preview
                hint={`JPG, PNG o WEBP · Máx ${MAX_FOTO} MB`}
                tipos={FOTO_TIPOS}
                maxMB={MAX_FOTO}
                value={foto}
                error={fotoErr}
                onChange={(f, err) => {
                  setFoto(f);
                  setFotoErr(err || "");
                }}
              />
            </div>

            <div className="col-md-6">
              <FileZone
                label="INE (frente y vuelta)"
                preview={false}
                hint={`JPG, PNG, WEBP o PDF · Máx ${MAX_INE} MB`}
                tipos={INE_TIPOS}
                maxMB={MAX_INE}
                value={ine}
                error={ineErr}
                onChange={(f, err) => {
                  setIne(f);
                  setIneErr(err || "");
                }}
              />
            </div>

            <div className="col-12">
              <div className="alert alert-light border small d-flex gap-2 align-items-start mb-0">
                <i className="bi bi-shield-lock-fill text-success mt-1 flex-shrink-0" />
                <span>
                  Tus archivos se transmiten cifrados y se almacenan en
                  servidores seguros.
                </span>
              </div>
            </div>

            {/* ── reCAPTCHA ── */}
            <div className="col-12">
              <div
                className="border rounded p-3"
                style={{ background: "var(--gray-100)" }}
              >
                <RecaptchaWidget
                  onVerify={(token) => {
                    setCaptchaToken(token);
                    onCaptchaVerify?.(token);
                  }}
                  onExpire={() => {
                    setCaptchaToken(null);
                    onCaptchaVerify?.(null);
                  }}
                />
                {!captchaToken && (
                  <p className="text-center text-muted small mb-0 mt-1">
                    Marca la casilla para continuar
                  </p>
                )}
                {captchaToken && (
                  <p
                    className="text-center small mb-0 mt-1"
                    style={{ color: "var(--green, #198754)" }}
                  >
                    <i className="bi bi-check-circle-fill me-1" />
                    Verificación completada
                  </p>
                )}
              </div>
            </div>
          </div>

          <div
            className="d-flex justify-content-between align-items-center mt-4 pt-3"
            style={{ borderTop: "1px solid var(--gray-200)" }}
          >
            <span className="small text-muted">
              <span className="text-danger">*</span> Campos obligatorios
            </span>

            <button
              type="submit"
              className="btn-hubox d-flex align-items-center gap-2"
              // Se deshabilita por: carga, falta de captcha O bloqueo de cooldown
              disabled={!captchaToken || loading || regLockout}
            >
              {loading ? (
                <>
                  <span
                    className="spinner-border spinner-border-sm"
                    role="status"
                    aria-hidden="true"
                  ></span>
                  Procesando...
                </>
              ) : regLockout ? (
                <>
                  <i className="bi bi-clock-history"></i>
                  Espera {regCooldown}s
                </>
              ) : (
                <>
                  Continuar <i className="bi bi-arrow-right"></i>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
