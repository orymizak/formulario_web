import Modal from "../../components/Modal";
import RecaptchaWidget from "../../components/RecaptchaWidget";

// ── Modal de error genérico ───────────────────────────────────────────────────
export function ErrorModal({ show, title, body, onClose }) {
  return (
    <Modal show={show} title={title} onClose={onClose}
      footer={
        <div className="d-flex gap-2 justify-content-end w-100">
          <button className="btn btn-outline-secondary btn-sm" onClick={onClose}>Cerrar</button>
        </div>
      }>
      <div className="d-flex gap-3 align-items-start">
        <i className="bi bi-exclamation-circle-fill text-danger flex-shrink-0 fs-5 mt-1"></i>
        <p className="mb-0 small">{body}</p>
      </div>
    </Modal>
  );
}

// ── Modal de riesgo / reCAPTCHA ───────────────────────────────────────────────
export function RiskModal({ show, captchaToken, onVerify, onExpire, onAck, onClose }) {
  return (
    <Modal show={show} title="Verificación de seguridad" onClose={onClose}
      footer={
        <div className="d-flex gap-2 justify-content-end w-100">
          <button className="btn btn-outline-secondary btn-sm" onClick={onClose}>Cancelar</button>
          <button className="btn-hubox btn-sm" onClick={onAck}
            disabled={!captchaToken}
            title={!captchaToken ? "Completa el CAPTCHA primero" : ""}>
            <i className="bi bi-shield-check me-1"></i> Confirmar y continuar
          </button>
        </div>
      }>
      <div>
        <div className="d-flex gap-3 align-items-start mb-3">
          <i className="bi bi-shield-exclamation text-warning flex-shrink-0 fs-5 mt-1"></i>
          <div>
            <p className="mb-1 fw-semibold small">Se detectó actividad inusual desde tu dispositivo</p>
            <p className="mb-0 small text-muted">Completa la verificación para continuar con el registro.</p>
          </div>
        </div>
        <RecaptchaWidget onVerify={onVerify} onExpire={onExpire} />
        {!captchaToken && (
          <p className="text-center text-muted small mb-0">
            Marca la casilla "No soy un robot" para continuar.
          </p>
        )}
      </div>
    </Modal>
  );
}

// ── Modal de registro duplicado ───────────────────────────────────────────────
export function DupModal({ show, dupState, lockout, cooldown, onSend, onClose }) {
  return (
    <Modal show={show} title="Registro existente" onClose={onClose}
      footer={
        <div className="d-flex gap-2 justify-content-end w-100">
          {!dupState.sent && (
            <button className="btn-hubox btn-sm" onClick={onSend}
              disabled={dupState.sending || lockout}
              title={lockout ? `Disponible en ${cooldown}s` : ""}>
              {dupState.sending
                ? <span className="spinner-border spinner-border-sm me-1" />
                : lockout
                  ? <i className="bi bi-clock-history me-1"></i>
                  : <i className="bi bi-envelope me-1"></i>}
              {lockout ? `Espera... ${cooldown}s` : "Enviar folio"}
            </button>
          )}
          <button className="btn btn-outline-secondary btn-sm" onClick={onClose}>Cerrar</button>
        </div>
      }>
      <div className="d-flex flex-column gap-3">
        <div className="d-flex gap-3 align-items-start">
          <i className="bi bi-info-circle-fill text-primary flex-shrink-0 fs-5 mt-1"></i>
          <div>
            <p className="mb-1 small fw-semibold text-dark">Hemos detectado que ya cuentas con un registro previo.</p>
            <p className="mb-0 small text-muted">Si eres el titular y deseas recuperar tu información, haz clic en el botón de abajo.</p>
          </div>
        </div>
        {dupState.error && (
          <div className="alert alert-warning d-flex gap-2 align-items-center small mb-0 py-2 border-0 shadow-sm">
            <i className="bi bi-exclamation-triangle-fill flex-shrink-0 text-warning"></i>
            <span>{dupState.error}. Podrás reenviar el folio en {cooldown}s</span>
          </div>
        )}
        {dupState.sent && (
          <div className="alert alert-success d-flex gap-2 align-items-center small mb-0 py-2 border-0 shadow-sm">
            <i className="bi bi-check-circle-fill text-success"></i>
            <span>Se ha enviado tu folio al correo original.</span>
          </div>
        )}
      </div>
    </Modal>
  );
}