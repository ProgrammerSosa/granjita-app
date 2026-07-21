const { Router } = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const upload = require('../middleware/upload');
const { authenticateAdmin } = require('../middleware/auth');
const { isConfigured, uploadBuffer } = require('../services/cloudinaryService');

const router = Router();

router.post('/', authenticateAdmin, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No se proporcionó imagen' });
    }

    // Cloudinary (permanente) — no se borra en redeploys de Render
    if (isConfigured()) {
      const result = await uploadBuffer(req.file.buffer);
      return res.json({ success: true, data: { url: result.secure_url } });
    }

    // Respaldo: disco local (efímero en Render) — para desarrollo o si aún no hay Cloudinary
    const uploadsDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    const ext = path.extname(req.file.originalname).toLowerCase();
    const name = `${crypto.randomBytes(16).toString('hex')}${ext}`;
    fs.writeFileSync(path.join(uploadsDir, name), req.file.buffer);
    return res.json({ success: true, data: { url: `/uploads/${name}` } });
  } catch (error) {
    console.error('Error al subir imagen:', error);
    return res.status(500).json({ success: false, message: error.message || 'Error al subir imagen' });
  }
});

router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, message: 'La imagen supera el tamaño máximo de 5MB' });
    }
    return res.status(400).json({ success: false, message: `Error al subir imagen: ${err.message}` });
  }
  if (err) {
    return res.status(400).json({ success: false, message: err.message || 'Error al subir imagen' });
  }
  next();
});

module.exports = router;
