const Order = require('../models/Order');
const Product = require('../models/Product');
const { sendOrderNotification, sendCustomerConfirmation, sendOrderStatusUpdate } = require('../services/whatsappService');
const { createPaymentPreference } = require('../services/mercadopagoService');

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
    const { customer, items, paymentMethod } = req.body;

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
            ? { name: item.variantName, price: unitPrice - extrasTotal - (product.price ? 0 : unitPrice) }
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
      paymentStatus: paymentMethod === 'cash' ? 'pending' : 'pending',
      orderStatus: 'pending',
    };

    let paymentLink = null;
    if (paymentMethod === 'card') {
      try {
        const preference = await createPaymentPreference({
          items: enrichedItems,
          customer,
          total,
          orderId: 'pending',
        });
        paymentLink = preference.init_point;
      } catch (mpError) {
        console.error('Error creando preferencia MP:', mpError.message);
        return res.status(502).json({
          success: false,
          message: 'Error al procesar el pago con tarjeta. Intente de nuevo.',
        });
      }
    }

    const order = await Order.create(orderData);

    if (paymentMethod === 'card' && paymentLink) {
      await Order.findByIdAndUpdate(order._id, {
        whatsappSessionId: `pending_mp_${order._id}`,
      });
    }

    try {
      await sendOrderNotification(order);
    } catch (waError) {
      console.error('Error enviando notificación WhatsApp:', waError.message);
    }

    try {
      await sendCustomerConfirmation(order);
    } catch (waError) {
      console.error('Error enviando confirmación al cliente:', waError.message);
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
        createdAt: order.createdAt,
        ...(paymentLink ? { paymentLink } : {}),
      },
    };

    return res.status(201).json(response);
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

    const order = await Order.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Pedido no encontrado',
      });
    }

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
