import { useState, useCallback } from "react";
import { api } from "../services/api";
import { useCountdown } from "./useCountdown";
import { useFormGuard } from "./useFormGuard";

export function friendlyError(err) {
  if (err?.code === "DUPLICATE_ENTRY" || err?.status === 409) {
    const msg = err?.message || "";
    if (msg.toLowerCase().includes("curp"))
      return { field: "CURP", text: "Este CURP ya está registrado en el sistema." };
    if (msg.toLowerCase().includes("email"))
      return { field: "correo", text: "Este correo electrónico ya está registrado." };
    if (msg.toLowerCase().includes("telefono") || msg.toLowerCase().includes("teléfono"))
      return { field: "teléfono", text: "Este número de teléfono ya está registrado." };
    return { field: null, text: "Este registro ya existe en el sistema." };
  }
  if (err?.code === "EMAIL_MISMATCH")
    return { field: "correo", text: "El correo no coincide con el verificado por OTP. Vuelve al formulario y corrige el correo." };
  if (err?.code === "VALIDATION_ERROR") {
    const detail = err?.errors?.map((e) => `${e.field}: ${e.message}`).join(" · ");
    return { field: null, text: detail || "Hay campos con errores. Revisa el formulario." };
  }
  return { field: null, text: err?.message || "Error al guardar el registro. Intenta de nuevo." };
}

/**
 * useRegistro — encapsula todo el flujo de registro:
 * datos → OTP → submit → success
 *
 * Expone solo lo que el componente necesita renderizar:
 * estado, handlers y callbacks.
 */
export function useRegistro({ onError, onDuplicate, onRiskDetected }) {
  const [step,         setStep]        = useState("datos");
  const [formData,     setFormData]    = useState({});
  const [registroId,   setRegistroId]  = useState(null);
  const [submitting,   setSubmitting]  = useState(false);
  const [otpExpires,   setOtpExpires]  = useState(600);
  const [captchaToken, setCaptchaToken]= useState(null);
  const [formKey,      setFormKey]     = useState(0);

  const countdown                = useCountdown();
  const { needsCaptcha, recordFail, clearFails } = useFormGuard();

  const lockout  = countdown.active;
  const cooldown = countdown.seconds;

  const stepNumber = { datos: 1, verificacion: 2, success: 3 }[step] ?? 1;

  const resetForm = useCallback(() => {
    setFormData({});
    setCaptchaToken(null);
    setStep("datos");
    setFormKey((k) => k + 1);
  }, []);

  const startCooldown = useCallback((s) => countdown.start(s), [countdown]);

  // ── Paso 1: validar riesgo + duplicados → solicitar OTP ─────────────────
  const handleDatosOk = useCallback(async (data) => {
    if (lockout) {
      onError("Debes esperar", `Espera ${cooldown} segundos antes de intentar de nuevo.`);
      return;
    }
    setFormData(data);

    // Risk score
    try {
      const scoreRes = await api.getRiskScore().catch((err) => {
        if (err?.status === 429) {
          const s = err?.retryAfterSeconds || 60;
          startCooldown(s);
          onError("Demasiadas solicitudes", `Por seguridad, espera ${s} segundos antes de continuar.`);
          return null;
        }
        return { riskLevel: "low", requiresCaptcha: false, blocked: false };
      });
      if (!scoreRes) return;
      if (scoreRes.blocked) {
        const s = scoreRes.retryAfterSeconds || 60;
        startCooldown(s);
        onError("Acceso temporalmente bloqueado", `Demasiados intentos. Espera ${s} segundos.`);
        return;
      }
      if ((needsCaptcha || scoreRes.requiresCaptcha) && !captchaToken) {
        onRiskDetected();
        return;
      }
    } catch { /* fail-open */ }

    // Duplicados
    try {
      const check = await api.checkDuplicates({ email: data.email, telefono: data.telefono, curp: data.curp });
      if (check.exists) {
        resetForm();
        onDuplicate({ field: check.field, email: data.email, telefono: data.telefono, curp: data.curp });
        return;
      }
    } catch (err) {
      if (err?.status === 429) {
        const s = err?.retryAfterSeconds || err?.retryAfter || 60;
        startCooldown(s);
        onError("Demasiadas solicitudes", `Por seguridad, espera ${s} segundos antes de continuar.`);
        return;
      }
    }

    await _sendOtp(data);
  }, [lockout, cooldown, captchaToken, needsCaptcha, onError, onDuplicate, onRiskDetected, resetForm, startCooldown]);

  // ── Solicitar OTP ────────────────────────────────────────────────────────
  const _sendOtp = useCallback(async (data) => {
    if (lockout) return;
    try {
      const res = await api.requestOtp(data.email);
      setOtpExpires(res.expiresInSeconds || 600);
      setStep("verificacion");
    } catch (err) {
      if (err.status === 429 || err.code === "OTP_COOLDOWN") {
        startCooldown(err.retryAfter || 60);
        onError("Espera un momento", `Por seguridad, debes esperar ${err.retryAfter || 60} segundos antes de solicitar otro código.`);
      } else {
        onError("Error al enviar código", err.message || "No se pudo enviar el código.");
      }
    }
  }, [lockout, startCooldown, onError]);

  const resendOtp = useCallback(() => _sendOtp(formData), [formData, _sendOtp]);

  // ── Paso 2: verificar OTP → submit registro ──────────────────────────────
  const handleVerificacionOk = useCallback(async (token) => {
    setSubmitting(true);
    try {
      const apellido = [formData.apellidoP, formData.apellidoM].filter(Boolean).join(" ").trim();
      const payload = {
        nombre: formData.nombre, apellido,
        fechaNac: formData.fechaNac, genero: formData.genero,
        email: formData.email, telefono: formData.telefono,
        ...(formData.curp  ? { curp: formData.curp }   : {}),
        ...(formData.foto  ? { foto: formData.foto }   : {}),
        ...(formData.ine   ? { ine:  formData.ine }    : {}),
        idempotencyKey: crypto.randomUUID(),
        ...(captchaToken   ? { captchaAck: "1" }       : {}),
      };
      const data = await api.submitRegistro(payload, token, captchaToken);
      setRegistroId(data.data?.id);
      clearFails();
      setStep("success");
    } catch (err) {
      recordFail();
      const isDuplicate    = err?.code === "DUPLICATE_ENTRY" || err?.status === 409;
      const isEmailMismatch= err?.code === "EMAIL_MISMATCH";
      if (isDuplicate) {
        setStep("datos"); setFormData({}); setCaptchaToken(null);
        onDuplicate({ email: formData.email });
      } else {
        const { text } = friendlyError(err);
        onError(isEmailMismatch ? "Correo no coincide" : "Error al registrar", text, true);
      }
    } finally {
      setSubmitting(false);
    }
  }, [formData, captchaToken, clearFails, recordFail, onError, onDuplicate]);

  const handleRiskAck = useCallback(() => {
    clearFails();
    _sendOtp(formData);
  }, [clearFails, formData, _sendOtp]);

  return {
    // estado
    step, stepNumber, formData, registroId, submitting, otpExpires,
    captchaToken, setCaptchaToken, formKey, lockout, cooldown,
    // acciones
    handleDatosOk, handleVerificacionOk, handleRiskAck,
    resendOtp, resetForm,
    goBack: () => setStep("datos"),
  };
}