const { Router } = require('express');
const multer = require('multer');
const upload = require('../middleware/upload');
const { authenticateAdmin } = require('../middleware/auth');

const router = Router();

router.post('/', authenticateAdmin, upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No se proporcionó imagen' });
    }
    const url = `/uploads/${req.file.filename}`;
    return res.json({ success: true, data: { url } });
  } catch (error) {
    console.error('Error al subir imagen:', error);
    return res.status(500).json({ success: false, message: 'Error al subir imagen' });
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
