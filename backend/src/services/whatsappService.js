const { Client, LocalAuth, List, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const { generateInvoicePdf } = require('./invoicePdfService');

let client = null;
let isReady = false;
let reconnectAttempts = 0;
let currentQR = null;
/** Código de emparejamiento (alternativa al QR) */
let currentPairingCode = null;
let pairingPhone = null;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_DELAY = 10000;

function getAuthPath() {
  return (
    process.env.WA_AUTH_PATH ||
    path.join(require('os').homedir(), '.tienda-wwebjs-auth')
  );
}

/** Carpeta de sesión LocalAuth (clientId = tienda) */
function getSessionDir() {
  return path.join(getAuthPath(), 'session-tienda');
}

function hasSavedSession() {
  try {
    const dir = getSessionDir();
    if (!fs.existsSync(dir)) return false;
    const files = fs.readdirSync(dir);
    return files.length > 0;
  } catch {
    return false;
  }
}

const AUTO_REPLY_ENABLED = process.env.WHATSAPP_AUTO_REPLY === 'true';
// Solo primer mensaje del día por contacto (default: true)
const FIRST_MSG_OF_DAY =
  process.env.WHATSAPP_FIRST_MSG_OF_DAY !== 'false';
const STORE_URL = process.env.STORE_URL || 'https://granjita-frontend.onrender.com';

// Sesiones de menú WhatsApp por teléfono
// { "502...": { greetedDay, state, lastOrderId, lastOrderCode } }
const SESSION_PATH = path.join(__dirname, '..', '..', 'data', 'wa-sessions.json');
const OWNER_WHATSAPP = process.env.OWNER_WHATSAPP || '';

// Estados: main_menu | after_order | await_modification | idle
const STATE = {
  MAIN: 'main_menu',
  AFTER_ORDER: 'after_order',
  AWAIT_MOD: 'await_modification',
  IDLE: 'idle',
};

console.log(`[WhatsApp] AUTO_REPLY_ENABLED = ${AUTO_REPLY_ENABLED}`);
console.log(`[WhatsApp] FIRST_MSG_OF_DAY = ${FIRST_MSG_OF_DAY}`);
console.log(`[WhatsApp] STORE_URL = ${STORE_URL}`);
console.log(`[WhatsApp] Auth: LocalAuth`);

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function phoneFromId(fromId) {
  const s = String(fromId || '');
  // @lid NO es un teléfono — no extraer dígitos (son IDs internos de WA)
  if (/@lid$/i.test(s)) return '';
  return s
    .replace(/@c\.us$/i, '')
    .replace(/@s\.whatsapp\.net$/i, '')
    .replace(/\D/g, '');
}

function isLidId(id) {
  return /@lid$/i.test(String(id || ''));
}

function isIgnorableChatId(id) {
  const s = String(id || '');
  return (
    /status@broadcast/i.test(s) ||
    /@broadcast$/i.test(s) ||
    /@newsletter$/i.test(s) ||
    /@g\.us$/i.test(s)
  );
}

/**
 * Resuelve el teléfono real del remitente.
 * WhatsApp nuevo manda a veces `123...@lid` en vez de `502...@c.us`.
 */
async function resolveSenderPhone(msg) {
  // 1) from clásico @c.us
  let phone = phoneFromId(msg.from);
  if (phone && phone.length >= 8 && phone.length <= 15) return phone;

  // 2) author (por si viene en grupos / lid)
  phone = phoneFromId(msg.author);
  if (phone && phone.length >= 8 && phone.length <= 15) return phone;

  // 3) Contact.number
  try {
    const contact = await msg.getContact();
    const n = String(contact?.number || contact?.id?.user || '').replace(/\D/g, '');
    // Contact con @lid suele traer userid = lid numérico (muy largo) → no es teléfono
    if (n && n.length >= 8 && n.length <= 15 && !isLidId(contact?.id?._serialized)) {
      return n;
    }
    // A veces id es @c.us aunque from sea @lid
    const fromContact = phoneFromId(contact?.id?._serialized);
    if (fromContact && fromContact.length >= 8 && fromContact.length <= 15) {
      return fromContact;
    }
  } catch (e) {
    console.warn('[WhatsApp] getContact:', e.message);
  }

  // 4) API lid → phone (whatsapp-web.js 1.34+)
  if (client && typeof client.getContactLidAndPhone === 'function') {
    const ids = [msg.from, msg.author].filter(Boolean);
    try {
      const pairs = await client.getContactLidAndPhone(ids);
      for (const p of pairs || []) {
        const pn = phoneFromId(p?.pn) || String(p?.pn || '').replace(/\D/g, '');
        if (pn && pn.length >= 8 && pn.length <= 15) return pn;
      }
    } catch (e) {
      console.warn('[WhatsApp] getContactLidAndPhone:', e.message);
    }
  }

  // 5) Fallback: usar el lid como clave de sesión (el reply igual funciona)
  if (isLidId(msg.from)) {
    return `lid:${String(msg.from).replace(/@lid$/i, '')}`;
  }
  return phoneFromId(msg.from) || String(msg.from || '').replace(/@.*$/, '');
}

function loadSessions() {
  try {
    if (!fs.existsSync(SESSION_PATH)) return {};
    return JSON.parse(fs.readFileSync(SESSION_PATH, 'utf8') || '{}');
  } catch {
    return {};
  }
}

function saveSessions(all) {
  try {
    const dir = path.dirname(SESSION_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    // Limpiar sesiones de otros días (mantener solo hoy)
    const today = todayKey();
    const clean = {};
    for (const [phone, s] of Object.entries(all)) {
      if (s && s.greetedDay === today) clean[phone] = s;
    }
    fs.writeFileSync(SESSION_PATH, JSON.stringify(clean, null, 2), 'utf8');
  } catch (e) {
    console.error('[WhatsApp] Error guardando sesiones:', e.message);
  }
}

function getSession(phone) {
  const all = loadSessions();
  return all[phone] || null;
}

function setSession(phone, patch) {
  const all = loadSessions();
  const prev = all[phone] || {};
  all[phone] = {
    ...prev,
    ...patch,
    phone,
    updatedAt: new Date().toISOString(),
  };
  saveSessions(all);
  return all[phone];
}

function isFirstContactToday(phone) {
  const s = getSession(phone);
  return !s || s.greetedDay !== todayKey();
}

/** Filas del List Message (id = 1/2/3) */
function listRowsMain() {
  return [
    {
      id: '1',
      title: '🛒 Hacer un pedido',
      description: 'Productos frescos a tu puerta',
    },
    {
      id: '2',
      title: '💬 Atención al cliente',
      description: 'Estamos para ayudarte',
    },
    {
      id: '3',
      title: '✏️ Modificar un pedido',
      description: 'Antes de que pase a En proceso',
    },
  ];
}

function listRowsAfter() {
  return [
    {
      id: '1',
      title: '🛒 Hacer otro pedido',
      description: '¡Nos encanta que vuelvas!',
    },
    {
      id: '2',
      title: '✏️ Modificar este pedido',
      description: 'Antes de que pase a En proceso',
    },
    {
      id: '3',
      title: '💬 Atención al cliente',
      description: 'Hablar con nuestro equipo',
    },
  ];
}

/** List Message nativo (bonus si WhatsApp lo deja) */
function buildListMenu(kind = 'main', orderCode = null) {
  const isAfter = kind === 'after';
  const title = isAfter ? '🧡 ¿Qué sigue?' : '🧡 Menú La Granjita';
  const body = isAfter
    ? `Tu pedido${orderCode ? ' #' + orderCode : ''} ya está con nosotros 🙌\nElegí con cariño 👇`
    : '¡Qué lindo verte por acá! 🐔\nElegí lo que necesitás 👇';
  const buttonText = '✨ Ver menú';
  const footer = 'Con amor · TIENDA La Granjita';
  const sectionTitle = isAfter ? 'Tu pedido' : '¿En qué te ayudamos?';
  const rows = isAfter ? listRowsAfter() : listRowsMain();

  return new List(
    body,
    buttonText,
    [{ title: sectionTitle, rows }],
    title,
    footer
  );
}

/** Mensaje principal lindo + listado claro (SIEMPRE se envía) */
function menuMain() {
  return (
    `╭──────────────────────╮\n` +
    `│  🐔 *TIENDA · La Granjita*  │\n` +
    `╰──────────────────────╯\n\n` +
    `¡Hola, hola! 👋🧡\n` +
    `Qué bueno tenerte por acá.\n` +
    `Esperamos que estés teniendo un *día hermoso*.\n\n` +
    `Estamos para servirte con mucho cariño 🌿\n` +
    `Productos fresquitos, directo a tu casa.\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `✨ *¿En qué te podemos ayudar?*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `🛒  *1*  ·  Hacer un pedido\n` +
    `      _Armá tu carrito y te lo llevamos_\n\n` +
    `💬  *2*  ·  Atención al cliente\n` +
    `      _Escribinos, con gusto te ayudamos_\n\n` +
    `✏️  *3*  ·  Modificar un pedido\n` +
    `      _Antes de que pase a "En proceso"_\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `Respondé con *1*, *2* o *3*\n` +
    `(o tocá *✨ Ver menú* si te aparece el listado)\n\n` +
    `Con amor,\n` +
    `*el equipo de La Granjita* 🧡🐔`
  );
}

/** Menú post-pedido, cálido y con listado */
function menuAfterOrder(orderCode) {
  const codeLine = orderCode ? `Tu pedido *#${orderCode}*` : 'Tu pedido';
  return (
    `╭──────────────────────╮\n` +
    `│  ✅ *¡Pedido recibido!*     │\n` +
    `╰──────────────────────╯\n\n` +
    `¡Gracias por confiar en nosotros! 🧡\n` +
    `${codeLine} ya está en buenas manos.\n` +
    `Lo vamos a cuidar como se merece 🐔✨\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `💫 *¿Qué te gustaría hacer ahora?*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `🛒  *1*  ·  Hacer *otro* pedido\n` +
    `      _¡Nos encanta cuando volvés!_\n\n` +
    `✏️  *2*  ·  *Modificar* este pedido\n` +
    `      _Antes de que pase a "En proceso"_\n\n` +
    `💬  *3*  ·  Atención al cliente\n` +
    `      _Estamos aquí si necesitás algo_\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `Respondé con *1*, *2* o *3*\n` +
    `(o tocá *✨ Ver menú* si te aparece)\n\n` +
    `Cualquier cosita, acá estamos 💛\n` +
    `*La Granjita te mima* 🐔`
  );
}

/**
 * Siempre manda el listado amigable en texto.
 * Si se puede, también intenta el List Message nativo.
 */
async function sendSwitchMenu(chatId, kind = 'main', orderCode = null) {
  if (!client || !isReady || !chatId) return false;

  const intro = kind === 'after' ? menuAfterOrder(orderCode) : menuMain();
  try {
    await client.sendMessage(chatId, intro, { sendSeen: false });
    console.log(`✅ Menú lindo (${kind}) → ${chatId}`);
  } catch (e) {
    console.warn('[WhatsApp] menú texto falló:', e.message);
    return false;
  }

  // Bonus: List Message nativo (si WhatsApp lo acepta)
  try {
    const list = buildListMenu(kind, orderCode);
    await client.sendMessage(chatId, list, { sendSeen: false });
    console.log(`✅ List Message extra (${kind}) → ${chatId}`);
  } catch (e) {
    console.warn('[WhatsApp] List nativo no disponible (ok, ya mandamos el lindo):', e.message);
  }
  return true;
}

/** Menú lindo al responder un mensaje entrante */
async function replyWithSwitchMenu(msg, kind = 'main', orderCode = null) {
  const intro = kind === 'after' ? menuAfterOrder(orderCode) : menuMain();
  try {
    await safeReply(msg, intro);
    console.log(`✅ Menú lindo (${kind}) reply → ${msg.from}`);
  } catch (e) {
    console.warn('[WhatsApp] reply menú:', e.message);
    try {
      await client.sendMessage(msg.from, intro, { sendSeen: false });
    } catch (e2) {
      console.warn('[WhatsApp] menú total falló:', e2.message);
      return false;
    }
  }

  try {
    const list = buildListMenu(kind, orderCode);
    await client.sendMessage(msg.from, list, { sendSeen: false });
    console.log(`✅ List Message extra (${kind}) → ${msg.from}`);
  } catch (e) {
    console.warn('[WhatsApp] List nativo no disponible (ok):', e.message);
  }
  return true;
}

function msgPedidoLink() {
  return (
    `🛒 *¡Vamos a armar tu pedido!* 🧡\n\n` +
    `Tocá este link y elegí con calma lo que se te antoje:\n\n` +
    `👉 ${STORE_URL}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `💵 *Efectivo* al recibir (vos elegís los billetes)\n` +
    `💳 *Tarjeta* con terminal en tu casa\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `Cuando confirmes, te avisamos por acá con todo el cariño 🐔✨\n` +
    `¡Gracias por preferirnos!`
  );
}

function msgAtencionCliente() {
  return (
    `💬 *Atención al cliente* 🧡\n\n` +
    `¡Claro que sí! Ya le avisamos al equipo que querés hablar con nosotros.\n\n` +
    `En un momentito te van a atender *por este mismo chat* 🙌\n\n` +
    `Mientras tanto, si querés, contanos en un mensaje qué necesitás…\n` +
    `Estamos para ayudarte de verdad 💛\n\n` +
    `_Gracias por tu paciencia, valés mucho para nosotros_ 🐔`
  );
}

function msgPedirModificacion() {
  return (
    `✏️ *Modificar tu pedido* 🧡\n\n` +
    `Con mucho gusto te ayudamos a ajustar lo que haga falta.\n\n` +
    `⚠️ Solo se puede *antes de que el pedido pase a "En proceso"*.\n\n` +
    `Escribí tu cambio en *un solo mensaje*, por ejemplo:\n\n` +
    `• _"Quiero 2 pollos en vez de 1"_\n` +
    `• _"Cambiá la dirección a..."_\n` +
    `• _"Cancelá el helado, porfa"_\n\n` +
    `Nosotros lo revisamos y te confirmamos 💛\n` +
    `Si ya va en camino, te avisamos con honestidad si no se puede.`
  );
}

function normalizeChoice(body, menuKind = 'main') {
  const t = String(body || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // "1 · Realizar un pedido" / "2 · Atención..." (switch / poll)
  const m = t.match(/^[\s]*([123])\s*[·.\-)\:]?\s*/);
  if (m) return m[1];

  // Menú post-pedido: el significado de 2/3 cambia un poco en texto libre
  if (menuKind === 'after') {
    if (/atencion|cliente|humano|asesor|ayuda|hablar/.test(t)) return '3';
    if (/modif|cambio|correg/.test(t)) return '2';
    if (/otro|nuevo|pedir|pedido|ordenar|comprar/.test(t)) return '1';
  } else {
    if (/^1$|uno/.test(t) || (/pedido|ordenar|comprar/.test(t) && !/modif/.test(t)))
      return '1';
    if (/^2$|dos|atencion|cliente|humano|proveedor|asesor|ayuda/.test(t)) return '2';
    if (/^3$|tres|modificar|cambio|corregir/.test(t)) return '3';
  }

  if (t.startsWith('1')) return '1';
  if (t.startsWith('2')) return '2';
  if (t.startsWith('3')) return '3';
  return null;
}

/** Solo dígitos; si es número local GT (8 dígitos) antepone 502 */
function normalizePhone(raw) {
  let digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  // Guatemala: 8 dígitos locales → +502
  if (digits.length === 8) digits = `502${digits}`;
  // Si vino con 00 internacional
  if (digits.startsWith('00')) digits = digits.slice(2);
  return digits;
}

/**
 * Espera a que el cliente reporte CONNECTED (store de WA Web listo).
 */
async function ensureWaConnected(timeoutMs = 15000) {
  if (!client) throw new Error('WhatsApp no iniciado (client null)');
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const state = await client.getState();
      if (state === 'CONNECTED') {
        isReady = true;
        return true;
      }
      logWa(`ensureWaConnected: state=${state}`);
    } catch (e) {
      logWa(`ensureWaConnected error: ${e.message}`);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  if (!isReady) {
    throw new Error(
      'WhatsApp aún no está listo (no CONNECTED). Esperá a ver CONECTADO en la consola o escaneá el QR en http://127.0.0.1:5000/'
    );
  }
  return true;
}

/**
 * Envía mensaje resolviendo el chatId real.
 * Evita fallos clásicos de `@c.us` / sendSeen con WA Web nuevo.
 * Reintenta hasta 3 veces si el store de WA aún no cargó.
 */
async function sendWaMessage(rawPhone, text) {
  await ensureWaConnected(12000);

  const phone = normalizePhone(rawPhone);
  if (!phone) throw new Error('Teléfono vacío o inválido');

  let chatId = `${phone}@c.us`;
  try {
    // getNumberId devuelve el id real si el número tiene WA
    const numberId = await client.getNumberId(phone);
    if (numberId?._serialized) {
      chatId = numberId._serialized;
    } else if (numberId?.user) {
      chatId = `${numberId.user}@${numberId.server || 'c.us'}`;
    } else {
      console.warn(`[WhatsApp] getNumberId sin resultado para ${phone} — intento @c.us`);
    }
  } catch (e) {
    console.warn(`[WhatsApp] getNumberId falló (${phone}): ${e.message}`);
  }

  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      // sendSeen:false evita crash sendSeen cuando el chat store no cargó
      await client.sendMessage(chatId, text, { sendSeen: false });
      return chatId;
    } catch (e) {
      lastErr = e;
      const msg = String(e?.message || e);
      console.warn(`[WhatsApp] send intento ${attempt}/3 falló (${phone}): ${msg}`);
      // Si el chat no existe en store, forzar getChat
      if (/sendSeen|undefined|getChat|Evaluation failed|Protocol/i.test(msg)) {
        try {
          const chat = await client.getChatById(chatId);
          if (chat) {
            await chat.sendMessage(text, { sendSeen: false });
            return chatId;
          }
        } catch (e2) {
          lastErr = e2;
          console.warn(`[WhatsApp] getChatById fallback: ${e2.message}`);
        }
      }
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
  throw new Error(lastErr?.message || 'No se pudo enviar el mensaje de WhatsApp');
}

async function notifyOwner(text) {
  if (!OWNER_WHATSAPP || !client || !isReady) {
    console.warn('[WhatsApp] No se pudo avisar al dueño (OWNER o WA off)');
    return;
  }
  try {
    await sendWaMessage(OWNER_WHATSAPP, text);
  } catch (e) {
    console.error('[WhatsApp] notifyOwner:', e.message);
  }
}

/** reply seguro: si falla msg.reply, intenta sendMessage al chat */
async function safeReply(msg, text) {
  try {
    await msg.reply(text);
    return;
  } catch (e1) {
    console.warn('[WhatsApp] msg.reply falló:', e1.message);
    try {
      const chat = await msg.getChat();
      await chat.sendMessage(text, { sendSeen: false });
      return;
    } catch (e2) {
      console.warn('[WhatsApp] chat.sendMessage falló:', e2.message);
    }
    // Último recurso: al id del chat (incluye @lid)
    const chatId = msg.from;
    if (client && chatId) {
      await client.sendMessage(chatId, text, { sendSeen: false });
      return;
    }
    throw e1;
  }
}

/** Ejecuta la acción del switch (1/2/3) según el menú actual */
async function runSwitchAction(phone, choice, replyFn, state, body = '') {
  // Menú principal
  if (state === STATE.MAIN || state === STATE.IDLE) {
    if (choice === '1') {
      await replyFn(msgPedidoLink());
      setSession(phone, { state: STATE.MAIN, lastMenu: 'main' });
      return true;
    }
    if (choice === '2') {
      await notifyOwner(
        `👩‍💼 *ATENCIÓN AL CLIENTE*\n\n` +
          `El cliente *${phone}* quiere hablar con el equipo.\n` +
          (body ? `Último mensaje: "${body}"\n\n` : '\n') +
          `_Respondé por WhatsApp a este número._`
      );
      await replyFn(msgAtencionCliente());
      setSession(phone, { state: STATE.MAIN, lastMenu: 'main' });
      return true;
    }
    if (choice === '3') {
      await replyFn(msgPedirModificacion());
      setSession(phone, { state: STATE.AWAIT_MOD, lastMenu: 'main' });
      return true;
    }
  }

  // Menú post-pedido: 1 otro | 2 modificar | 3 atención
  if (state === STATE.AFTER_ORDER) {
    if (choice === '1') {
      await replyFn(msgPedidoLink());
      setSession(phone, { state: STATE.MAIN, lastMenu: 'main' });
      return true;
    }
    if (choice === '2') {
      await replyFn(msgPedirModificacion());
      setSession(phone, { state: STATE.AWAIT_MOD, lastMenu: 'after' });
      return true;
    }
    if (choice === '3') {
      await notifyOwner(
        `👩‍💼 *ATENCIÓN AL CLIENTE* (post-pedido)\n\n` +
          `El cliente *${phone}* pide hablar con el equipo.\n` +
          (getSession(phone)?.lastOrderCode
            ? `Pedido: #${getSession(phone).lastOrderCode}\n`
            : '') +
          `_Respondé por WhatsApp a este número._`
      );
      await replyFn(msgAtencionCliente());
      setSession(phone, { state: STATE.AFTER_ORDER, lastMenu: 'after' });
      return true;
    }
  }
  return false;
}

async function handleIncomingMessage(msg) {
  const phone =
    msg._resolvedPhone ||
    phoneFromId(msg.from) ||
    (isLidId(msg.from) ? `lid:${String(msg.from).replace(/@lid$/i, '')}` : '');
  const body = (msg.body || '').trim();
  if (!phone) {
    console.warn('[WhatsApp] mensaje sin teléfono/lid resoluble:', msg.from);
    return;
  }

  const replyFn = (text) => safeReply(msg, text);

  let session = getSession(phone);
  const firstToday = isFirstContactToday(phone);

  // —— Primer mensaje del día → saludo + switch 3 opciones ——
  if (firstToday) {
    setSession(phone, {
      greetedDay: todayKey(),
      state: STATE.MAIN,
      lastMenu: 'main',
      lastOrderId: session?.lastOrderId || null,
      lastOrderCode: session?.lastOrderCode || null,
    });
    await replyWithSwitchMenu(msg, 'main');
    console.log(`✅ Menú switch principal (1er msg del día) → ${phone}`);
    // Si ya escribió 1/2/3 en el mismo mensaje, procesarlo abajo
    const early = normalizeChoice(body, 'main');
    if (!early) return;
  }

  session = getSession(phone) || { state: STATE.IDLE, greetedDay: todayKey() };
  const state = session.state || STATE.IDLE;
  const menuKind = state === STATE.AFTER_ORDER ? 'after' : 'main';
  const choice = normalizeChoice(body, menuKind);

  // —— Esperando texto de modificación ——
  if (state === STATE.AWAIT_MOD) {
    // Si tocó el switch otra vez (1/2/3), no tomar como texto de cambio
    if (choice) {
      setSession(phone, { state: STATE.AFTER_ORDER });
      await runSwitchAction(phone, choice, replyFn, STATE.AFTER_ORDER, body);
      return;
    }

    const code = session.lastOrderCode || '—';
    const orderRef = session.lastOrderId || '';

    await notifyOwner(
      `✏️ *SOLICITUD DE CAMBIO DE PEDIDO*\n\n` +
        `👤 Cliente WA: ${phone}\n` +
        `🆔 Pedido: #${code}\n` +
        (orderRef ? `🔗 ID: ${orderRef}\n` : '') +
        `\n📝 *Cambio pedido:*\n${body}\n\n` +
        `_Editá el pedido en Admin → Pedidos → "Modificar pedido" (solo si aún no está "En proceso")_`
    );

    await safeReply(
      msg,
      `✅ *Recibimos tu solicitud de cambio*\n\n` +
        `Pedido: *#${code}*\n` +
        `Tu mensaje:\n_"${body.substring(0, 300)}"_\n\n` +
        `El equipo lo revisa *antes de que el pedido pase a "En proceso"*.`
    );
    setSession(phone, { state: STATE.AFTER_ORDER, lastMenu: 'after' });
    await replyWithSwitchMenu(msg, 'after', code === '—' ? null : code);
    return;
  }

  // —— Menú principal (1 / 2 / 3) ——
  if (state === STATE.MAIN || state === STATE.IDLE) {
    if (!choice) {
      if (/menu|menú|hola|buenas|inicio|opciones/i.test(body)) {
        setSession(phone, { state: STATE.MAIN, greetedDay: todayKey(), lastMenu: 'main' });
        await replyWithSwitchMenu(msg, 'main');
        return;
      }
      setSession(phone, { state: STATE.MAIN, lastMenu: 'main' });
      await safeReply(
        msg,
        `Jajaja perdón, no te capté bien 🙈🧡\n` +
          `Sin problema — te dejo el menú de nuevo.\n` +
          `Respondé con *1*, *2* o *3* y con gusto te ayudamos.`
      );
      await replyWithSwitchMenu(msg, 'main');
      return;
    }

    const ok = await runSwitchAction(phone, choice, replyFn, STATE.MAIN, body);
    if (ok) return;
  }

  // —— Después de un pedido (1 otro / 2 modificar / 3 atención) ——
  if (state === STATE.AFTER_ORDER) {
    if (/menu|menú|hola|inicio/i.test(body)) {
      setSession(phone, { state: STATE.MAIN, lastMenu: 'main' });
      await replyWithSwitchMenu(msg, 'main');
      return;
    }

    if (choice) {
      const ok = await runSwitchAction(phone, choice, replyFn, STATE.AFTER_ORDER, body);
      if (ok) return;
    }

    await safeReply(
      msg,
      `No te preocupes 💛\n` +
        `Elegí una opción del menú (incluye *atención al cliente*)\n` +
        `o escribí *1*, *2* o *3*. ¡Acá estamos!`
    );
    await replyWithSwitchMenu(msg, 'after', session.lastOrderCode);
    return;
  }

  // Fallback
  if (/menu|menú|hola|buenas|opciones/i.test(body)) {
    setSession(phone, { state: STATE.MAIN, greetedDay: todayKey(), lastMenu: 'main' });
    await replyWithSwitchMenu(msg, 'main');
  }
}

function getWhatsAppStatus() {
  const saved = hasSavedSession();
  return {
    connected: isReady,
    reconnectAttempts,
    hasQR: !!currentQR,
    hasPairingCode: !!currentPairingCode,
    pairingCode: currentPairingCode,
    pairingPhone: pairingPhone,
    lastEvent: lastWaEvent || null,
    /** true = ya vinculaste alguna vez; al reiniciar no hace falta QR */
    sessionSaved: saved,
    authPath: getAuthPath(),
    sessionDir: getSessionDir(),
    oneTimeLink:
      'WhatsApp se vincula UNA sola vez. La sesión queda en el PC. Al prender el backend se reconecta solo (sin QR), salvo que borres la sesión o desvincules el dispositivo en el celular.',
  };
}

function getCurrentQR() {
  return currentQR;
}

function getPairingCode() {
  return currentPairingCode
    ? { code: currentPairingCode, phone: pairingPhone }
    : null;
}

/**
 * Código de 8 dígitos para vincular sin escanear QR.
 * En el celular: WhatsApp → Dispositivos vinculados → Vincular con número de teléfono
 */
async function requestPairingCode(phoneRaw) {
  if (process.env.WHATSAPP_ENABLED === 'false') {
    throw new Error('WhatsApp está desactivado (WHATSAPP_ENABLED=false)');
  }
  if (isReady) {
    throw new Error('WhatsApp ya está conectado. No hace falta vincular de nuevo.');
  }
  if (!client) {
    throw new Error(
      'WhatsApp aún no inició. Esperá 10–20 s con el backend corriendo e intentá de nuevo.'
    );
  }

  const digits = String(phoneRaw || '').replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) {
    throw new Error('Número inválido. Usá código de país, ej: 50254973412');
  }

  // Si aún no hay QR, esperar un poco a que el cliente esté listo para pairing
  for (let i = 0; i < 15 && !currentQR && !isReady; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    if (isReady) {
      throw new Error('WhatsApp ya se conectó solo con la sesión guardada.');
    }
  }

  try {
    logWa(`Solicitando pairing code para ${digits}...`);
    const code = await client.requestPairingCode(digits);
    currentPairingCode = code;
    pairingPhone = digits;
    logWa(`Pairing code: ${code}`);
    return { code, phone: digits };
  } catch (err) {
    logWa(`requestPairingCode falló: ${err.message}`);
    throw new Error(
      err.message ||
        'No se pudo generar el código. Probá el QR o reiniciá el backend.'
    );
  }
}

/** Cierra la sesión de WhatsApp (queda desvinculado hasta volver a enlazar) */
async function logoutWhatsApp({ deleteSession = false } = {}) {
  try {
    if (client) {
      try {
        if (isReady && typeof client.logout === 'function') {
          await client.logout();
        }
      } catch (e) {
        logWa(`logout: ${e.message}`);
      }
      await safeDestroyClient();
    }
  } finally {
    isReady = false;
    currentQR = null;
    currentPairingCode = null;
    pairingPhone = null;
  }

  if (deleteSession) {
    const dir = getSessionDir();
    try {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
        logWa(`Sesión borrada: ${dir}`);
      }
    } catch (e) {
      logWa(`No se pudo borrar sesión: ${e.message}`);
    }
  }

  // Reiniciar cliente para poder vincular de nuevo
  setTimeout(() => {
    startWhatsApp().catch((e) => logWa(`re-start tras logout: ${e.message}`));
  }, 1500);

  return getWhatsAppStatus();
}

let lastWaEvent = '';
function logWa(msg) {
  lastWaEvent = `${new Date().toLocaleTimeString()} ${msg}`;
  console.log(`[WhatsApp] ${msg}`);
}

/** Tras escanear QR a veces no llega 'ready'; polleamos el estado */
async function pollUntilConnected(label = 'post-auth') {
  const maxTries = 45; // ~90s
  for (let i = 1; i <= maxTries; i++) {
    if (!client) return false;
    try {
      const state = await client.getState();
      logWa(`poll (${label}) #${i}: state=${state}`);
      if (state === 'CONNECTED') {
        isReady = true;
        currentQR = null;
        currentPairingCode = null;
        reconnectAttempts = 0;
        console.log('');
        console.log('========================================');
        console.log('  ✅ WHATSAPP CONECTADO');
        console.log('  Listo para menús y pedidos');
        console.log('========================================');
        console.log('');
        return true;
      }
    } catch (e) {
      logWa(`poll (${label}) error: ${e.message}`);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  logWa(`poll (${label}): no llegó a CONNECTED en 90s`);
  return false;
}

function resolveChromePath() {
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    process.env.CHROME_PATH,
    path.join(process.env.PROGRAMFILES || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env['PROGRAMFILES(X86)'] || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env.PROGRAMFILES || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(process.env['PROGRAMFILES(X86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  ].filter(Boolean);

  for (const p of candidates) {
    try {
      if (p && fs.existsSync(p)) return p;
    } catch {
      /* ignore */
    }
  }

  // Chromium embebido en .puppeteer (Linux-style "chrome" binary)
  const cacheBase = process.env.PUPPETEER_CACHE_DIR || path.join(process.cwd(), '.puppeteer');
  function findChrome(dir, depth = 0) {
    if (depth > 6) return null;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isFile() && (entry.name === 'chrome' || entry.name === 'chrome.exe')) {
          return fullPath;
        }
        if (entry.isDirectory()) {
          const found = findChrome(fullPath, depth + 1);
          if (found) return found;
        }
      }
    } catch {
      /* ignore */
    }
    return null;
  }
  return findChrome(cacheBase);
}

async function safeDestroyClient() {
  try {
    if (client) {
      await client.destroy().catch(() => {});
    }
  } catch {
    /* ignore */
  }
  client = null;
  isReady = false;
  currentQR = null;
  currentPairingCode = null;
  pairingPhone = null;
}

function initWhatsApp() {
  if (process.env.WHATSAPP_ENABLED === 'false') {
    logWa('Desactivado (WHATSAPP_ENABLED=false). API sigue normal.');
    return;
  }
  if (client) return;

  try {
    const chromePath = resolveChromePath();
    // headless "new" + Chrome del sistema es más estable en Windows
    const puppeteerConfig = {
      headless: process.env.WA_HEADLESS === 'false' ? false : 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--disable-gpu',
        '--disable-extensions',
        '--window-size=1280,800',
      ],
    };
    if (chromePath) {
      puppeteerConfig.executablePath = chromePath;
      logWa(`Browser: ${chromePath}`);
    } else {
      logWa('Sin Chrome/Edge del sistema — puede fallar. Instalá Google Chrome.');
    }

    // Sesión FUERA del proyecto → sobrevive reinicios y nodemon no la toca
    const authPath = getAuthPath();
    logWa(`Sesión LocalAuth en: ${authPath}`);
    if (hasSavedSession()) {
      logWa('Sesión guardada encontrada → debería reconectar SIN QR');
    } else {
      logWa('Sin sesión previa → hay que vincular UNA vez (QR o código)');
    }

    client = new Client({
      authStrategy: new LocalAuth({
        clientId: 'tienda',
        dataPath: authPath,
      }),
      puppeteer: puppeteerConfig,
      // Cache local de WA Web (más estable que depender del CDN roto)
      webVersionCache: {
        type: 'local',
      },
      restartOnAuthFail: false,
      qrMaxRetries: 10,
      takeoverOnConflict: true,
      takeoverTimeoutMs: 10000,
    });

    let authLogged = false;
    let readyLogged = false;
    let pollStarted = false;

    client.on('qr', (qr) => {
      currentQR = qr;
      isReady = false;
      // Nuevo QR invalida pairing anterior
      currentPairingCode = null;
      authLogged = false;
      readyLogged = false;
      console.log('');
      console.log('========================================');
      console.log('  📱 VINCULAR WHATSAPP (solo la primera vez)');
      console.log('  Admin: /admin/whatsapp  ·  o  http://127.0.0.1:5000/');
      console.log('  Opción A: escanear QR');
      console.log('  Opción B: código de emparejamiento en el panel admin');
      console.log('  Luego la sesión se guarda y NO pedirá QR al reiniciar');
      console.log('========================================');
      console.log('');
      try {
        qrcode.generate(qr, { small: true });
      } catch {
        /* ignore */
      }
      console.log('');
      console.log('  Esperando vinculación...');
      console.log('');
      logWa('evento: qr');
    });

    client.on('loading_screen', (percent, message) => {
      logWa(`Cargando ${percent}% — ${message}`);
    });

    client.on('authenticated', () => {
      currentQR = null;
      currentPairingCode = null;
      if (!authLogged) {
        authLogged = true;
        console.log('');
        console.log('  ✅ WhatsApp AUTENTICADO (QR ok)');
        console.log('  Cargando WhatsApp Web... esperá, no cierres nada');
        console.log('');
        logWa('evento: authenticated');
      }
      // Backup: a veces no dispara 'ready' (solo una vez)
      if (!pollStarted) {
        pollStarted = true;
        pollUntilConnected('after-authenticated').catch(() => {});
      }
    });

    client.on('ready', () => {
      isReady = true;
      currentQR = null;
      reconnectAttempts = 0;
      if (!readyLogged) {
        readyLogged = true;
        console.log('');
        console.log('========================================');
        console.log('  ✅ WHATSAPP CONECTADO');
        console.log('  Menús y pedidos activos');
        console.log('========================================');
        console.log('');
        logWa('evento: ready → CONECTADO');
      }
    });

    client.on('remote_session_saved', () => {
      logWa('evento: sesión guardada en disco');
    });

    client.on('auth_failure', (msg) => {
      console.error('❌ Auth WhatsApp falló:', msg);
      logWa(`auth_failure: ${msg}`);
      isReady = false;
      scheduleReconnect();
    });

    client.on('error', (err) => {
      console.error('❌ WhatsApp error:', err?.message || err);
      logWa(`error: ${err?.message || err}`);
      if (
        /Protocol|Execution context|detached|Target closed|Session closed/i.test(
          String(err?.message || err)
        )
      ) {
        isReady = false;
        scheduleReconnect();
      }
    });

    client.on('change_state', (state) => {
      logWa(`change_state: ${state}`);
      if (state === 'CONNECTED') {
        isReady = true;
        currentQR = null;
        console.log('');
        console.log('  ✅ WHATSAPP CONECTADO (change_state)');
        console.log('');
      }
    });

    client.on('disconnected', (reason) => {
      console.log('⚠️ WhatsApp desconectado:', reason);
      logWa(`disconnected: ${reason}`);
      isReady = false;
      scheduleReconnect();
    });

    client.on('message', async (msg) => {
      try {
        if (!msg || msg.fromMe) return;
        if (isIgnorableChatId(msg.from) || isIgnorableChatId(msg.to)) return;

        // Grupos: @g.us (sin getChat, que a veces revienta con @lid)
        if (/@g\.us$/i.test(String(msg.from || ''))) return;

        // Tipos que no son chat de texto del menú
        const t = msg.type || '';
        if (['e2e_notification', 'notification_template', 'call_log', 'ciphertext'].includes(t)) {
          return;
        }

        // List Message / botones: el id de la fila es la opción (1/2/3)
        if (t === 'list_response' && msg.selectedRowId) {
          msg.body = String(msg.selectedRowId);
          console.log(`📋 List Message elegida: rowId=${msg.selectedRowId}`);
        }
        if (t === 'buttons_response' && msg.selectedButtonId) {
          msg.body = String(msg.selectedButtonId);
          console.log(`🔘 Button elegida: id=${msg.selectedButtonId}`);
        }

        let phone = '';
        try {
          phone = await resolveSenderPhone(msg);
        } catch (e) {
          phone = phoneFromId(msg.from) || String(msg.from || '');
          console.warn('[WhatsApp] resolveSenderPhone:', e.message);
        }

        const body = (msg.body || '').trim();
        console.log(
          `📱 [${phone || msg.from}] "${body.substring(0, 80)}${body.length > 80 ? '...' : ''}"` +
            (isLidId(msg.from) ? ' (via @lid)' : '') +
            (t === 'list_response' ? ' [LIST]' : '')
        );

        if (!AUTO_REPLY_ENABLED) {
          console.log('📱 Auto-reply OFF');
          return;
        }

        // Pasar phone resuelto para sesiones / notifyOwner
        msg._resolvedPhone = phone;
        await handleIncomingMessage(msg);
      } catch (error) {
        const detail = error?.message || error?.toString?.() || String(error);
        console.error(`❌ Error mensaje ${msg?.from}:`, detail);
        if (error?.stack) console.error(error.stack.split('\n').slice(0, 4).join('\n'));
      }
    });

    logWa('initialize()...');
    client
      .initialize()
      .then(async () => {
        logWa('initialize() terminó — esperando ready/CONNECTED');
        // Si ya hay sesión guardada, a veces no hay QR ni ready inmediato
        if (!isReady) {
          await pollUntilConnected('after-initialize');
        }
        // Escuchar caídas del browser de Puppeteer (no tumbar Node)
        try {
          const browser = client.pupBrowser;
          if (browser && !browser.__tiendaHooks) {
            browser.__tiendaHooks = true;
            browser.on('disconnected', () => {
              console.warn('[WhatsApp] Chrome/Puppeteer desconectado — API sigue, reintento WA...');
              isReady = false;
              client = null;
              scheduleReconnect();
            });
          }
          const page = client.pupPage;
          if (page && !page.__tiendaHooks) {
            page.__tiendaHooks = true;
            page.on('error', (err) => {
              console.warn('[WhatsApp] page error:', err?.message || err);
            });
            page.on('pageerror', (err) => {
              console.warn('[WhatsApp] pageerror:', err?.message || err);
            });
          }
        } catch (hookErr) {
          console.warn('[WhatsApp] no se pudieron enganchar hooks browser:', hookErr.message);
        }
      })
      .catch((err) => {
        console.error('[WhatsApp] initialize falló (API sigue viva):', err?.message || err);
        isReady = false;
        client = null;
        scheduleReconnect();
      });
  } catch (err) {
    console.error('[WhatsApp] No se pudo iniciar (API sigue viva):', err?.message || err);
    client = null;
    isReady = false;
  }
}

let reconnectTimer = null;

function scheduleReconnect() {
  if (process.env.WHATSAPP_ENABLED === 'false') return;
  if (reconnectTimer) return;

  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.error(
      `❌ WhatsApp: máximo ${MAX_RECONNECT_ATTEMPTS} reintentos. Reiniciá el server o poné WHATSAPP_ENABLED=false`
    );
    return;
  }

  reconnectAttempts += 1;
  const delay = Math.min(RECONNECT_DELAY * reconnectAttempts, 60000);
  console.log(
    `🔄 WhatsApp reintento en ${delay / 1000}s (#${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`
  );

  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    console.log(`🔄 Reconectando WhatsApp #${reconnectAttempts}...`);
    await safeDestroyClient();
    initWhatsApp();
  }, delay);
}

function generateGreeting() {
  return menuMain();
}

/** Tras confirmar pedido web → menú switch de 3 opciones (incluye atención) */
async function sendAfterOrderMenu(order) {
  if (!client || !isReady) return;
  const phone = normalizePhone(order.customer?.phone);
  if (!phone) return;
  const code = order._id.toString().slice(-6).toUpperCase();
  try {
    setSession(phone, {
      greetedDay: todayKey(),
      state: STATE.AFTER_ORDER,
      lastMenu: 'after',
      lastOrderId: String(order._id),
      lastOrderCode: code,
    });
    // Resolver chatId real y mandar switch tocable
    let chatId = `${phone}@c.us`;
    try {
      const numberId = await client.getNumberId(phone);
      if (numberId?._serialized) chatId = numberId._serialized;
    } catch {
      /* usar @c.us */
    }
    await sendSwitchMenu(chatId, 'after', code);
    console.log(`✅ Menú switch post-pedido enviado a ${phone}`);
  } catch (e) {
    console.error('Error menú post-pedido:', e.message);
    try {
      await sendWaMessage(phone, menuAfterOrder(code));
    } catch {
      /* ignore */
    }
  }
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

  const paymentText =
    order.paymentMethod === 'cash'
      ? '💵 Efectivo al entregar'
      : '💳 Terminal POS en casa';

  const inv = order.invoice?.number;
  return (
    `╔════════════════════════╗\n` +
    `║  🛵 *NUEVO PEDIDO* 🛵  ║\n` +
    `║   🐔 *La Granjita*     ║\n` +
    `╚════════════════════════╝\n\n` +
    (inv ? `🧾 *Factura:* ${inv}\n` : '') +
    `🆔 *Pedido:* #${order._id.toString().slice(-6).toUpperCase()}\n\n` +
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
    (order.cashIntent?.amountTendered
      ? `💵 *Cliente dijo pagar con:* ${formatCashBills(order.cashIntent)} (vuelto Q${order.cashIntent.change})\n`
      : '') +
    `${statusEmoji[order.orderStatus] || '⏳'} *Estado:* ${getStatusText(order.orderStatus)}\n\n` +
    `_Revisá en admin · el cliente ya recibió su comprobante por WA_`
  );
}

function formatDenomLabel(d) {
  const n = Number(d);
  if (n >= 1) return `Q${n}`;
  if (n === 0.5) return '50¢';
  if (n === 0.25) return '25¢';
  return `Q${n}`;
}

function formatCashBills(intent) {
  if (!intent?.bills?.length) {
    return intent?.amountTendered != null ? `Q${intent.amountTendered}` : '—';
  }
  const parts = intent.bills
    .filter((b) => b.count > 0)
    .map((b) => `${b.count}× ${formatDenomLabel(b.denomination)}`)
    .join(' + ');
  return `${parts} = Q${intent.amountTendered}`;
}

/** Bloque de factura para repartidor: total, billetes y vuelto a llevar */
function formatInvoiceForDelivery(order) {
  const code = order._id.toString().slice(-6).toUpperCase();
  const inv = order.invoice?.number || '—';
  const lines = (order.items || [])
    .map(
      (item) =>
        `  ${item.quantity}x ${item.productName}` +
        (item.variant?.name ? ` (${item.variant.name})` : '') +
        ` ... Q${item.subtotal.toLocaleString('es-GT')}`
    )
    .join('\n');

  let payBlock = '';
  if (order.paymentMethod === 'cash' && order.cashIntent?.amountTendered) {
    const change = Number(order.cashIntent.change) || 0;
    payBlock =
      `\n💵 *PAGO EN EFECTIVO (para el repartidor)*\n` +
      `• Total a cobrar: *Q${order.total.toLocaleString('es-GT')}*\n` +
      `• Cliente paga con: *${formatCashBills(order.cashIntent)}*\n` +
      `• Entrega: *Q${Number(order.cashIntent.amountTendered).toLocaleString('es-GT')}*\n` +
      (change > 0
        ? `• ⚠️ *LLEVAR VUELTO CABAL: Q${change.toLocaleString('es-GT')}*\n`
        : `• ✓ Pago cabal — *sin vuelto*\n`);
  } else if (order.paymentMethod === 'card') {
    payBlock =
      `\n💳 *PAGO CON TARJETA*\n` +
      `• Llevar *terminal POS* a la casa\n` +
      `• Cobrar: *Q${order.total.toLocaleString('es-GT')}*\n`;
  }

  return (
    `🧾 *FACTURA DE ENTREGA*\n` +
    `Nº *${inv}*\n` +
    `Pedido *#${code}*\n\n` +
    `👤 ${order.customer.name}\n` +
    `📱 ${order.customer.phone}\n` +
    `📍 ${order.customer.address}\n` +
    (order.customer.notes ? `📝 ${order.customer.notes}\n` : '') +
    `\n━━━━━━━━━━━━━━━━\n` +
    `📦 Productos:\n${lines}\n` +
    `━━━━━━━━━━━━━━━━\n` +
    `💰 *TOTAL: Q${order.total.toLocaleString('es-GT')}*\n` +
    payBlock +
    `\n🛵 Generada al salir *en camino*`
  );
}

function formatCustomerConfirmation(order) {
  const code = order._id.toString().slice(-6).toUpperCase();
  const inv = order.invoice?.number || '—';
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

  const paymentText =
    order.paymentMethod === 'cash'
      ? '💵 Efectivo al recibir (cobramos en la puerta)'
      : '💳 Tarjeta con terminal en tu casa (llevamos el aparato)';

  let cashBlock = '';
  if (order.paymentMethod === 'cash' && order.cashIntent?.amountTendered) {
    const ch = Number(order.cashIntent.change) || 0;
    cashBlock =
      `\n💵 *Vas a pagar con:* ${formatCashBills(order.cashIntent)}\n` +
      (ch > 0
        ? `• Tu vuelto estimado: *Q${ch.toLocaleString('es-GT')}*\n`
        : `• Pago cabal (sin vuelto) ✨\n`);
  }

  return (
    `╭──────────────────────────╮\n` +
    `│  🧾 *COMPROBANTE DE PEDIDO*  │\n` +
    `│     🐔 La Granjita · TIENDA   │\n` +
    `╰──────────────────────────╯\n\n` +
    `¡Hola *${order.customer.name}*! 🧡\n` +
    `Tu pedido ya está *confirmado* y en buenas manos.\n\n` +
    `🧾 *Factura:* ${inv}\n` +
    `🆔 *Pedido:* #${code}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `📦 *Detalle:*\n${itemsList}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `💰 *Subtotal:* Q${order.subtotal.toLocaleString('es-GT')}\n` +
    `🚚 *Envío:* ${order.deliveryFee > 0 ? 'Q' + order.deliveryFee.toLocaleString('es-GT') : 'Gratis ✨'}\n` +
    `💵 *TOTAL:* *Q${order.total.toLocaleString('es-GT')}*\n` +
    `💳 *Pago:* ${paymentText}\n` +
    cashBlock +
    `📍 *Dirección:* ${order.customer.address}\n` +
    (order.customer.notes ? `📝 *Notas:* ${order.customer.notes}\n` : '') +
    `\n⏳ Estado: *Pendiente* — te avisamos cuando salga el repartidor 🛵\n\n` +
    `Guardá este mensaje como tu comprobante 💛\n` +
    `¡Gracias por preferirnos! Con amor, *La Granjita* 🐔`
  );
}

/** Q con 2 decimales, ej: Q 6.00 */
function money2(n) {
  return `Q ${Number(n || 0).toLocaleString('es-GT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Fecha civil de Guatemala DD/MM/YYYY, HH:mm */
function gtDateTime(d) {
  try {
    return new Intl.DateTimeFormat('es-GT', {
      timeZone: 'America/Guatemala',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(d || Date.now()));
  } catch {
    return new Date(d || Date.now()).toLocaleString('es-GT');
  }
}

/** Etiqueta de cantidad: peso → "0.5 lb", unidad → "1x" */
function qtyLabel(item) {
  if (item?.unitType === 'weight') {
    return `${Number(item.quantity).toLocaleString('es-GT')} lb`;
  }
  return `${item.quantity}x`;
}

/**
 * Factura en TEXTO para el WhatsApp del cliente (formato La Granjita).
 * Se envía cuando el pedido pasa a "En proceso".
 */
function formatInvoiceText(order) {
  const code = order._id.toString().slice(-6).toUpperCase();
  const inv = order.invoice?.number || `PED-${code}`;
  const fecha = gtDateTime(order.invoice?.issuedAt || order.createdAt);
  const zona = (order.customer?.zone || order.customer?.municipality || '').trim();
  const dir =
    (order.customer?.address || '').trim() + (zona ? ` (${zona})` : '');

  const detalle = (order.items || [])
    .map((item) => {
      const name =
        `${item.productName}` +
        (item.variant?.name ? ` (${item.variant.name})` : '') +
        (item.extras?.length ? ` + ${item.extras.map((e) => e.name).join(', ')}` : '');
      return `• ${qtyLabel(item)} ${name} ····· ${money2(item.subtotal)}`;
    })
    .join('\n');

  let pagoBlock;
  if (order.paymentMethod === 'cash') {
    let cash = '';
    if (order.cashIntent?.amountTendered) {
      const ch = Number(order.cashIntent.change) || 0;
      cash =
        `\nPaga con: ${formatCashBills(order.cashIntent)}  ·  entregás ${money2(order.cashIntent.amountTendered)}\n` +
        (ch > 0 ? `Vuelto: ${money2(ch)}` : `Pago cabal — sin vuelto`);
    }
    pagoBlock = `💵 *Pago:* Efectivo al entregar${cash}`;
  } else {
    pagoBlock =
      `💳 *Pago:* Tarjeta con terminal en tu casa\n` +
      `A cobrar: ${money2(order.total)}`;
  }

  return (
    `🧾 *LA GRANJITA · FACTURA*\n` +
    `Factura: ${inv}\n` +
    `Pedido: #${code}\n` +
    `Fecha: ${fecha}\n\n` +
    `👤 *Cliente*\n` +
    `${order.customer?.name || '—'}\n` +
    `📞 ${order.customer?.phone || '—'}\n` +
    `📍 ${dir || '—'}\n` +
    (order.customer?.notes ? `📝 ${order.customer.notes}\n` : '') +
    `\n🛒 *Detalle*\n${detalle}\n\n` +
    `Subtotal: ${money2(order.subtotal)}\n` +
    `Envío: ${order.deliveryFee > 0 ? money2(order.deliveryFee) : 'Gratis'}\n` +
    `*TOTAL: ${money2(order.total)}*\n\n` +
    `${pagoBlock}\n\n` +
    `_Gracias por preferirnos 🐔_`
  );
}

/**
 * Mensaje corto al crear el pedido (estado "Nuevo").
 * Todavía NO se manda la factura (va en "En proceso").
 */
function formatNewOrderCustomer(order) {
  const code = order._id.toString().slice(-6).toUpperCase();
  return (
    `🧡 *¡Recibimos tu pedido!*\n` +
    `🐔 La Granjita · TIENDA\n\n` +
    `Hola *${order.customer?.name || ''}*,\n` +
    `Tu pedido *#${code}* ya entró a la cola.\n\n` +
    `👀 En un momentito un *proveedor* lo va a revisar.\n` +
    `Cuando lo confirme, te avisamos por este mismo chat con todos los detalles y tu factura.\n\n` +
    `💵 Total estimado: *${money2(order.total)}*\n\n` +
    `¡Gracias por preferirnos! 💛`
  );
}

/**
 * Mensaje cuando el admin MODIFICA el pedido (agregó/quitó productos).
 */
function formatOrderUpdatedCustomer(order) {
  const code = order._id.toString().slice(-6).toUpperCase();
  const detalle = (order.items || [])
    .map((item) => {
      const name =
        `${item.productName}` +
        (item.variant?.name ? ` (${item.variant.name})` : '');
      return `• ${qtyLabel(item)} ${name} ····· ${money2(item.subtotal)}`;
    })
    .join('\n');
  return (
    `✏️ *Tu pedido fue actualizado*\n` +
    `🐔 La Granjita\n\n` +
    `Pedido *#${code}*\n\n` +
    `🛒 *Nuevo detalle:*\n${detalle}\n\n` +
    `*NUEVO TOTAL: ${money2(order.total)}*\n\n` +
    `Si algo no cuadra, escribinos por este chat 💛`
  );
}

/**
 * Mensaje al cliente según el nuevo estado (flujo La Granjita):
 * Nuevo → Confirmado → En proceso → En camino → Entregado
 */
/** Invitación a pedir de nuevo (se manda cuando el pedido queda Entregado) */
function formatDeliveredInvite() {
  return (
    `🛍️ *¿Se te antoja algo más?*\n\n` +
    `Cuando quieras hacer *otro pedido*, entrá a nuestra tienda:\n` +
    `👉 ${STORE_URL}\n\n` +
    `Es rapidísimo y te lo llevamos a la puerta 🛵\n` +
    `¡Te esperamos! 🐔🧡`
  );
}

function formatStatusUpdate(order) {
  const code = order._id.toString().slice(-6).toUpperCase();
  const name = order.customer?.name || '';
  const paymentText =
    order.paymentMethod === 'cash' ? '💵 Efectivo al entregar' : '💳 Terminal en tu casa';

  switch (order.orderStatus) {
    case 'confirmed':
      return (
        `✅ *¡Tu pedido fue confirmado!*\n` +
        `🐔 La Granjita\n\n` +
        `Hola *${name}*, un *proveedor* está revisando tu pedido *#${code}* 👀\n` +
        `Está confirmando que tengamos *todo lo que pediste*.\n\n` +
        `Si llegara a faltar algo, te avisamos por acá y lo *cambiamos por lo que vos quieras* 💛\n\n` +
        `Y si vos querés ajustar algo:\n` +
        `• *Agregar* más productos\n` +
        `• *Quitar* o *cambiar* algo de la lista\n\n` +
        `Escribinos por este mismo chat *antes de que pase a "En proceso"* ⏳\n` +
        `Cuando lo pasemos a *En proceso*, te llega tu *factura* 🧾`
      );

    case 'preparing':
      return (
        `👨‍🍳 *¡Manos a la obra!*\n` +
        `🐔 La Granjita\n\n` +
        `Hola *${name}*, tu pedido *#${code}* quedó *confirmado* y ya lo estamos preparando.\n\n` +
        `Aquí abajo te dejamos tu *factura* 🧾👇`
      );

    case 'in_transit': {
      let cashClient = '';
      if (order.paymentMethod === 'cash' && order.cashIntent?.amountTendered) {
        const ch = Number(order.cashIntent.change) || 0;
        cashClient =
          `\n💵 *Vas a pagar con:* ${formatCashBills(order.cashIntent)}\n` +
          `• Total: ${money2(order.total)}\n` +
          (ch > 0
            ? `• Tu vuelto: *${money2(ch)}*\n`
            : `• Pago cabal (sin vuelto)\n`);
      }
      return (
        `🛵 *¡Tu pedido salió a ruta!*\n` +
        `🐔 La Granjita\n\n` +
        `Hola *${name}*,\n` +
        `Tu pedido *#${code}* ya va *en camino* a tu puerta 🎉\n` +
        (order.invoice?.number ? `🧾 Factura: *${order.invoice.number}*\n` : '') +
        `\n💵 *TOTAL: ${money2(order.total)}*\n` +
        `💳 Pago: ${paymentText}\n` +
        cashClient +
        `\n¡Estate atento/a a la puerta! 🧡`
      );
    }

    case 'delivered':
      return (
        `🎉 *¡Pedido entregado!*\n` +
        `🐔 La Granjita\n\n` +
        `Hola *${name}*, tu pedido *#${code}* fue *entregado* con éxito ✅\n\n` +
        `Gracias de corazón por confiar en nosotros 💛\n` +
        `*¡Que tengas un feliz día!* ☀️🐔\n\n` +
        `Cuando quieras volver a pedir, acá estamos para vos.`
      );

    case 'cancelled':
      return (
        `❌ *Pedido cancelado*\n` +
        `🐔 La Granjita\n\n` +
        `Hola *${name}*, tu pedido *#${code}* fue cancelado.\n` +
        `Si fue un error o tenés dudas, escribinos por este chat y lo resolvemos 💛`
      );

    default: // pending / desconocido
      return (
        `🧡 *Tu pedido #${code}*\n` +
        `Hola *${name}*, tu pedido está *en cola* y pronto un proveedor lo revisará.\n` +
        `Te avisamos por este chat en cada paso. ¡Gracias! 🐔`
      );
  }
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

/** Resuelve chatId real de un teléfono (falla si no tiene WhatsApp) */
async function resolveChatId(rawPhone) {
  const phone = normalizePhone(rawPhone);
  if (!phone) throw new Error('Teléfono vacío o inválido');
  if (!client || !isReady) throw new Error('WhatsApp no conectado');

  try {
    const numberId = await client.getNumberId(phone);
    if (numberId?._serialized) return { phone, chatId: numberId._serialized };
    if (numberId?.user) {
      return {
        phone,
        chatId: `${numberId.user}@${numberId.server || 'c.us'}`,
      };
    }
  } catch (e) {
    console.warn(`[WhatsApp] getNumberId(${phone}):`, e.message);
  }

  // Fallback: muchos números GT funcionan directo con @c.us
  return { phone, chatId: `${phone}@c.us` };
}

/** Envía PDF de factura como documento por WhatsApp al número indicado */
async function sendInvoicePdfTo(rawPhone, order, caption) {
  const { phone, chatId } = await resolveChatId(rawPhone);
  if (phone.length < 10) {
    throw new Error(
      `Teléfono muy corto (${phone}). El cliente debe poner su WhatsApp real con código de país.`
    );
  }

  const { filePath, fileName } = await generateInvoicePdf(order);
  const media = MessageMedia.fromFilePath(filePath);
  media.filename = fileName;

  await client.sendMessage(chatId, media, {
    caption:
      caption ||
      `🧾 Factura *${order.invoice?.number || ''}* · La Granjita\n` +
        `Pedido #${order._id.toString().slice(-6).toUpperCase()}`,
    sendMediaAsDocument: true,
    sendSeen: false,
  });
  console.log(`✅ PDF factura → ${phone} (${fileName}) chatId=${chatId}`);
  return { filePath, fileName, phone, chatId };
}

/**
 * AL DUEÑO (OWNER_WHATSAPP): aviso "HAY PEDIDO"
 * No manda el PDF al dueño; el PDF va al cliente que pidió.
 */
async function sendOrderNotification(order) {
  const ownerNumber = process.env.OWNER_WHATSAPP;
  if (!ownerNumber) {
    throw new Error('OWNER_WHATSAPP no configurado en .env');
  }
  if (!client || !isReady) {
    throw new Error('WhatsApp no está CONECTADO — no se pudo avisar al dueño');
  }

  const code = order._id.toString().slice(-6).toUpperCase();
  const inv = order.invoice?.number || '—';
  const clientPhone = normalizePhone(order.customer?.phone) || order.customer?.phone;

  // 1) Aviso corto y claro: HAY PEDIDO
  const alert =
    `🚨 *¡HAY PEDIDO NUEVO!*\n\n` +
    `🧾 Factura: *${inv}*\n` +
    `🆔 Pedido: *#${code}*\n` +
    `👤 Cliente: *${order.customer?.name}*\n` +
    `📱 WhatsApp cliente: *${clientPhone}*\n` +
    `📍 ${order.customer?.address}\n` +
    `💵 *TOTAL: Q${Number(order.total).toLocaleString('es-GT')}*\n` +
    (order.paymentMethod === 'cash'
      ? order.cashIntent?.amountTendered
        ? `💰 Paga con: Q${order.cashIntent.amountTendered}` +
          (order.cashIntent.change > 0
            ? ` · ⚠️ Llevar vuelto Q${order.cashIntent.change}`
            : ' · pago cabal')
        : '💵 Efectivo al entregar'
      : '💳 Terminal POS en casa') +
    `\n\n_La factura PDF se mandó al WhatsApp del cliente._\n` +
    `_Revisá el panel admin para más detalle._`;

  await sendWaMessage(ownerNumber, alert);

  // 2) Detalle completo del pedido (texto)
  await sendWaMessage(ownerNumber, formatOrderMessage(order));

  console.log(
    `✅ Aviso "HAY PEDIDO" → dueño ${normalizePhone(ownerNumber)} ` +
      `(#${code} factura ${inv})`
  );
}

/**
 * AL CLIENTE (el número con el que pidió):
 * mensaje de confirmación + PDF de factura en ese mismo chat.
 */
async function sendCustomerConfirmation(order) {
  if (!client || !isReady) {
    throw new Error('WhatsApp no está CONECTADO — no se envió factura al cliente');
  }

  // SIEMPRE el teléfono del pedido (quien lo pidió)
  const phone = normalizePhone(order.customer?.phone);
  if (!phone) {
    throw new Error('El pedido no tiene teléfono del cliente');
  }
  if (phone.length < 10) {
    throw new Error(
      `Teléfono del cliente inválido (${phone}). Debe ser su WhatsApp real, ej. 502XXXXXXXX`
    );
  }

  console.log(
    `📲 Enviando factura al NÚMERO QUE PIDIÓ: ${phone} ` +
      `factura=${order.invoice?.number} pedido=#${order._id.toString().slice(-6).toUpperCase()}`
  );

  // 1) Mensaje de texto al cliente
  await sendWaMessage(phone, formatCustomerConfirmation(order));

  // 2) PDF de factura AL MISMO NÚMERO (quien pidió)
  await sendInvoicePdfTo(
    phone,
    order,
    `🧾 *Tu factura* ${order.invoice?.number || ''}\n` +
      `Pedido #${order._id.toString().slice(-6).toUpperCase()}\n` +
      `Total *Q${Number(order.total).toLocaleString('es-GT')}*\n\n` +
      `Este PDF es tu comprobante 🧡\n` +
      `¡Gracias por pedir en La Granjita! 🐔`
  );

  console.log(`✅ Texto + PDF de factura enviados al cliente ${phone}`);

  // 3) Menú post-pedido (otro / modificar / atención)
  try {
    await sendAfterOrderMenu(order);
  } catch (e) {
    console.warn('[WhatsApp] menú post-pedido:', e.message);
  }
}

async function sendOrderStatusUpdate(order) {
  if (!client || !isReady) {
    console.warn('WhatsApp no disponible. Notificación de estado no enviada.');
    return;
  }

  const phone = normalizePhone(order.customer?.phone);
  if (!phone) {
    console.warn('Teléfono del cliente no disponible. Omitiendo notificación de estado.');
    return;
  }

  try {
    const message = formatStatusUpdate(order);
    await sendWaMessage(phone, message);
    console.log(`✅ Notificación de estado enviada al cliente ${phone} para pedido #${order._id.toString().slice(-6).toUpperCase()} → ${order.orderStatus}`);

    // En proceso: además de "confirmado", mandar la FACTURA en texto al cliente
    if (order.orderStatus === 'preparing') {
      await sendWaMessage(phone, formatInvoiceText(order));
      console.log(`✅ Factura (texto) enviada al cliente ${phone}`);
    }

    // Entregado: invitar a pedir de nuevo con el link + dejar el menú post-pedido
    if (order.orderStatus === 'delivered') {
      await sendWaMessage(phone, formatDeliveredInvite());
      console.log(`✅ Invitación a nuevo pedido enviada al cliente ${phone}`);
      try {
        await sendAfterOrderMenu(order);
      } catch (e) {
        console.warn('[WhatsApp] menú post-entrega:', e.message);
      }
    }

    // Al salir en camino: factura completa al dueño/repartidor (billetes + vuelto a llevar)
    if (order.orderStatus === 'in_transit') {
      await notifyOwner(formatInvoiceForDelivery(order));
      console.log(`✅ Factura de entrega enviada al dueño (vuelto / billetes)`);
    }
  } catch (error) {
    console.error(`Error enviando notificación de estado al cliente:`, error.message);
  }
}

/**
 * Al CREAR el pedido (estado Nuevo): mensaje corto al cliente + menú post-pedido.
 * NO manda factura todavía (va en "En proceso").
 */
async function sendCustomerNewOrder(order) {
  if (!client || !isReady) {
    throw new Error('WhatsApp no está CONECTADO — no se avisó al cliente');
  }
  const phone = normalizePhone(order.customer?.phone);
  if (!phone) throw new Error('El pedido no tiene teléfono del cliente');
  if (phone.length < 10) {
    throw new Error(`Teléfono del cliente inválido (${phone}).`);
  }

  await sendWaMessage(phone, formatNewOrderCustomer(order));
  console.log(`✅ Aviso "pedido recibido" enviado al cliente ${phone}`);

  try {
    await sendAfterOrderMenu(order);
  } catch (e) {
    console.warn('[WhatsApp] menú post-pedido:', e.message);
  }
}

/** Cuando el admin edita los productos del pedido → avisar al cliente el nuevo total */
async function sendOrderUpdatedToCustomer(order) {
  if (!client || !isReady) return;
  const phone = normalizePhone(order.customer?.phone);
  if (!phone || phone.length < 10) return;
  try {
    await sendWaMessage(phone, formatOrderUpdatedCustomer(order));
    console.log(`✅ Aviso de pedido modificado enviado al cliente ${phone}`);
  } catch (e) {
    console.warn('[WhatsApp] aviso modificación:', e.message);
  }
}

/** Mensaje "falta algo del pedido" que el proveedor manda antes de la factura */
function formatMissingItems(order, { items = [], note = '' } = {}) {
  const code = order._id.toString().slice(-6).toUpperCase();
  const name = order.customer?.name || '';
  const list = (items || [])
    .filter(Boolean)
    .map((t) => `• ${t}`)
    .join('\n');
  return (
    `⚠️ *Sobre tu pedido #${code}*\n` +
    `🐔 La Granjita\n\n` +
    `Hola *${name}*, revisando tu pedido nos dimos cuenta de que por ahora ` +
    `*no tenemos disponible*:\n` +
    (list ? `${list}\n` : '') +
    (note ? `\n📝 ${note}\n` : '') +
    `\n¿Querés que lo *quitemos* o lo *cambiemos por otra cosa*?\n` +
    `Respondé por este mismo chat y lo ajustamos enseguida 💛`
  );
}

/**
 * El proveedor avisa al cliente que falta algo del pedido (antes de la factura).
 * Deja la sesión esperando la respuesta del cliente (que le llega al dueño).
 */
async function sendMissingItemsToCustomer(order, payload = {}) {
  if (!client || !isReady) {
    throw new Error('WhatsApp no está CONECTADO — no se avisó al cliente');
  }
  const phone = normalizePhone(order.customer?.phone);
  if (!phone || phone.length < 10) {
    throw new Error('Teléfono del cliente inválido');
  }
  const code = order._id.toString().slice(-6).toUpperCase();
  await sendWaMessage(phone, formatMissingItems(order, payload));
  // Dejar la sesión esperando el cambio: la respuesta del cliente le llega al dueño
  try {
    setSession(phone, {
      greetedDay: todayKey(),
      state: STATE.AWAIT_MOD,
      lastMenu: 'after',
      lastOrderId: String(order._id),
      lastOrderCode: code,
    });
  } catch {
    /* ignore */
  }
  console.log(`✅ Aviso "falta algo" enviado al cliente ${phone}`);
}

async function startWhatsApp() {
  // Handlers globales ya están en server.js; aquí solo reconectar si WA se cae
  if (!process.__tiendaWaReconnectHook) {
    process.__tiendaWaReconnectHook = true;
    process.on('unhandledRejection', (reason) => {
      const msg = String(reason?.message || reason || '');
      if (/ProtocolError|Execution context|puppeteer|Target closed|Session closed|Protocol error|browser has disconnected|Evaluation failed/i.test(msg)) {
        isReady = false;
        scheduleReconnect();
      }
    });
    process.on('uncaughtException', (err) => {
      const msg = String(err?.message || err || '');
      if (/ProtocolError|Execution context|puppeteer|Target closed|Session closed|Protocol error|browser has disconnected|Evaluation failed/i.test(msg)) {
        isReady = false;
        scheduleReconnect();
      }
    });
  }
  try {
    initWhatsApp();
  } catch (e) {
    console.error('[WhatsApp] start falló, API sigue:', e?.message || e);
  }
}

async function sendTestMessage(toNumber) {
  if (!client || !isReady) {
    throw new Error('WhatsApp no está conectado');
  }
  const chatId = await sendWaMessage(
    toNumber,
    '🐔 *Mensaje de prueba* 🐔\n\nSi ves este mensaje, WhatsApp está funcionando correctamente en TIENDA.'
  );
  console.log(`✅ Mensaje de prueba enviado a ${toNumber} (${chatId})`);
}

module.exports = {
  initWhatsApp,
  sendOrderNotification,
  sendCustomerConfirmation,
  sendCustomerNewOrder,
  sendOrderUpdatedToCustomer,
  sendMissingItemsToCustomer,
  sendOrderStatusUpdate,
  sendAfterOrderMenu,
  sendTestMessage,
  sendInvoicePdfTo,
  startWhatsApp,
  getWhatsAppStatus,
  getCurrentQR,
  getPairingCode,
  requestPairingCode,
  logoutWhatsApp,
  hasSavedSession,
  getAuthPath,
  notifyOwner,
  // Builders de texto (reutilizados por el motor Cloud API — solo lectura)
  formatNewOrderCustomer,
  formatStatusUpdate,
  formatInvoiceText,
  formatOrderUpdatedCustomer,
  formatMissingItems,
  formatDeliveredInvite,
  formatOrderMessage,
  formatInvoiceForDelivery,
};
