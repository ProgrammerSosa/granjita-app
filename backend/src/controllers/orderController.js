const Order = require('../models/Order');
const Product = require('../models/Product');

const DELIVERY_FEE = 0;

exports.getAllOrders = async (req, res) => {
  try {
    const { status, date, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (status) filter.orderStatus = status;
    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      filter.createdAt = { $gte: start, $lte: end };
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [orders, total] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      Order.countDocuments(filter),
    ]);
    return res.json({ success: true, data: orders, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (error) {
    console.error('Error al obtener pedidos:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener pedidos' });
  }
};

exports.getAdminStats = async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const todayFilter = { createdAt: { $gte: startOfDay, $lte: endOfDay } };

    const [totalOrders, orders, topProducts] = await Promise.all([
      Order.countDocuments(todayFilter),
      Order.find(todayFilter),
      Order.aggregate([
        { $match: todayFilter },
        { $unwind: '$items' },
        { $group: { _id: '$items.productName', totalSold: { $sum: '$items.quantity' }, totalRevenue: { $sum: '$items.subtotal' } } },
        { $sort: { totalSold: -1 } },
        { $limit: 10 },
      ]),
    ]); 

    const cashOrders = orders.filter(o => o.paymentMethod === 'cash');
    const cardOrders = orders.filter(o => o.paymentMethod === 'card');
    const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
    const cashRevenue = cashOrders.reduce((sum, o) => sum + o.total, 0);
    const cardRevenue = cardOrders.reduce((sum, o) => sum + o.total, 0);

    const statusCounts = {};
    orders.forEach(o => {
      statusCounts[o.orderStatus] = (statusCounts[o.orderStatus] || 0) + 1;
    });

    const hourlySales = Array(24).fill(0);
    orders.forEach(o => {
      const hour = new Date(o.createdAt).getHours();
      hourlySales[hour] += o.total;
    });

    return res.json({
      success: true,
      data: {
        totalOrders,
        totalRevenue,
        cashOrders: cashOrders.length,
        cardOrders: cardOrders.length,
        cashRevenue,
        cardRevenue,
        statusCounts,
        topProducts,
        hourlySales,
      },
    });
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener estadísticas' });
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

    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'El pedido debe tener al menos un producto',
      });
    }

    if (!['cash', 'card'].includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: 'Método de pago inválido. Use "cash" o "card"',
      });
    }

    const enrichedItems = await Promise.all(
      items.map(async (item) => {
        const product = await Product.findById(item.productId);
        if (!product) {
          throw new Error(`Producto no encontrado: ${item.productId}`);
        }
        if (product.stock !== null && product.stock < (item.quantity || 1)) {
          throw new Error(`Stock insuficiente de "${product.name}". Disponible: ${product.stock}, solicitado: ${item.quantity || 1}`);
        }

        let unitPrice = product.price;

        if (item.variantName) {
          const variant = product.variants.find(
            (v) => v.name === item.variantName
          );
          if (variant) unitPrice = variant.price;
        }

        const extrasTotal = (item.extras || []).reduce(
          (sum, extraName) => {
            const extra = product.extras.find((e) => e.name === extraName);
            return sum + (extra ? extra.price : 0);
          },
          0
        );

        unitPrice += extrasTotal;

        return {
          product: product._id,
          productName: product.name,
          variant: item.variantName
            ? { name: item.variantName, price: unitPrice - extrasTotal }
            : { name: null, price: 0 },
          extras: (item.extras || []).map((name) => {
            const extra = product.extras.find((e) => e.name === name);
            return extra ? { name: extra.name, price: extra.price } : { name, price: 0 };
          }),
          quantity: item.quantity || 1,
          unitPrice,
          subtotal: (item.quantity || 1) * unitPrice,
        };
      })
    );

    const subtotal = enrichedItems.reduce((sum, i) => sum + i.subtotal, 0);
    const total = subtotal + DELIVERY_FEE;

    // Efectivo: guardamos con cuánto dijo el cliente que va a pagar (para el vuelto).
    // El monto se recalcula acá desde los billetes; no se confía en el número del cliente.
    let cashIntentData;
    if (paymentMethod === 'cash' && cashIntent?.bills?.length) {
      const cleanBills = (cashIntent.bills || [])
        .map((b) => ({ denomination: Number(b.denomination), count: Number(b.count) }))
        .filter((b) => b.denomination > 0 && b.count > 0);
      if (cleanBills.length) {
        const amountTendered = cleanBills.reduce((s, b) => s + b.denomination * b.count, 0);
        cashIntentData = {
          bills: cleanBills,
          amountTendered: Math.round(amountTendered * 100) / 100,
          change: Math.round((amountTendered - total) * 100) / 100,
        };
      }
    }

    const orderData = {
      customer: {
        name: customer.name.trim(),
        phone: customer.phone.trim(),
        address: customer.address.trim(),
        notes: customer.notes?.trim() || '',
      },
      items: enrichedItems,
      subtotal,
      deliveryFee: DELIVERY_FEE,
      total,
      paymentMethod,
      paymentStatus: 'pending',
      orderStatus: 'pending',
      ...(cashIntentData ? { cashIntent: cashIntentData } : {}),
    };

    const order = await Order.create(orderData);

    for (const item of enrichedItems) {
      if (item.product) {
        const prod = await Product.findById(item.product);
        if (prod && prod.stock !== null) {
          const newStock = Math.max(0, prod.stock - item.quantity);
          await Product.findByIdAndUpdate(item.product, { stock: newStock, available: newStock > 0 });
        }
      }
    }

    try {
      const wa = require('../../server');
      wa.sendOrderNotification(order);
      wa.sendInvoiceToCustomer(order);
    } catch (e) {
      // WhatsApp no disponible, no bloquear
    }

    const response = {
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
        cashIntent: order.cashIntent,
        createdAt: order.createdAt,
      },
    };

    return res.status(201).json(response);
  } catch (error) {
    console.error('Error al crear pedido:', error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Pedido no encontrado',
      });
    }
    return res.json({ success: true, data: order });
  } catch (error) {
    console.error('Error al obtener pedido:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener el pedido',
    });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { orderStatus, paymentStatus } = req.body;
    const updateData = {};
    if (orderStatus) updateData.orderStatus = orderStatus;
    if (paymentStatus) updateData.paymentStatus = paymentStatus;

    const oldOrder = await Order.findById(req.params.id);
    if (!oldOrder) {
      return res.status(404).json({
        success: false,
        message: 'Pedido no encontrado',
      });
    }

    const order = await Order.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    });

    const wasStockDecremented = !['cancelled'].includes(oldOrder.orderStatus);

    if (orderStatus === 'cancelled' && wasStockDecremented) {
      for (const item of order.items) {
        if (item.product) {
          const prod = await Product.findById(item.product);
          if (prod && prod.stock !== null) {
            const newStock = prod.stock + item.quantity;
            await Product.findByIdAndUpdate(item.product, { stock: newStock, available: true });
          }
        }
      }
    }

    if (!wasStockDecremented && orderStatus && !['cancelled'].includes(orderStatus)) {
      for (const item of order.items) {
        if (item.product) {
          const prod = await Product.findById(item.product);
          if (prod && prod.stock !== null) {
            const newStock = Math.max(0, prod.stock - item.quantity);
            await Product.findByIdAndUpdate(item.product, { stock: newStock, available: newStock > 0 });
          }
        }
      }
    }

    if (orderStatus === 'in_transit') {
      try {
        const wa = require('../../server');
        wa.sendOrderOnWayNotification(order);
      } catch (e) {
        // WhatsApp no disponible
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

exports.updateOrderItems = async (req, res) => {
  try {
    const { items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Debe proporcionar al menos un item',
      });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Pedido no encontrado',
      });
    }

    const enrichedItems = await Promise.all(items.map(async (item) => {
      const productId = item.productId || item.product;
      if (productId) {
        const product = await Product.findById(productId);
        if (product) {
          const oldItem = order.items.find(i => String(i.product) === String(productId));
          const oldQty = oldItem ? oldItem.quantity : 0;
          const newQty = item.quantity || 1;
          const diff = newQty - oldQty;

          if (product.stock !== null && diff > 0 && product.stock < diff) {
            throw new Error(`Stock insuficiente de "${product.name}". Disponible: ${product.stock}, solicitado: ${newQty}`);
          }
        }
      }
      return {
        product: productId,
        productName: item.productName,
        variant: item.variant || { name: null, price: 0 },
        extras: item.extras || [],
        quantity: item.quantity || 1,
        unitPrice: item.unitPrice,
        subtotal: (item.quantity || 1) * item.unitPrice,
      };
    }));

    const subtotal = enrichedItems.reduce((sum, i) => sum + i.subtotal, 0);
    const total = subtotal + (order.deliveryFee || 0);

    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.id,
      { items: enrichedItems, subtotal, total },
      { new: true, runValidators: true }
    );

    for (const item of enrichedItems) {
      if (item.product) {
        const oldItem = order.items.find(i => String(i.product) === String(item.product));
        const oldQty = oldItem ? oldItem.quantity : 0;
        const diff = item.quantity - oldQty;

        if (diff !== 0) {
          const prod = await Product.findById(item.product);
          if (prod && prod.stock !== null) {
            const newStock = Math.max(0, prod.stock - diff);
            await Product.findByIdAndUpdate(item.product, { stock: newStock, available: newStock > 0 });
          }
        }
      }
    }

    for (const oldItem of order.items) {
      if (oldItem.product) {
        const stillExists = enrichedItems.some(i => String(i.product) === String(oldItem.product));
        if (!stillExists) {
          const prod = await Product.findById(oldItem.product);
          if (prod && prod.stock !== null) {
            const newStock = prod.stock + oldItem.quantity;
            await Product.findByIdAndUpdate(oldItem.product, { stock: newStock, available: true });
          }
        }
      }
    }

    return res.json({ success: true, data: updatedOrder });
  } catch (error) {
    console.error('Error al actualizar items del pedido:', error);
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};
