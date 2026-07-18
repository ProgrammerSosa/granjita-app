const { Router } = require('express');
const jwt = require('jsonwebtoken');
const { getJwtSecret, safeEqualString } = require('../middleware/auth');
const { rateLimit } = require('../middleware/security');

const router = Router();

const TOKEN_EXPIRY = process.env.JWT_EXPIRES_IN || '12h';

// Máx 15 intentos de login por IP cada 15 min
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: 'Demasiados intentos de login. Esperá 15 minutos.',
});

router.post('/login', loginLimiter, (req, res) => {
  try {
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
    if (!ADMIN_PASSWORD) {
      return res.status(503).json({
        success: false,
        message: 'Admin no configurado (ADMIN_PASSWORD en .env)',
      });
    }

    const { password } = req.body || {};
    if (!password || typeof password !== 'string') {
      return res.status(400).json({ success: false, message: 'La contraseña es obligatoria' });
    }

    if (password.length > 200) {
      return res.status(400).json({ success: false, message: 'Contraseña inválida' });
    }

    if (!safeEqualString(password, ADMIN_PASSWORD)) {
      return res.status(401).json({ success: false, message: 'Contraseña incorrecta' });
    }

    const token = jwt.sign(
      { role: 'admin', iat: Math.floor(Date.now() / 1000) },
      getJwtSecret(),
      { expiresIn: TOKEN_EXPIRY, algorithm: 'HS256' }
    );

    return res.json({
      success: true,
      data: { token, expiresIn: TOKEN_EXPIRY },
    });
  } catch (error) {
    console.error('Error en login:', error);
    return res.status(500).json({ success: false, message: 'Error al iniciar sesión' });
  }
});

router.post('/verify', rateLimit({ windowMs: 60_000, max: 60 }), (req, res) => {
  try {
    const { token } = req.body || {};
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ success: false, message: 'Token requerido' });
    }

    const decoded = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] });
    if (decoded.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Token inválido' });
    }

    return res.json({ success: true, data: { valid: true } });
  } catch {
    return res.status(401).json({ success: false, data: { valid: false } });
  }
});

module.exports = router;
