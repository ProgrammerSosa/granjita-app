/**
 * Asigna factura si falta y reenvía WA del último pedido
 * (usa el client del server — este script NO levanta Puppeteer).
 * Mejor: endpoint interno. Por ahora solo prepara datos.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const path = require('path');

async function nextInvoiceNumber(Order) {
  const year = new Date().getFullYear();
  const prefix = `TDA-${year}-`;
  const last = await Order.findOne({
    'invoice.number': { $regex: `^${prefix}` },
  })
    .sort({ 'invoice.issuedAt': -1 })
    .select('invoice.number');
  let seq = 1;
  if (last?.invoice?.number) {
    const n = parseInt(last.invoice.number.split('-').pop(), 10);
    if (!Number.isNaN(n)) seq = n + 1;
  }
  return `${prefix}${String(seq).padStart(5, '0')}`;
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Order = require('../src/models/Order');
  const order = await Order.findOne().sort({ createdAt: -1 });
  if (!order) {
    console.log('Sin pedidos');
    process.exit(0);
  }

  let p = String(order.customer.phone || '').replace(/\D/g, '');
  if (p.length === 8) p = `502${p}`;
  order.customer.phone = p;

  if (!order.invoice?.number) {
    order.invoice = {
      number: await nextInvoiceNumber(Order),
      issuedAt: new Date(),
    };
  }
  await order.save();

  console.log(
    JSON.stringify(
      {
        id: String(order._id),
        code: String(order._id).slice(-6).toUpperCase(),
        phone: order.customer.phone,
        name: order.customer.name,
        invoice: order.invoice,
        total: order.total,
      },
      null,
      2
    )
  );

  // Cargar WA en este proceso y enviar (útil si el server no tiene sesión)
  process.env.WHATSAPP_ENABLED = process.env.WHATSAPP_ENABLED || 'true';
  const {
    startWhatsApp,
    sendOrderNotification,
    sendCustomerConfirmation,
    getWhatsAppStatus,
  } = require('../src/services/whatsappService');

  // Express no está; startWhatsApp solo init
  await startWhatsApp();

  // Esperar CONNECTED
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const st = getWhatsAppStatus();
    console.log(`[${i}] connected=${st.connected}`);
    if (st.connected) break;
  }

  if (!getWhatsAppStatus().connected) {
    console.error('WA no conectó en este script — usá el backend en :5000');
    process.exit(1);
  }

  try {
    await sendOrderNotification(order);
    console.log('OK dueño');
  } catch (e) {
    console.error('FAIL dueño:', e.message);
  }

  try {
    await sendCustomerConfirmation(order);
    console.log('OK cliente');
  } catch (e) {
    console.error('FAIL cliente:', e.message);
  }

  await mongoose.disconnect();
  // Dejar 3s y salir (no matar chrome del server si compartimos auth — mejor exit)
  setTimeout(() => process.exit(0), 2000);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
