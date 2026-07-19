const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

process.on('uncaughtException', (err) => {
  console.error('[FATAL] Excepcion no capturada:', err.message);
});
process.on('unhandledRejection', (err) => {
  console.error('[FATAL] Promesa rechazada:', err?.message || err);
});

const productRoutes = require('./src/routes/productRoutes');
const orderRoutes = require('./src/routes/orderRoutes');
const authRoutes = require('./src/routes/authRoutes');
const uploadRoutes = require('./src/routes/uploadRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use(helmet({ crossOriginResourcePolicies: { policy: 'cross-origin' } }));

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:3001,https://granjita-frontend.onrender.com').split(',').map(s => s.trim());
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Origen no permitido por CORS'));
    }
  },
  credentials: true,
}));

app.use(morgan('dev'));
app.use(express.json());
app.use('/uploads', express.static(uploadsDir));

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/upload', uploadRoutes);

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
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

// ===================== WHATSAPP SERVICE =====================

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const Order = require('./src/models/Order');

let client = null;
let isReady = false;
let reconnectAttempts = 0;
let currentQR = null;
let pairingCode = null;
let pairingExpires = null;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_DELAY = 10000;

const AUTO_REPLY_ENABLED = process.env.WHATSAPP_AUTO_REPLY === 'true';
const STORE_URL = process.env.STORE_URL || 'https://granjita-frontend.onrender.com/';
const BACKEND_URL = process.env.BACKEND_URL || 'https://granjita-app.onrender.com';
const OWNER_NUMBER = process.env.OWNER_WHATSAPP || '';

const customerStates = new Map();
let accessInfoSent = false;

function getMenu1(customerName) {
  return (
    `Hola! Bienvenido a GRANJITA\n\n` +
    `Mande *1* si quiere ordenar\n` +
    `Mande *2* si necesita atencion al cliente\n` +
    `Mande *4* si desea hacer un cambio a su pedido`
  );
}

function getMenu2(customerName) {
  return (
    `Gracias por su compra! ¿En que podemos ayudarle?\n\n` +
    `Mande *2* si necesita atencion al cliente\n` +
    `Mande *3* si desea hacer una orden nueva\n` +
    `Mande *4* si desea hacer un cambio a su pedido`
  );
}

function getWhatsAppStatus() {
  return {
    connected: isReady,
    reconnectAttempts,
    hasQR: !!currentQR,
    hasPairingCode: !!pairingCode,
  };
}

function getCurrentQR() {
  return currentQR;
}

function getPairingCode() {
  return { code: pairingCode, expires: pairingExpires };
}

function initWhatsApp() {
  if (client) return;

  const fs = require('fs');
  const path = require('path');

  const cacheBase = process.env.PUPPETEER_CACHE_DIR || path.join(process.cwd(), '.puppeteer');

  let chromePath = null;
  const possiblePaths = [
    path.join(cacheBase, 'chrome', 'win64-1045629', 'chrome-win32', 'chrome.exe'),
    path.join(cacheBase, 'chrome', 'win64-1045629', 'chrome-win', 'chrome.exe'),
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
  ];
  for (const p of possiblePaths) {
    try { if (fs.existsSync(p)) { chromePath = p; break; } } catch {}
  }

  const puppeteerConfig = {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
    ],
  };
  if (chromePath) {
    puppeteerConfig.executablePath = chromePath;
    console.log(`[WhatsApp] Chrome encontrado: ${chromePath}`);
  } else {
    console.log('[WhatsApp] Chrome no encontrado. Descargá Chromium con: pnpm exec puppeteer browsers install chrome');
  }

  client = new Client({
    authStrategy: new LocalAuth({
      dataPath: './.wwebjs_auth',
    }),
    puppeteer: puppeteerConfig,
  });

  client.on('qr', (qr) => {
    currentQR = qr;
    console.log('\n========================================');
    console.log(' Escaneá este código QR con WhatsApp:');
    console.log('========================================\n');
    qrcode.generate(qr, { small: true });
    console.log('\nEsperando escaneo...\n');
    console.log('QR también disponible en: GET /api/whatsapp/qr');
  });

  client.on('ready', async () => {
    console.log('WhatsApp conectado exitosamente');
    isReady = true;
    reconnectAttempts = 0;
    currentQR = null;
    pairingCode = null;
    pairingExpires = null;
    if (!accessInfoSent) {
      accessInfoSent = true;
      await sendAccessInfoToOwner();
    }
  });

  client.on('authenticated', () => {
    console.log('WhatsApp autenticado');
    currentQR = null;
    pairingCode = null;
    pairingExpires = null;
    isReady = true;
  });

  client.on('auth_failure', (msg) => {
    console.error('Error de autenticación WhatsApp:', msg);
    isReady = false;
    client = null;
    scheduleReconnect();
  });

  client.on('error', (err) => {
    console.error('WhatsApp error:', err.message);
    if (err.message.includes('EBR') || err.message.includes('detached') || err.message.includes('Protocol') || err.message.includes('Execution context')) {
      isReady = false;
      client = null;
      scheduleReconnect();
    }
  });

  client.on('loading_screen', (percent, message) => {
    console.log(`[WhatsApp] Cargando: ${percent}% - ${message}`);
  });

  client.on('disconnected', (reason) => {
    console.log('WhatsApp desconectado:', reason);
    isReady = false;
    client = null;
    scheduleReconnect();
  });

  client.on('message', async (msg) => {
    try {
      if (msg.fromMe) return;
      const chat = await msg.getChat();
      if (chat.isGroup) return;

      const body = msg.body.trim();
      const sender = msg.from;
      const contact = await msg.getContact();
      const customerName = contact.pushname || 'Cliente';

      console.log(`Mensaje recibido de ${sender} (${customerName}): "${body.substring(0, 80)}${body.length > 80 ? '...' : ''}"`);

      if (OWNER_NUMBER && sender === `${OWNER_NUMBER}@c.us` && /^(accesos|acceso|links|link)$/i.test(body)) {
        await msg.reply(getAccessInfoMessage());
        console.log('Mensaje de accesos enviado al dueño (por comando).');
        return;
      }

      if (!AUTO_REPLY_ENABLED) {
        console.log('[MODO PRUEBA] Auto-reply desactivado');
        return;
      }

      const state = customerStates.get(sender) || 'new';
      const text = body.trim();

      if (state === 'new') {
        await msg.reply(getMenu1(customerName));
        customerStates.set(sender, 'menu1');
        console.log(`Menu 1 enviado a ${sender}`);
        return;
      }

      if (state === 'menu1') {
        if (text === '1') {
          const msg1 =
            `Hola ${customerName}, aqui tenes nuestro catalogo completo:\n\n` +
            `${STORE_URL}\n\n` +
            `Envio a domicilio, pago en efectivo.\n` +
            `Si necesitas algo mas, escribinos!`;
          await msg.reply(msg1);
          console.log(`Opcion 1 seleccionada por ${sender}`);
          return;
        }

        if (text === '2') {
          await handleOption2(sender, customerName, msg);
          return;
        }

        if (text === '4') {
          await handleOption4Start(sender, customerName, msg);
          return;
        }

        await msg.reply(getMenu1(customerName));
        return;
      }

      if (state === 'menu2') {
        if (text === '2') {
          await handleOption2(sender, customerName, msg);
          return;
        }

        if (text === '3') {
          const msg3 =
            `Hola ${customerName}, aqui tenes nuestro catalogo completo:\n\n` +
            `${STORE_URL}\n\n` +
            `Envio a domicilio, pago en efectivo.\n` +
            `Si necesitas algo mas, escribinos!`;
          await msg.reply(msg3);
          console.log(`Opcion 3 (orden nueva) seleccionada por ${sender}`);
          return;
        }

        if (text === '4') {
          await handleOption4Start(sender, customerName, msg);
          return;
        }

        await msg.reply(getMenu2(customerName));
        return;
      }

      if (state === 'option2') {
        const waitMsg =
          `Espere por favor, nuestro proveedor le respondra en breve.`;
        await msg.reply(waitMsg);

        if (OWNER_NUMBER) {
          try {
            const followMsg =
              `Mensaje de ${customerName} (${sender.replace('@c.us', '')}):\n"${body}"\n\nResponda directamente por este chat.`;
            await client.sendMessage(`${OWNER_NUMBER}@c.us`, followMsg);
          } catch (err) {
            console.error('Error reenviando mensaje al owner:', err.message);
          }
        }
        return;
      }

      if (state === 'option4_waiting_id') {
        const searchId = text.replace(/[^a-zA-Z0-9]/g, '');
        const order = await Order.findOne({
          _id: { $regex: searchId, $options: 'i' },
        }).sort({ createdAt: -1 });

        if (!order) {
          await msg.reply(
            `No se encontro ningun pedido con "${text}".\n\n` +
            `Intentelo de nuevo o escriba *menu* para volver al menu principal.`
          );
          return;
        }

        if (order.customer.phone?.replace(/[^0-9]/g, '') !== sender.replace('@c.us', '')) {
          await msg.reply(
            `El pedido #${order._id.toString().slice(-6).toUpperCase()} no pertenece a este numero.\n\n` +
            `Intentelo de nuevo o escriba *menu* para volver al menu principal.`
          );
          return;
        }

        const itemsList = order.items
          .map((item, i) =>
            `${i + 1}. ${item.quantity}x ${item.productName}${item.variant?.name ? ` (${item.variant.name})` : ''} - Q${item.subtotal.toLocaleString('es-GT')}`
          )
          .join('\n');

        await msg.reply(
          `Pedido #${order._id.toString().slice(-6).toUpperCase()} encontrado:\n\n` +
          `${itemsList}\n\n` +
          `Total: Q${order.total.toLocaleString('es-GT')}\n` +
          `Estado: ${order.orderStatus}\n\n` +
          `Escriba *menu* para volver al menu principal.\n` +
          `Un momento, notificaremos al proveedor sobre su cambio.`
        );

        if (OWNER_NUMBER) {
          try {
            const notifyMsg =
              `Cambio en pedido #${order._id.toString().slice(-6).toUpperCase()}:\n` +
              `Cliente: ${customerName}\n` +
              `Numero: ${sender.replace('@c.us', '')}\n\n` +
              `El cliente desea hacer un cambio al pedido.\n` +
              `Modifique el pedido desde el panel de administracion.`;
            await client.sendMessage(`${OWNER_NUMBER}@c.us`, notifyMsg);
            console.log(`Notificacion de cambio enviada al owner para pedido #${order._id.toString().slice(-6).toUpperCase()}`);
          } catch (err) {
            console.error('Error notificando al owner:', err.message);
          }
        }

        customerStates.set(sender, 'menu2');
        return;
      }

    } catch (error) {
      console.error('Error procesando mensaje:', error.message);
    }
  });

  client.initialize().catch((err) => {
    console.error('Error inicializando WhatsApp:', err.message);
    isReady = false;
    client = null;
    scheduleReconnect();
  });
}

async function handleOption2(sender, customerName, msg) {
  await msg.reply(
    `Hola ${customerName}, no se preocupe! Un momento por favor, sera atendido por nuestro proveedor.`
  );
  customerStates.set(sender, 'option2');

  if (OWNER_NUMBER) {
    try {
      const notifyMsg =
        `Atencion al cliente:\n` +
        `Nombre: ${customerName}\n` +
        `Numero: ${sender.replace('@c.us', '')}\n\n` +
        `El cliente necesita atencion, respondale por este chat.`;
      await client.sendMessage(`${OWNER_NUMBER}@c.us`, notifyMsg);
      console.log(`Notificacion de atencion enviada al owner para ${sender}`);
    } catch (err) {
      console.error('Error notificando al owner:', err.message);
    }
  }
}

async function handleOption4Start(sender, customerName, msg) {
  await msg.reply(
    `Para hacer un cambio, por favor escriba el numero de su pedido (ej: ABC123).\n\n` +
    `Si no recuerda el numero, escriba su nombre completo.`
  );
  customerStates.set(sender, 'option4_waiting_id');
  console.log(`Opcion 4 - esperando ID de pedido de ${sender}`);
}

function scheduleReconnect() {
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.error(`Se alcanzó el máximo de ${MAX_RECONNECT_ATTEMPTS} intentos. Reiniciá el servidor manualmente.`);
    return;
  }

  reconnectAttempts++;
  const delay = RECONNECT_DELAY * reconnectAttempts;
  console.log(`Reintentando conexión en ${delay / 1000}s (intento ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);

  setTimeout(() => {
    console.log(`Intento de reconexión #${reconnectAttempts}...`);
    client = null;
    isReady = false;
    initWhatsApp();
  }, delay);
}

function formatOrderMessage(order) {
  const itemsList = order.items
    .map(
      (item) =>
        `  ${item.quantity}x ${item.productName}` +
        (item.variant?.name ? ` (${item.variant.name})` : '') +
        (item.extras?.length > 0
          ? ` + ${item.extras.map((e) => e.name).join(', ')}`
          : '') +
        ` ........... Q${item.subtotal.toLocaleString('es-GT')}`
    )
    .join('\n');

  const statusText = {
    pending: 'Pendiente',
    confirmed: 'Confirmado',
    preparing: 'En preparacion',
    in_transit: 'En camino',
    delivered: 'Entregado',
    cancelled: 'Cancelado',
  };

  const paymentText = order.paymentMethod === 'cash' ? 'Efectivo' : 'Tarjeta';

  return (
    `--- GRANJITA ---\n` +
    `NUEVO PEDIDO\n\n` +
    `Cliente: ${order.customer.name}\n` +
    `Telefono: ${order.customer.phone}\n` +
    `Direccion: ${order.customer.address}\n` +
    (order.customer.notes ? `Notas: ${order.customer.notes}\n` : '') +
    `\n--- PRODUCTOS ---\n${itemsList}\n` +
    `---------------------\n\n` +
    `Subtotal: Q${order.subtotal.toLocaleString('es-GT')}\n` +
    `Envio: ${order.deliveryFee > 0 ? 'Q' + order.deliveryFee.toLocaleString('es-GT') : 'Gratis'}\n` +
    `TOTAL: Q${order.total.toLocaleString('es-GT')}\n` +
    `Pago: ${paymentText}\n` +
    `Estado: ${statusText[order.orderStatus] || 'Pendiente'}\n\n` +
    `Pedido #${order._id.toString().slice(-6).toUpperCase()}`
  );
}

function getDenominations(amount) {
  const bills = [200, 100, 50, 20, 10, 5, 1];
  const parts = [];
  let remaining = Math.round(amount);
  for (const bill of bills) {
    const count = Math.floor(remaining / bill);
    if (count > 0) {
      parts.push(`${count}\u00D7 Q${bill}`);
      remaining -= count * bill;
    }
    if (remaining === 0) break;
  }
  return parts.join('  ');
}

function formatInvoiceMessage(order) {
  const itemsList = order.items
    .map((item) => {
      const name = item.productName + (item.variant?.name ? ` (${item.variant.name})` : '');
      return `\u2022 ${item.quantity}x ${name}` +
        (item.extras?.length > 0
          ? ` + ${item.extras.map((e) => e.name).join(', ')}`
          : '') +
        ` ` + '.'.repeat(Math.max(1, 20 - name.length)) +
        ` Q ${item.subtotal.toLocaleString('es-GT')}`;
    })
    .join('\n');

  const now = new Date();
  const fecha = now.toLocaleDateString('es-GT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const hora = now.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' });

  const paymentText = order.paymentMethod === 'cash' ? 'Efectivo al entregar' : 'Tarjeta';
  const total = order.total;

  return (
    `\uD83E\uDDFE *LA GRANJITA \u00B7 FACTURA*\n` +
    `Factura: TDA-${now.getFullYear()}-${order._id.toString().slice(-5).toUpperCase()}\n` +
    `Pedido: #${order._id.toString().slice(-6).toUpperCase()}\n` +
    `Fecha: ${fecha}, ${hora}\n\n` +

    `\uD83D\uDC64 *Cliente*\n` +
    `${order.customer.name}\n` +
    `\uD83D\uDCDE ${order.customer.phone}\n` +
    `\uD83D\uDCCD ${order.customer.address}\n` +
    (order.customer.notes ? `\uD83D\uDCDD ${order.customer.notes}\n` : '') +
    `\n` +

    `\uD83D\uDED2 *Detalle*\n${itemsList}\n\n` +

    `Subtotal: Q ${order.subtotal.toLocaleString('es-GT')}\n` +
    `Env\u00EDo: ${order.deliveryFee > 0 ? 'Q ' + order.deliveryFee.toLocaleString('es-GT') : 'Gratis'}\n` +
    `*TOTAL: Q ${total.toLocaleString('es-GT')}*\n\n` +

    `\uD83D\uDCB5 *Pago:* ${paymentText}\n` +
    (order.paymentMethod === 'cash'
      ? `Paga con: ${getDenominations(total)}  \u00B7  entreg\u00E1s Q ${total.toLocaleString('es-GT')}\n` +
        `Pago cabal \u2014 sin vuelto\n`
      : '') +
    `\n` +
    `_Gracias por preferirnos \uD83D\uDC14_`
  );
}

async function sendOrderNotification(order) {
  if (!OWNER_NUMBER) {
    console.warn('OWNER_WHATSAPP no configurado. Omitiendo notificacion.');
    return;
  }

  if (!client || !isReady) {
    console.warn('WhatsApp no disponible. La notificacion no se envio.');
    return;
  }

  try {
    const formattedNumber = `${OWNER_NUMBER}@c.us`;
    const message = formatOrderMessage(order);
    await client.sendMessage(formattedNumber, message);
    console.log(`Notificacion enviada al dueño para pedido #${order._id.toString().slice(-6).toUpperCase()}`);

    const customerPhone = order.customer.phone?.replace(/[^0-9]/g, '');
    if (customerPhone) {
      const customerWaId = `${customerPhone}@c.us`;
      customerStates.set(customerWaId, 'menu2');
      console.log(`Estado del cliente ${customerPhone} cambiado a menu2 (post-compra)`);
    }
  } catch (error) {
    console.error('Error enviando notificacion WhatsApp:', error.message);
  }
}

async function sendInvoiceToCustomer(order) {
  if (!client || !isReady) {
    console.warn('WhatsApp no disponible. La factura no se envio.');
    return false;
  }

  const phone = order.customer.phone?.replace(/[^0-9]/g, '');
  if (!phone) {
    console.warn('Telefono del cliente no valido.');
    return false;
  }

  try {
    const formattedNumber = `${phone}@c.us`;
    const message = formatInvoiceMessage(order);
    await client.sendMessage(formattedNumber, message);
    console.log(`Factura enviada al cliente ${phone} para pedido #${order._id.toString().slice(-6).toUpperCase()}`);
    return true;
  } catch (error) {
    console.error('Error enviando factura al cliente:', error.message);
    return false;
  }
}

async function sendOrderOnWayNotification(order) {
  if (!client || !isReady) {
    console.warn('WhatsApp no disponible. No se pudo enviar notificacion.');
    return false;
  }

  const phone = order.customer.phone?.replace(/[^0-9]/g, '');
  if (!phone) {
    console.warn('Telefono del cliente no valido.');
    return false;
  }

  try {
    const formattedNumber = `${phone}@c.us`;
    const message =
      `Su pedido #${order._id.toString().slice(-6).toUpperCase()} esta en camino!\n\n` +
      `Cliente: ${order.customer.name}\n` +
      `Direccion: ${order.customer.address}\n\n` +
      `Pronto estara con usted. Gracias por su compra!`;
    await client.sendMessage(formattedNumber, message);
    console.log(`Notificacion de envio enviada al cliente ${phone} para pedido #${order._id.toString().slice(-6).toUpperCase()}`);
    return true;
  } catch (error) {
    console.error('Error enviando notificacion de envio:', error.message);
    return false;
  }
}

function getAccessInfoMessage() {
  const store = STORE_URL.replace(/\/+$/, '');
  const backend = BACKEND_URL.replace(/\/+$/, '');
  const adminPassword = process.env.ADMIN_PASSWORD || '';

  return (
    `*La Granjita - accesos*\n\n` +
    `Tienda:\n` +
    `${store}\n\n` +
    `Admin:\n` +
    `${store}/admin/login\n` +
    `Contrasena: ${adminPassword}\n\n` +
    `1) Abra el enlace del Admin\n` +
    `2) Ingrese la contrasena\n` +
    `3) Gestione pedidos, productos y stock\n\n` +
    `Backend (tecnico):\n` +
    `${backend}/api/health\n\n` +
    `Nota: la primera carga puede tardar un poco (servidor free).`
  );
}

async function sendAccessInfoToOwner() {
  if (!OWNER_NUMBER) {
    console.warn('OWNER_WHATSAPP no configurado. No se envio el mensaje de accesos.');
    return false;
  }

  if (!client || !isReady) {
    console.warn('WhatsApp no disponible. No se envio el mensaje de accesos.');
    return false;
  }

  try {
    const formattedNumber = `${OWNER_NUMBER}@c.us`;
    await client.sendMessage(formattedNumber, getAccessInfoMessage());
    console.log('Mensaje de accesos enviado al dueño.');
    return true;
  } catch (error) {
    console.error('Error enviando mensaje de accesos al dueño:', error.message);
    return false;
  }
}

async function startWhatsApp() {
  initWhatsApp();
}

async function sendTestMessage(toNumber) {
  if (!client || !isReady) {
    throw new Error('WhatsApp no esta conectado');
  }
  const formattedNumber = `${toNumber}@c.us`;
  await client.sendMessage(formattedNumber, 'Mensaje de prueba - GRANJITA. Si ves este mensaje, WhatsApp esta funcionando correctamente.');
}

// ===================== WHATSAPP API ROUTES =====================

app.get('/api/whatsapp/status', (_req, res) => {
  res.json({
    success: true,
    data: getWhatsAppStatus(),
  });
});

app.get('/api/whatsapp/qr', (_req, res) => {
  if (!currentQR) {
    return res.status(400).json({
      success: false,
      message: 'No hay QR disponible. Espera a que se genere o revisa si ya esta conectado.',
    });
  }
  res.json({
    success: true,
    data: { qr: currentQR },
  });
});

app.post('/api/whatsapp/code', async (_req, res) => {
  if (isReady) {
    return res.status(400).json({
      success: false,
      message: 'WhatsApp ya esta conectado. No es necesario generar codigo.',
    });
  }
  if (!client) {
    return res.status(400).json({
      success: false,
      message: 'WhatsApp no esta inicializado. Espera un momento e intenta de nuevo.',
    });
  }
  try {
    const phone = _req.body?.phone || OWNER_NUMBER;
    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'Proporciona un numero de telefono o configura OWNER_WHATSAPP en el .env',
      });
    }
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const code = await client.requestPairingCode(cleanPhone);
    pairingCode = code;
    pairingExpires = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    console.log(`Codigo de vinculacion generado: ${code} para ${cleanPhone}`);
    res.json({
      success: true,
      data: {
        code,
        phone: cleanPhone,
        expires: pairingExpires,
        instructions: `Abre WhatsApp en tu celular > Dispositivos vinculados > Vincular dispositivo > Vincular con numero de telefono. Ingresa el codigo: ${code}`,
      },
    });
  } catch (error) {
    console.error('Error generando codigo de vinculacion:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error generando codigo: ' + error.message,
    });
  }
});

app.post('/api/whatsapp/logout', async (_req, res) => {
  try {
    const sessionDir = path.join(__dirname, '.wwebjs_auth');
    if (client) {
      try {
        await client.destroy();
      } catch (e) {
        // ignore destroy errors
      }
      client = null;
    }
    isReady = false;
    currentQR = null;
    pairingCode = null;
    pairingExpires = null;
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
      console.log('Sesion de WhatsApp eliminada.');
    }
    res.json({
      success: true,
      message: 'Sesion de WhatsApp eliminada. Reconectando...',
    });
    setTimeout(() => initWhatsApp(), 1000);
  } catch (error) {
    console.error('Error al cerrar sesion:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error al cerrar sesion: ' + error.message,
    });
  }
});

module.exports = {
  sendOrderNotification,
  sendInvoiceToCustomer,
  sendOrderOnWayNotification,
  sendAccessInfoToOwner,
  getAccessInfoMessage,
  sendTestMessage,
  startWhatsApp,
  getWhatsAppStatus,
  getCurrentQR,
};
