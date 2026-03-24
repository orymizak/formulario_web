/**
 * Utilidades de censura para datos sensibles.
 * Se aplican en el backend antes de serializar la respuesta.
 *
 * Reglas:
 *   email    →  d***z@gmail.com   (primera letra + *** + última antes de @ + dominio)
 *   telefono →  6********7        (primera y última letra visibles)
 *   curp     →  BA*******         (primeras 2 letras + asteriscos)
 *   ip       →  2*******3         (primer y último carácter visibles)
 */

function censorEmail(email) {
  if (!email) return email;
  const [local, domain] = email.split('@');
  if (!domain || local.length < 2) return `*@${domain}`;
  const first = local[0];
  const last  = local[local.length - 1];
  return `${first}***${last}@${domain}`;
}

function censorTelefono(tel) {
  if (!tel) return tel;
  const t = tel.replace(/\s+/g, '');
  if (t.length < 2) return t;
  return `${t[0]}${'*'.repeat(t.length - 2)}${t[t.length - 1]}`;
}

function censorCurp(curp) {
  if (!curp) return curp;
  if (curp.length <= 2) return curp;
  return `${curp.slice(0, 2)}${'*'.repeat(curp.length - 2)}`;
}

function censorIp(ip) {
  if (!ip) return ip;
  if (ip.length < 2) return ip;
  return `${ip[0]}${'*'.repeat(ip.length - 2)}${ip[ip.length - 1]}`;
}

/**
 * Aplica censura a un objeto contacto plano (o instancia Sequelize).
 * Devuelve un objeto nuevo sin mutar el original.
 */
function censorContacto(contacto) {
  const c = contacto?.toJSON ? contacto.toJSON() : { ...contacto };
  if (c.email)    c.email    = censorEmail(c.email);
  if (c.telefono) c.telefono = censorTelefono(c.telefono);
  if (c.curp)     c.curp     = censorCurp(c.curp);
  if (c.ipOrigen) c.ipOrigen = censorIp(c.ipOrigen);
  return c;
}

/**
 * Aplica censorContacto a un array de contactos.
 */
function censorContactos(rows) {
  return rows.map(censorContacto);
}

module.exports = { censorEmail, censorTelefono, censorCurp, censorIp, censorContacto, censorContactos };