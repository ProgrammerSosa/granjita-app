const fs = require('fs');
const path = require('path');
const Product = require('../models/Product');

const DATA_DIR = path.join(__dirname, '../../data');
const ALERTS_PATH = path.join(DATA_DIR, 'stock-alerts.json');

function readAlertState() {
  try {
    if (!fs.existsSync(ALERTS_PATH)) return { last: {}, events: [] };
    return JSON.parse(fs.readFileSync(ALERTS_PATH, 'utf8'));
  } catch {
    return { last: {}, events: [] };
  }
}

function writeAlertState(state) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  // conservar últimos 80 eventos
  state.events = (state.events || []).slice(-80);
  fs.writeFileSync(ALERTS_PATH, JSON.stringify(state, null, 2), 'utf8');
}

function pushEvent(state, event) {
  state.events = state.events || [];
  state.events.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    read: false,
    at: new Date().toISOString(),
    ...event,
  });
}

/**
 * Tras bajar stock: marca agotado si 0 y dispara alertas (WA + log admin).
 * level: 'low' (3–5 o umbral) | 'out' (0)
 */
async function applyStockSideEffects(product, { sendWhatsApp } = {}) {
  if (!product || product.trackStock === false) return { product, alert: null };

  const threshold = Number(product.lowStockThreshold ?? 5);
  const stock = Math.max(0, Number(product.stock) || 0);
  let changed = false;

  // Agotado automático
  if (stock <= 0 && product.available !== false) {
    product.available = false;
    product.stock = 0;
    changed = true;
  }
  // Si había stock y estaba agotado por inventario, reactivar
  if (stock > 0 && product.available === false) {
    // solo reabrir si no lo dejaron a propósito: reabrir cuando stock > 0
    product.available = true;
    changed = true;
  }

  if (changed) await product.save();

  let level = null;
  if (stock <= 0) level = 'out';
  else if (stock <= threshold) level = 'low';

  const state = readAlertState();
  const key = String(product._id);

  // Stock sano → limpia última alerta de ese producto
  if (!level) {
    if (state.last[key]) {
      delete state.last[key];
      writeAlertState(state);
    }
    return { product, alert: null };
  }

  const prev = state.last[key];

  // No spamear el mismo nivel
  if (prev?.level === level) {
    return { product, alert: null, skipped: true };
  }

  state.last[key] = { level, stock, at: new Date().toISOString() };

  const alert = {
    type: 'stock',
    level,
    productId: key,
    productName: product.name,
    stock,
    threshold,
    message:
      level === 'out'
        ? `AGOTADO: ${product.name} (0 en stock). Ya se marca como no disponible en la tienda.`
        : `Stock bajo: ${product.name} — quedan ${stock} (umbral ${threshold}).`,
  };

  pushEvent(state, alert);
  writeAlertState(state);

  // WhatsApp al dueño
  if (typeof sendWhatsApp === 'function') {
    try {
      const text =
        level === 'out'
          ? `🚨 *STOCK AGOTADO*\n\n` +
            `🛒 *${product.name}*\n` +
            `📦 Quedan: *0*\n` +
            `❌ Se marcó como *Agotado* en la tienda.\n\n` +
            `_Reponé stock en Admin → Stock_`
          : `⚠️ *STOCK BAJO*\n\n` +
            `🛒 *${product.name}*\n` +
            `📦 Quedan: *${stock}* (aviso a ${threshold})\n\n` +
            `_Revisá Admin → Stock / Mensajes_`;
      await sendWhatsApp(text);
    } catch (e) {
      console.warn('[stock] WA alert falló:', e.message);
    }
  }

  return { product, alert };
}

/**
 * Descuenta stock de varios ítems de pedido (atómico por producto).
 * @returns {{ depleted: Product[], alerts: any[] }}
 */
async function consumeStockForOrder(items, { sendWhatsApp } = {}) {
  // Agrupar cantidades por productId
  const byId = {};
  for (const it of items) {
    const id = String(it.productId || it.product);
    const q = Math.max(1, parseInt(it.quantity, 10) || 1);
    byId[id] = (byId[id] || 0) + q;
  }

  const results = [];
  const alerts = [];

  for (const [id, qty] of Object.entries(byId)) {
    const product = await Product.findById(id);
    if (!product) throw new Error(`Producto no encontrado: ${id}`);

    if (product.trackStock === false) {
      results.push(product);
      continue;
    }

    // Productos viejos sin campo stock → inicializar
    if (product.stock == null || Number.isNaN(Number(product.stock))) {
      product.stock = 20;
      await product.save();
    }

    if (product.available === false && (product.stock || 0) <= 0) {
      throw new Error(`"${product.name}" está agotado`);
    }

    if ((product.stock || 0) < qty) {
      throw new Error(
        `No hay suficiente stock de "${product.name}". Quedan ${product.stock || 0}, pediste ${qty}.`
      );
    }

    const updated = await Product.findOneAndUpdate(
      { _id: id, stock: { $gte: qty } },
      { $inc: { stock: -qty } },
      { new: true }
    );

    if (!updated) {
      throw new Error(`Stock insuficiente de "${product.name}" (se agotó al confirmar).`);
    }

    const { product: finalP, alert } = await applyStockSideEffects(updated, { sendWhatsApp });
    results.push(finalP);
    if (alert) alerts.push(alert);
  }

  return { products: results, alerts };
}

/** Resumen para panel stock / campana */
async function getStockOverview() {
  const products = await Product.find({ trackStock: { $ne: false } }).sort({ stock: 1, name: 1 });
  const list = products.map((p) => {
    const stock = Number(p.stock) || 0;
    const threshold = Number(p.lowStockThreshold ?? 5);
    let status = 'ok';
    if (stock <= 0) status = 'out';
    else if (stock <= threshold) status = 'low';
    return {
      id: p._id,
      name: p.name,
      category: p.category,
      image: p.image,
      stock,
      lowStockThreshold: threshold,
      available: p.available,
      trackStock: p.trackStock !== false,
      status,
    };
  });

  const out = list.filter((p) => p.status === 'out');
  const low = list.filter((p) => p.status === 'low');
  const ok = list.filter((p) => p.status === 'ok');

  const state = readAlertState();
  const events = (state.events || []).slice().reverse();
  const unread = events.filter((e) => !e.read).length;

  return {
    products: list,
    counts: {
      total: list.length,
      out: out.length,
      low: low.length,
      ok: ok.length,
      unreadAlerts: unread,
    },
    out,
    low,
    events,
  };
}

function markAlertsRead(ids) {
  const state = readAlertState();
  const set = ids ? new Set(ids.map(String)) : null;
  state.events = (state.events || []).map((e) => {
    if (!set || set.has(String(e.id))) return { ...e, read: true };
    return e;
  });
  writeAlertState(state);
  return state.events;
}

function getUnreadAlerts() {
  const state = readAlertState();
  const events = (state.events || []).filter((e) => !e.read).reverse();
  return events;
}

module.exports = {
  consumeStockForOrder,
  applyStockSideEffects,
  getStockOverview,
  markAlertsRead,
  getUnreadAlerts,
  readAlertState,
};
