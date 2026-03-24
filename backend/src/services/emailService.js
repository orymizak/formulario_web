/**
 * SERVICIO DE EMAIL
 *
 * EMAIL_PROVIDER=smtp  > Mailtrap SMTP (desarrollo/testing)
 * EMAIL_PROVIDER=ses   > AWS SES (producción)
 *
 * Un único contrato: sendOtp(to, code) y sendConfirmation(to, nombre).
 * Cambiar de proveedor = cambiar EMAIL_PROVIDER en .env, sin tocar código.
 */

const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;

  const provider = process.env.EMAIL_PROVIDER || 'smtp';

  if (provider === 'console') {
    // Modo desarrollo sin email real: imprime en consola y simula envío exitoso
    _transporter = {
      sendMail: async (msg) => {
        const code = (msg.text || '').match(/\d{6}/)?.[0] || '(ver subject)';
        console.log('\n' + '═'.repeat(55));
        console.log('  📧  EMAIL (modo consola)');
        console.log('  Para:    ' + msg.to);
        console.log('  Asunto:  ' + msg.subject);
        if (code !== '(ver subject)') {
          console.log('  ┌─────────────────────┐');
          console.log('  │  CÓDIGO OTP: ' + code + ' │');
          console.log('  └─────────────────────┘');
        } else {
          console.log('  ' + (msg.text || '').slice(0, 120));
        }
        console.log('═'.repeat(55) + '\n');
        return { messageId: 'console-' + Date.now() };
      }
    };
} else if (provider === 'ses') {
  const { SESv2Client, SendEmailCommand } = require('@aws-sdk/client-sesv2');
  
  // Si estás en ECS (Fargate), no necesitas pasar credentials explícitamente, 
  // el SDK las toma del Task Role automáticamente.
  const sesClient = new SESv2Client({
    region: process.env.AWS_REGION || 'us-east-2'
  });

  _transporter = {
    sendMail: async ({ from, to, subject, html, text }) => {
      const cmd = new SendEmailCommand({
        FromEmailAddress: from,
        Destination: { ToAddresses: [to] },
        Content: {
          Simple: {
            Subject: { Data: subject },
            Body: {
              Html: { Data: html },
              Text: { Data: text },
            },
          },
        },
      });

      // Importante: No retornes el resultado directo, solo lo que el resto del código espera
      const result = await sesClient.send(cmd);

      return { messageId: result.MessageId };
    },
  };
} else {
    // SMTP — Mailtrap o cualquier servidor SMTP
    _transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'sandbox.smtp.mailtrap.io',
      port: parseInt(process.env.SMTP_PORT || '587'),
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  return _transporter;
}

// ─── Template OTP ─────────────────────────────────────────────────────────────
function otpTemplate(code, expiresMinutes = 10) {
  return {
    subject: `Tu código de verificación HuBOX: ${code}`,
    html: `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:24px">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
    <div style="background:#f53c3e;padding:24px;text-align:center">
      <span style="color:#fff;font-size:22px;font-weight:bold;letter-spacing:3px">HuBOX®</span>
    </div>
    <div style="padding:32px 24px;text-align:center">
      <p style="margin:0 0 8px;color:#666;font-size:14px">Tu código de verificación es</p>
      <div style="font-size:44px;font-weight:bold;letter-spacing:14px;color:#1a1a1a;margin:20px 0;font-family:monospace">${code}</div>
      <p style="color:#999;font-size:13px;margin:0">Válido por <strong>${expiresMinutes} minutos</strong>.<br>No lo compartas con nadie.</p>
    </div>
    <div style="border-top:1px solid #eee;padding:16px 24px;text-align:center">
      <p style="color:#ccc;font-size:11px;margin:0">Si no solicitaste este código, ignora este correo.</p>
    </div>
  </div>
</body>
</html>`,
    text: `Tu código de verificación HuBOX es: ${code}\nVálido por ${expiresMinutes} minutos.\nNo lo compartas con nadie.`,
  };
}

// ─── Template confirmación ────────────────────────────────────────────────────
function confirmTemplate(nombre, folio) {
  const folioHtml = folio
    ? `<div style="background:#fff8e1;border:1px solid #ffe082;border-radius:6px;padding:16px 20px;margin:20px 0;text-align:center">
        <p style="margin:0 0 6px;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:1px">Tu folio de registro</p>
        <code style="font-size:14px;font-weight:bold;color:#1a1a1a;word-break:break-all">${folio}</code>
       </div>
       <p style="color:#444;font-size:13px;line-height:1.6">
         Puedes usar este folio para consultar tu información en cualquier momento a través del
         <a href="https://hubox.orymizak.com" style="color:#f53c3e">formulario de búsqueda</a>
         en nuestro sitio web.
       </p>`
    : ''
  return {
    subject: '¡Registro recibido! — HuBOX',
    html: `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:24px">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
    <div style="background:#f53c3e;padding:24px;text-align:center">
      <span style="color:#fff;font-size:22px;font-weight:bold;letter-spacing:3px">HuBOX®</span>
    </div>
    <div style="padding:32px 24px">
      <h2 style="margin:0 0 12px;color:#1a1a1a;font-size:18px">Hola, ${nombre}</h2>
      <p style="color:#444;line-height:1.6;margin:0 0 8px">
        Hemos recibido tu información y puedes visualizarla a través del formulario de búsqueda
        en el sitio web con el siguiente folio:
      </p>
      ${folioHtml}
      <p style="color:#888;font-size:12px;margin-top:24px">
        HuBOX® · Disrupción Digital ·
        <a href="mailto:info@hubox.com" style="color:#f53c3e">info@hubox.com</a>
      </p>
    </div>
  </div>
</body>
</html>`,
    text: `Hola ${nombre},\n\nHemos recibido tu información. Puedes consultarla en el formulario de búsqueda en hubox.orymizak.com con el siguiente folio:\n\n${folio || '(sin folio)'}\n\n— HuBOX®`,
  };
}

// ─── Enviar OTP ───────────────────────────────────────────────────────────────
async function sendOtp(to, code) {
  const from = process.env.EMAIL_FROM || 'hubox-noreply@orymizak.com';
  const expires = parseInt(process.env.OTP_EXPIRES_MINUTES || '10');
  const tpl = otpTemplate(code, expires);

  try {
    const info = await getTransporter().sendMail({ from, to, ...tpl });
    logger.info({
      event: 'EMAIL_OTP_SENT',
      to: to.replace(/(.{2}).+(@.+)/, '$1****$2'),
      messageId: info.messageId,
      provider: process.env.EMAIL_PROVIDER || 'smtp',
    });
    return info;
  } catch (err) {
    logger.error({ event: 'EMAIL_OTP_FAILED', error: err.message });
    throw Object.assign(
      new Error('No se pudo enviar el correo de verificación. Intenta más tarde.'),
      { code: 'EMAIL_ERROR', status: 503 }
    );
  }
}

// ─── Enviar confirmación de registro ─────────────────────────────────────────
async function sendConfirmation(to, nombre, folio) {
  const from = process.env.EMAIL_FROM || 'hubox-noreply@orymizak.com';
  const tpl = confirmTemplate(nombre, folio);
  try {
    const info = await getTransporter().sendMail({ from, to, ...tpl });
    logger.info({
      event: 'EMAIL_CONFIRM_SENT',
      to: to.replace(/(.{2}).+(@.+)/, '$1****$2'),
      messageId: info.messageId,
    });
    return info;
  } catch (err) {
    // No crítico — solo loggear, no relanzar
    logger.warn({ event: 'EMAIL_CONFIRM_FAILED', error: err.message });
  }
}

// ─── Template recordatorio de folio ──────────────────────────────────────────
function folioReminderTemplate(nombre, folio) {
  return {
    subject: 'Tu folio de registro — HuBOX',
    html: `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:24px">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
    <div style="background:#f53c3e;padding:24px;text-align:center">
      <span style="color:#fff;font-size:22px;font-weight:bold;letter-spacing:3px">HuBOX®</span>
    </div>
    <div style="padding:32px 24px">
      <h2 style="margin:0 0 12px;color:#1a1a1a;font-size:18px">Hola, ${nombre}</h2>
      <p style="color:#444;line-height:1.6;margin:0 0 8px">
        Nos solicitaste el reenvío de tu folio de registro. Aquí lo tienes:
      </p>
      <div style="background:#fff8e1;border:1px solid #ffe082;border-radius:6px;padding:16px 20px;margin:20px 0;text-align:center">
        <p style="margin:0 0 6px;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:1px">Tu folio de registro</p>
        <code style="font-size:14px;font-weight:bold;color:#1a1a1a;word-break:break-all">${folio}</code>
      </div>
      <p style="color:#444;font-size:13px;line-height:1.6">
        Puedes usar este folio para consultar tu información en cualquier momento
        a través del formulario de búsqueda en
        <a href="https://hubox.orymizak.com" style="color:#f53c3e">hubox.orymizak.com</a>.
      </p>
      <p style="color:#888;font-size:12px;margin-top:24px">
        Si no solicitaste este reenvío, puedes ignorar este mensaje.<br>
        HuBOX® · Disrupción Digital ·
        <a href="mailto:info@hubox.com" style="color:#f53c3e">info@hubox.com</a>
      </p>
    </div>
  </div>
</body>
</html>`,
    text: `Hola ${nombre},\n\nNos solicitaste el reenvío de tu folio de registro:\n\n${folio}\n\nPuedes usarlo para consultar tu información en hubox.orymizak.com.\n\n— HuBOX®`,
  };
}

// ─── Enviar recordatorio de folio ─────────────────────────────────────────────
async function sendFolioReminder(to, nombre, folio) {
  const from = process.env.EMAIL_FROM || 'hubox-noreply@orymizak.com';
  const tpl  = folioReminderTemplate(nombre, folio);
  try {
    const info = await getTransporter().sendMail({ from, to, ...tpl });
    logger.info({
      event: 'EMAIL_FOLIO_REMINDER_SENT',
      to: to.replace(/(.{2}).+(@.+)/, '$1****$2'),
      messageId: info.messageId,
    });
    return info;
  } catch (err) {
    logger.warn({ event: 'EMAIL_FOLIO_REMINDER_FAILED', error: err.message });
    throw Object.assign(
      new Error('No se pudo enviar el correo. Intenta más tarde.'),
      { code: 'EMAIL_ERROR', status: 503 }
    );
  }
}

module.exports = { sendOtp, sendConfirmation, sendFolioReminder };