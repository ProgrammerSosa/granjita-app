'use client';

import { useState } from 'react';
import useCartStore from '@/store/useCartStore';
import { createOrder } from '@/lib/api';

export default function CheckoutForm({ onBack }) {
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!form.name.trim() || !form.phone.trim() || !form.address.trim()) {
      setError('Completá nombre, teléfono y dirección');
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
          extras: item.extras.map((e) => e.name),
          quantity: item.quantity,
        })),
        paymentMethod,
      };

      const order = await createOrder(orderData);
      setSuccess(order);
      clearCart();
    } catch (err) {
      setError(err.message || 'Error al crear el pedido. Intentalo de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="flex-1 overflow-y-auto p-4">
        <div className="text-center py-10">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-5xl">🎉</span>
          </div>
          <h3 className="text-xl font-black text-gray-900">Pedido confirmado</h3>
          <p className="text-gray-500 text-sm mt-2 max-w-xs mx-auto">
            {success.paymentMethod === 'card'
              ? 'Completá el pago con el link de Mercado Pago'
              : 'Pagás en efectivo al recibir el pedido'}
          </p>
        </div>

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
            <span className="font-black text-primary-600 text-base">
              Q {success.total.toLocaleString('es-GT')}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Pago</span>
            <span className="font-semibold text-gray-900">
              {success.paymentMethod === 'cash' ? '💵 Efectivo' : '💳 Tarjeta'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Estado</span>
            <span className="badge-green">Pendiente</span>
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
            placeholder="Ej: Juan Pérez"
            className="input-field mt-1"
            required
          />
        </div>
        <div>
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            Teléfono
          </label>
          <input
            type="tel"
            name="phone"
            value={form.phone}
            onChange={handleChange}
            placeholder="Ej: 1134567890"
            className="input-field mt-1"
            required
          />
        </div>
        <div>
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            Dirección de entrega
          </label>
          <input
            type="text"
            name="address"
            value={form.address}
            onChange={handleChange}
            placeholder="Calle, número, piso, etc."
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
            placeholder="Ej: Tocá el timbre 3 veces"
            rows={2}
            className="input-field mt-1 resize-none"
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2.5 block">
          Método de pago
        </label>
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => setPaymentMethod('cash')}
            className={`p-4 rounded-xl border-2 text-center transition-all duration-200 ${
              paymentMethod === 'cash'
                ? 'border-primary-500 bg-primary-50 shadow-sm shadow-primary-100'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <span className="block text-2xl mb-1">💵</span>
            <span className="block text-sm font-bold text-gray-900">Efectivo</span>
            <span className="block text-xs text-gray-500 mt-0.5">Contra entrega</span>
          </button>
          <button
            type="button"
            onClick={() => setPaymentMethod('card')}
            className={`p-4 rounded-xl border-2 text-center transition-all duration-200 ${
              paymentMethod === 'card'
                ? 'border-primary-500 bg-primary-50 shadow-sm shadow-primary-100'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <span className="block text-2xl mb-1">💳</span>
            <span className="block text-sm font-bold text-gray-900">Tarjeta</span>
            <span className="block text-xs text-gray-500 mt-0.5">Mercado Pago</span>
          </button>
        </div>
      </div>

      <div className="card p-4 space-y-2 text-sm">
        <div className="flex justify-between text-gray-600">
          <span>Subtotal</span>
          <span className="font-semibold">Q {subtotal.toLocaleString('es-GT')}</span>
        </div>
        <div className="flex justify-between text-gray-600">
          <span>Envío</span>
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
