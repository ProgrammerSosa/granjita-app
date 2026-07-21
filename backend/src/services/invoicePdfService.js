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
const STATUS_ES = {
  pending: 'Nuevo',
  confirmed: 'Confirmado',
  preparing: 'En proceso',
  in_transit: 'En camino',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};

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

function generateInvoicePdf(order) {
  ensureDir();
  const inv = order.invoice?.number || `PED-${String(order._id).slice(-6).toUpperCase()}`;
  const code = String(order._id).slice(-6).toUpperCase();
  const fileName = `factura-${inv.replace(/[^\w.-]+/g, '_')}.pdf`;
  const filePath = path.join(INVOICES_DIR, fileName);

  // Paleta
  const ORANGE = '#ea580c';
  const INK = '#1c1917';
  const MUTE = '#78716c';
  const LINE = '#e7e5e4';
  const SOFT = '#fafaf9';

  const PAGE_L = 50;
  const PAGE_R = 545;
  const W = PAGE_R - PAGE_L;

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

    // ── Banda de encabezado ──
    doc.rect(0, 0, doc.page.width, 96).fill(ORANGE);
    doc
      .fillColor('#ffffff')
      .font('Helvetica-Bold')
      .fontSize(24)
      .text('LA GRANJITA', PAGE_L, 26);
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#ffe8d6')
      .text('Productos frescos a domicilio · San José Pinula', PAGE_L, 56);
    doc
      .font('Helvetica-Bold')
      .fontSize(13)
      .fillColor('#ffffff')
      .text('FACTURA', PAGE_L, 70);

    // Meta a la derecha del header
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#ffffff')
      .text(`Nº ${inv}`, PAGE_R - 200, 30, { width: 200, align: 'right' })
      .text(`Pedido #${code}`, PAGE_R - 200, 44, { width: 200, align: 'right' })
      .text(gtDateTime(order.invoice?.issuedAt || order.createdAt), PAGE_R - 200, 58, {
        width: 200,
        align: 'right',
      })
      .font('Helvetica-Bold')
      .text(`Estado: ${STATUS_ES[order.orderStatus] || order.orderStatus || '—'}`, PAGE_R - 200, 72, {
        width: 200,
        align: 'right',
      });

    let y = 120;

    // ── Cliente ──
    const zona = (order.customer?.zone || order.customer?.municipality || '').trim();
    const dir = (order.customer?.address || '—') + (zona ? ` (${zona})` : '');
    const clientLines = [
      `Nombre:  ${order.customer?.name || '—'}`,
      `Teléfono:  ${order.customer?.phone || '—'}`,
      `Dirección:  ${dir}`,
    ];
    if (order.customer?.notes) clientLines.push(`Notas:  ${order.customer.notes}`);
    const clientBoxH = 24 + clientLines.length * 15;

    doc.roundedRect(PAGE_L, y, W, clientBoxH, 8).fill(SOFT);
    doc.roundedRect(PAGE_L, y, W, clientBoxH, 8).lineWidth(1).stroke(LINE);
    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor(ORANGE)
      .text('CLIENTE', PAGE_L + 14, y + 10);
    doc.font('Helvetica').fontSize(10).fillColor(INK);
    clientLines.forEach((line, i) => {
      doc.text(line, PAGE_L + 14, y + 26 + i * 15, { width: W - 28 });
    });
    y += clientBoxH + 18;

    // ── Tabla de detalle ──
    doc.font('Helvetica-Bold').fontSize(10).fillColor(INK);
    // Encabezado de tabla
    doc.rect(PAGE_L, y, W, 22).fill('#f5f5f4');
    doc.fillColor(MUTE).fontSize(9);
    doc.text('CANT.', PAGE_L + 10, y + 7);
    doc.text('PRODUCTO', PAGE_L + 70, y + 7);
    doc.text('SUBTOTAL', PAGE_R - 90, y + 7, { width: 80, align: 'right' });
    y += 22;

    const items = order.items || [];
    doc.font('Helvetica').fontSize(10).fillColor(INK);
    items.forEach((item, idx) => {
      const qtyLabel =
        item.unitType === 'weight'
          ? `${Number(item.quantity).toLocaleString('es-GT')} lb`
          : `${item.quantity}x`;
      const name =
        `${item.productName}` +
        (item.variant?.name ? ` (${item.variant.name})` : '') +
        (item.extras?.length ? ` + ${item.extras.map((e) => e.name).join(', ')}` : '');

      const nameH = doc.heightOfString(name, { width: PAGE_R - 90 - (PAGE_L + 70) - 10 });
      const rowH = Math.max(22, nameH + 12);

      if (idx % 2 === 1) doc.rect(PAGE_L, y, W, rowH).fill(SOFT);
      doc.fillColor(INK).fontSize(10);
      doc.text(qtyLabel, PAGE_L + 10, y + 6);
      doc.text(name, PAGE_L + 70, y + 6, { width: PAGE_R - 90 - (PAGE_L + 70) - 10 });
      doc.text(money(item.subtotal), PAGE_R - 90, y + 6, { width: 80, align: 'right' });
      y += rowH;
    });

    doc.moveTo(PAGE_L, y).lineTo(PAGE_R, y).lineWidth(1).stroke(LINE);
    y += 12;

    // ── Totales (caja a la derecha) ──
    const totBoxW = 220;
    const totBoxX = PAGE_R - totBoxW;
    doc.font('Helvetica').fontSize(10).fillColor(MUTE);
    doc.text('Subtotal', totBoxX, y, { width: totBoxW - 90 });
    doc.fillColor(INK).text(money(order.subtotal), totBoxX + totBoxW - 90, y, { width: 90, align: 'right' });
    y += 16;
    doc.fillColor(MUTE).text('Envío', totBoxX, y, { width: totBoxW - 90 });
    doc
      .fillColor(INK)
      .text(order.deliveryFee > 0 ? money(order.deliveryFee) : 'Gratis', totBoxX + totBoxW - 90, y, {
        width: 90,
        align: 'right',
      });
    y += 20;
    doc.roundedRect(totBoxX, y, totBoxW, 30, 6).fill(ORANGE);
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#ffffff');
    doc.text('TOTAL', totBoxX + 12, y + 9);
    doc.text(money(order.total), totBoxX + totBoxW - 100, y + 8, { width: 88, align: 'right' });
    y += 46;

    // ── Pago ──
    doc.font('Helvetica-Bold').fontSize(10).fillColor(ORANGE).text('PAGO', PAGE_L, y);
    y += 15;
    doc.font('Helvetica').fontSize(10).fillColor(INK);
    if (order.paymentMethod === 'cash') {
      doc.text('Método:  Efectivo al entregar', PAGE_L, y);
      y += 15;
      if (order.cashIntent?.amountTendered) {
        doc.text(`Paga con:  ${formatBills(order.cashIntent)}`, PAGE_L, y);
        y += 15;
        doc.text(`Entrega:  ${money(order.cashIntent.amountTendered)}`, PAGE_L, y);
        y += 15;
        const ch = Number(order.cashIntent.change) || 0;
        if (ch > 0) {
          doc.font('Helvetica-Bold').fillColor('#047857').text(`Vuelto a entregar:  ${money(ch)}`, PAGE_L, y);
        } else {
          doc.fillColor(MUTE).text('Pago cabal — sin vuelto', PAGE_L, y);
        }
        y += 15;
      }
    } else {
      doc.text('Método:  Tarjeta con terminal POS en casa', PAGE_L, y);
      y += 15;
      doc.text(`A cobrar:  ${money(order.total)}`, PAGE_L, y);
      y += 15;
    }

    // ── Pie ──
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(MUTE)
      .text(
        'Gracias por preferirnos · La Granjita · Este documento es tu comprobante de pedido.',
        PAGE_L,
        doc.page.height - 70,
        { width: W, align: 'center', lineBreak: false }
      );

    doc.end();
  });
}

module.exports = {
  generateInvoicePdf,
  INVOICES_DIR,
  formatBills,
};
