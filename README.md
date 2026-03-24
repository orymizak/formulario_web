# Formulario de Contacto Web
> Ejercicio práctico — Equipo Hubox

**Autor:** David Orymizak Batiz Romero  
**Fecha:** 18/03/2026  
**Solicitante:** Equipo Hubox

---

## Descripción

Formulario web para capturar, almacenar y consultar datos de contacto de usuarios.

El proyecto prioriza no solo la funcionalidad básica, sino la seguridad por capas, la protección contra abuso, la alta disponibilidad y la facilidad de migración.

---

## Objetivos

- [x] Captura de datos de contacto con validación en frontend y backend
- [x] Almacenamiento persistente con base de datos relacional
- [x] Almacenamiento de imágenes en S3
- [x] Consulta y búsqueda de registros almacenados
- [x] Exportación de datos
- [x] Verificación de identidad por OTP
- [x] Rate limiting progresivo y bloqueo por IP / dispositivo
- [x] CAPTCHA adaptativo
- [x] Identificación de dispositivos
- [x] Protección contra ataques comunes: SQLi, XSS, DDoS, HPP
- [x] Panel de administración con vista pública censurada y acceso autenticado
- [x] Bitácora de auditoría de eventos

---

## Tecnologías

| Capa | Tecnología |
|------|-----------|
| Frontend | React + Vite |
| Backend | Node.js 20 + Express |
| Base de datos | PostgreSQL 15 |
| Cache / Rate limiting | Redis |
| Almacenamiento de archivos | AWS S3 |
| Email | SMTP Brevo |
| Captcha | Google reCAPTCHA v2 |
| Cloud | AWS |

---

## Levantar en desarrollo

### Requisitos
- Docker y Docker Compose

### Pasos

```bash
# 1. Configurar variables de entorno
colocar el archivo .env en la carpeta backend

# 2. Levantar servicios backend
docker compose -f docker-compose.dev.yml up --build

# 3. Levantar frontend
npm i && npm run dev
```

La API queda disponible en `http://localhost:8080`.  
El panel de administración del frontend en `http://localhost:5173/admin`.

### Variables de entorno necesarias

Las credenciales para desarrollo se comparten por correo con el equipo.  
El archivo `.env` **no se incluye en el repositorio**.

| Variable | Descripción |
|----------|-------------|
| `DB_*` | Conexión a PostgreSQL (corre en Docker) |
| `REDIS_*` | Conexión a Redis (corre en Docker) |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | Acceso a S3 para subida y lectura de archivos |
| `S3_BUCKET` | Nombre del bucket de archivos |
| `JWT_SECRET` | Firma de tokens de administrador |
| `ADMIN_USER` / `ADMIN_PASS` | Credenciales del panel de administración |
| `SMTP_*` | Envío de emails vía Brevo |
| `CAPTCHA_SECRET` | Verificación de reCAPTCHA |

---

## Flujos principales

### Registro de contacto

```
1. Usuario completa el formulario
2. reCAPTCHA valida que no es un bot
3. Backend verifica duplicados (email, teléfono, CURP)
4. Se solicita verificación OTP → se envía código al correo
5. Usuario ingresa el código
6. Backend valida, sanitiza y almacena la información + archivos en S3
7. Se envía email de confirmación con folio
```

### Consulta por folio

```
1. Usuario ingresa su folio
2. Backend valida UUID y aplica rate limit (1 búsqueda/min por IP)
3. Se muestran los datos del registro
```

### Panel de administración

```
1. Se accede a /admin — vista pública con datos censurados
   (email, teléfono, CURP e IP parcialmente ocultos)
2. Admin hace clic en "Iniciar sesión" e ingresa credenciales
3. Vista completa: datos sin censura, documentos adjuntos, bitácora
4. Admin puede:
   ├── Ver detalle con foto e INE (URL de S3)
   ├── Exportar registros a CSV
   └── Consultar bitácora de eventos
```

---

## Protección contra abuso

El sistema detecta y responde automáticamente a comportamiento anómalo:

| Comportamiento | Acción |
|----------------|--------|
| > 10 peticiones / minuto | Bloqueo 5 minutos |
| Reincidencia | Bloqueo 30 min → 2h → 24h |
| > límite por hora | Escalado directo a nivel 2 |
| Misma IP, distinto dispositivo | Bloqueo por fingerprint independiente |
| Fallo de CAPTCHA | Penalización en score de riesgo |
| > 3 fallos OTP | Código invalidado + cooldown |

---

## Endpoints

### Contactos

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/v1/contactos` | Registrar contacto | OTP session |
| `GET` | `/api/v1/contactos` | Listar registros | Pública |
| `GET` | `/api/v1/contactos/:id` | Consultar por folio | Pública |
| `POST` | `/api/v1/contactos/check-duplicates` | Verificar si email/tel/CURP ya existe | Pública |
| `POST` | `/api/v1/contactos/folio-reminder` | Reenviar folio al correo | Pública |
| `GET` | `/api/v1/contactos/file-url` | Presigned URL de archivo (foto/INE) | Pública* |

*Valida que la key pertenece al folio solicitado.

### OTP

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `POST` | `/api/v1/otp/request` | Solicitar código OTP |
| `POST` | `/api/v1/otp/verify` | Verificar código → JWT de sesión |
| `GET` | `/api/v1/otp/score` | Consultar score de riesgo actual |

### Administración

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/v1/admin/login` | Autenticación de admin | — |
| `GET` | `/api/v1/admin/contactos` | Listar contactos (datos censurados / completos con `?raw=1`) | JWT admin |
| `GET` | `/api/v1/admin/contactos/:id` | Detalle de contacto | JWT admin |
| `GET` | `/api/v1/admin/audit` | Bitácora de eventos | JWT admin |
| `GET` | `/api/v1/admin/file-url` | Presigned URL de archivo | JWT admin |

### Sistema

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/health` | Estado general (DB + Redis) |
| `GET` | `/health/ready` | Readiness probe para ECS |

---

## Estructura del proyecto

```
backend/
├── src/
│   ├── app.js              # Express, middlewares, rutas
│   ├── server.js           # Bootstrap, sync de schema, seed admin
│   ├── config/
│   │   └── redis.js
│   ├── middleware/
│   │   ├── captcha.js
│   │   ├── rateLimiter.js
│   │   └── validators.js
│   ├── models/
│   │   └── index.js        # Contacto, AuditLog, AdminUser
│   ├── routes/
│   │   ├── admin.js
│   │   ├── contactos.js
│   │   ├── health.js
│   │   └── otp.js
│   ├── services/
│   │   ├── emailService.js
│   │   ├── otpService.js
│   │   └── userScoring.js
│   └── utils/
│       ├── censor.js       # Censura de datos sensibles
│       └── logger.js
├── docker-compose.dev.yml
├── Dockerfile
├── Dockerfile.dev
└── global-bundle.pem       # CA cert de Amazon RDS (para SSL en producción)

frontend/
├── src/
│   ├── admin/
│   │   ├── AdminApp.jsx
│   │   ├── AdminDashboard.jsx # modal de login integrado
│   │   └── adminApi.js
│   ├── components/
│   ├── features/
│   ├── hooks/
│   └── services/
└── ...
```