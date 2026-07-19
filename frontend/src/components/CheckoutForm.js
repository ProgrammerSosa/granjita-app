'use client';

import { useState, useEffect, useMemo } from 'react';
import useCartStore from '@/store/useCartStore';
import { createOrder } from '@/lib/api';
import { buildWhatsAppUrl } from '@/lib/whatsapp';
import { BillIcon, CreditCardIcon, CheckCircleIcon } from '@/lib/icons';
import CheckoutCashBills from '@/components/CheckoutCashBills';
import { emptyBillsMap, billsTotal, billsToArray } from '@/lib/bills';

export default function CheckoutForm({ onBack, onClose }) {
  const items = useCartStore((s) => s.items);
  const clearCart = useCartStore((s) => s.clearCart);
  const subtotal = items.reduce((sum, i) => sum + i.subtotal, 0);
  const deliveryFee = 0;
  const total = subtotal + deliveryFee;

  const [form, setForm] = useState({
    name: '',
    phone: '',
    address: '',
    notes: '',
  });
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [cashBills, setCashBills] = useState(() => emptyBillsMap());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);

  const cashTendered = useMemo(() => billsTotal(cashBills), [cashBills]);
  const cashChange = Math.round((cashTendered - total) * 100) / 100;

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!form.name.trim() || !form.phone.trim() || !form.address.trim()) {
      setError('Completa nombre, telefono y direccion');
      return;
    }

    setLoading(true);

    try {
      const orderData = {
        customer: {
          name: form.name.trim(),
          phone: form.phone.trim(),
          address: form.address.trim(),
          notes: form.notes.trim(),
        },
        items: items.map((item) => ({
          productId: item.product._id,
          variantName: item.variant?.name || null,
          quantity: item.quantity,
        })),
        paymentMethod,
      };

      if (paymentMethod === 'cash') {
        orderData.cashIntent = {
          bills: billsToArray(cashBills),
          amountTendered: cashTendered,
          change: cashChange,
        };
      }

      const order = await createOrder(orderData);
      setSuccess(order);
      clearCart();
      setCashBills(emptyBillsMap());
    } catch (err) {
      setError(err.message || 'Error al crear el pedido. Intentalo de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  const whatsappUrl = success ? buildWhatsAppUrl(success) : '';

  // Al confirmar el pedido, se intenta abrir WhatsApp automáticamente con la factura
  // ya escrita. Si el navegador bloquea la apertura automática, queda el botón visible.
  useEffect(() => {
    if (!success) return;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [success]);

  if (success) {
    return (
      <div className="flex-1 overflow-y-auto p-4">
        <div className="text-center py-10">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircleIcon className="w-12 h-12 text-green-500" />
          </div>
          <h3 className="text-xl font-black text-gray-900">Pedido confirmado</h3>
          <p className="text-gray-500 text-sm mt-2 max-w-xs mx-auto">
            {success.paymentMethod === 'card'
              ? 'Completa el pago con el link de Mercado Pago'
              : 'Pagas en efectivo al recibir el pedido'}
          </p>
        </div>

        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full bg-[#25D366] hover:bg-[#1ebe5b] text-white font-bold py-3.5 rounded-xl transition-colors duration-200 shadow-sm"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.002-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
          Enviar pedido por WhatsApp
        </a>
        <p className="text-center text-xs text-gray-400 mt-2">
          Se abrirá WhatsApp con tu pedido listo. Solo toca <span className="font-semibold">enviar</span>.
        </p>

        <div className="card p-4 space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Pedido #</span>
            <span className="font-bold text-gray-900">
              {success._id.toString().slice(-6).toUpperCase()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Cliente</span>
            <span className="font-semibold text-gray-900">{success.customer.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Total</span>
            <span className="font-black text-orange-600 text-base">
              Q {success.total.toLocaleString('es-GT')}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Pago</span>
            <span className="font-semibold text-gray-900">
              {success.paymentMethod === 'cash' ? 'Efectivo' : 'Tarjeta'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Estado</span>
            <span className="badge-yellow">Pendiente</span>
          </div>
        </div>

        {success.paymentLink && (
          <a
            href={success.paymentLink}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary block text-center mt-4"
          >
            Pagar con Mercado Pago
          </a>
        )}

        <div className="card p-4 mt-4 space-y-2.5">
          <h4 className="font-bold text-sm text-gray-900">Resumen del pedido</h4>
          {success.items.map((item, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="text-gray-600">
                {item.quantity}x {item.productName}
                {item.variant?.name ? ` (${item.variant.name})` : ''}
              </span>
              <span className="font-semibold text-gray-900">
                Q {item.subtotal.toLocaleString('es-GT')}
              </span>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-gray-400 mt-5">
          Te vamos a notificar por WhatsApp el estado del pedido
        </p>

        <button onClick={onClose} className="btn-outline w-full text-sm py-2.5 mt-2">
          Cerrar
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-5">
      <div className="space-y-3">
        <div>
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            Nombre completo
          </label>
          <input
            type="text"
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="Ej: Juan Perez"
            className="input-field mt-1"
            required
          />
        </div>
        <div>
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            Telefono
          </label>
          <input
            type="tel"
            name="phone"
            value={form.phone}
            onChange={handleChange}
            placeholder="Ej: 12345678"
            className="input-field mt-1"
            required
          />
        </div>
        <div>
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            Direccion de entrega
          </label>
          <input
            type="text"
            name="address"
            value={form.address}
            onChange={handleChange}
            placeholder="Calle, numero, piso, etc."
            className="input-field mt-1"
            required
          />
        </div>
        <div>
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            Notas (opcional)
          </label>
          <textarea
            name="notes"
            value={form.notes}
            onChange={handleChange}
            placeholder="Ej: Toca el timbre 3 veces"
            rows={2}
            className="input-field mt-1 resize-none"
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2.5 block">
          Metodo de pago
        </label>
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => setPaymentMethod('cash')}
            className={`p-4 rounded-xl border-2 text-center transition-all duration-200 ${
              paymentMethod === 'cash'
                ? 'border-orange-500 bg-orange-50 shadow-sm shadow-orange-100'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <span className="block text-orange-500 mb-1"><BillIcon className="w-6 h-6 mx-auto" /></span>
            <span className="block text-sm font-bold text-gray-900">Efectivo</span>
            <span className="block text-xs text-gray-500 mt-0.5">Contra entrega</span>
          </button>
          <button
            type="button"
            disabled
            className="p-4 rounded-xl border-2 border-gray-100 bg-gray-50 text-center cursor-not-allowed opacity-60"
          >
            <span className="block text-gray-400 mb-1"><CreditCardIcon className="w-6 h-6 mx-auto" /></span>
            <span className="block text-sm font-bold text-gray-400">Tarjeta</span>
            <span className="block text-xs text-gray-400 mt-0.5">Proximamente</span>
          </button>
        </div>

        {paymentMethod === 'cash' && (
          <CheckoutCashBills
            total={total}
            bills={cashBills}
            onChange={setCashBills}
          />
        )}
      </div>

      <div className="card p-4 space-y-2 text-sm">
        <div className="flex justify-between text-gray-600">
          <span>Subtotal</span>
          <span className="font-semibold">Q {subtotal.toLocaleString('es-GT')}</span>
        </div>
        <div className="flex justify-between text-gray-600">
          <span>Envio</span>
          <span className="text-green-600 font-bold">Gratis</span>
        </div>
        <div className="flex justify-between text-lg font-black text-gray-900 pt-2 border-t border-gray-100">
          <span>Total</span>
          <span>Q {total.toLocaleString('es-GT')}</span>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3.5 rounded-xl flex items-start gap-2">
          <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          {error}
        </div>
      )}

      <div className="flex gap-2 pb-4">
        <button type="button" onClick={onBack} className="btn-outline flex-1 text-sm py-3">
          Volver
        </button>
        <button
          type="submit"
          disabled={loading}
          className="btn-primary flex-1 text-sm py-3 flex items-center justify-center gap-2"
        >
          {loading ? (
            <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            'Confirmar pedido'
          )}
        </button>
      </div>
    </form>
  );
}
