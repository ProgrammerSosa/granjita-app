const { Router } = require('express');
const jwt = require('jsonwebtoken');

const router = Router();

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const JWT_SECRET = process.env.JWT_SECRET || 'granjita_fallback_secret';
const TOKEN_EXPIRY = '24h';

router.post('/login', (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ success: false, message: 'La contraseña es obligatoria' });
    }

    if (password !== ADMIN_PASSWORD) {
      return res.status(401).json({ success: false, message: 'Contraseña incorrecta' });
    }

    const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });

    return res.json({
      success: true,
      data: { token, expiresIn: TOKEN_EXPIRY },
    });
  } catch (error) {
    console.error('Error en login:', error);
    return res.status(500).json({ success: false, message: 'Error al iniciar sesión' });
  }
});

router.post('/verify', (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ success: false, message: 'Token requerido' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    if (decoded.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Token inválido' });
    }

    return res.json({ success: true, data: { valid: true } });
  } catch (error) {
    return res.status(401).json({ success: false, data: { valid: false } });
  }
});

module.exports = router;
