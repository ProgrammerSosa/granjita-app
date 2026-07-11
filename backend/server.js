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

app.get('/api/whatsapp/status', (_req, res) => {
  const status = getWhatsAppStatus();
  res.json(status);
});

app.get('/', async (_req, res) => {
  const status = getWhatsAppStatus();
  const qr = getCurrentQR();

  let qrSection = '';
  if (status.connected) {
    qrSection = '<div class="connected"><span class="dot green"></span> WhatsApp CONECTADO - La tienda esta funcionando</div>';
  } else if (qr) {
    try {
      const dataUrl = await QRCode.toDataURL(qr, { width: 260, margin: 2 });
      qrSection = '<div class="qr-box"><img src="' + dataUrl + '" width="260" height="260" alt="QR" /></div><div class="hint">Escanea: WhatsApp &gt; Dispositivos vinculados &gt; Vincular dispositivo</div>';
    } catch (e) {
      qrSection = '<div class="status-line error">Error generando QR</div>';
    }
  } else {
    qrSection = '<div class="status-line">Esperando QR...</div>';
  }

  const logLines = [
    '[SYS] Granjita Backend v1.0',
    '[DB]  MongoDB ' + (status.connected ? 'conectado' : 'verificando...'),
    '[WA]  WhatsApp ' + (status.connected ? 'conectado' : 'desconectado'),
    status.hasQR ? '[QR]  QR listo para escanear' : status.connected ? '[QR]  No necesario - ya conectado' : '[QR]  Generando...',
    '[SYS] Auto-refresh cada 30s',
  ];

  const logHTML = logLines.map(l => {
    let cls = 'log-line';
    if (l.includes('conectado') && !l.includes('desconectado')) cls += ' ok';
    if (l.includes('desconectado') || l.includes('error')) cls += ' warn';
    return '<div class="' + cls + '">' + l + '</div>';
  }).join('');

  res.send('<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Granjita - Panel</title><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#0d1117;color:#c9d1d9;font-family:"Courier New",monospace;min-height:100vh;padding:20px}.header{text-align:center;padding:20px 0;border-bottom:1px solid #21262d;margin-bottom:20px}.header h1{color:#58a6ff;font-size:1.4em}.header small{color:#8b949e}.panel{max-width:600px;margin:0 auto}.terminal{background:#161b22;border:1px solid #30363d;border-radius:8px;padding:16px;margin:16px 0;max-height:160px;overflow-y:auto}.log-line{color:#8b949e;font-size:0.85em;padding:2px 0}.log-line.ok{color:#3fb950}.log-line.warn{color:#d29922}.qr-section{text-align:center;padding:20px}.qr-box{background:white;padding:16px;border-radius:12px;display:inline-block;margin:12px 0}img{display:block}.connected{color:#3fb950;font-size:1.1em;padding:20px;text-align:center}.dot{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:8px}.dot.green{background:#3fb950;box-shadow:0 0 8px #3fb950}.status-line{color:#8b949e;text-align:center;padding:16px;font-size:0.95em}.status-line.error{color:#f85149}.hint{color:#8b949e;font-size:0.8em;text-align:center;margin-top:8px}.footer{text-align:center;color:#484f58;font-size:0.75em;padding:20px 0;border-top:1px solid #21262d;margin-top:20px}</style><script>setTimeout(()=>location.reload(),30000)</script></head><body><div class="panel"><div class="header"><h1>GRANJITA</h1><small>Panel de Control WhatsApp</small></div><div class="qr-section">' + qrSection + '</div><div class="terminal"><div class="log-line" style="color:#58a6ff">--- Log del Sistema ---</div>' + logHTML + '</div><div class="footer">Auto-refresh 30s | Puerto ' + (process.env.PORT || 5000) + '</div></div></body></html>');
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
