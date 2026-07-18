// ── Escudo anti-crash de Puppeteer/WhatsApp (ANTES de todo) ──
// Sin esto, un error de Chrome tras "ready" tira el proceso y nodemon dice "app crashed"
function isWaNoise(err) {
  const msg = String(err?.message || err?.stack || err || '');
  return /ProtocolError|Protocol error|Execution context|puppeteer|Target closed|Session closed|Navigation failed|browser has disconnected|Runtime\.callFunctionOn|frame was detached|WebSocket is not open|net::ERR|whatsapp|WWebJS|Evaluation failed|Cannot find context/i.test(
    msg
  );
}

if (!process.__tiendaGlobalGuards) {
  process.__tiendaGlobalGuards = true;
  process.on('unhandledRejection', (reason) => {
    if (isWaNoise(reason)) {
      console.error('[WhatsApp] rejection capturado (API sigue viva):', reason?.message || reason);
      return;
    }
    console.error('[Backend] unhandledRejection:', reason);
  });
  process.on('uncaughtException', (err) => {
    if (isWaNoise(err)) {
      console.error('[WhatsApp] exception capturado (API sigue viva):', err?.message || err);
      return; // NO process.exit
    }
    console.error('[Backend] uncaughtException:', err);
    // Tampoco matamos el proceso por errores de runtime no fatales:
    // el API de Express debe seguir sirviendo pedidos/catálogo.
  });
  process.on('warning', (w) => {
    if (isWaNoise(w)) return;
    console.warn('[Backend] warning:', w?.message || w);
  });
}

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const { assertSecurityConfig, rateLimit, isProd } = require('./src/middleware/security');
assertSecurityConfig();

const productRoutes = require('./src/routes/productRoutes');
const orderRoutes = require('./src/routes/orderRoutes');
const uploadRoutes = require('./src/routes/uploadRoutes');
const authRoutes = require('./src/routes/authRoutes');
const categoryRoutes = require('./src/routes/categoryRoutes');
const storeRoutes = require('./src/routes/storeRoutes');
const { seedDefaultCategories } = require('./src/controllers/categoryController');
const QRCode = require('qrcode');
const {
  startWhatsApp,
  getWhatsAppStatus,
  getCurrentQR,
  sendTestMessage,
  requestPairingCode,
  logoutWhatsApp,
} = require('./src/services/whatsappService');
const { authenticateAdmin } = require('./src/middleware/auth');

const app = express();
const PORT = process.env.PORT || 5000;

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Cabeceras de seguridad
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false, // panel HTML local simple
  })
);
app.disable('x-powered-by');

// CORS
const defaultOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
];
const envOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const allowedOrigins = [...new Set([...defaultOrigins, ...envOrigins])];

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true); // same-origin / Postman / server-to-server
      if (allowedOrigins.includes(origin)) return callback(null, true);
      // En desarrollo: localhost / 127.0.0.1 / devtunnels
      if (!isProd()) {
        if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
          return callback(null, true);
        }
        if (/\.use\.devtunnels\.ms$/i.test(new URL(origin).hostname)) {
          return callback(null, true);
        }
      }
      console.warn(`[CORS] bloqueado: ${origin}`);
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.options('*', cors());

if (!isProd()) {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Límite de body (anti payload abuse)
app.use(express.json({ limit: '512kb' }));
app.use(express.urlencoded({ extended: false, limit: '512kb' }));

// Rate limit global API (por IP)
app.use('/api/', rateLimit({ windowMs: 60_000, max: 180, message: 'Demasiadas peticiones. Esperá un minuto.' }));

app.use('/uploads', express.static(uploadsDir, {
  fallthrough: true,
  setHeaders(res) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=86400');
  },
}));

app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/store', storeRoutes);

/** Health mínimo (sin secretos ni URLs internas en prod) */
app.get('/api/health', (_req, res) => {
  const waStatus = getWhatsAppStatus();
  const payload = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    whatsapp: { connected: Boolean(waStatus.connected) },
  };
  if (!isProd()) {
    payload.whatsapp.sessionSaved = waStatus.sessionSaved;
    payload.whatsapp.hasQR = waStatus.hasQR;
  }
  res.json(payload);
});

/** Estado WA público: solo connected (sin paths ni pairing) */
app.get('/api/whatsapp/status', (_req, res) => {
  const s = getWhatsAppStatus();
  res.json({
    success: true,
    data: {
      connected: Boolean(s.connected),
      sessionSaved: Boolean(s.sessionSaved),
    },
  });
});

/** Admin: estado completo WA */
app.get('/api/whatsapp/admin/status', authenticateAdmin, (_req, res) => {
  res.json({ success: true, data: getWhatsAppStatus() });
});

async function sendAdminQr(_req, res) {
  const qr = getCurrentQR();
  const status = getWhatsAppStatus();
  if (status.connected) {
    return res.json({ success: true, connected: true, qr: null, qrImage: null });
  }
  if (!qr) {
    return res.status(404).json({
      success: false,
      message: status.sessionSaved
        ? 'Reconectando con sesión guardada…'
        : 'QR aún no generado. Esperá unos segundos.',
      connected: false,
      sessionSaved: status.sessionSaved,
    });
  }
  try {
    const qrImage = await QRCode.toDataURL(qr, { width: 280, margin: 2 });
    return res.json({ success: true, connected: false, qrImage });
  } catch {
    return res.json({ success: true, connected: false, qrImage: null });
  }
}

/** Admin: QR (nunca público — evita hijack de sesión WA) */
app.get('/api/whatsapp/admin/qr', authenticateAdmin, sendAdminQr);
app.get('/api/whatsapp/qr', authenticateAdmin, sendAdminQr);

app.post('/api/whatsapp/admin/pairing-code', authenticateAdmin, async (req, res) => {
  try {
    const phone = req.body?.phone || process.env.OWNER_WHATSAPP;
    const data = await requestPairingCode(phone);
    res.json({
      success: true,
      data,
      message:
        'En el celular: WhatsApp → Dispositivos vinculados → Vincular con número → escribí el código.',
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message || 'Error al pedir código' });
  }
});

app.post('/api/whatsapp/admin/logout', authenticateAdmin, async (req, res) => {
  try {
    const deleteSession = Boolean(req.body?.deleteSession);
    const data = await logoutWhatsApp({ deleteSession });
    res.json({
      success: true,
      data,
      message: deleteSession
        ? 'Desvinculado y sesión borrada.'
        : 'Desvinculado.',
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Error al desvincular' });
  }
});

/** Solo admin — nunca público */
app.post('/api/whatsapp/admin/test', authenticateAdmin, async (req, res) => {
  const ownerNumber = req.body?.phone || process.env.OWNER_WHATSAPP;
  if (!ownerNumber) {
    return res.status(400).json({ success: false, message: 'OWNER_WHATSAPP no configurado' });
  }
  try {
    await sendTestMessage(ownerNumber);
    res.json({ success: true, message: `Prueba enviada a ${ownerNumber}` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Error' });
  }
});

// Bloquear endpoints WA públicos viejos
app.get('/api/whatsapp/test', (_req, res) => {
  res.status(401).json({
    success: false,
    message: 'Endpoint protegido. Usá POST /api/whatsapp/admin/test con token admin.',
  });
});

/** Raíz: en producción no exponer QR; en dev solo si WA_PUBLIC_PANEL=true */
app.get('/', async (_req, res) => {
  if (isProd() || process.env.WA_PUBLIC_PANEL === 'false') {
    return res.status(404).json({
      success: false,
      message: 'API La Granjita. Panel WhatsApp solo en Admin (login requerido).',
    });
  }

  const status = getWhatsAppStatus();
  const qr = getCurrentQR();
  let qrSection = '';
  if (status.connected) {
    qrSection =
      '<div class="connected"><span class="dot green"></span> WhatsApp CONECTADO</div>';
  } else if (qr) {
    try {
      const dataUrl = await QRCode.toDataURL(qr, { width: 260, margin: 2 });
      qrSection =
        '<div class="qr-box"><img src="' +
        dataUrl +
        '" width="260" height="260" alt="QR" /></div><p class="hint">Solo en desarrollo. En producción usá Admin → WhatsApp.</p>';
    } catch {
      qrSection = '<div class="status-line error">Error QR</div>';
    }
  } else {
    qrSection = '<div class="status-line">Esperando… o usá /admin/whatsapp</div>';
  }

  res.type('html').send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>WA Dev</title>
<style>body{background:#0d1117;color:#c9d1d9;font-family:system-ui;padding:24px;text-align:center}.connected{color:#3fb950;font-weight:700}.qr-box{background:#fff;display:inline-block;padding:12px;border-radius:12px;margin:12px}.hint{color:#8b949e;font-size:13px}</style>
</head><body><h1 style="color:#f97316">La Granjita API</h1>${qrSection}
<p class="hint">Preferí el panel admin protegido. Desactivá este panel con WA_PUBLIC_PANEL=false</p>
</body></html>`);
});

// 404 API
app.use('/api', (_req, res) => {
  res.status(404).json({ success: false, message: 'Ruta no encontrada' });
});

app.use((err, _req, res, _next) => {
  console.error('Error no manejado:', err?.message || err);
  res.status(500).json({
    success: false,
    message: isProd() ? 'Error interno del servidor' : err?.message || 'Error interno',
  });
});

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('Conectado a MongoDB');
    await seedDefaultCategories();
    app.listen(PORT, () => {
      console.log(`Servidor corriendo en puerto ${PORT}`);
      console.log(`Health: http://127.0.0.1:${PORT}/api/health`);
      // WhatsApp en segundo plano: si falla Puppeteer, la API no se cae
      setImmediate(() => {
        startWhatsApp().catch((e) => {
          console.error('[WhatsApp] no crítico:', e?.message || e);
        });
      });
    });
  })
  .catch((err) => {
    console.error('Error conectando a MongoDB:', err.message);
    process.exit(1);
  });
