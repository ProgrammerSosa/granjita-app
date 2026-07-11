'use client';

import { useState, useEffect } from 'react';
import { fetchProducts } from '@/lib/api';
import ProductCard from '@/components/ProductCard';
import ProductModal from '@/components/ProductModal';

const CATEGORIES = [
  { id: 'Pollo', label: 'Pollo', icon: '🐔' },
  { id: 'Carnes', label: 'Carnes', icon: '🥩' },
  { id: 'Lácteos', label: 'Lácteos', icon: '🧀' },
  { id: 'Aguas', label: 'Aguas', icon: '💧' },
  { id: 'Helados', label: 'Helados', icon: '🍦' },
  { id: 'Condimentos', label: 'Condimentos', icon: '🧂' },
  { id: 'Bebidas', label: 'Bebidas', icon: '🥤' },
  { id: 'Extras', label: 'Extras', icon: '🍟' },
];

export default function HomePage() {
  const [products, setProducts] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    try {
      const data = await fetchProducts();
      setProducts(data);
    } catch (err) {
      console.error('Error cargando productos:', err);
    } finally {
      setLoading(false);
    }
  }

  const filteredProducts = activeCategory
    ? products.filter((p) => p.category === activeCategory)
    : products;

  const groupedByCategory = {};
  filteredProducts.forEach((product) => {
    if (!groupedByCategory[product.category]) {
      groupedByCategory[product.category] = [];
    }
    groupedByCategory[product.category].push(product);
  });

  return (
    <div className="max-w-lg mx-auto px-4">
      <div className="relative bg-gradient-to-br from-primary-600 via-primary-700 to-forest-800 -mx-4 px-4 py-10 mt-[-64px] pt-[84px] mb-8 rounded-b-3xl overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-4 left-8 w-24 h-24 bg-white rounded-full blur-2xl" />
          <div className="absolute bottom-4 right-8 w-32 h-32 bg-white rounded-full blur-3xl" />
        </div>

        <div className="relative text-center">
          <div className="w-18 h-18 bg-white/15 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl border border-white/20 w-[72px] h-[72px]">
            <span className="text-4xl animate-float">🐔</span>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">
            GRANJITA
          </h1>
          <p className="text-primary-100 text-sm mt-1.5 font-medium">
            Productos frescos directo a tu hogar
          </p>
          <div className="flex items-center justify-center gap-4 mt-4 flex-wrap">
            <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/10">
              <svg className="w-3.5 h-3.5 text-primary-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-primary-100 text-xs font-medium">Frescos</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/10">
              <svg className="w-3.5 h-3.5 text-primary-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-primary-100 text-xs font-medium">Envío a domicilio</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/10">
              <svg className="w-3.5 h-3.5 text-primary-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-primary-100 text-xs font-medium">Pago fácil</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-8">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 px-1">
          Categorías
        </h2>
        <div className="flex gap-2.5 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
          <button
            onClick={() => setActiveCategory(null)}
            className={`flex-shrink-0 px-4 py-2.5 rounded-2xl text-sm font-semibold transition-all duration-200 ${
              activeCategory === null
                ? 'bg-primary-600 text-white shadow-lg shadow-primary-200'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-primary-300 hover:text-primary-600 shadow-sm'
            }`}
          >
            Todos
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex-shrink-0 px-4 py-2.5 rounded-2xl text-sm font-semibold transition-all duration-200 flex items-center gap-1.5 ${
                activeCategory === cat.id
                  ? 'bg-primary-600 text-white shadow-lg shadow-primary-200'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-primary-300 hover:text-primary-600 shadow-sm'
              }`}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="aspect-[4/3] bg-gray-200 rounded-t-2xl" />
              <div className="p-3.5 space-y-2.5">
                <div className="h-4 bg-gray-200 rounded-lg w-3/4" />
                <div className="h-3 bg-gray-200 rounded-lg w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : Object.keys(groupedByCategory).length === 0 ? (
        <div className="text-center py-20">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner">
            <span className="text-5xl opacity-50">📦</span>
          </div>
          <p className="text-gray-600 font-bold text-lg">No hay productos</p>
          <p className="text-gray-400 text-sm mt-1.5">Volvé más tarde</p>
        </div>
      ) : (
        Object.entries(groupedByCategory).map(([category, catProducts]) => (
          <section key={category} className="mb-10 animate-fade-in">
            <div className="flex items-center gap-2.5 mb-4 px-1">
              <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center border border-primary-100">
                <span className="text-xl">
                  {CATEGORIES.find((c) => c.id === category)?.icon || '📦'}
                </span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  {category}
                </h3>
                <span className="text-xs text-gray-400 font-medium">
                  {catProducts.length} {catProducts.length === 1 ? 'producto' : 'productos'}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {catProducts.map((product) => (
                <ProductCard
                  key={product._id}
                  product={product}
                  onSelect={setSelectedProduct}
                />
              ))}
            </div>
          </section>
        ))
      )}

      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </div>
  );
}
