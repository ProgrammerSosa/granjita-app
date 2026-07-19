// Envío de pedidos por WhatsApp usando enlaces wa.me (click-to-chat).
// No requiere servidor de WhatsApp, ni QR, ni dependencias: funciona en Render free.

// Número de la tienda que RECIBE los pedidos.
// Formato internacional SIN "+", espacios ni guiones. Ej. Guatemala: 502########
// Se configura con la variable NEXT_PUBLIC_WHATSAPP_NUMBER en Render (frontend).
export function getStoreWhatsAppNumber() {
  return (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '').replace(/[^0-9]/g, '');
}

// Construye el texto del pedido/factura que se manda por WhatsApp.
export function buildOrderWhatsAppText(order) {
  const pedidoId = order._id.toString().slice(-6).toUpperCase();

  const productos = order.items
    .map((item) => {
      const variante = item.variant?.name ? ` (${item.variant.name})` : '';
      return `• ${item.quantity}x ${item.productName}${variante} — Q${item.subtotal.toLocaleString('es-GT')}`;
    })
    .join('\n');

  const pago = order.paymentMethod === 'cash' ? 'Efectivo (contra entrega)' : 'Tarjeta';
  const notas = order.customer.notes ? `*Notas:* ${order.customer.notes}\n` : '';

  return (
    `*GRANJITA — Pedido #${pedidoId}*\n\n` +
    `*Cliente:* ${order.customer.name}\n` +
    `*Teléfono:* ${order.customer.phone}\n` +
    `*Dirección:* ${order.customer.address}\n` +
    notas +
    `\n*Productos:*\n${productos}\n\n` +
    `*TOTAL: Q${order.total.toLocaleString('es-GT')}*\n` +
    `*Pago:* ${pago}`
  );
}

// URL de WhatsApp lista para abrir. Si hay número de tienda, va dirigido a ese número;
// si no, WhatsApp deja que el cliente elija a quién enviarlo.
export function buildWhatsAppUrl(order) {
  const number = getStoreWhatsAppNumber();
  const text = encodeURIComponent(buildOrderWhatsAppText(order));
  return number
    ? `https://wa.me/${number}?text=${text}`
    : `https://wa.me/?text=${text}`;
}
