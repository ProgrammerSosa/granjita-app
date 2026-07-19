const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const INVOICES_DIR = path.join(__dirname, '..', '..', 'data', 'invoices');

function ensureDir() {
  if (!fs.existsSync(INVOICES_DIR)) {
    fs.mkdirSync(INVOICES_DIR, { recursive: true });
  }
}

function money(n) {
  return `Q ${Number(n || 0).toLocaleString('es-GT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatBills(intent) {
  if (!intent?.bills?.length) {
    return intent?.amountTendered != null ? money(intent.amountTendered) : '—';
  }
  return intent.bills
    .filter((b) => b.count > 0)
    .map((b) => {
      const d = Number(b.denomination);
      const label = d >= 1 ? `Q${d}` : d === 0.5 ? '50¢' : d === 0.25 ? '25¢' : `Q${d}`;
      return `${b.count}× ${label}`;
    })
    .join(' + ');
}

/**
 * Genera PDF de factura y lo guarda en data/invoices/
 * @returns {Promise<{ filePath: string, fileName: string, buffer: Buffer }>}
 */
function generateInvoicePdf(order) {
  ensureDir();
  const inv = order.invoice?.number || `PED-${String(order._id).slice(-6).toUpperCase()}`;
  const code = String(order._id).slice(-6).toUpperCase();
  const fileName = `factura-${inv.replace(/[^\w.-]+/g, '_')}.pdf`;
  const filePath = path.join(INVOICES_DIR, fileName);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks = [];
    const stream = fs.createWriteStream(filePath);

    doc.on('data', (c) => chunks.push(c));
    doc.on('error', reject);
    stream.on('error', reject);
    stream.on('finish', () => {
      const buffer = Buffer.concat(chunks);
      resolve({ filePath, fileName, buffer });
    });
    doc.pipe(stream);

    // Header
    doc
      .fontSize(22)
      .fillColor('#ea580c')
      .text('TIENDA · La Granjita', { align: 'left' });
    doc
      .fontSize(10)
      .fillColor('#666')
      .text('Productos frescos a domicilio', { align: 'left' });
    doc.moveDown(0.5);
    doc
      .fontSize(16)
      .fillColor('#111')
      .text('FACTURA / COMPROBANTE', { align: 'left' });
    doc.moveDown(0.8);

    // Meta
    doc.fontSize(11).fillColor('#111');
    doc.text(`Factura: ${inv}`);
    doc.text(`Pedido: #${code}`);
    doc.text(
      `Fecha: ${new Date(order.invoice?.issuedAt || order.createdAt || Date.now()).toLocaleString('es-GT')}`
    );
    doc.text(`Estado: ${order.orderStatus || 'pending'}`);
    doc.moveDown(0.8);

    // Cliente
    doc.fontSize(12).fillColor('#ea580c').text('Cliente', { underline: true });
    doc.fontSize(11).fillColor('#111');
    doc.text(`Nombre: ${order.customer?.name || '—'}`);
    doc.text(`Teléfono: ${order.customer?.phone || '—'}`);
    doc.text(`Dirección: ${order.customer?.address || '—'}`);
    if (order.customer?.notes) doc.text(`Notas: ${order.customer.notes}`);
    doc.moveDown(0.8);

    // Items table header
    doc.fontSize(12).fillColor('#ea580c').text('Detalle', { underline: true });
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor('#111');

    const items = order.items || [];
    items.forEach((item) => {
      const name =
        `${item.quantity}x ${item.productName}` +
        (item.variant?.name ? ` (${item.variant.name})` : '') +
        (item.extras?.length ? ` + ${item.extras.map((e) => e.name).join(', ')}` : '');
      doc.text(name, { continued: true, width: 380 });
      doc.text(money(item.subtotal), { align: 'right' });
    });

    doc.moveDown(0.6);
    doc
      .moveTo(50, doc.y)
      .lineTo(545, doc.y)
      .strokeColor('#ddd')
      .stroke();
    doc.moveDown(0.5);

    doc.fontSize(11);
    doc.text(`Subtotal: ${money(order.subtotal)}`);
    doc.text(
      `Envío: ${order.deliveryFee > 0 ? money(order.deliveryFee) : 'Gratis'}`
    );
    doc.fontSize(13).fillColor('#111').text(`TOTAL: ${money(order.total)}`, {
      underline: true,
    });
    doc.moveDown(0.6);

    // Pago
    doc.fontSize(12).fillColor('#ea580c').text('Pago', { underline: true });
    doc.fontSize(11).fillColor('#111');
    if (order.paymentMethod === 'cash') {
      doc.text('Método: Efectivo al entregar');
      if (order.cashIntent?.amountTendered) {
        doc.text(`Cliente paga con: ${formatBills(order.cashIntent)}`);
        doc.text(`Entrega: ${money(order.cashIntent.amountTendered)}`);
        const ch = Number(order.cashIntent.change) || 0;
        if (ch > 0) {
          doc
            .fillColor('#047857')
            .text(`VUELTO A ENTREGAR: ${money(ch)}`, { underline: true });
          doc.fillColor('#111');
        } else {
          doc.text('Pago cabal — sin vuelto');
        }
      }
    } else {
      doc.text('Método: Tarjeta con terminal POS en casa');
      doc.text(`Cobrar: ${money(order.total)}`);
    }

    doc.moveDown(1.2);
    doc
      .fontSize(9)
      .fillColor('#888')
      .text(
        'Gracias por preferirnos · La Granjita 🐔 · Este documento es tu comprobante de pedido.',
        { align: 'center' }
      );

    doc.end();
  });
}

module.exports = {
  generateInvoicePdf,
  INVOICES_DIR,
  formatBills,
};
