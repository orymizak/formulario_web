# Formulario de Contacto Web

> Ejercicio práctico — Equipo Hubox

**Autor:** David Orymizak Batiz Romero  
**Fecha:** 18/03/2026  
**Solicitante:** Hector Ivan Gutierrez Ayala / Equipo Hubox

---

## Descripción

Formulario web para capturar, almacenar y consultar datos de contacto de usuarios.
El proyecto prioriza no solo la funcionalidad básica, sino la seguridad por capas, la protección contra abuso, la alta disponibilidad y la facilidad de migración.

---

## Objetivos

- [ ] Captura de datos de contacto con validación en frontend y backend
- [ ] Almacenamiento persistente con base de datos relacional
- [ ] Consulta y búsqueda de registros almacenados
- [ ] Exportación de datos
- [ ] Verificación de identidad por OTP
- [ ] Rate limiting progresivo y bloqueo por IP / dispositivo
- [ ] CAPTCHA adaptativo
- [ ] Identificación de dispositivos
- [ ] Protección contra ataques comunes: SQLi, XSS, DDoS, HPP

## Tecnologías 

| Capa | Tecnología |
|------|-----------|
| Frontend | React |
| Backend | Node.js 20 + Express |
| Base de datos | PostgreSQL / Aurora |
| Email | Nodemailer / AWS SES |
| Cloud | AWS | 

---

## Flujo de registro de datos del usuario

```
1. Abre el formulario
2. Completa los datos
3. Envía el formulario
4. Se solicita verificación por OTP
  └── Se envía código al correo
5. Usuario verifica OTP
6. El backend valida, sanitiza y almacena la información
7. Confirmación por email
```

## Flujo de consulta de datos del usuario

```
1. Usuario ingresa su correo
2. Solicita acceso a sus datos
3. Recibe OTP o enlace mágico
4. Verifica identidad
5. Visualiza sus registros
```

## Flujo de consulta de datos del administrador

```
1. Admin accede a panel de administración
2. Se autentica (usuario + contraseña)
3. Segundo factor
4. Accede a dashboard de datos
5. Puede:
  ├── Ver todos los registros
  ├── Buscar / filtrar
  └── Exportar datos
```

El sistema detecta automáticamente comportamiento anómalo:

| Comportamiento | Acción |
|----------------|--------|
| Errores de validación | Feedback inmediato, sin penalización |
| > 10 peticiones por minuto | Bloqueo 5 minutos |
| Reincidencia | Bloqueo 30 min → 6h → 24h |
| Misma IP, distinto dispositivo | Bloqueo por fingerprint |
| > 3 fallos OTP | Código invalidado + cooldown |
| > 3 fallos acumulados | CAPTCHA obligatorio |

---

## Definición de Endpoints

| Método | Endpoint | Descripción |
|--------|---------|-------------|
| `POST` | `/otp/request` | Enviar código OTP al correo |
| `POST` | `/otp/verify` | Verificar OTP → obtener JWT |
| `POST` | `/contactos` | Registrar contacto |
| `GET` | `/contactos` | Consultar registros |
| `GET` | `/health` | Estado del sistema |
