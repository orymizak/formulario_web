import { useState } from "react";
import { api } from "./services/api";
import Topbar from "./components/Topbar";
import Navbar from "./components/Navbar";
import StepIndicator from "./components/StepIndicator";
import RecaptchaWidget from "./components/RecaptchaWidget";
import DatosPersonalesStep from "./components/DatosPersonalesStep";
import VerificacionStep from "./components/VerificacionStep";
import SuccessStep from "./components/SuccessStep";
import Modal from "./components/Modal";
import styles from "./App.module.css";
import { useFormGuard } from './hooks/useFormGuard'

// ── Mensajes de error amigables por código de respuesta ─────────────────────
function friendlyError(err) {
  if (err?.code === "DUPLICATE_ENTRY" || err?.status === 409) {
    // Intentar detectar qué campo está duplicado desde el mensaje
    const msg = err?.message || "";
    if (msg.toLowerCase().includes("curp"))
      return {
        field: "CURP",
        text: "Este CURP ya está registrado en el sistema.",
      };
    if (msg.toLowerCase().includes("email"))
      return {
        field: "correo",
        text: "Este correo electrónico ya está registrado.",
      };
    if (
      msg.toLowerCase().includes("telefono") ||
      msg.toLowerCase().includes("teléfono")
    )
      return {
        field: "teléfono",
        text: "Este número de teléfono ya está registrado.",
      };
    return { field: null, text: "Este registro ya existe en el sistema." };
  }
  if (err?.code === "EMAIL_MISMATCH") {
    return {
      field: "correo",
      text: "El correo no coincide con el verificado por OTP. Vuelve al formulario y corrige el correo.",
    };
  }
  if (err?.code === "VALIDATION_ERROR") {
    const detail = err?.errors
      ?.map((e) => `${e.field}: ${e.message}`)
      .join(" · ");
    return {
      field: null,
      text: detail || "Hay campos con errores. Revisa el formulario.",
    };
  }
  return {
    field: null,
    text: err?.message || "Error al guardar el registro. Intenta de nuevo.",
  };
}

export default function App() {
  const [step, setStep] = useState("datos");
  const [formData, setFormData] = useState({});
  const [sessionToken, setToken] = useState("");
  const [registroId, setId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [otpExpires, setOtpExpires] = useState(600);

  // ── Modales ─────────────────────────────────────────────────────────────────
  const [errorModal, setErrorModal] = useState({
    show: false,
    title: "",
    body: "",
    backToForm: false,
  });
  // Modal específico para registro duplicado — permite reenviar el folio
  const [dupModal, setDupModal] = useState({
    show: false,
    field: null, // qué campo está duplicado: 'email'|'telefono'|'curp'
    sending: false,
    sent: false,
    error: "",
  });
  const [riskModal, setRiskModal] = useState(false);
  const [captchaV2Token, setCaptchaV2Token] = useState(null); // token del widget v2
  const [regLockout, setRegLockout] = useState(false);
  const [regCooldown, setRegCooldown] = useState(0);

  // ── Búsqueda por folio ───────────────────────────────────────────────────────
  const [folioSearch, setFolioSearch] = useState("");
  const [folioResult, setFolioResult] = useState(null);
  const [folioError, setFolioError] = useState("");
  const [folioSearching, setFolioSearching] = useState(false);
  const [folioLockout, setFolioLockout] = useState(false);
  const [folioCooldown, setFolioCooldown] = useState(0);
  const [formKey, setFormKey] = useState(0);

  const { needsCaptcha, recordFail, clearFails } = useFormGuard()

  const stepNumber = { datos: 1, verificacion: 2, success: 3 }[step];

  function showError(title, body, backToForm = false) {
    setErrorModal({ show: true, title, body, backToForm });
  }
  function closeErrorModal() {
    const goBack = errorModal.backToForm;
    setErrorModal({ show: false, title: "", body: "", backToForm: false });
    if (goBack) setStep("datos");

    resetForm()
  }

  // ── Paso 1 > 2 ──────────────────────────────────────────────────────────────
  async function handleDatosOk(data) {
  if (regLockout) {
    showError("Debes esperar", `Espera ${regCooldown} segundos antes de intentar de nuevo.`);
    return;
  }

  setFormData(data);

  try {
    const scoreRes = await api.getRiskScore().catch((err) => {
      // si getRiskScore devuelve 429
      if (err?.status === 429) {
        const seconds = err?.retryAfterSeconds || 60;
        startRegCooldown(seconds);
        showError("Demasiadas solicitudes", `Por seguridad, espera ${seconds} segundos antes de continuar.`);
        return null; // señal para abortar
      }
      return { riskLevel: "low", requiresCaptcha: false, blocked: false }; // fail-open solo para errores de red
    });

    if (!scoreRes) return; // abortar si fue 429

    if (scoreRes.blocked) {
      const seconds = scoreRes.retryAfterSeconds || 60;
      startRegCooldown(seconds);
      showError("Acceso temporalmente bloqueado", `Demasiados intentos. Espera ${seconds} segundos.`);
      return;
    }

    if ((needsCaptcha || scoreRes.requiresCaptcha) && !captchaV2Token) {
      setRiskModal(true);
      return;
    }
  } catch { /* fail-open para errores inesperados */ }

  // checkDuplicates — igual que antes
  try {
    const check = await api.checkDuplicates({ email: data.email, telefono: data.telefono, curp: data.curp });
    if (check.exists) {
      resetForm();
      setDupModal({ show: true, field: check.field, email: data.email, telefono: data.telefono, curp: data.curp, sending: false, sent: false, error: "" });
      return;
    }
  } catch (err) {
    if (err?.status === 429) {
      const seconds = err?.retryAfterSeconds || err?.retryAfter || 60;
      startRegCooldown(seconds);
      showError("Demasiadas solicitudes", `Por seguridad, espera ${seconds} segundos antes de continuar.`);
      return;
    }
  }

  await sendOtp(data);
}

  async function sendOtp(data = formData) {
    if (regLockout) return; // Evita peticiones si hay cooldown activo

    try {
      const res = await api.requestOtp(data.email);
      setOtpExpires(res.expiresInSeconds || 600);
      setStep("verificacion");
    } catch (err) {
      // Si el error es por Cooldown (status 429 definido en tu servicio)
      if (err.status === 429 || err.code === "OTP_COOLDOWN") {
        const seconds = err.retryAfter || 60;
        startRegCooldown(seconds);
        showError(
          "Espera un momento",
          `Por seguridad, debes esperar ${seconds} segundos antes de solicitar otro código.`,
        );
      } else {
        showError(
          "Error al enviar código",
          err.message || "No se pudo enviar el código.",
        );
      }
    }
  }

  // Helper para el contador de registro
  function startRegCooldown(seconds) {
    setRegLockout(true);
    setRegCooldown(seconds);
    const timer = setInterval(() => {
      setRegCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setRegLockout(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  // Se llama cuando el usuario completa el widget v2 y confirma en el modal
  function handleRiskAck() {
    clearFails()
    setRiskModal(false);
    sendOtp();
  }

  // función para limpiar
  function resetForm() {
    setFormData({});
    setCaptchaV2Token(null);
    setStep("datos");
    setFormKey((k) => k + 1); // forzar remount
  }

  // Resetear el token cuando expira (el widget lo notifica)
  function handleCaptchaExpire() {
    setCaptchaV2Token(null);
  }

  // ── Paso 2 > backend > 3 ────────────────────────────────────────────────────
  async function handleVerificacionOk(token) {
    setToken(token);
    setSubmitting(true);
    try {
      const apellido = [formData.apellidoP, formData.apellidoM]
        .filter(Boolean)
        .join(" ")
        .trim();
      const payload = {
        nombre: formData.nombre,
        apellido,
        fechaNac: formData.fechaNac,
        genero: formData.genero,
        email: formData.email,
        telefono: formData.telefono,
        ...(formData.fuente ? { fuente: formData.fuente } : {}),
        ...(formData.curp ? { curp: formData.curp } : {}),
        ...(formData.foto ? { foto: formData.foto } : {}),
        ...(formData.ine ? { ine: formData.ine } : {}),
        idempotencyKey: crypto.randomUUID(),
        ...(captchaV2Token ? { captchaAck: "1" } : {}),
      };

      const data = await api.submitRegistro(payload, token, captchaV2Token);
      setId(data.data?.id);
      clearFails()
      setStep("success");
    } catch (err) {
      recordFail()
      const isDuplicate =
        err?.code === "DUPLICATE_ENTRY" || err?.status === 409;
      const isEmailMismatch = err?.code === "EMAIL_MISMATCH";

      if (isDuplicate) {
        setStep("datos");
        setFormData({});
        setCaptchaV2Token(null);

        // Mostrar modal específico con opción de reenviar folio
        setDupModal({
          show: true,
          email: formData.email,
          sending: false,
          sent: false,
          error: "",
        });
      } else {
        const { text } = friendlyError(err);
        showError(
          isEmailMismatch ? "Correo no coincide" : "Error al registrar",
          text,
          true,
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  // ── Búsqueda por folio ───────────────────────────────────────────────────────
  async function handleFolioSearch(e) {
    e.preventDefault();

    // 1. Si está bloqueado o buscando, no hacer nada (función "vacía")
    if (folioLockout || folioSearching || !folioSearch.trim()) return;

    setFolioSearching(true);
    setFolioError("");
    setFolioResult(null);

    try {
      const data = await api.buscarPorFolio(folioSearch.trim());
      setFolioResult(data.data);

      // Opcional: Bloqueo preventivo tras una búsqueda exitosa (1/2 minuto)
      startFolioCooldown(60);
    } catch (err) {
      if (err?.status === 429) {
        // 2. Si el backend dice que excedió el límite, extraer segundos
        const seconds = err.retryAfterSeconds || 60;
        setFolioError(`Demasiados intentos. Reintenta en más tarde.`);
        startFolioCooldown(seconds);
      } else {
        setFolioError(err?.message || "No se encontró ningún registro.");
      }
    } finally {
      setFolioSearching(false);
    }
  }

  // Helper para manejar el contador
  function startFolioCooldown(seconds) {
    setFolioLockout(true);
    setFolioCooldown(seconds);

    const timer = setInterval(() => {
      setFolioCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setFolioLockout(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  // ── Reenvío de folio a duplicado ────────────────────────────────────────────
  async function handleSendFolioReminder() {
    setDupModal((prev) => ({ ...prev, sending: true, error: "" }));
    try {
      await api.sendFolioReminder({
        email: dupModal.email, // desde dupModal, no formData
        telefono: dupModal.telefono,
        curp: dupModal.curp,
      });
      setDupModal((prev) => ({ ...prev, sending: false, sent: true }));

      resetForm()
      setCaptchaV2Token(null);
    } catch (err) {
      const is429 = err?.status === 429;
      const seconds = err?.retryAfterSeconds || 60;
      // si es rate limit, arranca cooldown y muestra mensaje específico
      if (is429) startRegCooldown(seconds);
      setDupModal((prev) => ({
        ...prev,
        sending: false,
        error: is429
          ? `Ya enviamos tu folio recientemente.`
          : "No pudimos procesar la solicitud. Intenta más tarde.",
      }));
    }
  }

  return (
    <div className="d-flex flex-column min-vh-100">
      <div className="sticky-top shadow-sm">
        <Topbar />
        <Navbar />
      </div>

      <main
        className={`flex-grow-1 ${styles.hero}`}
        style={{
          minHeight: "80vh",
          display: "flex",
          alignItems: "flex-start",
          paddingTop: "clamp(2rem, 5vh, 5rem)", // Padding dinámico basado en el viewport
        }}
      >
        {/* Limitar el ancho máximo para que en 2K no se vea infinito */}
        <div className="container py-4" style={{ maxWidth: "1400px" }}>
          <div className="row g-4 g-xl-5 align-items-start justify-content-center ">
            {/* Panel izquierdo: Ajustar tamaños de fuente para 2K y Móvil */}
            <div
              className={`col-12 col-lg-5 col-xl-4 text-center text-lg-start mb-4 mb-lg-0 ${styles.stickyPanel}`}
            >
              <p
                className="small fw-bold text-uppercase mb-2"
                style={{
                  color: "var(--red)",
                  letterSpacing: "0.18em",
                  fontSize: "clamp(0.7rem, 1vw, 0.9rem)",
                }}
              >
                Identidad Digital
              </p>
              <h1
                className={`fw-bold mb-3 ${styles.heroTitle}`}
                style={{
                  color: "#fff",
                  // 1080p: ~3.5rem | 2K: ~4.5rem | Móvil: ~2.5rem
                  fontSize: "clamp(2.2rem, 4vw, 4.5rem)",
                  lineHeight: 1.1,
                }}
              >
                Registro de <span style={{ color: "var(--red)" }}>datos</span>
              </h1>
              <p
                className="mb-4"
                style={{
                  color: "rgba(255,255,255,.65)",
                  fontWeight: 300,
                  fontSize: "clamp(1rem, 1.2vw, 1.25rem)",
                  maxWidth: "500px",
                  margin: "0 auto 0 auto", // Centrado en móvil, reset en desktop vía CSS
                }}
              >
                Completa el formulario para registrar tu identidad de forma
                segura.
              </p>

              {/* Beneficios: Se ocultan en móvil pequeño para evitar scroll infinito */}
              <div className="d-none d-lg-block">
                {[
                  ["bi-shield-check", "Datos cifrados"],
                  ["bi-envelope-check", "Verificación de correo"],
                  ["bi-lock-fill", "Solo tú tienes acceso"],
                  ["bi-eye-slash", "Tu información es privada"],
                  ["bi-shield-shaded", "Protección de identidad"],
                ].map(([icon, text]) => (
                  <div
                    key={icon}
                    className="d-flex  align-items-center justify-content-center justify-content-lg-start gap-2 mb-2"
                  >
                    <i className={`bi ${icon} text-danger`}></i>
                    <span
                      className="small"
                      style={{
                        color: "rgba(255,255,255,.55)",
                        fontSize: "clamp(0.8rem, 0.9vw, 1rem)",
                      }}
                    >
                      {text}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Card del formulario: Ajustar anchos para 2K y 1080p */}
            <div className="col-12 col-lg-7 col-xl-7">
              <div style={{ maxWidth: "850px", margin: "0 auto" }}>
                {/* Banner de cooldown visible mientras regLockout esté activo */}
                {regLockout && step === "datos" && (
                  <div className="alert alert-warning d-flex align-items-center gap-2 mb-3 small">
                    <i className="bi bi-clock-history flex-shrink-0"></i>
                    <span>
                      Por seguridad debes esperar{" "}
                      <strong>{regCooldown} segundos</strong> antes de volver a
                      intentarlo.
                    </span>
                  </div>
                )}

                {step !== "success" && <StepIndicator current={stepNumber} />}

                {submitting ? (
                  <div
                    className="card border-0"
                    style={{
                      borderRadius: "var(--radius)",
                      boxShadow: "0 20px 40px rgba(0,0,0,.4)",
                    }}
                  >
                    <div className="card-body p-5 text-center bg-white">
                      <div
                        className="spinner-border text-danger mb-3"
                        role="status"
                      />
                      <p className="text-muted small mb-0">
                        Guardando tu registro de forma segura…
                      </p>
                    </div>
                  </div>
                ) : (
                  <div
                    className={`card border-0 overflow-hidden ${styles.fadeKeyframe}`}
                    style={{
                      borderRadius: "16px",
                    }}
                  >
                    <div className="card-body p-0 bg-transparent">
                      {step === "datos" && (
                        <DatosPersonalesStep
                          key={formKey}
                          data={formData}
                          onNext={handleDatosOk}
                          onCaptchaVerify={(token) => setCaptchaV2Token(token)}
                          disabled={regLockout}
                        />
                      )}
                      {step === "verificacion" && (
                        <VerificacionStep
                          email={formData.email}
                          expiresIn={otpExpires}
                          onSuccess={handleVerificacionOk}
                          onBack={() => setStep("datos")}
                          onResend={() => sendOtp()}
                        />
                      )}
                      {step === "success" && (
                        <SuccessStep
                          registroId={registroId}
                          email={formData.email}
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ── Sección búsqueda por folio ────────────────────────────────────── */}
      <section className="py-5 bg-light border-top">
        <div className="container" style={{ maxWidth: "min(90%, 800px)" }}>
          <div className="text-center mb-4">
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 300,
                fontSize: "1.6rem",
              }}
            >
              Consultar mi registro
            </h2>
            <p className="text-muted small mb-0">
              Si ya te registraste, ingresa el folio que recibiste para
              consultar tu información.
            </p>
          </div>

          <form onSubmit={handleFolioSearch} className="d-flex gap-2">
            <input
              type="text"
              className="form-control"
              placeholder={
                folioLockout
                  ? `Espera ${folioCooldown}s...`
                  : "Ingresa tu folio"
              }
              value={folioSearch}
              onChange={(e) => {
                setFolioSearch(e.target.value);
                setFolioError("");
              }}
              disabled={folioLockout} // Deshabilita el input
              required
            />
            <button
              type="submit"
              className="btn-hubox flex-shrink-0"
              disabled={folioSearching || folioLockout} // Deshabilita el botón
            >
              {folioSearching ? (
                <span className="spinner-border spinner-border-sm" />
              ) : folioLockout ? (
                <>
                  <i className="bi bi-clock-history me-1"></i>
                  {folioCooldown}s
                </>
              ) : (
                <>
                  <i className="bi bi-search me-1"></i>Buscar
                </>
              )}
            </button>
          </form>

          {folioError && (
            <div className="alert alert-warning mt-3 small d-flex gap-2 align-items-center">
              <i className="bi bi-exclamation-triangle-fill flex-shrink-0"></i>
              {folioError}
            </div>
          )}

          {folioResult && (
            <div
              className="card border-0 mt-3 overflow-hidden"
              style={{
                borderRadius: "var(--radius)",
                boxShadow: "var(--shadow-card)",
              }}
            >
              <div
                className="card-header bg-white py-3 px-4 d-flex align-items-center gap-2"
                style={{ borderBottom: "1px solid var(--gray-200)" }}
              >
                <i className="bi bi-person-check-fill text-danger"></i>
                <span
                  className="fw-semibold small text-uppercase"
                  style={{ letterSpacing: "0.08em" }}
                >
                  Información de registro
                </span>
              </div>
              <div className="card-body p-4">
                {[
                  [
                    "Nombre",
                    `${folioResult.nombre} ${folioResult.apellido || ""}`.trim(),
                  ],
                  ["Correo", folioResult.email],
                  ["Teléfono", folioResult.telefono],
                  [
                    "Registrado",
                    folioResult.createdAt
                      ? new Date(folioResult.createdAt).toLocaleDateString(
                          "es-MX",
                          { dateStyle: "long" },
                        )
                      : null,
                  ],
                ]
                  .filter(([, v]) => v)
                  .map(([label, value]) => (
                    <div
                      key={label}
                      className="d-flex gap-3 py-2"
                      style={{ borderBottom: "1px solid var(--gray-200)" }}
                    >
                      <span
                        className="text-muted small"
                        style={{ minWidth: 110 }}
                      >
                        {label}
                      </span>
                      <span className="small fw-semibold text-dark">
                        {value}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <footer role="contentinfo" className="mt-auto">
        <div
          className="text-center py-2 text-white"
          style={{ backgroundColor: "#f53c3e" }}
        >
          <div className="container">
            <a
              href="https://hubox.com/aviso_privacidad.html"
              className="text-white text-decoration-none mx-2 fw-semibold"
            >
              Aviso de Privacidad
            </a>
            <span className=""> | </span>
            <a
              href="https://hubox.com/nosotros.html#politicas"
              className="text-white text-decoration-none mx-2 fw-semibold"
            >
              Políticas de Gestión
            </a>
            <span className=""> | </span>
            <a
              href="https://hubox.com/transparencia.html"
              className="text-white text-decoration-none mx-2 fw-semibold"
            >
              Transparencia
            </a>
          </div>
        </div>
        <div
          className="text-center text-white-50 py-3"
          style={{ backgroundColor: "#3a3333" }}
        >
          <p className="mb-0 small fw-semibold">© Copyright 2025. HuBOX</p>
        </div>
      </footer>

      {/* ── Modal de error / duplicado ────────────────────────────────────── */}
      <Modal
        show={errorModal.show}
        title={errorModal.title}
        onClose={closeErrorModal}
        footer={
          <div className="d-flex gap-2 justify-content-end w-100">
            <button
              className="btn btn-outline-secondary btn-sm"
              onClick={closeErrorModal}
            >
              Cerrar
            </button>
          </div>
        }
      >
        <div className="d-flex gap-3 align-items-start">
          <i className="bi bi-exclamation-circle-fill text-danger flex-shrink-0 fs-5 mt-1"></i>
          <p className="mb-0 small">{errorModal.body}</p>
        </div>
      </Modal>

      {/* ── Modal de riesgo / reCAPTCHA v2 ──────────────────────────────── */}
      <Modal
        show={riskModal}
        title="Verificación de seguridad"
        onClose={() => setRiskModal(false)}
        footer={
          <div className="d-flex gap-2 justify-content-end w-100">
            <button
              className="btn btn-outline-secondary btn-sm"
              onClick={() => setRiskModal(false)}
            >
              Cancelar
            </button>
            <button
              className="btn-hubox btn-sm"
              onClick={handleRiskAck}
              disabled={!captchaV2Token}
              title={!captchaV2Token ? "Completa el CAPTCHA primero" : ""}
            >
              <i className="bi bi-shield-check me-1"></i> Confirmar y continuar
            </button>
          </div>
        }
      >
        <div>
          <div className="d-flex gap-3 align-items-start mb-3">
            <i className="bi bi-shield-exclamation text-warning flex-shrink-0 fs-5 mt-1"></i>
            <div>
              <p className="mb-1 fw-semibold small">
                Se detectó actividad inusual desde tu dispositivo
              </p>
              <p className="mb-0 small text-muted">
                Completa la verificación para continuar con el registro.
              </p>
            </div>
          </div>
          <RecaptchaWidget
            onVerify={(token) => setCaptchaV2Token(token)}
            onExpire={handleCaptchaExpire}
          />
          {!captchaV2Token && (
            <p className="text-center text-muted small mb-0">
              Marca la casilla "No soy un robot" para continuar.
            </p>
          )}
        </div>
      </Modal>

      {/* ── Modal de registro duplicado ─────────────────────────────────── */}
      {/* ── Modal de registro duplicado (VERSIÓN SEGURA) ── */}
      <Modal
        show={dupModal.show}
        title="Registro existente"
        onClose={() => {
          setDupModal((p) => ({ ...p, show: false }));
          resetForm()
        }}
        footer={
          <div className="d-flex gap-2 justify-content-end w-100">
            {!dupModal.sent && (
              <button
                className="btn-hubox btn-sm"
                onClick={handleSendFolioReminder}
                disabled={dupModal.sending || regLockout}
                title={regLockout ? `Disponible en ${regCooldown}s` : ""}
              >
                {dupModal.sending ? (
                  <span className="spinner-border spinner-border-sm me-1" />
                ) : regLockout ? (
                  <i className="bi bi-clock-history me-1"></i>
                ) : (
                  <i className="bi bi-envelope me-1"></i>
                )}
                {regLockout ? `Espera... ${regCooldown}s` : "Enviar folio"}
              </button>
            )}
            <button
              className="btn btn-outline-secondary btn-sm"
              onClick={() => {
                setDupModal((p) => ({ ...p, show: false }));
                resetForm()
              }}
            >
              Cerrar
            </button>
          </div>
        }
      >
        <div className="d-flex flex-column gap-3">
          <div className="d-flex gap-3 align-items-start">
            <i className="bi bi-info-circle-fill text-primary flex-shrink-0 fs-5 mt-1"></i>
            <div>
              <p className="mb-1 small fw-semibold text-dark">
                Hemos detectado que ya cuentas con un registro previo.
              </p>
              <p className="mb-0 small text-muted">
                Si eres el titular y deseas recuperar tu información, haz clic
                en el botón de abajo.
              </p>
            </div>
          </div>

          {dupModal.error && (
            <div className="alert alert-warning d-flex gap-2 align-items-center small mb-0 py-2 border-0 shadow-sm">
              <i className="bi bi-exclamation-triangle-fill flex-shrink-0 text-warning"></i>
              <span>{dupModal.error}. Podrás reenviar el folio en {regCooldown}s</span>
            </div>
          )}

          {dupModal.sent && (
            <div className="alert alert-success d-flex gap-2 align-items-center small mb-0 py-2 border-0 shadow-sm">
              <i className="bi bi-check-circle-fill text-success"></i>
              <span>Se ha enviado tu folio al correo original.</span>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
