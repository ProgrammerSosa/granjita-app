'use client';

import { useState } from 'react';
import useCartStore from '@/store/useCartStore';
import useToastStore from '@/store/useToastStore';
import { formatMoney } from '@/lib/api';
import CheckoutForm from './CheckoutForm';
import { useStoreStatus } from './StoreStatusBanner';

export default function CartDrawer({ open, onClose }) {
  const [checkingOut, setCheckingOut] = useState(false);
  const items = useCartStore((s) => s.items);
  const removeItem = useCartStore((s) => s.removeItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const clearCart = useCartStore((s) => s.clearCart);
  const askConfirm = useToastStore((s) => s.askConfirm);
  const success = useToastStore((s) => s.success);
  const { status } = useStoreStatus();

  const subtotal = items.reduce((sum, i) => sum + i.subtotal, 0);
  const deliveryFee = 0;
  const total = subtotal + deliveryFee;

  const minOrder = status?.minOrder ?? 15;
  const belowMin = subtotal > 0 && subtotal < minOrder;
  const storeClosed = status && !status.open;
  const canCheckout = !storeClosed && !belowMin && items.length > 0;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-ink-950/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-md bg-white h-full flex flex-col animate-slide-left shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-ink-100 bg-white">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-lg text-ink-900">
              {checkingOut ? 'Completar pedido' : 'Tu carrito'}
            </h2>
            {items.length > 0 && !checkingOut && (
              <span className="bg-primary-100 text-primary-700 text-xs font-bold px-2 py-0.5 rounded-full">
                {items.reduce((sum, i) => sum + i.quantity, 0)}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-ink-100 rounded-full transition-colors"
            aria-label="Cerrar carrito"
          >
            <svg className="w-5 h-5 text-ink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {checkingOut ? (
          <CheckoutForm
            onBack={() => setCheckingOut(false)}
            onDone={() => {
              setCheckingOut(false);
              onClose();
            }}
            storeStatus={status}
          />
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {status && (
                <div
                  className={`rounded-xl px-3 py-2.5 text-xs font-semibold border ${
                    status.open
                      ? 'bg-forest-50 border-forest-200 text-forest-800'
                      : 'bg-amber-50 border-amber-200 text-amber-950'
                  }`}
                >
                  <p>
                    {status.open ? '🟢' : '🔴'} {status.message}
                  </p>
                  {!status.open && status.nextOpenHint && (
                    <p className="mt-0.5 opacity-90 font-medium">{status.nextOpenHint}</p>
                  )}
                  <p className="mt-1 opacity-80">
                    Horario: {status.hoursLabel} · {status.workDaysLabel} · Mín.{' '}
                    {formatMoney(minOrder)}
                  </p>
                </div>
              )}

              {items.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-20 h-20 bg-cream-100 rounded-full flex items-center justify-center mx-auto mb-4 border border-primary-100">
                    <span className="text-5xl opacity-70" aria-hidden="true">
                      🌿
                    </span>
                  </div>
                  <p className="text-ink-700 font-bold">Tu carrito está vacío</p>
                  <p className="text-ink-400 text-sm mt-1">Agregá productos de la granja</p>
                  <button onClick={onClose} className="btn-primary mt-6 text-sm px-8">
                    Ver catálogo
                  </button>
                </div>
              ) : (
                items.map((item, index) => (
                  <div key={index} className="card p-4 animate-fade-in">
                    <div className="flex gap-3">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-ink-900 text-sm truncate">
                          {item.product.name}
                        </h4>
                        {item.variant?.name && (
                          <p className="text-xs text-primary-600 font-semibold mt-0.5">
                            {item.variant.name}
                          </p>
                        )}
                        {item.extras?.length > 0 && (
                          <p className="text-xs text-ink-500 truncate mt-0.5">
                            + {item.extras.map((e) => e.name).join(', ')}
                          </p>
                        )}
                        <p className="text-sm font-black text-ink-900 mt-1.5">
                          {formatMoney(item.subtotal)}
                        </p>
                      </div>
                      <div className="flex flex-col items-center gap-1.5">
                        <div className="flex items-center gap-1 bg-ink-50 rounded-xl p-0.5 border border-ink-200">
                          <button
                            onClick={() => {
                              const step = item.unitType === 'weight' ? 0.5 : 1;
                              const next = Math.max(step, Math.round((item.quantity - step) * 10) / 10);
                              updateQuantity(index, next);
                            }}
                            className="w-8 h-8 rounded-lg flex items-center justify-center
                                     hover:bg-white transition-colors text-sm font-bold text-ink-600"
                            aria-label="Menos"
                          >
                            -
                          </button>
                          <span className="min-w-[3rem] text-center text-sm font-bold text-ink-900">
                            {item.unitType === 'weight' ? `${item.quantity.toFixed(1)} lb` : item.quantity}
                          </span>
                          <button
                            onClick={() => {
                              const step = item.unitType === 'weight' ? 0.5 : 1;
                              const next = Math.round((item.quantity + step) * 10) / 10;
                              updateQuantity(index, next);
                            }}
                            className="w-8 h-8 rounded-lg flex items-center justify-center
                                     hover:bg-white transition-colors text-sm font-bold text-ink-600"
                            aria-label="Más"
                          >
                            +
                          </button>
                        </div>
                        <button
                          onClick={() => removeItem(index)}
                          className="text-[11px] text-red-500 hover:text-red-600 font-semibold"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {items.length > 0 && (
              <div className="border-t border-ink-100 p-4 space-y-3 bg-white">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-ink-600">
                    <span>Subtotal</span>
                    <span className="font-semibold">{formatMoney(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-ink-600">
                    <span>Envío</span>
                    <span className="text-forest-600 font-bold">Gratis</span>
                  </div>
                  <div className="flex justify-between text-lg font-black text-ink-900 pt-2 border-t border-ink-100">
                    <span>Total</span>
                    <span className="text-primary-600">{formatMoney(total)}</span>
                  </div>
                </div>

                {belowMin && (
                  <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-xs font-semibold px-3 py-2.5">
                    Pedido mínimo {formatMoney(minOrder)}. Te faltan{' '}
                    {formatMoney(minOrder - subtotal)}.
                  </div>
                )}
                {storeClosed && (
                  <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold px-3 py-2.5">
                    {status?.message || 'La tienda está cerrada'}
                    {status?.nextOpenHint ? ` ${status.nextOpenHint}.` : ''}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      const ok = await askConfirm({
                        title: 'Vaciar carrito',
                        message: 'Se eliminarán todos los productos del carrito. ¿Continuar?',
                        confirmLabel: 'Vaciar',
                        danger: true,
                      });
                      if (ok) {
                        clearCart();
                        success('Carrito vaciado');
                      }
                    }}
                    className="btn-outline flex-1 text-sm py-2.5"
                  >
                    Vaciar
                  </button>
                  <button
                    onClick={() => setCheckingOut(true)}
                    disabled={!canCheckout}
                    className="btn-primary flex-1 text-sm py-2.5 disabled:opacity-50"
                  >
                    {storeClosed
                      ? 'Cerrado'
                      : belowMin
                        ? `Mín. ${formatMoney(minOrder)}`
                        : 'Continuar'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
