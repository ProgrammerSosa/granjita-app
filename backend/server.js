const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const productRoutes = require('./src/routes/productRoutes');
const orderRoutes = require('./src/routes/orderRoutes');
const uploadRoutes = require('./src/routes/uploadRoutes');
const authRoutes = require('./src/routes/authRoutes');
const QRCode = require('qrcode');
const { startWhatsApp, getWhatsAppStatus, getCurrentQR } = require('./src/services/whatsappService');

const app = express();
const PORT = process.env.PORT || 5000;

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: function (origin, callback) {
    const allowed = (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',').map(s => s.trim());
    if (!origin || allowed.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true);
    }
  },
}));
app.use(morgan('dev'));
app.use(express.json());

app.use('/uploads', express.static(uploadsDir));

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/upload', uploadRoutes);

app.get('/api/health', (_req, res) => {
  const waStatus = getWhatsAppStatus();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    whatsapp: {
      connected: waStatus.connected,
      reconnectAttempts: waStatus.reconnectAttempts,
      hasQR: waStatus.hasQR,
    },
  });
});

app.get('/api/whatsapp/qr', async (_req, res) => {
  const qr = getCurrentQR();
  if (!qr) {
    const status = getWhatsAppStatus();
    if (status.connected) {
      return res.send('<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>WhatsApp Conectado</title><style>body{display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;font-family:sans-serif;background:#25D366;color:white;text-align:center}.box{padding:40px;border-radius:16px;background:rgba(255,255,255,0.15)}</style></head><body><div class="box"><h1>WhatsApp Conectado</h1><p>La tienda ya esta funcionando</p><p>Esta pagina se puede cerrar</p></div></body></html>');
    }
    return res.send('<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>WhatsApp QR</title><style>body{display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;font-family:sans-serif;background:#111b21;color:white;text-align:center}p{color:#8696a0}</style><script>setTimeout(()=>location.reload(),30000)</script></head><body><h2>Esperando QR...</h2><p>Se actualiza cada 30 segundos</p></body></html>');
  }
  try {
    const dataUrl = await QRCode.toDataURL(qr, { width: 300, margin: 2 });
    res.send('<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Escanear QR - WhatsApp</title><style>body{display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;font-family:sans-serif;background:#111b21;color:white;text-align:center;flex-direction:column}.box{padding:30px;border-radius:16px;background:rgba(255,255,255,0.08)}#qr{background:white;padding:16px;border-radius:12px;display:inline-block}h1{font-size:1.3em;margin-bottom:8px}p{color:#8696a0;font-size:0.9em;margin-top:12px}small{color:#8696a0}img{display:block}</style><script>setTimeout(()=>location.reload(),30000)</script></head><body><div class="box"><h1>Escanea con WhatsApp</h1><p>WhatsApp &gt; Menu &gt; Dispositivos vinculados &gt; Vincular dispositivo</p><div id="qr"><img src="' + dataUrl + '" width="300" height="300" alt="QR Code" /></div><p><small>Se actualiza cada 30 segundos. Si no funciona, recarga la pagina.</small></p></div></body></html>');
  } catch (err) {
    console.error('Error generando QR:', err);
    res.status(500).send('Error generando QR');
  }
});

app.use((err, _req, res, _next) => {
  console.error('Error no manejado:', err);
  res.status(500).json({ success: false, message: 'Error interno del servidor' });
});

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Conectado a MongoDB');
    app.listen(PORT, () => {
      console.log(`Servidor corriendo en puerto ${PORT}`);
      startWhatsApp();
    });
  })
  .catch((err) => {
    console.error('Error conectando a MongoDB:', err.message);
    process.exit(1);
  });
