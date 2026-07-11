const { Client, RemoteAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const sessionStore = require('./sessionStore');

let client = null;
let isReady = false;
let reconnectAttempts = 0;
let currentQR = null;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_DELAY = 10000;

const AUTO_REPLY_ENABLED = process.env.WHATSAPP_AUTO_REPLY === 'true';
const STORE_URL = process.env.STORE_URL || 'https://granjita-frontend.vercel.app';

console.log(`[WhatsApp] AUTO_REPLY_ENABLED = ${AUTO_REPLY_ENABLED} (env: "${process.env.WHATSAPP_AUTO_REPLY}")`);
console.log(`[WhatsApp] STORE_URL = ${STORE_URL}`);
console.log(`[WhatsApp] Versión: whatsapp-web.js v1.34.7 (GitHub latest)`);
console.log(`[WhatsApp] Auth: RemoteAuth (MongoDB)`);

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
    console.log(`[WhatsApp] Chrome encontrado: ${chromePath}`);
  }

  client = new Client({
    authStrategy: new RemoteAuth({
      store: sessionStore,
      dataPath: './.wwebjs_remote',
      backupSyncIntervalMs: 60000,
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

  client.on('error', (err) => {
    console.error('❌ WhatsApp error:', err.message);
    if (err.message.includes('EBR') || err.message.includes('detached') || err.message.includes('Protocol')) {
      console.error('❌ Error fatal, reconectando...');
      isReady = false;
      client = null;
      scheduleReconnect();
    }
  });

  client.on('loading_screen', (percent, message) => {
    console.log(`[WhatsApp] Cargando: ${percent}% - ${message}`);
  });

  client.on('change_state', (state) => {
    console.log(`[WhatsApp] Estado: ${state}`);
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
      console.log(`📱 AUTO_REPLY_ENABLED = ${AUTO_REPLY_ENABLED}`);

      if (!AUTO_REPLY_ENABLED) {
        console.log(`📱 [MODO PRUEBA] Se enviaría auto-reply pero está desactivado`);
        return;
      }

      const reply = generateGreeting();
      console.log(`📱 Enviando auto-reply a ${msg.from}...`);
      await msg.reply(reply);
      console.log(`✅ Auto-reply enviado a ${msg.from}`);
    } catch (error) {
      console.error(`❌ Error procesando mensaje de ${msg.from}:`, error.message);
      console.error(`❌ Stack:`, error.stack);
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

function formatCustomerConfirmation(order) {
  const itemsList = order.items
    .map(
      (item) =>
        `  ${item.quantity}x ${item.productName}` +
        (item.variant?.name ? ` (${item.variant.name})` : '') +
        (item.extras?.length > 0
          ? ` + ${item.extras.map((e) => e.name).join(', ')}`
          : '') +
        ` ... Q${item.subtotal.toLocaleString('es-GT')}`
    )
    .join('\n');

  const paymentText = order.paymentMethod === 'cash' ? '💵 Efectivo al delivery' : '💳 Pago con tarjeta';

  return (
    `╔══════════════════════════════╗\n` +
    `║   🐔 *CONFIRMACIÓN DE PEDIDO*  ║\n` +
    `║          *GRANJITA*              ║\n` +
    `╚══════════════════════════════╝\n\n` +
    `Hola *${order.customer.name}*, tu pedido fue recibido correctamente.\n\n` +
    `📋 *Tu pedido #${order._id.toString().slice(-6).toUpperCase()}:*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `${itemsList}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `💰 *Subtotal:* Q${order.subtotal.toLocaleString('es-GT')}\n` +
    `🚚 *Envío:* ${order.deliveryFee > 0 ? 'Q' + order.deliveryFee.toLocaleString('es-GT') : 'Gratis'}\n` +
    `💵 *TOTAL:* Q${order.total.toLocaleString('es-GT')}\n` +
    `💳 *Método de pago:* ${paymentText}\n` +
    `📍 *Dirección:* ${order.customer.address}\n\n` +
    `⏳ *Estado:* Pendiente\n\n` +
    `Te notificaremos cuando tu pedido sea confirmado y salga en camino. 🛵\n\n` +
    `Si tenés alguna consulta, escribinos por este mismo chat.\n` +
    `¡Gracias por preferirnos! 💚`
  );
}

function formatStatusUpdate(order) {
  const statusInfo = {
    pending: { emoji: '⏳', text: 'Pendiente', desc: 'Tu pedido está en cola, lo procesaremos pronto.' },
    confirmed: { emoji: '✅', text: 'Confirmado', desc: 'Tu pedido fue confirmado. ¡Preparándolo!' },
    preparing: { emoji: '👨‍🍳', text: 'En preparación', desc: 'Tu pedido se está preparando con cariño.' },
    in_transit: { emoji: '🛵', text: 'En camino', desc: '¡Tu pedido va en camino! Estate atento/a a la puerta.' },
    delivered: { emoji: '🎉', text: 'Entregado', desc: 'Tu pedido fue entregado. ¡Esperamos que lo disfrutes!' },
    cancelled: { emoji: '❌', text: 'Cancelado', desc: 'Lamentablemente tu pedido fue cancelado. Si tenés dudas, escribinos.' },
  };

  const info = statusInfo[order.orderStatus] || { emoji: '📋', text: order.orderStatus, desc: '' };
  const paymentText = order.paymentMethod === 'cash' ? '💵 Efectivo' : '💳 Tarjeta';

  return (
    `╔══════════════════════════════╗\n` +
    `║  ${info.emoji} *ACTUALIZACIÓN DE PEDIDO*  ║\n` +
    `║           *GRANJITA*            ║\n` +
    `╚══════════════════════════════╝\n\n` +
    `Hola *${order.customer.name}*, tu pedido #${order._id.toString().slice(-6).toUpperCase()} fue actualizado:\n\n` +
    `${info.emoji} *Estado:* ${info.text}\n` +
    `${info.desc}\n\n` +
    `💵 *TOTAL:* Q${order.total.toLocaleString('es-GT')}\n` +
    `💳 *Pago:* ${paymentText}\n\n` +
    `Si tenés alguna consulta, escribinos por este mismo chat.\n` +
    `¡Gracias por preferirnos! 💚`
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

async function sendCustomerConfirmation(order) {
  if (!client || !isReady) {
    console.warn('WhatsApp no disponible. Confirmación al cliente no enviada.');
    return;
  }

  const phone = order.customer?.phone;
  if (!phone) {
    console.warn('Teléfono del cliente no disponible. Omitiendo confirmación.');
    return;
  }

  try {
    const formattedNumber = `${phone}@c.us`;
    const message = formatCustomerConfirmation(order);
    await client.sendMessage(formattedNumber, message);
    console.log(`✅ Confirmación enviada al cliente ${phone} para pedido #${order._id.toString().slice(-6).toUpperCase()}`);
  } catch (error) {
    console.error(`Error enviando confirmación al cliente:`, error.message);
  }
}

async function sendOrderStatusUpdate(order) {
  if (!client || !isReady) {
    console.warn('WhatsApp no disponible. Notificación de estado no enviada.');
    return;
  }

  const phone = order.customer?.phone;
  if (!phone) {
    console.warn('Teléfono del cliente no disponible. Omitiendo notificación de estado.');
    return;
  }

  try {
    const formattedNumber = `${phone}@c.us`;
    const message = formatStatusUpdate(order);
    await client.sendMessage(formattedNumber, message);
    console.log(`✅ Notificación de estado enviada al cliente ${phone} para pedido #${order._id.toString().slice(-6).toUpperCase()} → ${order.orderStatus}`);
  } catch (error) {
    console.error(`Error enviando notificación de estado al cliente:`, error.message);
  }
}

async function startWhatsApp() {
  initWhatsApp();
}

async function sendTestMessage(toNumber) {
  if (!client || !isReady) {
    throw new Error('WhatsApp no está conectado');
  }
  const formattedNumber = `${toNumber}@c.us`;
  await client.sendMessage(formattedNumber, '🐔 *Mensaje de prueba* 🐔\n\nSi ves este mensaje, WhatsApp está funcionando correctamente en GRANJITA.');
  console.log(`✅ Mensaje de prueba enviado a ${toNumber}`);
}

module.exports = {
  initWhatsApp,
  sendOrderNotification,
  sendCustomerConfirmation,
  sendOrderStatusUpdate,
  sendTestMessage,
  startWhatsApp,
  getWhatsAppStatus,
  getCurrentQR,
};
