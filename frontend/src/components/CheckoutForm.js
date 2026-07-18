'use client';

import { useEffect, useMemo, useState } from 'react';
import useCartStore from '@/store/useCartStore';
import { createOrder, fetchDeliveryZones, formatMoney } from '@/lib/api';
import CheckoutCashBills from '@/components/CheckoutCashBills';
import {
  billsTotal,
  billsToArray,
  formatBillsSummary,
  emptyBillsMap,
} from '@/lib/bills';

export default function CheckoutForm({ onBack, onDone, storeStatus }) {
  const items = useCartStore((s) => s.items);
  const clearCart = useCartStore((s) => s.clearCart);
  const subtotal = items.reduce((sum, i) => sum + i.subtotal, 0);
  const deliveryFee = 0;
  const total = subtotal + deliveryFee;
  const minOrder = storeStatus?.minOrder ?? 15;
  const storeClosed = storeStatus && !storeStatus.open;
  const belowMin = subtotal < minOrder;

  const [form, setForm] = useState({
    name: '',
    phone: '',
    zone: '',
    address: '',
    notes: '',
  });
  const [zones, setZones] = useState(
    storeStatus?.delivery?.zones || []
  );
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [cashBills, setCashBills] = useState(() => emptyBillsMap());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    if (storeStatus?.delivery?.zones?.length) {
      setZones(storeStatus.delivery.zones);
      return;
    }
    let alive = true;
    fetchDeliveryZones()
      .then((d) => {
        if (alive && d?.zones) setZones(d.zones);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [storeStatus]);

  const cashTendered = useMemo(() => billsTotal(cashBills), [cashBills]);
  const cashEnough = cashTendered >= total;
  const cashChange = Math.round((cashTendered - total) * 100) / 100;

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

    if (!form.zone) {
      setError('Elegí tu residencial de San José Pinula (solo entregamos ahí)');
      return;
    }

    const phoneDigits = form.phone.replace(/\D/g, '');
    if (phoneDigits.length < 8) {
      setError('Ingresá un teléfono válido (mínimo 8 dígitos)');
      return;
    }

    if (items.length === 0) {
      setError('Tu carrito está vacío');
      return;
    }

    if (storeClosed) {
      setError(
        (storeStatus?.message || 'La tienda está cerrada') +
          (storeStatus?.nextOpenHint ? ` ${storeStatus.nextOpenHint}.` : '')
      );
      return;
    }

    if (belowMin) {
      setError(`El pedido mínimo es ${formatMoney(minOrder)}. Tu carrito suma ${formatMoney(subtotal)}.`);
      return;
    }

    if (paymentMethod === 'cash') {
      if (cashTendered <= 0) {
        setError('Indicá con qué billetes vas a pagar (tocá los billetes abajo)');
        return;
      }
      if (!cashEnough) {
        setError(
          `Dijiste ${formatMoney(cashTendered)} pero el total es ${formatMoney(total)}. Sumá más billetes.`
        );
        return;
      }
    }

    setLoading(true);

    try {
      const orderData = {
        customer: {
          name: form.name.trim(),
          phone: form.phone.trim(),
          zone: form.zone,
          address: form.address.trim(),
          notes: form.notes.trim(),
        },
        items: items.map((item) => ({
          productId: item.product._id,
          variantName: item.variant?.name || null,
          extras: item.extras.map((ex) => ex.name),
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
    } catch (err) {
      setError(err.message || 'Error al crear el pedido. Intentalo de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    const intent = success.cashIntent;
    return (
      <div className="flex-1 overflow-y-auto p-4 pb-8">
        <div className="text-center py-6">
          <div className="w-20 h-20 bg-forest-100 rounded-full flex items-center justify-center mx-auto mb-4 border border-forest-200 shadow-sm">
            <span className="text-5xl" aria-hidden="true">
              🎉
            </span>
          </div>
          <h3 className="text-xl font-black text-ink-900">¡Pedido recibido!</h3>
          <p className="text-ink-500 text-sm mt-2 max-w-xs mx-auto leading-relaxed">
            {success.paymentMethod === 'card'
              ? 'Llevamos el terminal a tu casa y pagás con tarjeta al recibir.'
              : 'Pagás en efectivo cuando llegue el pedido a tu puerta.'}
          </p>
        </div>

        <div className="card p-4 space-y-3 text-sm border-ink-900/10">
          <div className="flex justify-between">
            <span className="text-ink-500">Pedido #</span>
            <span className="font-bold text-ink-900">
              {success._id.toString().slice(-6).toUpperCase()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-500">Cliente</span>
            <span className="font-semibold text-ink-900">{success.customer.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-500">Total</span>
            <span className="font-black text-primary-600 text-base">
              {formatMoney(success.total)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-500">Pago</span>
            <span className="font-semibold text-ink-900">
              {success.paymentMethod === 'cash'
                ? '💵 Efectivo al entregar'
                : '💳 Terminal en casa'}
            </span>
          </div>
        </div>

        {intent?.amountTendered > 0 && (
          <div className="mt-4 rounded-2xl bg-ink-950 text-white p-4 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary-400">
              Confirmaste pagar con
            </p>
            <p className="font-black text-lg text-primary-300">
              {formatBillsSummary(intent.bills)}
            </p>
            <p className="text-sm text-ink-200">
              Entregás <strong className="text-white">{formatMoney(intent.amountTendered)}</strong>
              {intent.change > 0
                ? ` · te devuelven ${formatMoney(intent.change)}`
                : ' · exacto, sin vuelto'}
            </p>
          </div>
        )}

        <div className="mt-4 rounded-2xl bg-gradient-to-br from-primary-600 to-primary-800 text-white p-4 text-sm space-y-2 shadow-lift">
          <p className="font-bold text-primary-100 text-xs uppercase tracking-wider">
            Cómo sigue en La Granjita
          </p>
          <ul className="space-y-1.5 text-white/90 text-xs leading-relaxed">
            <li>1. Confirmamos y preparamos tu pedido</li>
            <li>2. Te mandamos la factura en PDF por WhatsApp</li>
            <li>
              3.{' '}
              {success.paymentMethod === 'cash'
                ? 'Cobramos en efectivo en la puerta (con el vuelto que calculamos)'
                : 'Llevamos el aparato POS y cobrás con tarjeta en la puerta'}
            </li>
          </ul>
        </div>

        <div className="card p-4 mt-4 space-y-2.5">
          <h4 className="font-bold text-sm text-ink-900">Resumen</h4>
          {success.items.map((item, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="text-ink-600">
                {item.quantity}x {item.productName}
                {item.variant?.name ? ` (${item.variant.name})` : ''}
              </span>
              <span className="font-semibold text-ink-900">{formatMoney(item.subtotal)}</span>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => (onDone ? onDone() : onBack())}
          className="btn-primary w-full mt-6 py-3.5"
        >
          Seguir comprando
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-5">
      <div className="space-y-3">
        <div>
          <label className="text-xs font-bold text-ink-400 uppercase tracking-wider">
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
          <label className="text-xs font-bold text-ink-400 uppercase tracking-wider">
            Teléfono
          </label>
          <input
            type="tel"
            name="phone"
            value={form.phone}
            onChange={handleChange}
            placeholder="Ej: 5555-1234"
            className="input-field mt-1"
            required
          />
        </div>
        <div>
          <label className="text-xs font-bold text-ink-400 uppercase tracking-wider">
            Residencial (San José Pinula)
          </label>
          <select
            name="zone"
            value={form.zone}
            onChange={handleChange}
            className="input-field mt-1"
            required
          >
            <option value="">Elegí tu residencial…</option>
            {zones.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-ink-400 mt-1.5 leading-relaxed">
            Solo entregamos en zonas residenciales de San José Pinula.
          </p>
        </div>
        <div>
          <label className="text-xs font-bold text-ink-400 uppercase tracking-wider">
            Dirección / casa / referencia
          </label>
          <input
            type="text"
            name="address"
            value={form.address}
            onChange={handleChange}
            placeholder="Calle, casa, manzana, punto de referencia…"
            className="input-field mt-1"
            required
          />
        </div>
        <div>
          <label className="text-xs font-bold text-ink-400 uppercase tracking-wider">
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
        <label className="text-xs font-bold text-ink-400 uppercase tracking-wider mb-2.5 block">
          ¿Cómo pagás al recibir?
        </label>
        <div className="grid grid-cols-1 gap-2.5">
          <button
            type="button"
            onClick={() => setPaymentMethod('cash')}
            className={`p-4 rounded-2xl border-2 text-left transition-all duration-200 ${
              paymentMethod === 'cash'
                ? 'border-primary-500 bg-primary-50 shadow-glow'
                : 'border-ink-200 hover:border-ink-300 hover:bg-ink-50'
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl" aria-hidden="true">
                💵
              </span>
              <div>
                <span className="block text-sm font-black text-ink-900">Efectivo</span>
                <span className="block text-xs text-ink-500 mt-0.5 leading-relaxed">
                  Pagás en la puerta. Abajo decís con qué billetes.
                </span>
              </div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => {
              setPaymentMethod('card');
              setCashBills(emptyBillsMap());
            }}
            className={`p-4 rounded-2xl border-2 text-left transition-all duration-200 ${
              paymentMethod === 'card'
                ? 'border-primary-500 bg-primary-50 shadow-glow'
                : 'border-ink-200 hover:border-ink-300 hover:bg-ink-50'
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl" aria-hidden="true">
                💳
              </span>
              <div>
                <span className="block text-sm font-black text-ink-900">Tarjeta / POS</span>
                <span className="block text-xs text-ink-500 mt-0.5 leading-relaxed">
                  Llevamos el aparato a tu casa y cobrás con tarjeta en la puerta.
                </span>
              </div>
            </div>
          </button>
        </div>

        {paymentMethod === 'cash' && (
          <CheckoutCashBills total={total} bills={cashBills} onChange={setCashBills} />
        )}
      </div>

      {(storeClosed || belowMin) && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-sm font-semibold p-3.5">
          {storeClosed
            ? (storeStatus?.message || 'Cerrado') +
              (storeStatus?.nextOpenHint ? ` ${storeStatus.nextOpenHint}.` : '')
            : `Pedido mínimo ${formatMoney(minOrder)}. Te faltan ${formatMoney(minOrder - subtotal)}.`}
        </div>
      )}

      <div className="card p-4 space-y-2 text-sm">
        <div className="flex justify-between text-ink-600">
          <span>Subtotal</span>
          <span className="font-semibold">{formatMoney(subtotal)}</span>
        </div>
        <div className="flex justify-between text-ink-600">
          <span>Envío</span>
          <span className="text-forest-600 font-bold">Gratis</span>
        </div>
        <div className="flex justify-between text-ink-500 text-xs">
          <span>Pedido mínimo</span>
          <span className="font-semibold">{formatMoney(minOrder)}</span>
        </div>
        <div className="flex justify-between text-lg font-black text-ink-900 pt-2 border-t border-ink-100">
          <span>Total</span>
          <span className="text-primary-600">{formatMoney(total)}</span>
        </div>
        {paymentMethod === 'cash' && cashTendered > 0 && (
          <div className="pt-2 border-t border-ink-100 space-y-1 text-xs">
            <div className="flex justify-between text-ink-600">
              <span>Dijiste pagar con</span>
              <span className="font-bold text-ink-900">{formatMoney(cashTendered)}</span>
            </div>
            {cashEnough && (
              <div className="flex justify-between text-forest-700 font-bold">
                <span>Vuelto estimado</span>
                <span>{formatMoney(cashChange)}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3.5 rounded-xl">
          {error}
        </div>
      )}

      <div className="flex gap-2 pb-4">
        <button type="button" onClick={onBack} className="btn-outline flex-1 text-sm py-3">
          Volver
        </button>
        <button
          type="submit"
          disabled={
            loading ||
            storeClosed ||
            belowMin ||
            (paymentMethod === 'cash' && !cashEnough)
          }
          className="btn-primary flex-1 text-sm py-3 flex items-center justify-center gap-2"
        >
          {loading ? (
            <span className="w-5 h-5 border-2 border-ink-950 border-t-transparent rounded-full animate-spin" />
          ) : storeClosed ? (
            'Cerrado'
          ) : belowMin ? (
            `Mín. ${formatMoney(minOrder)}`
          ) : paymentMethod === 'cash' && cashEnough ? (
            `Confirmar · ${formatMoney(cashTendered)}`
          ) : paymentMethod === 'cash' ? (
            'Indicá billetes'
          ) : (
            'Confirmar pedido'
          )}
        </button>
      </div>
    </form>
  );
}
