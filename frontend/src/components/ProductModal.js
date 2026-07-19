'use client';

import { useState, useEffect } from 'react';
import useCartStore from '@/store/useCartStore';
import { getImageUrl } from '@/lib/api';

export default function ProductModal({ product, onClose }) {
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [unitType, setUnitType] = useState('unit');
  const addItem = useCartStore((s) => s.addItem);

  const variants = product.variants || [];
  const sellBy = product.sellBy || 'unit';

  useEffect(() => {
    if (variants.length > 0 && !selectedVariant) {
      setSelectedVariant(variants[0]);
    }
  }, [variants]);

  useEffect(() => {
    if (sellBy === 'unit') setUnitType('unit');
    else if (sellBy === 'weight') setUnitType('weight');
    else setUnitType('unit');
  }, [sellBy]);

  const unitPrice = selectedVariant ? selectedVariant.price : product.price;
  const totalPrice = unitPrice * quantity;

  function handleQuantityChange(value) {
    const parsed = parseFloat(value);
    if (isNaN(parsed) || parsed < 0) return;
    setQuantity(parsed);
  }

  function handleAdd() {
    if (quantity <= 0) return;
    addItem(product, {
      variant: selectedVariant,
      extras: [],
      quantity,
      unitType,
    });
    onClose();
  }

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={handleOverlayClick}
    >
      <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-y-auto animate-slide-up shadow-2xl">
        {product.image && (
          <div className="relative h-48 sm:h-56 overflow-hidden sm:rounded-t-3xl rounded-t-3xl">
            <img
              src={getImageUrl(product.image)}
              alt={product.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          </div>
        )}

        <div className="sticky top-0 bg-white z-10 p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-lg text-gray-900 truncate pr-4">
            {product.name}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-5">
          {product.description && (
            <p className="text-sm text-gray-500 leading-relaxed">{product.description}</p>
          )}

          <div className="flex items-center gap-2">
            <span className="text-2xl font-black text-orange-700">
              Q {unitPrice.toLocaleString('es-GT')}
            </span>
            {selectedVariant && (
              <span className="text-xs text-gray-400 font-medium">
                por {selectedVariant.name}
              </span>
            )}
            {unitType === 'weight' && (
              <span className="text-xs text-orange-500 font-bold">por libra</span>
            )}
          </div>

          {sellBy === 'both' && (
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2.5">
                Tipo de venta
              </h3>
              <div className="flex items-center justify-between bg-gray-50 rounded-xl p-4 border border-gray-200">
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-gray-900">
                    {unitType === 'unit' ? 'Por unidad' : 'Por peso'}
                  </span>
                  <span className="text-xs text-gray-500 mt-0.5">
                    {unitType === 'unit' ? 'Pieza entera' : 'Libras (lb)'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const newType = unitType === 'unit' ? 'weight' : 'unit';
                    setUnitType(newType);
                    setQuantity(newType === 'weight' ? 0.5 : 1);
                  }}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200 focus:outline-none ${
                    unitType === 'weight' ? 'bg-orange-500' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 ${
                      unitType === 'weight' ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          )}

          {variants.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2.5">
                Tamano / Variante
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {variants.map((v) => (
                  <button
                    key={v.name}
                    onClick={() => setSelectedVariant(v)}
                    className={`p-3.5 rounded-xl border-2 text-left transition-all duration-200 ${
                      selectedVariant?.name === v.name
                        ? 'border-orange-500 bg-orange-50 shadow-sm shadow-orange-100'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <span className="block font-semibold text-sm text-gray-900">{v.name}</span>
                    <span className="block text-xs text-orange-600 font-bold mt-0.5">
                      Q {v.price.toLocaleString('es-GT')}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2.5">
              Cantidad {unitType === 'weight' ? '(lb)' : ''}
            </h3>
            {sellBy === 'weight' || (sellBy === 'both' && unitType === 'weight') ? (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleQuantityChange(parseFloat(Math.max(0.5, quantity - 0.5).toFixed(1)))}
                  className="w-12 h-12 rounded-xl border-2 border-gray-200 flex items-center justify-center
                           hover:border-gray-300 hover:bg-gray-50 transition-all active:scale-95"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" />
                  </svg>
                </button>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => handleQuantityChange(e.target.value)}
                    min="0.5"
                    step="0.5"
                    className="w-20 text-center text-2xl font-black text-gray-900 border-2 border-gray-200 rounded-xl py-2
                             focus:border-orange-500 focus:outline-none"
                  />
                  <span className="text-sm font-bold text-gray-500">lb</span>
                </div>
                <button
                  onClick={() => handleQuantityChange(parseFloat((quantity + 0.5).toFixed(1)))}
                  className="w-12 h-12 rounded-xl border-2 border-gray-200 flex items-center justify-center
                           hover:border-gray-300 hover:bg-gray-50 transition-all active:scale-95"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-5">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-12 h-12 rounded-xl border-2 border-gray-200 flex items-center justify-center
                           hover:border-gray-300 hover:bg-gray-50 transition-all active:scale-95"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" />
                  </svg>
                </button>
                <span className="text-2xl font-black text-gray-900 w-10 text-center">{quantity}</span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="w-12 h-12 rounded-xl border-2 border-gray-200 flex items-center justify-center
                           hover:border-gray-300 hover:bg-gray-50 transition-all active:scale-95"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="sticky bottom-0 bg-white p-4 border-t border-gray-100 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
          <button onClick={handleAdd} className="btn-primary w-full text-lg py-4">
            Agregar al carrito — Q {totalPrice.toLocaleString('es-GT')}
          </button>
        </div>
      </div>
    </div>
  );
}
