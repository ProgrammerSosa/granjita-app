const jwt = require('jsonwebtoken');
const crypto = require('crypto');

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    // Solo dev: secret derivado (nunca en prod — assertSecurityConfig mata el proceso)
    return crypto
      .createHash('sha256')
      .update(`tienda-dev-only-${process.env.ADMIN_PASSWORD || 'dev'}`)
      .digest('hex');
  }
  return secret;
}

/**
 * Comparación en tiempo constante (evita timing attacks en password).
 */
function safeEqualString(a, b) {
  const aa = Buffer.from(String(a || ''), 'utf8');
  const bb = Buffer.from(String(b || ''), 'utf8');
  if (aa.length !== bb.length) {
    // comparar contra sí mismo para no filtrar longitud exacta por tiempo
    crypto.timingSafeEqual(aa, aa);
    return false;
  }
  return crypto.timingSafeEqual(aa, bb);
}

function extractToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  // GET con ?token=… (PDF factura en pestaña nueva)
  if (req.method === 'GET' && req.query?.token && typeof req.query.token === 'string') {
    return req.query.token.trim();
  }
  return null;
}

function authenticateAdmin(req, res, next) {
  const token = extractToken(req);

  if (!token || token.length < 20) {
    return res.status(401).json({
      success: false,
      message: 'Acceso no autorizado. Iniciá sesión en el panel admin.',
    });
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret(), {
      algorithms: ['HS256'],
    });
    if (decoded.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Acceso denegado' });
    }
    req.admin = decoded;
    next();
  } catch {
    return res.status(401).json({
      success: false,
      message: 'Token inválido o expirado. Volvé a iniciar sesión.',
    });
  }
}

/**
 * Admin JWT opcional: si hay token válido, marca req.admin.
 * Si no hay token, sigue (rutas semi-públicas).
 */
function optionalAdmin(req, _res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return next();
  try {
    const decoded = jwt.verify(authHeader.slice(7).trim(), getJwtSecret(), {
      algorithms: ['HS256'],
    });
    if (decoded.role === 'admin') req.admin = decoded;
  } catch {
    /* ignore */
  }
  next();
}

module.exports = {
  authenticateAdmin,
  optionalAdmin,
  getJwtSecret,
  safeEqualString,
};
