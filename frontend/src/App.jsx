import { useState, useCallback } from "react";
import { api } from "./services/api";
import Topbar from "./components/Topbar";
import Navbar from "./components/Navbar";
import StepIndicator from "./components/StepIndicator";
import DatosPersonalesStep from "./components/DatosPersonalesStep";
import VerificacionStep from "./components/VerificacionStep";
import SuccessStep from "./components/SuccessStep";
import styles from "./App.module.css";

import { useRegistro } from "./hooks/useRegistro";
import HeroPanel from "./features/registro/HeroPanel";
import VistaToggle from "./features/registro/VistaToggle";
import VistaConsulta from "./features/consulta/VistaConsulta";
import { ErrorModal, RiskModal, DupModal } from "./features/modales/AppModales";

export default function App() {
  const [vista, setVista] = useState("registro");

  // ── Estado de modales ────────────────────────────────────────────────────
  const [errorModal, setErrorModal] = useState({ show: false, title: "", body: "" });
  const [riskModal,  setRiskModal]  = useState(false);
  const [dupModal,   setDupModal]   = useState({
    show: false, email: "", telefono: "", curp: "",
    sending: false, sent: false, error: "",
  });

  // ── Callbacks que el hook necesita para comunicarse con modales ──────────
  const handleError = useCallback((title, body) => {
    setErrorModal({ show: true, title, body });
  }, []);

  const handleDuplicate = useCallback((data) => {
    setDupModal({ show: true, sending: false, sent: false, error: "", ...data });
  }, []);

  // ── Hook de registro — toda la lógica del flujo ──────────────────────────
  const registro = useRegistro({
    onError:        handleError,
    onDuplicate:    handleDuplicate,
    onRiskDetected: () => setRiskModal(true),
  });

  // ── Reenvío de folio ─────────────────────────────────────────────────────
  async function handleSendFolioReminder() {
    setDupModal((p) => ({ ...p, sending: true, error: "" }));
    try {
      await api.sendFolioReminder({
        email: dupModal.email, telefono: dupModal.telefono, curp: dupModal.curp,
      });
      setDupModal((p) => ({ ...p, sending: false, sent: true }));
      registro.resetForm();
    } catch (err) {
      const is429 = err?.status === 429;
      if (is429) registro.lockout || registro.cooldown; // el countdown ya está en el hook
      setDupModal((p) => ({
        ...p, sending: false,
        error: is429 ? "Ya enviamos tu folio recientemente." : "No pudimos procesar la solicitud. Intenta más tarde.",
      }));
    }
  }

  function closeDupModal() {
    setDupModal((p) => ({ ...p, show: false }));
    registro.resetForm();
  }

  function closeErrorModal() {
    setErrorModal({ show: false, title: "", body: "" });
    registro.resetForm();
  }

  return (
    <div className="d-flex flex-column min-vh-100">
      <div className="sticky-top shadow-sm">
        <Topbar />
        <Navbar />
      </div>

      <main className={`flex-grow-1 ${styles.hero}`}
        style={{ minHeight: "80vh", display: "flex", flexDirection: "column", paddingTop: "clamp(2rem, 5vh, 5rem)" }}>
        <div className="container py-4 px-4 px-md-5" style={{ maxWidth: "1400px", flex: 1 }}>
          <div className="row g-4 g-xl-5 align-items-start justify-content-center" style={{ minHeight: "100%" }}>

            <HeroPanel />

            <div className="col-12 col-lg-7 col-xl-7 hero-enter-right delay-2">
              <div style={{ maxWidth: "850px", margin: "0 auto" }}>

                <VistaToggle
                  vista={vista}
                  disabled={registro.step === "verificacion"}
                  onChange={setVista}
                />

                {vista === "registro" && (
                  <>
                    {registro.lockout && registro.step === "datos" && (
                      <div className="alert alert-warning d-flex align-items-center gap-2 mb-3 small">
                        <i className="bi bi-clock-history flex-shrink-0"></i>
                        <span>Por seguridad debes esperar <strong>{registro.cooldown} segundos</strong> antes de volver a intentarlo.</span>
                      </div>
                    )}

                    {registro.step !== "success" && <StepIndicator current={registro.stepNumber} />}

                    {registro.submitting ? (
                      <div className="card border-0"
                        style={{ borderRadius: "var(--radius)", boxShadow: "0 20px 40px rgba(0,0,0,.4)" }}>
                        <div className="card-body p-5 text-center bg-white">
                          <div className="spinner-border text-danger mb-3" role="status" />
                          <p className="text-muted small mb-0">Guardando tu registro de forma segura…</p>
                        </div>
                      </div>
                    ) : (
                      <div className={`card border-0 overflow-hidden ${styles.fadeKeyframe}`} style={{ borderRadius: "16px" }}>
                        <div className="card-body p-0 bg-transparent">
                          {registro.step === "datos" && (
                            <DatosPersonalesStep
                              key={registro.formKey}
                              data={registro.formData}
                              onNext={registro.handleDatosOk}
                              onCaptchaVerify={registro.setCaptchaToken}
                              disabled={registro.lockout}
                            />
                          )}
                          {registro.step === "verificacion" && (
                            <VerificacionStep
                              email={registro.formData.email}
                              expiresIn={registro.otpExpires}
                              onSuccess={registro.handleVerificacionOk}
                              onBack={registro.goBack}
                              onResend={registro.resendOtp}
                            />
                          )}
                          {registro.step === "success" && (
                            <SuccessStep registroId={registro.registroId} email={registro.formData.email} />
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {vista === "consulta" && <VistaConsulta />}

              </div>
            </div>
          </div>
        </div>
      </main>

      <footer role="contentinfo" className="mt-auto">
        <div className="text-center py-2 text-white" style={{ backgroundColor: "#f53c3e" }}>
          <div className="container">
            {[
              ["https://hubox.com/aviso_privacidad.html",       "Aviso de Privacidad"],
              ["https://hubox.com/nosotros.html#politicas",     "Políticas de Gestión"],
              ["https://hubox.com/transparencia.html",          "Transparencia"],
            ].map(([href, label], i) => (
              <span key={href}>
                {i > 0 && <span> | </span>}
                <a href={href} className="text-white text-decoration-none mx-2 fw-semibold">{label}</a>
              </span>
            ))}
          </div>
        </div>
        <div className="text-center text-white-50 py-3" style={{ backgroundColor: "#3a3333" }}>
          <p className="mb-0 small fw-semibold">© Copyright 2025. HuBOX</p>
        </div>
      </footer>

      <ErrorModal
        show={errorModal.show}
        title={errorModal.title}
        body={errorModal.body}
        onClose={closeErrorModal}
      />
      <RiskModal
        show={riskModal}
        captchaToken={registro.captchaToken}
        onVerify={registro.setCaptchaToken}
        onExpire={() => registro.setCaptchaToken(null)}
        onAck={() => { setRiskModal(false); registro.handleRiskAck(); }}
        onClose={() => setRiskModal(false)}
      />
      <DupModal
        show={dupModal.show}
        dupState={dupModal}
        lockout={registro.lockout}
        cooldown={registro.cooldown}
        onSend={handleSendFolioReminder}
        onClose={closeDupModal}
      />
    </div>
  );
}