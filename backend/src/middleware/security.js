/**
 * Seguridad: rate limit simple en memoria + helpers.
 * Sin dependencias extra (funciona en Windows/local y en cloud).
 */

const buckets = new Map();

function clientKey(req, suffix = '') {
  const ip =
    req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown';
  return `${ip}:${suffix}`;
}

/**
 * @param {{ windowMs?: number, max?: number, message?: string }} opts
 */
function rateLimit({ windowMs = 15 * 60 * 1000, max = 100, message } = {}) {
  return (req, res, next) => {
    const key = clientKey(req, req.path);
    const now = Date.now();
    let entry = buckets.get(key);
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      buckets.set(key, entry);
    }
    entry.count += 1;
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - entry.count)));

    if (entry.count > max) {
      return res.status(429).json({
        success: false,
        message:
          message ||
          'Demasiadas solicitudes. Esperá un momento e intentá de nuevo.',
      });
    }
    next();
  };
}

/** Limpieza periódica de buckets viejos */
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of buckets.entries()) {
    if (now > v.resetAt) buckets.delete(k);
  }
}, 60_000).unref?.();

function isProd() {
  return process.env.NODE_ENV === 'production';
}

/**
 * Arranque: fallar si faltan secretos en producción.
 * En desarrollo solo avisa.
 */
function assertSecurityConfig() {
  const warnings = [];
  const fatals = [];

  if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD === 'cambia-esta-clave' || process.env.ADMIN_PASSWORD === 'admin123') {
    const msg = 'ADMIN_PASSWORD débil o por defecto';
    if (isProd()) fatals.push(msg);
    else warnings.push(msg + ' — cambiala antes de publicar');
  }

  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 24 || process.env.JWT_SECRET.includes('fallback') || process.env.JWT_SECRET.includes('genera-un-secreto')) {
    const msg = 'JWT_SECRET débil o por defecto';
    if (isProd()) fatals.push(msg);
    else warnings.push(msg + ' — usá un string largo aleatorio');
  }

  warnings.forEach((w) => console.warn(`[Seguridad] ⚠️  ${w}`));
  if (fatals.length) {
    console.error('[Seguridad] ❌ Configuración insegura en producción:');
    fatals.forEach((f) => console.error('  -', f));
    process.exit(1);
  }
}

module.exports = {
  rateLimit,
  isProd,
  assertSecurityConfig,
  clientKey,
};
