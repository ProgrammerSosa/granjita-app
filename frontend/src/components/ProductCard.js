'use client';

import { getImageUrl } from '@/lib/api';

const CATEGORY_ICONS = {
  Pollo: '🐔',
  Carnes: '🥩',
  'Lácteos': '🧀',
  Aguas: '💧',
  Helados: '🍦',
  Condimentos: '🧂',
  Bebidas: '🥤',
  Extras: '🍟',
};

export default function ProductCard({ product, onSelect }) {
  return (
    <button
      onClick={() => onSelect(product)}
      className="card text-left w-full active:scale-[0.97] group"
    >
      <div className="aspect-[4/3] bg-gradient-to-br from-forest-50 to-primary-50 relative overflow-hidden">
        {product.image ? (
          <img
            src={getImageUrl(product.image)}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 ease-out"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-5xl opacity-40 group-hover:scale-110 transition-transform duration-500">
              {CATEGORY_ICONS[product.category] || '📦'}
            </span>
          </div>
        )}
        <div className="absolute top-2.5 right-2.5 bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-xl shadow-lg border border-white/50">
          <span className="font-black text-primary-700 text-sm">
            Q {product.price.toLocaleString('es-GT')}
          </span>
        </div>
        {!product.available && (
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-[2px] flex items-center justify-center">
            <span className="bg-red-500 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg">
              No disponible
            </span>
          </div>
        )}
      </div>
      <div className="p-3.5">
        <h3 className="font-bold text-gray-900 text-sm leading-tight group-hover:text-primary-700 transition-colors duration-200">
          {product.name}
        </h3>
        {product.description && (
          <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">
            {product.description}
          </p>
        )}
        <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
          {product.variants?.length > 0 && (
            <span className="text-[10px] font-bold text-primary-700 bg-primary-50 px-2 py-0.5 rounded-full border border-primary-100">
              {product.variants.length} variantes
            </span>
          )}
          {product.extras?.length > 0 && (
            <span className="text-[10px] font-bold text-forest-700 bg-forest-50 px-2 py-0.5 rounded-full border border-forest-100">
              + extras
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
