const Product = require('../models/Product');
const Category = require('../models/Category');
const {
  getStockOverview,
  markAlertsRead,
  getUnreadAlerts,
  applyStockSideEffects,
} = require('../services/stockService');
const { notifyOwner } = require('../services/whatsappService');

async function assertValidCategory(categoryName) {
  if (!categoryName?.trim()) {
    throw new Error('La categoría es obligatoria');
  }
  const cat = await Category.findOne({ name: categoryName.trim(), active: true });
  if (!cat) {
    // permitir categorías inactivas solo si ya existen (edición)
    const any = await Category.findOne({ name: categoryName.trim() });
    if (!any) {
      throw new Error(`La categoría "${categoryName}" no existe. Creala desde el panel admin.`);
    }
  }
  return categoryName.trim();
}

exports.getAllProducts = async (req, res) => {
  try {
    const { category, q, featured } = req.query;
    // Incluye agotados (available:false) para mostrar badge "Agotado" en la tienda
    const filter = {};
    if (category) filter.category = category;
    if (featured === 'true') filter.featured = true;
    if (q?.trim()) {
      filter.$or = [
        { name: { $regex: q.trim(), $options: 'i' } },
        { description: { $regex: q.trim(), $options: 'i' } },
      ];
    }

    const products = await Product.find(filter).sort({ featured: -1, available: -1, category: 1, name: 1 });
    return res.json({ success: true, data: products });
  } catch (error) {
    console.error('Error al obtener productos:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener productos' });
  }
};

exports.getAllProductsAdmin = async (req, res) => {
  try {
    const { category } = req.query;
    const filter = {};
    if (category) filter.category = category;
    const products = await Product.find(filter).sort({ category: 1, name: 1 });
    return res.json({ success: true, data: products });
  } catch (error) {
    console.error('Error al obtener productos admin:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener productos' });
  }
};

exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Producto no encontrado' });
    }
    return res.json({ success: true, data: product });
  } catch (error) {
    console.error('Error al obtener producto:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener producto' });
  }
};

function normalizeStockFields(body) {
  if (body.stock !== undefined) body.stock = Math.max(0, Number(body.stock) || 0);
  if (body.lowStockThreshold !== undefined) {
    body.lowStockThreshold = Math.max(0, Number(body.lowStockThreshold) || 0);
  }
  if (body.trackStock !== undefined) body.trackStock = Boolean(body.trackStock);
  // Si stock 0 y trackea → no disponible
  if (body.trackStock !== false && body.stock === 0) {
    body.available = false;
  }
  return body;
}

/** Variantes por unidad / peso + precio de vitrina = mínimo */
function normalizeSellAndVariants(body) {
  const sellByUnit = body.sellByUnit !== false && body.sellByUnit !== 'false';
  const sellByWeight = body.sellByWeight === true || body.sellByWeight === 'true';
  body.sellByUnit = Boolean(sellByUnit);
  body.sellByWeight = Boolean(sellByWeight);

  if (!body.sellByUnit && !body.sellByWeight) {
    throw new Error('Marcá al menos una forma de venta: por unidad y/o por peso');
  }

  let variants = Array.isArray(body.variants) ? body.variants : [];
  variants = variants
    .map((v) => ({
      name: String(v.name || '').trim(),
      price: Number(v.price),
      kind: v.kind === 'weight' ? 'weight' : 'unit',
    }))
    .filter((v) => v.name && Number.isFinite(v.price) && v.price >= 0);

  // Solo dejar variantes del tipo habilitado
  variants = variants.filter((v) => {
    if (v.kind === 'weight') return body.sellByWeight;
    return body.sellByUnit;
  });

  if (variants.length === 0) {
    throw new Error(
      'Agregá al menos una variante con precio (ej: 1 pieza, 1 lb, 1 kg). El precio se maneja en las variantes.'
    );
  }

  body.variants = variants;
  // Precio de tarjeta = el más bajo entre variantes
  body.price = Math.min(...variants.map((v) => v.price));
  return body;
}

exports.createProduct = async (req, res) => {
  try {
    let body = normalizeStockFields({ ...req.body });
    body = normalizeSellAndVariants(body);
    body.category = await assertValidCategory(body.category);
    if (body.stock === undefined) body.stock = 20;
    if (body.lowStockThreshold === undefined) body.lowStockThreshold = 5;
    const product = await Product.create(body);
    return res.status(201).json({ success: true, data: product });
  } catch (error) {
    console.error('Error al crear producto:', error);
    return res.status(400).json({ success: false, message: error.message });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    let body = normalizeStockFields({ ...req.body });
    if (body.variants !== undefined || body.sellByUnit !== undefined || body.sellByWeight !== undefined) {
      // Si mandan variantes o modos de venta, normalizar completo
      if (body.sellByUnit === undefined || body.sellByWeight === undefined) {
        const existing = await Product.findById(req.params.id).lean();
        if (existing) {
          if (body.sellByUnit === undefined) body.sellByUnit = existing.sellByUnit !== false;
          if (body.sellByWeight === undefined) body.sellByWeight = Boolean(existing.sellByWeight);
          if (body.variants === undefined) body.variants = existing.variants || [];
        }
      }
      body = normalizeSellAndVariants(body);
    }
    if (body.category) {
      body.category = await assertValidCategory(body.category);
    }
    const product = await Product.findByIdAndUpdate(req.params.id, body, {
      new: true,
      runValidators: true,
    });
    if (!product) {
      return res.status(404).json({ success: false, message: 'Producto no encontrado' });
    }
    // Si repusieron stock, reactivar en tienda
    if (product.trackStock !== false && product.stock > 0 && !product.available) {
      product.available = true;
      await product.save();
    }
    if (product.trackStock !== false && product.stock <= 0) {
      product.available = false;
      product.stock = 0;
      await product.save();
    }
    return res.json({ success: true, data: product });
  } catch (error) {
    console.error('Error al actualizar producto:', error);
    return res.status(400).json({ success: false, message: error.message });
  }
};

/** Admin: overview stock + alertas */
exports.getStockAdmin = async (_req, res) => {
  try {
    const data = await getStockOverview();
    return res.json({ success: true, data });
  } catch (error) {
    console.error('Error stock admin:', error);
    return res.status(500).json({ success: false, message: 'Error al cargar stock' });
  }
};

/** Admin: ajustar stock rápido */
exports.adjustStock = async (req, res) => {
  try {
    const { stock, lowStockThreshold, trackStock, available } = req.body || {};
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Producto no encontrado' });
    }
    if (stock !== undefined) product.stock = Math.max(0, Number(stock) || 0);
    if (lowStockThreshold !== undefined) {
      product.lowStockThreshold = Math.max(0, Number(lowStockThreshold) || 0);
    }
    if (trackStock !== undefined) product.trackStock = Boolean(trackStock);
    if (available !== undefined) product.available = Boolean(available);

    if (product.trackStock !== false) {
      if (product.stock <= 0) {
        product.stock = 0;
        product.available = false;
      } else if (product.available === false && product.stock > 0) {
        product.available = true;
      }
    }
    await product.save();

    // Si quedó bajo, registrar alerta (sin spamear WA si ya estaba)
    await applyStockSideEffects(product, {
      sendWhatsApp: async (text) => {
        if (typeof notifyOwner === 'function') await notifyOwner(text);
      },
    });

    const data = await getStockOverview();
    return res.json({ success: true, data: { product, overview: data } });
  } catch (error) {
    console.error('Error adjust stock:', error);
    return res.status(400).json({ success: false, message: error.message });
  }
};

/** Campana admin: no leídas + resumen */
exports.getAdminAlerts = async (_req, res) => {
  try {
    const overview = await getStockOverview();
    const unread = getUnreadAlerts();
    return res.json({
      success: true,
      data: {
        unreadCount: unread.length + (overview.counts?.out || 0) + (overview.counts?.low || 0),
        /** eventos nuevos (WA/log) */
        events: unread,
        /** estado actual stock */
        low: overview.low,
        out: overview.out,
        counts: overview.counts,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error al cargar alertas' });
  }
};

exports.markAdminAlertsRead = async (req, res) => {
  try {
    const ids = req.body?.ids;
    markAlertsRead(ids);
    return res.json({ success: true, message: 'Alertas marcadas como leídas' });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Producto no encontrado' });
    }
    return res.json({ success: true, message: 'Producto eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar producto:', error);
    return res.status(500).json({ success: false, message: 'Error al eliminar producto' });
  }
};
