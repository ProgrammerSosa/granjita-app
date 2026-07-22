const crypto = require('crypto');
const Order = require('../models/Order');
const Product = require('../models/Product');

/** Token aleatorio para el link público del PDF de la factura */
function invoiceToken() {
  return crypto.randomBytes(16).toString('hex');
}
const {
  sendOrderNotification,
  sendCustomerConfirmation,
  sendCustomerNewOrder,
  sendOrderUpdatedToCustomer,
  sendMissingItemsToCustomer,
  sendOrderStatusUpdate,
  notifyOwner,
} = require('../services/whatsappProvider');
const { validateOrderAllowed } = require('../services/storeService');
const { findZone, DELIVERY_MUNICIPALITY } = require('../data/deliveryZones');
const { consumeStockForOrder, restoreStockForItems } = require('../services/stockService');

const DELIVERY_FEE = 0;

const GT_TZ = 'America/Guatemala';

/** Fecha civil actual en Guatemala YYYY-MM-DD */
function gtTodayStr() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: GT_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** Inicio/fin del día civil en Guatemala (UTC-6 fijo) */
function gtDayRange(dateStr) {
  const d = dateStr && /^\d{4}-\d{2}-\d{2}$/.test(String(dateStr).slice(0, 10))
    ? String(dateStr).slice(0, 10)
    : gtTodayStr();
  const start = new Date(`${d}T00:00:00.000-06:00`);
  const end = new Date(`${d}T23:59:59.999-06:00`);
  return { start, end, dateStr: d };
}

/** Hora 0–23 en Guatemala para un Date */
function gtHour(date) {
  const h = new Intl.DateTimeFormat('en-GB', {
    timeZone: GT_TZ,
    hour: '2-digit',
    hour12: false,
  }).format(new Date(date));
  let n = parseInt(h, 10);
  if (n === 24) n = 0;
  return Number.isFinite(n) ? n : 0;
}

/** Resta N días a YYYY-MM-DD (civil) */
function addDaysStr(dateStr, delta) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + delta));
  return utc.toISOString().slice(0, 10);
}

async function nextInvoiceNumber() {
  const year = new Date().getFullYear();
  const prefix = `TDA-${year}-`;
  const last = await Order.findOne({
    'invoice.number': { $regex: `^${prefix}` },
  })
    .sort({ 'invoice.issuedAt': -1 })
    .select('invoice.number');

  let seq = 1;
  if (last?.invoice?.number) {
    const part = last.invoice.number.split('-').pop();
    const n = parseInt(part, 10);
    if (!Number.isNaN(n)) seq = n + 1;
  }
  return `${prefix}${String(seq).padStart(5, '0')}`;
}

async function ensureInvoice(order) {
  if (order.invoice?.number) {
    if (!order.invoice.publicToken) {
      order.invoice.publicToken = invoiceToken();
      await order.save();
    }
    return order;
  }
  order.invoice = {
    number: await nextInvoiceNumber(),
    issuedAt: new Date(),
    publicToken: invoiceToken(),
  };
  await order.save();
  return order;
}

exports.getAllOrders = async (req, res) => {
  try {
    const { status, date, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (status) filter.orderStatus = status;
    if (date) {
      const { start, end } = gtDayRange(date);
      filter.createdAt = { $gte: start, $lte: end };
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [orders, total] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      Order.countDocuments(filter),
    ]);
    return res.json({
      success: true,
      data: orders,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    console.error('Error al obtener pedidos:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener pedidos' });
  }
};

exports.getAdminStats = async (req, res) => {
  try {
    const { date } = req.query;
    const { start, end, dateStr } = gtDayRange(date);
    const dayFilter = { createdAt: { $gte: start, $lte: end } };

    // Rango últimos 7 días (incluye el día elegido)
    const weekStartStr = addDaysStr(dateStr, -6);
    const weekStart = new Date(`${weekStartStr}T00:00:00.000-06:00`);
    const weekFilter = { createdAt: { $gte: weekStart, $lte: end } };

    const [orders, topProducts, weekOrders, allTimeCount] = await Promise.all([
      Order.find(dayFilter).sort({ createdAt: -1 }),
      Order.aggregate([
        { $match: dayFilter },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.productName',
            totalSold: { $sum: '$items.quantity' },
            totalRevenue: { $sum: '$items.subtotal' },
          },
        },
        { $sort: { totalSold: -1 } },
        { $limit: 10 },
      ]),
      Order.find(weekFilter).select('createdAt total orderStatus paymentMethod'),
      Order.countDocuments(),
    ]);

    const totalOrders = orders.length;
    const cashOrders = orders.filter((o) => o.paymentMethod === 'cash');
    const cardOrders = orders.filter((o) => o.paymentMethod === 'card');
    const totalRevenue = orders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const cashRevenue = cashOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const cardRevenue = cardOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

    const statusCounts = {
      pending: 0,
      confirmed: 0,
      preparing: 0,
      in_transit: 0,
      delivered: 0,
      cancelled: 0,
    };
    orders.forEach((o) => {
      const k = o.orderStatus || 'pending';
      statusCounts[k] = (statusCounts[k] || 0) + 1;
    });

    // Ventas por hora en zona Guatemala (no UTC del servidor)
    const hourlySales = Array(24).fill(0);
    const hourlyOrders = Array(24).fill(0);
    orders.forEach((o) => {
      const hour = gtHour(o.createdAt);
      hourlySales[hour] += Number(o.total) || 0;
      hourlyOrders[hour] += 1;
    });

    const delivered = statusCounts.delivered || 0;
    const cancelled = statusCounts.cancelled || 0;
    const activeOrders = totalOrders - cancelled;
    const avgTicket = totalOrders > 0 ? Math.round((totalRevenue / totalOrders) * 100) / 100 : 0;

    const zoneCounts = {};
    orders.forEach((o) => {
      const z = (o.customer?.zone || '').trim() || 'Sin zona';
      zoneCounts[z] = (zoneCounts[z] || 0) + 1;
    });
    const topZones = Object.entries(zoneCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // Serie últimos 7 días (calendario GT)
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const dStr = addDaysStr(dateStr, -i);
      const r = gtDayRange(dStr);
      const dayOrders = weekOrders.filter(
        (o) => o.createdAt >= r.start && o.createdAt <= r.end
      );
      last7Days.push({
        date: dStr,
        orders: dayOrders.length,
        revenue: dayOrders.reduce((s, o) => s + (Number(o.total) || 0), 0),
        isSelected: dStr === dateStr,
      });
    }
    const weekOrdersCount = weekOrders.length;
    const weekRevenue = weekOrders.reduce((s, o) => s + (Number(o.total) || 0), 0);

    // Horas del negocio (10–20) para el front
    const businessHours = [];
    for (let h = 10; h <= 20; h++) {
      businessHours.push({
        hour: h,
        label: `${h}:00`,
        revenue: hourlySales[h] || 0,
        orders: hourlyOrders[h] || 0,
      });
    }

    return res.json({
      success: true,
      data: {
        date: dateStr,
        timezone: GT_TZ,
        totalOrders,
        totalRevenue,
        cashOrders: cashOrders.length,
        cardOrders: cardOrders.length,
        cashRevenue,
        cardRevenue,
        delivered,
        cancelled,
        activeOrders,
        avgTicket,
        statusCounts,
        topProducts: topProducts || [],
        topZones,
        hourlySales,
        hourlyOrders,
        businessHours,
        last7Days,
        weekOrders: weekOrdersCount,
        weekRevenue,
        allTimeOrders: allTimeCount,
        orders: orders.map((o) => ({
          id: o._id,
          shortId: o._id.toString().slice(-6).toUpperCase(),
          total: o.total,
          status: o.orderStatus,
          paymentMethod: o.paymentMethod,
          customerName: o.customer?.name || '',
          phone: o.customer?.phone || '',
          zone: o.customer?.zone || '',
          address: o.customer?.address || '',
          itemsCount: (o.items || []).reduce((s, it) => s + (it.quantity || 0), 0),
          createdAt: o.createdAt,
        })),
      },
    });
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener estadísticas',
    });
  }
};

exports.createOrder = async (req, res) => {
  try {
    const { customer, items, paymentMethod, cashIntent } = req.body;

    if (!customer?.name || !customer?.phone || !customer?.address) {
      return res.status(400).json({
        success: false,
        message: 'Nombre, teléfono y dirección son obligatorios',
      });
    }

    const zoneResolved = findZone(customer.zone || customer.deliveryZone);
    if (!zoneResolved) {
      return res.status(400).json({
        success: false,
        message:
          'Solo entregamos en zonas residenciales de San José Pinula. Elegí tu residencial de la lista.',
        code: 'invalid_zone',
      });
    }

    const phoneDigits = String(customer.phone).replace(/\D/g, '');
    if (phoneDigits.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Teléfono inválido (mínimo 8 dígitos)',
      });
    }

    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'El pedido debe tener al menos un producto',
      });
    }

    if (!['cash', 'card'].includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: 'Método de pago inválido. Use "cash" (efectivo) o "card" (terminal en casa)',
      });
    }

    const enrichedItems = await Promise.all(
      items.map(async (item) => {
        const product = await Product.findById(item.productId);
        if (!product) {
          throw new Error(`Producto no encontrado: ${item.productId}`);
        }
        if (product.available === false) {
          throw new Error(`"${product.name}" está agotado`);
        }
        const qty = item.quantity || 1;
        if (product.trackStock !== false && (product.stock || 0) < qty) {
          throw new Error(
            `No hay suficiente stock de "${product.name}". Quedan ${product.stock || 0}.`
          );
        }

        const variants = product.variants || [];
        let unitPrice = product.price;
        let variantMeta = { name: null, price: 0, kind: null };

        if (variants.length > 0) {
          if (!item.variantName) {
            throw new Error(`Elegí una variante (unidad o peso) para "${product.name}"`);
          }
          const variant = variants.find((v) => v.name === item.variantName);
          if (!variant) {
            throw new Error(`Variante no válida para "${product.name}"`);
          }
          unitPrice = Number(variant.price);
          variantMeta = {
            name: variant.name,
            price: unitPrice,
            kind: variant.kind === 'weight' ? 'weight' : 'unit',
          };
        }

        const extrasTotal = (item.extras || []).reduce((sum, extraName) => {
          const extra = product.extras.find((e) => e.name === extraName);
          return sum + (extra ? extra.price : 0);
        }, 0);

        unitPrice += extrasTotal;

        const unitType = item.unitType || variantMeta.kind || 'unit';

        return {
          product: product._id,
          productName: product.name,
          variant: variantMeta,
          extras: (item.extras || []).map((name) => {
            const extra = product.extras.find((e) => e.name === name);
            return extra ? { name: extra.name, price: extra.price } : { name, price: 0 };
          }),
          quantity: qty,
          unitPrice,
          subtotal: qty * unitPrice,
          unitType,
        };
      })
    );

    const subtotal = enrichedItems.reduce((sum, i) => sum + i.subtotal, 0);
    const total = subtotal + DELIVERY_FEE;

    // Horario, descanso planificado y pedido mínimo
    const storeCheck = validateOrderAllowed(subtotal);
    if (!storeCheck.ok) {
      return res.status(400).json({
        success: false,
        message: storeCheck.message,
        code: storeCheck.code,
      });
    }

    // Descontar inventario (y alertas stock bajo / agotado)
    try {
      await consumeStockForOrder(
        items.map((i) => ({ productId: i.productId, quantity: i.quantity || 1 })),
        { sendWhatsApp: (text) => notifyOwner(text) }
      );
    } catch (stockErr) {
      return res.status(400).json({
        success: false,
        message: stockErr.message || 'Error de stock',
        code: 'stock',
      });
    }

    // Cliente declara billetes al pedir en efectivo
    let cashIntentData = undefined;
    if (paymentMethod === 'cash' && cashIntent?.bills) {
      const cleanBills = (cashIntent.bills || [])
        .map((b) => ({
          denomination: Number(b.denomination),
          count: Math.max(0, parseInt(b.count, 10) || 0),
        }))
        .filter((b) => b.denomination > 0 && b.count > 0);

      const amountTendered = cleanBills.reduce(
        (sum, b) => sum + b.denomination * b.count,
        0
      );

      if (amountTendered < total) {
        return res.status(400).json({
          success: false,
          message: `Los billetes no alcanzan. Total Q${total}, indicaste Q${amountTendered}`,
        });
      }

      cashIntentData = {
        bills: cleanBills,
        amountTendered,
        change: Math.round((amountTendered - total) * 100) / 100,
        declaredAt: new Date(),
      };
    }

    if (paymentMethod === 'cash' && !cashIntentData) {
      return res.status(400).json({
        success: false,
        message: 'En efectivo debés indicar con qué billetes vas a pagar',
      });
    }

    // Teléfono normalizado (GT: 8 dígitos → 502…)
    let phoneNorm = phoneDigits;
    if (phoneNorm.length === 8) phoneNorm = `502${phoneNorm}`;
    if (phoneNorm.startsWith('00')) phoneNorm = phoneNorm.slice(2);

    // Ambos se cobran en la entrega (efectivo o POS)
    // Factura/comprobante al CONFIRMAR el pedido (no esperar "en camino")
    const invoiceNumber = await nextInvoiceNumber();
    const order = await Order.create({
      customer: {
        name: customer.name.trim(),
        phone: phoneNorm,
        address: customer.address.trim(),
        zone: zoneResolved,
        municipality: DELIVERY_MUNICIPALITY,
        notes: customer.notes?.trim() || '',
      },
      items: enrichedItems,
      subtotal,
      deliveryFee: DELIVERY_FEE,
      total,
      paymentMethod,
      paymentStatus: 'pending',
      orderStatus: 'pending',
      invoice: {
        number: invoiceNumber,
        issuedAt: new Date(),
        publicToken: invoiceToken(),
      },
      ...(cashIntentData ? { cashIntent: cashIntentData } : {}),
    });

    console.log(
      `🧾 Pedido creado #${order._id.toString().slice(-6).toUpperCase()} ` +
        `factura=${invoiceNumber} tel=${phoneNorm} total=Q${total}`
    );

    // WhatsApp (estado "Nuevo"):
    //  1) Cliente → mensaje corto "recibimos tu pedido, pronto un proveedor lo revisa"
    //     (la factura se envía recién en "En proceso")
    //  2) Dueño  → mensaje "HAY PEDIDO"
    const whatsapp = {
      owner: false,
      customer: false,
      customerPhone: phoneNorm,
      invoicePdf: false,
      errors: [],
    };

    // Primero al cliente (quien pidió) — aviso corto, sin factura todavía
    try {
      await sendCustomerNewOrder(order);
      whatsapp.customer = true;
      console.log(`✅ WA cliente OK → aviso "pedido recibido" a ${phoneNorm}`);
    } catch (waError) {
      whatsapp.errors.push(`cliente(${phoneNorm}): ${waError.message}`);
      console.error(`❌ WA cliente ${phoneNorm}:`, waError.message);
    }

    // Luego al dueño — "hay pedido"
    try {
      await sendOrderNotification(order);
      whatsapp.owner = true;
      console.log('✅ WA dueño OK → aviso HAY PEDIDO');
    } catch (waError) {
      whatsapp.errors.push(`dueño: ${waError.message}`);
      console.error('❌ WA dueño:', waError.message);
    }

    return res.status(201).json({
      success: true,
      data: {
        _id: order._id,
        customer: order.customer,
        items: order.items,
        subtotal: order.subtotal,
        deliveryFee: order.deliveryFee,
        total: order.total,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        orderStatus: order.orderStatus,
        invoice: order.invoice,
        cashIntent: order.cashIntent,
        createdAt: order.createdAt,
      },
      whatsapp,
      message: whatsapp.customer
        ? `Pedido creado. Le avisamos al cliente por WhatsApp ${phoneNorm} (la factura se envía al pasar a "En proceso").`
        : `Pedido creado, pero no se pudo avisar al cliente por WhatsApp ${phoneNorm}. Revisá que el número tenga WhatsApp.`,
    });
  } catch (error) {
    console.error('Error al crear pedido:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Error al crear el pedido',
    });
  }
};

exports.getOrderById = async (req, res) => {
  try {
    // Validar ObjectId para no filtrar errores internos
    if (!/^[a-f\d]{24}$/i.test(String(req.params.id || ''))) {
      return res.status(404).json({ success: false, message: 'Pedido no encontrado' });
    }
    const order = await Order.findById(req.params.id).lean();
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Pedido no encontrado',
      });
    }
    // Público: solo lo necesario para la pantalla de confirmación (sin datos internos)
    const publicOrder = {
      _id: order._id,
      customer: {
        name: order.customer?.name,
        // no exponer teléfono completo en respuestas públicas
        phone: order.customer?.phone
          ? String(order.customer.phone).replace(/(\d{4})\d+(\d{2})/, '$1****$2')
          : '',
        address: order.customer?.address,
        zone: order.customer?.zone,
      },
      items: (order.items || []).map((it) => ({
        productName: it.productName,
        quantity: it.quantity,
        subtotal: it.subtotal,
        variant: it.variant,
      })),
      subtotal: order.subtotal,
      deliveryFee: order.deliveryFee,
      total: order.total,
      paymentMethod: order.paymentMethod,
      orderStatus: order.orderStatus,
      cashIntent: order.cashIntent
        ? {
            amountTendered: order.cashIntent.amountTendered,
            change: order.cashIntent.change,
            bills: order.cashIntent.bills,
          }
        : undefined,
      createdAt: order.createdAt,
    };
    return res.json({ success: true, data: publicOrder });
  } catch (error) {
    console.error('Error al obtener pedido:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener el pedido',
    });
  }
};

/** Reenvía comprobante WA al cliente + aviso al dueño (útil si falló al crear) */
exports.resendWhatsApp = async (req, res) => {
  try {
    let order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Pedido no encontrado' });
    }

    // Asegurar factura
    if (!order.invoice?.number) {
      order = await ensureInvoice(order);
    }

    // Normalizar teléfono
    let p = String(order.customer.phone || '').replace(/\D/g, '');
    if (p.length === 8) p = `502${p}`;
    if (p !== order.customer.phone) {
      order.customer.phone = p;
      await order.save();
    }

    const whatsapp = { owner: false, customer: false, errors: [] };
    try {
      await sendOrderNotification(order);
      whatsapp.owner = true;
    } catch (e) {
      whatsapp.errors.push(`owner: ${e.message}`);
    }
    try {
      await sendCustomerConfirmation(order);
      whatsapp.customer = true;
    } catch (e) {
      whatsapp.errors.push(`customer: ${e.message}`);
    }

    return res.json({
      success: whatsapp.owner || whatsapp.customer,
      message: 'Reenvío WhatsApp ejecutado',
      invoice: order.invoice,
      phone: order.customer.phone,
      whatsapp,
    });
  } catch (error) {
    console.error('Error resend WhatsApp:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { orderStatus, paymentStatus } = req.body;
    let order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Pedido no encontrado',
      });
    }

    const prevStatus = order.orderStatus;

    // Cancelar un pedido que NO estaba cancelado → devolver stock al inventario
    if (orderStatus === 'cancelled' && prevStatus !== 'cancelled') {
      try {
        await restoreStockForItems(
          (order.items || []).map((it) => ({
            product: it.product,
            quantity: it.quantity,
          })),
          { sendWhatsApp: (text) => notifyOwner(text) }
        );
        console.log(`♻️ Stock restaurado por cancelación de #${order._id.toString().slice(-6).toUpperCase()}`);
      } catch (stockErr) {
        console.error('Error restaurando stock al cancelar:', stockErr.message);
      }
    }

    if (orderStatus) order.orderStatus = orderStatus;
    if (paymentStatus) order.paymentStatus = paymentStatus;

    // Factura al poner "en camino" (por si no se generó antes)
    if (orderStatus === 'in_transit' && !order.invoice?.number) {
      order.invoice = {
        number: await nextInvoiceNumber(),
        issuedAt: new Date(),
        publicToken: invoiceToken(),
      };
    }
    // Asegurar token público del PDF si faltara (pedidos viejos)
    if (order.invoice?.number && !order.invoice.publicToken) {
      order.invoice.publicToken = invoiceToken();
    }

    // Al entregar, marcar pago cobrado si no se marcó
    if (orderStatus === 'delivered' && order.paymentStatus === 'pending') {
      order.paymentStatus = 'paid';
    }

    // Al entregar: preparar el token del link público de calificación
    if (orderStatus === 'delivered' && !order.rating?.token) {
      order.rating = order.rating || {};
      order.rating.token = invoiceToken();
    }

    await order.save();

    if (orderStatus) {
      try {
        await sendOrderStatusUpdate(order);
      } catch (waError) {
        console.error('Error enviando notificación de estado al cliente:', waError.message);
      }
    }

    return res.json({ success: true, data: order });
  } catch (error) {
    console.error('Error al actualizar pedido:', error);
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/** Estados en los que el admin todavía puede editar los productos del pedido.
 *  Una vez "En proceso" (preparing) el pedido se bloquea y sale la factura. */
const EDITABLE_STATUSES = ['pending', 'confirmed'];

/**
 * Editar los productos de un pedido (admin): agregar / quitar / cambiar cantidades.
 * Body: { items: [{ productId, variantName?, extras?, quantity, unitType? }] }
 * Recalcula totales, ajusta el stock (delta) y avisa al cliente por WhatsApp.
 */
exports.updateOrderItems = async (req, res) => {
  try {
    const { items } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Pedido no encontrado' });
    }

    if (!EDITABLE_STATUSES.includes(order.orderStatus)) {
      return res.status(400).json({
        success: false,
        message:
          'Este pedido ya no se puede modificar (solo antes de salir "En camino").',
        code: 'not_editable',
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'El pedido debe quedar con al menos un producto.',
      });
    }

    // Enriquecer los ítems nuevos (precio, variante, extras, subtotal)
    const enrichedItems = await Promise.all(
      items.map(async (item) => {
        const product = await Product.findById(item.productId);
        if (!product) {
          throw new Error(`Producto no encontrado: ${item.productId}`);
        }
        const qty = Number(item.quantity) || 1;
        if (qty <= 0) {
          throw new Error(`Cantidad inválida para "${product.name}"`);
        }

        const variants = product.variants || [];
        let unitPrice = product.price;
        let variantMeta = { name: null, price: 0, kind: null };

        if (variants.length > 0) {
          const wanted = item.variantName || variants[0].name;
          const variant = variants.find((v) => v.name === wanted);
          if (!variant) {
            throw new Error(`Variante no válida para "${product.name}"`);
          }
          unitPrice = Number(variant.price);
          variantMeta = {
            name: variant.name,
            price: unitPrice,
            kind: variant.kind === 'weight' ? 'weight' : 'unit',
          };
        }

        const extrasTotal = (item.extras || []).reduce((sum, extraName) => {
          const extra = (product.extras || []).find((e) => e.name === extraName);
          return sum + (extra ? extra.price : 0);
        }, 0);
        unitPrice += extrasTotal;

        const unitType = item.unitType || variantMeta.kind || 'unit';

        return {
          product: product._id,
          productName: product.name,
          variant: variantMeta,
          extras: (item.extras || []).map((name) => {
            const extra = (product.extras || []).find((e) => e.name === name);
            return extra ? { name: extra.name, price: extra.price } : { name, price: 0 };
          }),
          quantity: qty,
          unitPrice,
          subtotal: Math.round(qty * unitPrice * 100) / 100,
          unitType,
        };
      })
    );

    // Delta de stock por producto (viejo vs nuevo)
    const oldById = {};
    for (const it of order.items || []) {
      const id = String(it.product);
      oldById[id] = (oldById[id] || 0) + (Number(it.quantity) || 0);
    }
    const newById = {};
    for (const it of enrichedItems) {
      const id = String(it.product);
      newById[id] = (newById[id] || 0) + (Number(it.quantity) || 0);
    }

    const increases = []; // hay que descontar más stock
    const decreases = []; // hay que devolver stock
    for (const id of new Set([...Object.keys(oldById), ...Object.keys(newById)])) {
      const oldQ = oldById[id] || 0;
      const newQ = newById[id] || 0;
      if (newQ > oldQ) increases.push({ productId: id, quantity: newQ - oldQ });
      else if (oldQ > newQ) decreases.push({ product: id, quantity: oldQ - newQ });
    }

    // Primero descontar lo que aumentó (valida disponibilidad; si falla, no tocamos nada)
    if (increases.length) {
      try {
        await consumeStockForOrder(increases, {
          sendWhatsApp: (text) => notifyOwner(text),
        });
      } catch (stockErr) {
        return res.status(400).json({
          success: false,
          message: stockErr.message || 'No hay stock para los productos agregados',
          code: 'stock',
        });
      }
    }
    // Luego devolver lo que se quitó / redujo
    if (decreases.length) {
      await restoreStockForItems(decreases, {
        sendWhatsApp: (text) => notifyOwner(text),
      });
    }

    // Recalcular y guardar
    const subtotal = enrichedItems.reduce((s, i) => s + i.subtotal, 0);
    order.items = enrichedItems;
    order.subtotal = subtotal;
    order.total = subtotal + (order.deliveryFee || 0);

    // Reajustar el vuelto declarado si el total cambió (pago en efectivo)
    if (order.paymentMethod === 'cash' && order.cashIntent?.amountTendered) {
      order.cashIntent.change =
        Math.round((order.cashIntent.amountTendered - order.total) * 100) / 100;
    }

    await order.save();

    // Avisar al cliente el nuevo detalle / total
    try {
      await sendOrderUpdatedToCustomer(order);
    } catch (e) {
      console.warn('Aviso de modificación al cliente falló:', e.message);
    }

    return res.json({ success: true, data: order });
  } catch (error) {
    console.error('Error al editar pedido:', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'No se pudo editar el pedido',
    });
  }
};

/**
 * El proveedor avisa al cliente que falta algo del pedido (antes de "En proceso").
 * Body: { items?: string[], note?: string }
 */
exports.notifyMissing = async (req, res) => {
  try {
    const { items, note } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Pedido no encontrado' });
    }
    if (!EDITABLE_STATUSES.includes(order.orderStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Solo se puede avisar antes de que el pedido pase a "En proceso".',
        code: 'not_editable',
      });
    }
    await sendMissingItemsToCustomer(order, {
      items: Array.isArray(items) ? items : [],
      note: (note || '').trim(),
    });
    return res.json({ success: true, message: 'Aviso enviado al cliente por WhatsApp' });
  } catch (error) {
    console.error('Error avisando falta de stock:', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'No se pudo enviar el aviso',
    });
  }
};

/**
 * Registrar cobro en efectivo.
 * Por defecto usa lo que el CLIENTE declaró (cashIntent) — el admin NO inventa montos.
 * Body: { useClientIntent: true, notes? }  (recomendado)
 */
exports.recordCashPayment = async (req, res) => {
  try {
    const { bills, notes, useClientIntent = true } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Pedido no encontrado' });
    }
    if (order.paymentMethod !== 'cash') {
      return res.status(400).json({
        success: false,
        message: 'Este pedido no es de efectivo (usa terminal POS)',
      });
    }

    let cleanBills;
    let amountTendered;
    let change;

    if (useClientIntent !== false && order.cashIntent?.amountTendered > 0) {
      // Solo lo que dijo el cliente — admin no modifica
      cleanBills = (order.cashIntent.bills || []).map((b) => ({
        denomination: Number(b.denomination),
        count: Number(b.count),
      }));
      amountTendered = Number(order.cashIntent.amountTendered);
      change = Number(order.cashIntent.change) || 0;
    } else {
      if (!Array.isArray(bills) || bills.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No hay billetes del cliente. El monto lo define el cliente en el checkout.',
        });
      }
      cleanBills = bills
        .map((b) => ({
          denomination: Number(b.denomination),
          count: Math.max(0, parseInt(b.count, 10) || 0),
        }))
        .filter((b) => b.denomination > 0 && b.count > 0);
      amountTendered = cleanBills.reduce(
        (sum, b) => sum + b.denomination * b.count,
        0
      );
      if (amountTendered < order.total) {
        return res.status(400).json({
          success: false,
          message: `Falta dinero. Total Q${order.total}, entregado Q${amountTendered}`,
        });
      }
      change = Math.round((amountTendered - order.total) * 100) / 100;
    }

    order.cashPayment = {
      bills: cleanBills,
      amountTendered,
      change,
      notes: notes?.trim() || 'Cobrado según billetes declarados por el cliente',
      recordedAt: new Date(),
    };
    order.paymentStatus = 'paid';
    await order.save();

    return res.json({ success: true, data: order });
  } catch (error) {
    console.error('Error registrando cobro efectivo:', error);
    return res.status(400).json({ success: false, message: error.message });
  }
};

/** Listado de facturas (admin) */
exports.listInvoices = async (req, res) => {
  try {
    const { date, page = 1, limit = 50 } = req.query;
    const filter = { 'invoice.number': { $ne: null, $exists: true } };
    if (date) {
      const { start, end } = gtDayRange(date);
      filter.$or = [
        { 'invoice.issuedAt': { $gte: start, $lte: end } },
        { createdAt: { $gte: start, $lte: end } },
      ];
    }
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const [orders, total] = await Promise.all([
      Order.find(filter)
        .sort({ 'invoice.issuedAt': -1, createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10))
        .select(
          'customer items subtotal deliveryFee total paymentMethod paymentStatus orderStatus invoice cashIntent cashPayment createdAt'
        ),
      Order.countDocuments(filter),
    ]);
    return res.json({
      success: true,
      data: orders,
      total,
      page: parseInt(page, 10),
      pages: Math.ceil(total / parseInt(limit, 10)) || 1,
    });
  } catch (error) {
    console.error('Error listando facturas:', error);
    return res.status(500).json({ success: false, message: 'Error al listar facturas' });
  }
};

/** Descargar PDF de factura */
exports.downloadInvoicePdf = async (req, res) => {
  try {
    let order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Pedido no encontrado' });
    }
    if (!order.invoice?.number) {
      order = await ensureInvoice(order);
    }
    const { generateInvoicePdf } = require('../services/invoicePdfService');
    const { filePath, fileName } = await generateInvoicePdf(order);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    return res.sendFile(filePath);
  } catch (error) {
    console.error('Error PDF factura:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PDF de factura PÚBLICO (sin login) protegido por token aleatorio.
 * Lo usa WhatsApp Cloud API para descargar el PDF y mandárselo al cliente.
 * URL: /api/orders/:id/invoice/:token
 */
exports.downloadInvoicePublic = async (req, res) => {
  try {
    if (!/^[a-f\d]{24}$/i.test(String(req.params.id || ''))) {
      return res.status(404).json({ success: false, message: 'No encontrado' });
    }
    const order = await Order.findById(req.params.id);
    const token = String(req.params.token || '').replace(/\.pdf$/i, '');
    if (!order || !order.invoice?.publicToken || order.invoice.publicToken !== token) {
      return res.status(404).json({ success: false, message: 'No encontrado' });
    }
    const { generateInvoicePdf } = require('../services/invoicePdfService');
    const { filePath, fileName } = await generateInvoicePdf(order);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    return res.sendFile(filePath);
  } catch (error) {
    console.error('Error PDF público:', error);
    return res.status(500).json({ success: false, message: 'Error' });
  }
};

/**
 * Info pública para la página de calificación (sin login), protegida por token.
 * URL: GET /api/orders/:id/rating/:token
 */
exports.getPublicRating = async (req, res) => {
  try {
    if (!/^[a-f\d]{24}$/i.test(String(req.params.id || ''))) {
      return res.status(404).json({ success: false, message: 'No encontrado' });
    }
    const order = await Order.findById(req.params.id);
    const token = String(req.params.token || '');
    if (!order || !order.rating?.token || order.rating.token !== token) {
      return res.status(404).json({ success: false, message: 'No encontrado' });
    }
    return res.json({
      success: true,
      data: {
        code: order._id.toString().slice(-6).toUpperCase(),
        customerName: order.customer?.name || '',
        alreadyRated: (order.rating.stars || 0) > 0,
        stars: order.rating.stars || 0,
        comment: order.rating.comment || '',
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error' });
  }
};

/**
 * Guarda la calificación del cliente (sin login), protegida por token.
 * URL: POST /api/orders/:id/rating/:token  body: { stars, comment }
 */
exports.submitPublicRating = async (req, res) => {
  try {
    if (!/^[a-f\d]{24}$/i.test(String(req.params.id || ''))) {
      return res.status(404).json({ success: false, message: 'No encontrado' });
    }
    const order = await Order.findById(req.params.id);
    const token = String(req.params.token || '');
    if (!order || !order.rating?.token || order.rating.token !== token) {
      return res.status(404).json({ success: false, message: 'No encontrado' });
    }
    const stars = Math.max(0, Math.min(5, parseInt(req.body?.stars, 10) || 0));
    if (!stars) {
      return res.status(400).json({ success: false, message: 'Elegí de 1 a 5 estrellas' });
    }
    order.rating.stars = stars;
    order.rating.comment = String(req.body?.comment || '').trim().slice(0, 500);
    order.rating.at = new Date();
    await order.save();
    return res.json({ success: true, message: '¡Gracias por tu calificación!' });
  } catch (error) {
    console.error('Error guardando calificación:', error);
    return res.status(500).json({ success: false, message: 'Error' });
  }
};

exports.ensureInvoice = ensureInvoice;
