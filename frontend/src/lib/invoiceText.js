// Factura en texto para WhatsApp (replica el PDF, pero como mensaje).
// Se envía con un enlace wa.me al confirmar el pedido: funciona sin depender
// del bot de WhatsApp del backend (ideal para Render free).

import { formatMoney } from '@/lib/api';
import { formatBillsSummary } from '@/lib/bills';

function invoiceCode(order) {
  return String(order._id).slice(-6).toUpperCase();
}

function invoiceNumber(order) {
  return order.invoice?.number || `PED-${invoiceCode(order)}`;
}

function invoiceDate(order) {
  const d = new Date(order.invoice?.issuedAt || order.createdAt || Date.now());
  try {
    return d.toLocaleString('es-GT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return d.toLocaleString();
  }
}

/** Arma el texto de la factura para WhatsApp (con formato *negrita* de WhatsApp). */
export function buildInvoiceText(order) {
  const lines = [];

  lines.push('🧾 *LA GRANJITA · FACTURA*');
  lines.push(`Factura: ${invoiceNumber(order)}`);
  lines.push(`Pedido: #${invoiceCode(order)}`);
  lines.push(`Fecha: ${invoiceDate(order)}`);
  lines.push('');

  const c = order.customer || {};
  lines.push('👤 *Cliente*');
  lines.push(c.name || '—');
  if (c.phone) lines.push(`📞 ${c.phone}`);
  const dir = [c.address, c.zone].filter(Boolean).join(' · ');
  if (dir) lines.push(`📍 ${dir}`);
  if (c.notes) lines.push(`📝 ${c.notes}`);
  lines.push('');

  lines.push('🛒 *Detalle*');
  (order.items || []).forEach((item) => {
    const extras = item.extras?.length
      ? ` + ${item.extras.map((e) => e.name || e).join(', ')}`
      : '';
    const variant = item.variant?.name ? ` (${item.variant.name})` : '';
    const qtyLabel = item.unitType === 'weight'
      ? `${item.quantity.toFixed(1)} lb`
      : `${item.quantity}x`;
    lines.push(
      `• ${qtyLabel} ${item.productName}${variant}${extras} — ${formatMoney(item.subtotal)}`
    );
  });
  lines.push('');

  lines.push(`Subtotal: ${formatMoney(order.subtotal)}`);
  lines.push(`Envío: ${order.deliveryFee > 0 ? formatMoney(order.deliveryFee) : 'Gratis'}`);
  lines.push(`*TOTAL: ${formatMoney(order.total)}*`);
  lines.push('');

  if (order.paymentMethod === 'cash') {
    lines.push('💵 *Pago:* Efectivo al entregar');
    const intent = order.cashIntent;
    if (intent?.amountTendered) {
      lines.push(
        `Paga con: ${formatBillsSummary(intent.bills)}  ·  entregás ${formatMoney(intent.amountTendered)}`
      );
      const change = Number(intent.change) || 0;
      lines.push(change > 0 ? `Vuelto: ${formatMoney(change)}` : 'Pago cabal — sin vuelto');
    }
  } else {
    lines.push('💳 *Pago:* Tarjeta / POS en casa');
    lines.push(`Cobrar: ${formatMoney(order.total)}`);
  }

  lines.push('');
  lines.push('_Gracias por preferirnos 🐔_');

  return lines.join('\n');
}

/** Enlace wa.me al número de la tienda con la factura ya escrita. */
export function buildInvoiceWhatsAppUrl(order) {
  const number = (process.env.NEXT_PUBLIC_WHATSAPP || '').replace(/\D/g, '');
  const text = encodeURIComponent(buildInvoiceText(order));
  return number ? `https://wa.me/${number}?text=${text}` : `https://wa.me/?text=${text}`;
}
