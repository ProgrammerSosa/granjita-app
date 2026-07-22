/**
 * WhatsApp Cloud API (Meta) — motor de envío ALTERNATIVO.
 * Se activa con WHATSAPP_PROVIDER=cloud. No usa navegador, ni QR, ni sesión:
 * son llamadas HTTPS a Meta → funciona en hosts free (Render).
 *
 * Variables de entorno:
 *   WA_CLOUD_TOKEN      = token de acceso de la app de Meta
 *   WA_CLOUD_PHONE_ID   = Phone Number ID del número conectado a la API
 *   WA_CLOUD_VERSION    = (opcional) versión del Graph API, ej. v21.0
 *   PUBLIC_BACKEND_URL  = URL pública del backend, para el link del PDF de factura
 *   OWNER_WHATSAPP      = número del dueño (avisos internos)
 *
 * Reutiliza los TEXTOS del motor actual (whatsappService) para no duplicar mensajes.
 * El menú entrante (1/2/3) es fase 2 (necesita webhook) — acá solo va el envío.
 */
const wa = require('./whatsappService'); // solo para reutilizar los builders de texto

const VERSION = process.env.WA_CLOUD_VERSION || 'v21.0';
const TOKEN = process.env.WA_CLOUD_TOKEN || '';
const PHONE_ID = process.env.WA_CLOUD_PHONE_ID || '';
const OWNER = process.env.OWNER_WHATSAPP || '';
const BACKEND_URL = (process.env.PUBLIC_BACKEND_URL || '').replace(/\/$/, '');

function isReady() {
  return Boolean(TOKEN && PHONE_ID);
}

function normalizePhone(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.length === 8) d = `502${d}`;
  if (d.startsWith('00')) d = d.slice(2);
  return d;
}

async function graph(payload) {
  if (!isReady()) {
    throw new Error('Cloud API sin configurar (faltan WA_CLOUD_TOKEN / WA_CLOUD_PHONE_ID)');
  }
  if (typeof fetch !== 'function') {
    throw new Error('fetch no disponible — se necesita Node 18+ para la Cloud API');
  }
  const url = `https://graph.facebook.com/${VERSION}/${PHONE_ID}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messaging_product: 'whatsapp', ...payload }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Cloud API ${res.status}: ${data?.error?.message || JSON.stringify(data)}`);
  }
  return data;
}

async function sendText(rawPhone, body) {
  const to = normalizePhone(rawPhone);
  if (!to) throw new Error('Teléfono vacío o inválido');
  return graph({ to, type: 'text', text: { body, preview_url: true } });
}

async function sendDocumentLink(rawPhone, link, filename, caption) {
  const to = normalizePhone(rawPhone);
  if (!to) throw new Error('Teléfono vacío o inválido');
  return graph({
    to,
    type: 'document',
    document: { link, filename, caption },
  });
}

/** URL pública del PDF de la factura (Meta la descarga y la manda como documento) */
function invoicePdfUrl(order) {
  const token = order.invoice?.publicToken;
  if (!BACKEND_URL || !token) return null;
  return `${BACKEND_URL}/api/orders/${order._id}/invoice/${token}`;
}

/** Manda la factura como PDF (documento). Si no hay link público, cae a texto. */
async function sendInvoice(order, captionExtra = '') {
  const phone = order.customer?.phone;
  const url = invoicePdfUrl(order);
  const inv = order.invoice?.number || '';
  if (url) {
    await sendDocumentLink(
      phone,
      url,
      `factura-${String(inv).replace(/[^\w.-]+/g, '_') || 'granjita'}.pdf`,
      `🧾 Tu factura ${inv} · La Granjita${captionExtra ? `\n${captionExtra}` : ''}`
    );
  } else {
    // Sin URL pública configurada → mandamos la factura en texto (fallback)
    await sendText(phone, wa.formatInvoiceText(order));
  }
}

// ───────── Interfaz que usa orderController ─────────

async function notifyOwner(text) {
  if (!OWNER || !isReady()) {
    console.warn('[WA Cloud] No se pudo avisar al dueño (OWNER o Cloud API sin config)');
    return;
  }
  try {
    await sendText(OWNER, text);
  } catch (e) {
    console.error('[WA Cloud] notifyOwner:', e.message);
  }
}

/** Estado "Nuevo": aviso corto al cliente (sin factura todavía) */
async function sendCustomerNewOrder(order) {
  await sendText(order.customer?.phone, wa.formatNewOrderCustomer(order));
}

/** Aviso "HAY PEDIDO" al dueño */
async function sendOrderNotification(order) {
  if (!OWNER) throw new Error('OWNER_WHATSAPP no configurado');
  await sendText(OWNER, wa.formatOrderMessage(order));
}

/** Cambio de estado → mensaje al cliente (+ factura en "En proceso") */
async function sendOrderStatusUpdate(order) {
  const phone = order.customer?.phone;
  await sendText(phone, wa.formatStatusUpdate(order));

  if (order.orderStatus === 'preparing') {
    await sendInvoice(order);
  }
  if (order.orderStatus === 'in_transit') {
    await notifyOwner(wa.formatInvoiceForDelivery(order));
  }
  if (order.orderStatus === 'delivered') {
    await sendText(phone, wa.formatDeliveredInvite(order));
  }
}

/** El admin editó el pedido → nuevo total al cliente */
async function sendOrderUpdatedToCustomer(order) {
  try {
    await sendText(order.customer?.phone, wa.formatOrderUpdatedCustomer(order));
  } catch (e) {
    console.warn('[WA Cloud] aviso modificación:', e.message);
  }
}

/** El proveedor avisa que falta algo */
async function sendMissingItemsToCustomer(order, payload = {}) {
  await sendText(order.customer?.phone, wa.formatMissingItems(order, payload));
}

/** Reenvío manual de comprobante (texto + PDF) */
async function sendCustomerConfirmation(order) {
  await sendText(order.customer?.phone, wa.formatStatusUpdate(order));
  await sendInvoice(order);
}

/** Reenvío del PDF de factura a un número */
async function sendInvoicePdfTo(rawPhone, order, caption) {
  const url = invoicePdfUrl(order);
  if (!url) {
    await sendText(rawPhone, wa.formatInvoiceText(order));
    return;
  }
  await sendDocumentLink(
    rawPhone,
    url,
    `factura-${String(order.invoice?.number || 'granjita').replace(/[^\w.-]+/g, '_')}.pdf`,
    caption || `🧾 Tu factura ${order.invoice?.number || ''}`
  );
}

function getWhatsAppStatus() {
  return {
    provider: 'cloud',
    connected: isReady(),
    configured: isReady(),
    sessionSaved: true,
    hasQR: false,
    note: 'WhatsApp Cloud API (Meta). No usa QR ni sesión local.',
  };
}

async function sendTestMessage(to) {
  await sendText(to || OWNER, '🐔 *Prueba Cloud API* — La Granjita está enviando por la API oficial de WhatsApp. ¡Funciona!');
}

// ── Stubs de compatibilidad (no aplican en Cloud API) ──
function startWhatsApp() {
  console.log('[WA Cloud] Motor Cloud API activo (WHATSAPP_PROVIDER=cloud). Sin QR ni navegador.');
}
function initWhatsApp() {}
function getCurrentQR() {
  return null;
}
function getPairingCode() {
  return null;
}
async function requestPairingCode() {
  throw new Error('El código/QR no aplica con la Cloud API (Meta).');
}
async function logoutWhatsApp() {
  return getWhatsAppStatus();
}
function hasSavedSession() {
  return true;
}
function getAuthPath() {
  return null;
}
async function sendAfterOrderMenu() {
  /* menú entrante = fase 2 (webhook + botones); no bloquea el envío */
}

module.exports = {
  notifyOwner,
  sendCustomerNewOrder,
  sendOrderNotification,
  sendOrderStatusUpdate,
  sendOrderUpdatedToCustomer,
  sendMissingItemsToCustomer,
  sendCustomerConfirmation,
  sendInvoicePdfTo,
  getWhatsAppStatus,
  sendTestMessage,
  startWhatsApp,
  initWhatsApp,
  getCurrentQR,
  getPairingCode,
  requestPairingCode,
  logoutWhatsApp,
  hasSavedSession,
  getAuthPath,
  sendAfterOrderMenu,
  // utilidades
  sendText,
  sendDocumentLink,
  isReady,
};
