'use client';

import { getImageUrl, formatMoney } from '@/lib/api';

function catalogPrice(product) {
  const vars = product.variants || [];
  if (vars.length > 0) {
    return Math.min(...vars.map((v) => Number(v.price) || 0));
  }
  return Number(product.price) || 0;
}

export default function ProductCard({ product, onSelect, categories = {} }) {
  const icon = categories[product.category]?.icon || '📦';
  const unavailable = product.available === false;
  const price = catalogPrice(product);
  const hasVariants = (product.variants || []).length > 0;
  const byUnit = product.sellByUnit !== false && (product.variants || []).some((v) => (v.kind || 'unit') === 'unit');
  const byWeight =
    Boolean(product.sellByWeight) ||
    (product.variants || []).some((v) => v.kind === 'weight');

  return (
    <button
      onClick={() => !unavailable && onSelect(product)}
      disabled={unavailable}
      className="card text-left w-full active:scale-[0.98] group disabled:active:scale-100 disabled:cursor-not-allowed disabled:opacity-90"
    >
      <div className="aspect-[4/3] bg-gradient-to-br from-cream-100 to-primary-50 relative overflow-hidden">
        {product.image ? (
          <img
            src={getImageUrl(product.image)}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 ease-out"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-5xl opacity-50 group-hover:scale-110 transition-transform duration-500">
              {icon}
            </span>
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/35 to-transparent pointer-events-none" />

        <div className="absolute top-2.5 right-2.5 bg-white/95 backdrop-blur-sm px-2.5 py-1 rounded-xl shadow-lg border border-white/60">
          <span className="font-black text-primary-700 text-sm tracking-tight">
            {hasVariants ? (
              <>
                <span className="text-[10px] font-bold text-ink-400 block leading-none">desde</span>
                {formatMoney(price)}
              </>
            ) : (
              formatMoney(price)
            )}
          </span>
        </div>

        {product.featured && !unavailable && (
          <div className="absolute top-2.5 left-2.5 bg-ink-900/90 text-white text-[10px] font-bold px-2 py-1 rounded-lg">
            ⭐ Destacado
          </div>
        )}

        {unavailable && (
          <div className="absolute inset-0 bg-ink-950/55 backdrop-blur-[2px] flex items-center justify-center">
            <span className="bg-red-500 text-white text-xs font-bold px-3.5 py-1.5 rounded-full shadow-lg">
              Agotado
            </span>
          </div>
        )}
      </div>

      <div className="p-3.5">
        <h3 className="font-bold text-ink-900 text-sm leading-snug group-hover:text-primary-700 transition-colors line-clamp-2">
          {product.name}
        </h3>
        {product.description && (
          <p className="text-xs text-ink-500 mt-1 line-clamp-2 leading-relaxed">
            {product.description}
          </p>
        )}
        <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
          {byUnit && (
            <span className="text-[10px] font-bold text-ink-600 bg-ink-50 px-2 py-0.5 rounded-full border border-ink-100">
              Unidad
            </span>
          )}
          {byWeight && (
            <span className="text-[10px] font-bold text-primary-700 bg-primary-50 px-2 py-0.5 rounded-full border border-primary-100">
              Peso
            </span>
          )}
          {hasVariants && (
            <span className="text-[10px] font-bold text-primary-700 bg-primary-50 px-2 py-0.5 rounded-full border border-primary-100">
              {product.variants.length} opciones
            </span>
          )}
          {product.extras?.length > 0 && (
            <span className="text-[10px] font-bold text-forest-700 bg-forest-50 px-2 py-0.5 rounded-full border border-forest-200">
              + extras
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
