'use client';

import { useState } from 'react';
import useCartStore from '@/store/useCartStore';
import { getImageUrl } from '@/lib/api';
import CheckoutForm from './CheckoutForm';
import { CategoryIcon } from '@/lib/icons';

export default function CartDrawer({ open, onClose }) {
  const [checkingOut, setCheckingOut] = useState(false);
  const items = useCartStore((s) => s.items);
  const removeItem = useCartStore((s) => s.removeItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const clearCart = useCartStore((s) => s.clearCart);

  const subtotal = items.reduce((sum, i) => sum + i.subtotal, 0);
  const deliveryFee = 0;
  const total = subtotal + deliveryFee;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md bg-white h-full flex flex-col animate-slide-left shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-lg text-gray-900">
              {checkingOut ? 'Completar pedido' : 'Tu carrito'}
            </h2>
            {items.length > 0 && !checkingOut && (
              <span className="bg-orange-100 text-orange-700 text-xs font-bold px-2 py-0.5 rounded-full">
                {items.reduce((sum, i) => sum + i.quantity, 0)}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {checkingOut ? (
          <CheckoutForm onBack={() => setCheckingOut(false)} onClose={onClose} />
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {items.length === 0 ? (
                <div className="text-center py-20">
                  <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
                    </svg>
                  </div>
                  <p className="text-gray-600 font-bold">Tu carrito esta vacio</p>
                  <p className="text-gray-400 text-sm mt-1">Agrega productos del menu</p>
                </div>
              ) : (
                items.map((item, index) => (
                  <div key={index} className="card p-4 animate-fade-in">
                    <div className="flex gap-3">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-gray-900 text-sm truncate">
                          {item.product.name}
                        </h4>
                        {item.variant?.name && (
                          <p className="text-xs text-orange-600 font-semibold mt-0.5">
                            {item.variant.name}
                          </p>
                        )}
                        {item.unitType === 'weight' && (
                          <p className="text-xs text-orange-500 font-bold mt-0.5">
                            Por peso
                          </p>
                        )}
                        <p className="text-sm font-black text-gray-900 mt-1.5">
                          Q {item.subtotal.toLocaleString('es-GT')}
                        </p>
                      </div>
                      <div className="flex flex-col items-center gap-1.5">
                        <div className="flex items-center gap-1 bg-gray-50 rounded-xl p-0.5 border border-gray-200">
                          <button
                            onClick={() => {
                              const step = item.unitType === 'weight' ? 0.5 : 1;
                              const newQty = parseFloat(Math.max(step, item.quantity - step).toFixed(1));
                              updateQuantity(index, newQty);
                            }}
                            className="w-8 h-8 rounded-lg flex items-center justify-center
                                     hover:bg-white transition-colors text-sm font-bold text-gray-600"
                          >
                            -
                          </button>
                          <span className="w-7 text-center text-sm font-bold">
                            {item.quantity}{item.unitType === 'weight' ? 'lb' : ''}
                          </span>
                          <button
                            onClick={() => {
                              const step = item.unitType === 'weight' ? 0.5 : 1;
                              const newQty = parseFloat((item.quantity + step).toFixed(1));
                              updateQuantity(index, newQty);
                            }}
                            className="w-8 h-8 rounded-lg flex items-center justify-center
                                     hover:bg-white transition-colors text-sm font-bold text-gray-600"
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
              <div className="border-t border-gray-100 p-4 space-y-3 bg-white">
                <div className="space-y-2 text-sm">
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
                <div className="flex gap-2">
                  <button onClick={clearCart} className="btn-outline flex-1 text-sm py-2.5">
                    Vaciar
                  </button>
                  <button
                    onClick={() => setCheckingOut(true)}
                    className="btn-primary flex-1 text-sm py-2.5"
                  >
                    Continuar
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
