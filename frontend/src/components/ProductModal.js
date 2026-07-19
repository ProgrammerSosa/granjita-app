'use client';

import { useState, useEffect, useMemo } from 'react';
import useCartStore from '@/store/useCartStore';
import useToastStore from '@/store/useToastStore';
import { getImageUrl, formatMoney } from '@/lib/api';

/**
 * El admin define si el producto se vende por unidad, por peso, o ambas.
 * Si son ambas, el cliente elige el tipo y después la variante (1 lb, 2 piezas, etc.).
 */
export default function ProductModal({ product, onClose }) {
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [selectedExtras, setSelectedExtras] = useState([]);
  const [quantity, setQuantity] = useState(1);
  /** 'unit' | 'weight' | null — solo importa si hay de los dos tipos */
  const [sellMode, setSellMode] = useState(null);
  const addItem = useCartStore((s) => s.addItem);
  const success = useToastStore((s) => s.success);
  const toastError = useToastStore((s) => s.error);

  const variants = product.variants || [];
  const extras = product.extras || [];

  const unitVariants = useMemo(
    () => variants.filter((v) => (v.kind || 'unit') === 'unit'),
    [variants]
  );
  const weightVariants = useMemo(
    () => variants.filter((v) => v.kind === 'weight'),
    [variants]
  );

  const hasUnit = unitVariants.length > 0;
  const hasWeight = weightVariants.length > 0;
  const bothModes = hasUnit && hasWeight;
  const onlyLegacy =
    !hasUnit && !hasWeight && variants.length > 0; // productos viejos sin kind

  // Inicializar modo y variante
  useEffect(() => {
    if (onlyLegacy) {
      if (!selectedVariant) setSelectedVariant(variants[0]);
      return;
    }
    if (bothModes) {
      if (!sellMode) return; // espera que el cliente elija unidad o peso
      const list = sellMode === 'weight' ? weightVariants : unitVariants;
      if (!list.some((v) => v.name === selectedVariant?.name && (v.kind || 'unit') === sellMode)) {
        setSelectedVariant(list[0] || null);
      }
      return;
    }
    if (hasUnit && !selectedVariant) {
      setSellMode('unit');
      setSelectedVariant(unitVariants[0]);
    } else if (hasWeight && !selectedVariant) {
      setSellMode('weight');
      setSelectedVariant(weightVariants[0]);
    }
  }, [
    onlyLegacy,
    bothModes,
    hasUnit,
    hasWeight,
    sellMode,
    unitVariants,
    weightVariants,
    variants,
    selectedVariant,
  ]);

  const basePrice = selectedVariant
    ? selectedVariant.price
    : variants.length
      ? Math.min(...variants.map((v) => Number(v.price) || 0))
      : product.price;
  const extrasTotal = selectedExtras.reduce((sum, e) => sum + e.price, 0);
  const unitPrice = (Number(basePrice) || 0) + extrasTotal;
  const totalPrice = unitPrice * quantity;

  function toggleExtra(extra) {
    setSelectedExtras((prev) =>
      prev.some((e) => e.name === extra.name)
        ? prev.filter((e) => e.name !== extra.name)
        : [...prev, extra]
    );
  }

  function pickMode(mode) {
    setSellMode(mode);
    const list = mode === 'weight' ? weightVariants : unitVariants;
    setSelectedVariant(list[0] || null);
  }

  function isSelected(v) {
    if (!selectedVariant) return false;
    return (
      selectedVariant.name === v.name &&
      (selectedVariant.kind || 'unit') === (v.kind || 'unit')
    );
  }

  const qtyStep = sellMode === 'weight' ? 0.5 : 1;
  const minQty = sellMode === 'weight' ? 0.5 : 1;

  function handleAdd() {
    if (product.available === false) return;
    if (bothModes && !sellMode) {
      toastError('Elegí si comprás por unidad o por peso');
      return;
    }
    if (variants.length > 0 && !selectedVariant) {
      toastError('Elegí una opción');
      return;
    }
    addItem(product, {
      variant: selectedVariant,
      extras: selectedExtras,
      quantity,
    });
    success(`${product.name} agregado al carrito`);
    onClose();
  }

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) onClose();
  }

  const optionsToShow = onlyLegacy
    ? variants
    : bothModes
      ? sellMode === 'weight'
        ? weightVariants
        : sellMode === 'unit'
          ? unitVariants
          : []
      : hasWeight
        ? weightVariants
        : unitVariants;

  const optionsTitle = onlyLegacy
    ? 'Opciones'
    : bothModes
      ? sellMode === 'weight'
        ? 'Elegí el peso'
        : sellMode === 'unit'
          ? 'Elegí la unidad'
          : ''
      : hasWeight
        ? 'Por peso'
        : 'Por unidad';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink-950/50 backdrop-blur-sm"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label={product.name}
    >
      <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-y-auto animate-slide-up shadow-2xl">
        {product.image ? (
          <div className="relative h-48 sm:h-56 overflow-hidden sm:rounded-t-3xl rounded-t-3xl">
            <img
              src={getImageUrl(product.image)}
              alt={product.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          </div>
        ) : (
          <div className="h-28 bg-gradient-to-br from-cream-100 to-primary-50 flex items-center justify-center rounded-t-3xl">
            <span className="text-5xl opacity-60" aria-hidden="true">
              🌿
            </span>
          </div>
        )}

        <div className="sticky top-0 bg-white z-10 p-4 border-b border-ink-100 flex items-center justify-between">
          <h2 className="font-bold text-lg text-ink-900 truncate pr-4">{product.name}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-ink-100 rounded-full transition-colors"
            aria-label="Cerrar"
          >
            <svg className="w-5 h-5 text-ink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-5">
          {product.description && (
            <p className="text-sm text-ink-500 leading-relaxed">{product.description}</p>
          )}

          <div className="flex items-center gap-2">
            <span className="text-2xl font-black text-primary-700">{formatMoney(unitPrice)}</span>
            {selectedVariant && (
              <span className="text-xs text-ink-400 font-medium">
                {selectedVariant.kind === 'weight' ? 'por peso' : 'por unidad'} ·{' '}
                {selectedVariant.name}
              </span>
            )}
          </div>

          {/* Paso 1: si hay unidad Y peso, el cliente elige cómo comprar */}
          {bothModes && (
            <div>
              <h3 className="text-xs font-bold text-ink-400 uppercase tracking-wider mb-2.5">
                ¿Cómo querés comprar?
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => pickMode('unit')}
                  className={`p-4 rounded-2xl border-2 text-left transition-all ${
                    sellMode === 'unit'
                      ? 'border-primary-500 bg-primary-50 shadow-sm'
                      : 'border-ink-200 hover:border-ink-300'
                  }`}
                >
                  <span className="text-2xl block mb-1">📦</span>
                  <span className="font-black text-sm text-ink-900">Por unidad</span>
                  <span className="block text-[11px] text-ink-500 mt-0.5">
                    Pieza, docena, bolsa…
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => pickMode('weight')}
                  className={`p-4 rounded-2xl border-2 text-left transition-all ${
                    sellMode === 'weight'
                      ? 'border-primary-500 bg-primary-50 shadow-sm'
                      : 'border-ink-200 hover:border-ink-300'
                  }`}
                >
                  <span className="text-2xl block mb-1">⚖️</span>
                  <span className="font-black text-sm text-ink-900">Por peso</span>
                  <span className="block text-[11px] text-ink-500 mt-0.5">
                    Libra, kilo…
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Paso 2: variantes del tipo elegido (o la única disponible) */}
          {optionsToShow.length > 0 && optionsTitle && (
            <div>
              <h3 className="text-xs font-bold text-ink-400 uppercase tracking-wider mb-2.5">
                {optionsTitle}
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {optionsToShow.map((v) => (
                  <button
                    key={`${v.kind || 'unit'}-${v.name}`}
                    type="button"
                    onClick={() => setSelectedVariant(v)}
                    className={`p-3.5 rounded-xl border-2 text-left transition-all duration-200 ${
                      isSelected(v)
                        ? 'border-primary-500 bg-primary-50 shadow-sm shadow-primary-100'
                        : 'border-ink-200 hover:border-ink-300 hover:bg-ink-50'
                    }`}
                  >
                    <span className="block font-semibold text-sm text-ink-900">{v.name}</span>
                    <span className="block text-xs text-primary-600 font-bold mt-0.5">
                      {formatMoney(v.price)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {bothModes && !sellMode && (
            <p className="text-xs text-center text-ink-400 font-medium">
              Primero elegí unidad o peso para ver las opciones
            </p>
          )}

          {extras.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-ink-400 uppercase tracking-wider mb-2.5">
                Extras
              </h3>
              <div className="space-y-2">
                {extras.map((extra) => {
                  const selected = selectedExtras.some((e) => e.name === extra.name);
                  return (
                    <label
                      key={extra.name}
                      className={`flex items-center justify-between p-3.5 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                        selected
                          ? 'border-primary-500 bg-primary-50 shadow-sm shadow-primary-100'
                          : 'border-ink-200 hover:border-ink-300 hover:bg-ink-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={selected}
                          onChange={() => toggleExtra(extra)}
                        />
                        <div
                          className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                            selected ? 'border-primary-500 bg-primary-500' : 'border-ink-300'
                          }`}
                        >
                          {selected && (
                            <svg
                              className="w-3 h-3 text-white"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={3}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          )}
                        </div>
                        <span className="text-sm font-medium text-ink-900">{extra.name}</span>
                      </div>
                      <span className="text-xs font-bold text-primary-600">
                        +{formatMoney(extra.price)}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <h3 className="text-xs font-bold text-ink-400 uppercase tracking-wider mb-2.5">
              Cantidad
            </h3>
            <div className="flex items-center gap-5">
              <button
                type="button"
                onClick={() => setQuantity(Math.max(minQty, Math.round((quantity - qtyStep) * 10) / 10))}
                className="w-12 h-12 rounded-xl border-2 border-ink-200 flex items-center justify-center
                         hover:border-ink-300 hover:bg-ink-50 transition-all active:scale-95"
                aria-label="Menos"
              >
                <svg className="w-5 h-5 text-ink-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" />
                </svg>
              </button>
              <span className="text-2xl font-black text-ink-900 w-10 text-center">
                {sellMode === 'weight' ? quantity.toFixed(1) : quantity}
              </span>
              <button
                type="button"
                onClick={() => setQuantity(Math.round((quantity + qtyStep) * 10) / 10)}
                className="w-12 h-12 rounded-xl border-2 border-ink-200 flex items-center justify-center
                         hover:border-ink-300 hover:bg-ink-50 transition-all active:scale-95"
                aria-label="Más"
              >
                <svg className="w-5 h-5 text-ink-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white p-4 border-t border-ink-100 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
          <button
            type="button"
            onClick={handleAdd}
            disabled={
              product.available === false ||
              (bothModes && !sellMode) ||
              (variants.length > 0 && !selectedVariant)
            }
            className="btn-primary w-full text-lg py-4"
          >
            {product.available === false
              ? 'No disponible'
              : bothModes && !sellMode
                ? 'Elegí unidad o peso'
                : `Agregar al carrito — ${formatMoney(totalPrice)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
