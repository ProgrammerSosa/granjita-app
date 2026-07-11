const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

let client = null;
let isReady = false;
let reconnectAttempts = 0;
let currentQR = null;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_DELAY = 10000;

const AUTO_REPLY_ENABLED = process.env.WHATSAPP_AUTO_REPLY === 'true';
const STORE_URL = process.env.STORE_URL || 'http://localhost:3000';

function getWhatsAppStatus() {
  return {
    connected: isReady,
    reconnectAttempts,
    hasQR: !!currentQR,
  };
}

function getCurrentQR() {
  return currentQR;
}

function initWhatsApp() {
  if (client) return;

  const fs = require('fs');
  const path = require('path');

  let chromePath;
  const cacheBase = process.env.PUPPETEER_CACHE_DIR || path.join(process.cwd(), '.puppeteer');

  function findChrome(dir) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isFile() && entry.name === 'chrome') return fullPath;
        if (entry.isDirectory()) {
          const found = findChrome(fullPath);
          if (found) return found;
        }
      }
    } catch {}
    return null;
  }

  chromePath = findChrome(cacheBase);

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
    console.log(`🔍 Chrome encontrado en: ${chromePath}`);
  }

  client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: puppeteerConfig,
  });

  client.on('qr', (qr) => {
    currentQR = qr;
    console.log('\n========================================');
    console.log(' Escaneá este código QR con WhatsApp:');
    console.log('========================================\n');
    qrcode.generate(qr, { small: true });
    console.log('\nEsperando escaneo...\n');
    console.log(`📱 QR también disponible en: GET /api/whatsapp/qr`);
  });

  client.on('ready', () => {
    console.log('✅ WhatsApp conectado exitosamente');
    isReady = true;
    reconnectAttempts = 0;
  });

  client.on('authenticated', () => {
    console.log('✅ WhatsApp autenticado');
    currentQR = null;
  });

  client.on('auth_failure', (msg) => {
    console.error('❌ Error de autenticación WhatsApp:', msg);
    isReady = false;
    client = null;
    scheduleReconnect();
  });

  client.on('disconnected', (reason) => {
    console.log('⚠️ WhatsApp desconectado:', reason);
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
      console.log(`📱 Mensaje recibido de ${msg.from}: "${body.substring(0, 80)}${body.length > 80 ? '...' : ''}"`);

      if (!AUTO_REPLY_ENABLED) {
        console.log(`📱 [MODO PRUEBA] Se enviaría auto-reply pero está desactivado`);
        return;
      }

      const reply = generateGreeting();
      await msg.reply(reply);
      console.log(`✅ Auto-reply enviado a ${msg.from}`);
    } catch (error) {
      console.error(`❌ Error procesando mensaje de ${msg.from}:`, error.message);
    }
  });

  client.initialize();
}

function scheduleReconnect() {
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.error(`❌ Se alcanzó el máximo de ${MAX_RECONNECT_ATTEMPTS} intentos de reconexión. Reiniciá el servidor manualmente.`);
    return;
  }

  reconnectAttempts++;
  const delay = RECONNECT_DELAY * reconnectAttempts;
  console.log(`🔄 Reintentando conexión WhatsApp en ${delay / 1000}s (intento ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);

  setTimeout(() => {
    console.log(`🔄 Intento de reconexión #${reconnectAttempts}...`);
    client = null;
    isReady = false;
    initWhatsApp();
  }, delay);
}

function generateGreeting() {
  return (
    `🐔 *¡Hola! Bienvenido a GRANJITA* 🐔\n\n` +
    `🌟 *Le deseamos un lindo día* 🌟\n\n` +
    `Si desea ordenar para domicilio, haga clic en el siguiente link:\n\n` +
    `${STORE_URL}\n\n` +
    `📦 *Catálogo completo*\n` +
    `🚚 *Envío a domicilio*\n` +
    `💵 *Pago en efectivo o tarjeta*\n\n` +
    `¡Gracias por preferirnos! 💚`
  );
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

  const statusEmoji = {
    pending: '⏳',
    confirmed: '✅',
    preparing: '👨‍🍳',
    in_transit: '🛵',
    delivered: '🎉',
    cancelled: '❌',
  };

  const paymentText = order.paymentMethod === 'cash' ? '💵 Efectivo' : '💳 Tarjeta';

  return (
    `╔════════════════════════╗\n` +
    `║  🛵 *NUEVO PEDIDO* 🛵  ║\n` +
    `║      *GRANJITA*        ║\n` +
    `╚════════════════════════╝\n\n` +
    `👤 *Cliente:* ${order.customer.name}\n` +
    `📱 *Teléfono:* ${order.customer.phone}\n` +
    `📍 *Dirección:* ${order.customer.address}\n` +
    (order.customer.notes ? `📝 *Notas:* ${order.customer.notes}\n` : '') +
    `\n━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `📦 *PRODUCTOS:*\n${itemsList}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `💰 *Subtotal:* Q${order.subtotal.toLocaleString('es-GT')}\n` +
    `🚚 *Envío:* ${order.deliveryFee > 0 ? 'Q' + order.deliveryFee.toLocaleString('es-GT') : 'Gratis'}\n` +
    `💵 *TOTAL:* Q${order.total.toLocaleString('es-GT')}\n` +
    `💳 *Pago:* ${paymentText}\n` +
    `${statusEmoji[order.orderStatus] || '⏳'} *Estado:* ${getStatusText(order.orderStatus)}\n\n` +
    `🆔 Pedido #${order._id.toString().slice(-6).toUpperCase()}`
  );
}

function getStatusText(status) {
  const map = {
    pending: 'Pendiente',
    confirmed: 'Confirmado',
    preparing: 'En preparación',
    in_transit: 'En camino',
    delivered: 'Entregado',
    cancelled: 'Cancelado',
  };
  return map[status] || status;
}

async function sendOrderNotification(order) {
  const ownerNumber = process.env.OWNER_WHATSAPP;
  if (!ownerNumber) {
    console.warn('OWNER_WHATSAPP no configurado. Omitiendo notificación.');
    return;
  }

  if (!client || !isReady) {
    console.warn('WhatsApp no disponible. La notificación no se envió.');
    return;
  }

  try {
    const formattedNumber = `${ownerNumber}@c.us`;
    const message = formatOrderMessage(order);
    await client.sendMessage(formattedNumber, message);
    console.log(`✅ Notificación enviada al dueño para pedido #${order._id.toString().slice(-6).toUpperCase()}`);
  } catch (error) {
    console.error('Error enviando notificación WhatsApp:', error.message);
  }
}

async function startWhatsApp() {
  initWhatsApp();
}

module.exports = {
  initWhatsApp,
  sendOrderNotification,
  startWhatsApp,
  getWhatsAppStatus,
  getCurrentQR,
};
