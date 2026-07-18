'use client';

import { useState, useEffect, useMemo } from 'react';
import { fetchProducts, fetchCategories, formatMoney } from '@/lib/api';
import ProductCard from '@/components/ProductCard';
import ProductModal from '@/components/ProductModal';
import StoreStatusBanner from '@/components/StoreStatusBanner';
import BrandLogo from '@/components/BrandLogo';

export default function HomePage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    try {
      setLoading(true);
      setError('');
      const [prods, cats] = await Promise.all([fetchProducts(), fetchCategories()]);
      setProducts(prods);
      setCategories(cats);
    } catch (err) {
      console.error(err);
      setError(err.message || 'No se pudieron cargar los productos');
    } finally {
      setLoading(false);
    }
  }

  const catMap = useMemo(() => {
    const m = {};
    categories.forEach((c) => {
      m[c.name] = c;
    });
    return m;
  }, [categories]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (activeCategory && p.category !== activeCategory) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q)
      );
    });
  }, [products, activeCategory, search]);

  const groupedByCategory = useMemo(() => {
    const order = categories.map((c) => c.name);
    const groups = {};
    filteredProducts.forEach((product) => {
      if (!groups[product.category]) groups[product.category] = [];
      groups[product.category].push(product);
    });
    return Object.fromEntries(
      Object.entries(groups).sort(([a], [b]) => {
        const ia = order.indexOf(a);
        const ib = order.indexOf(b);
        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
      })
    );
  }, [filteredProducts, categories]);

  const featured = useMemo(
    () => products.filter((p) => p.featured && p.available !== false).slice(0, 6),
    [products]
  );

  const visibleCats = categories.filter(
    (c) => products.some((p) => p.category === c.name) || true
  );

  return (
    <div className="max-w-lg mx-auto px-4">
      {/* Hero La Granjita */}
      <section className="relative -mx-4 px-4 pt-[88px] pb-12 mb-6 overflow-hidden bg-hero-mesh rounded-b-[2.25rem]">
        <div className="absolute inset-0 opacity-30 pointer-events-none">
          <div className="absolute -top-10 -right-10 w-48 h-48 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-40 h-40 bg-primary-300 rounded-full blur-3xl" />
          <div className="absolute top-1/2 right-1/4 w-24 h-24 bg-forest-400/40 rounded-full blur-2xl" />
        </div>

        <div className="relative text-center">
          <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-md border border-white/20 text-white/95 text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-forest-300 animate-pulse" />
            Fresco del día · Entrega a domicilio
          </div>
          <div className="mx-auto mb-4 animate-float w-fit">
            <BrandLogo size={84} rounded="rounded-[1.35rem]" ring={false} className="ring-2 ring-white/40 shadow-xl" />
          </div>
          <h1 className="text-4xl font-black text-white tracking-tight drop-shadow-sm">
            La Granjita
          </h1>
          <p className="text-primary-100/95 text-[15px] mt-2 font-medium max-w-[300px] mx-auto leading-relaxed">
            De la granja a tu puerta · pedí online y cobramos al llegar
          </p>

          <div className="mt-6 grid grid-cols-3 gap-2 max-w-sm mx-auto">
            {[
              { t: 'Efectivo', d: 'Al llegar', icon: '💵' },
              { t: 'Tarjeta', d: 'POS en casa', icon: '💳' },
              { t: 'Factura', d: 'Por WhatsApp', icon: '🧾' },
            ].map((item) => (
              <div
                key={item.t}
                className="rounded-2xl bg-white/10 border border-white/15 backdrop-blur-sm px-2 py-3"
              >
                <p className="text-lg leading-none mb-1" aria-hidden="true">
                  {item.icon}
                </p>
                <p className="text-white font-bold text-sm">{item.t}</p>
                <p className="text-primary-100/80 text-[11px]">{item.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Horario / descanso / mínimo */}
      <StoreStatusBanner />

      {/* Cómo funciona */}
      <section className="mb-7 -mt-1">
        <div className="card p-4 border-primary-100/80 bg-gradient-to-br from-white to-primary-50/40">
          <p className="section-label mb-3">Cómo pedir</p>
          <ol className="grid grid-cols-3 gap-2 text-center">
            {[
              { n: '1', t: 'Elegí', d: 'del catálogo' },
              { n: '2', t: 'Confirmá', d: 'datos y pago' },
              { n: '3', t: 'Recibí', d: 'en tu casa' },
            ].map((step) => (
              <li key={step.n} className="flex flex-col items-center gap-1.5">
                <span className="w-8 h-8 rounded-full bg-ink-900 text-white text-sm font-black flex items-center justify-center shadow-md">
                  {step.n}
                </span>
                <span className="text-sm font-bold text-ink-900">{step.t}</span>
                <span className="text-[11px] text-ink-500 leading-tight">{step.d}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Search */}
      <div className="mb-5 relative z-10">
        <div className="relative surface-glass rounded-2xl">
          <svg
            className="w-5 h-5 text-ink-400 absolute left-4 top-1/2 -translate-y-1/2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="¿Qué necesitás de la granja?"
            className="w-full pl-12 pr-10 py-4 rounded-2xl bg-transparent border-0 outline-none text-ink-900 placeholder:text-ink-400 font-medium"
            aria-label="Buscar productos"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600 p-1.5 rounded-lg"
              aria-label="Limpiar búsqueda"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Categories */}
      <div className="mb-7">
        <div className="flex items-end justify-between mb-3 px-0.5">
          <div>
            <p className="section-label mb-0.5">Explorar</p>
            <h2 className="text-lg font-black text-ink-900">Categorías</h2>
          </div>
          {activeCategory && (
            <button
              onClick={() => setActiveCategory(null)}
              className="text-xs font-bold text-primary-700 hover:text-primary-800"
            >
              Ver todas
            </button>
          )}
        </div>
        <div className="flex gap-2.5 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
          <button
            onClick={() => setActiveCategory(null)}
            className={`flex-shrink-0 px-4 py-2.5 rounded-2xl text-sm font-semibold transition-all duration-200 ${
              activeCategory === null
                ? 'bg-ink-900 text-white shadow-lg shadow-ink-900/20'
                : 'bg-white text-ink-600 border border-ink-100 hover:border-primary-300 hover:text-primary-700 shadow-sm'
            }`}
          >
            Todos
            <span
              className={`ml-1.5 text-xs ${
                activeCategory === null ? 'text-white/70' : 'text-ink-400'
              }`}
            >
              {products.length}
            </span>
          </button>
          {visibleCats.map((cat) => {
            const count = products.filter((p) => p.category === cat.name).length;
            const active = activeCategory === cat.name;
            return (
              <button
                key={cat._id || cat.name}
                onClick={() => setActiveCategory(cat.name)}
                className={`flex-shrink-0 px-4 py-2.5 rounded-2xl text-sm font-semibold transition-all duration-200 flex items-center gap-1.5 ${
                  active
                    ? 'bg-primary-600 text-white shadow-lift'
                    : 'bg-white text-ink-600 border border-ink-100 hover:border-primary-300 hover:text-primary-700 shadow-sm'
                }`}
              >
                <span className="text-base leading-none">{cat.icon || '📦'}</span>
                <span>{cat.name}</span>
                <span className={`text-xs ${active ? 'text-white/75' : 'text-ink-400'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Featured */}
      {!loading && !error && !search && !activeCategory && featured.length > 0 && (
        <section className="mb-9 animate-fade-in">
          <div className="flex items-center gap-2 mb-3 px-0.5">
            <span className="text-lg" aria-hidden="true">
              ✨
            </span>
            <div>
              <p className="section-label">Destacados</p>
              <h3 className="text-base font-black text-ink-900">Lo más pedido</h3>
            </div>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
            {featured.map((product) => (
              <div key={product._id} className="w-[46%] flex-shrink-0 min-w-[160px]">
                <ProductCard
                  product={product}
                  onSelect={setSelectedProduct}
                  categories={catMap}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card">
              <div className="aspect-[4/3] skeleton" />
              <div className="p-3.5 space-y-2.5">
                <div className="h-4 skeleton rounded-lg w-3/4" />
                <div className="h-3 skeleton rounded-lg w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-14 card p-8">
          <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-3xl">
            ⚠️
          </div>
          <p className="text-ink-900 font-bold text-lg">No pudimos cargar el catálogo</p>
          <p className="text-ink-500 text-sm mt-1.5 max-w-xs mx-auto">{error}</p>
          <button onClick={loadAll} className="btn-primary mt-6 px-8">
            Reintentar
          </button>
        </div>
      ) : Object.keys(groupedByCategory).length === 0 ? (
        <div className="text-center py-16">
          <div className="w-20 h-20 bg-ink-100 rounded-3xl flex items-center justify-center mx-auto mb-4 text-4xl">
            {search ? '🔍' : '🌿'}
          </div>
          <p className="text-ink-800 font-bold text-lg">
            {search || activeCategory ? 'Sin resultados' : 'Aún no hay productos'}
          </p>
          <p className="text-ink-400 text-sm mt-1.5">
            {search
              ? `No encontramos “${search}”`
              : activeCategory
                ? 'No hay productos en esta categoría'
                : 'El admin puede cargarlos desde el panel'}
          </p>
          {(search || activeCategory) && (
            <button
              onClick={() => {
                setSearch('');
                setActiveCategory(null);
              }}
              className="btn-outline mt-5 text-sm"
            >
              Ver todos
            </button>
          )}
        </div>
      ) : (
        Object.entries(groupedByCategory).map(([category, catProducts]) => (
          <section key={category} className="mb-10 animate-fade-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 bg-primary-50 rounded-2xl flex items-center justify-center border border-primary-100 shadow-sm">
                <span className="text-xl">{catMap[category]?.icon || '📦'}</span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-black text-ink-900 truncate">{category}</h3>
                <p className="text-xs text-ink-400 font-medium">
                  {catProducts.length} {catProducts.length === 1 ? 'producto' : 'productos'}
                  {catMap[category]?.description ? ` · ${catMap[category].description}` : ''}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {catProducts.map((product) => (
                <ProductCard
                  key={product._id}
                  product={product}
                  onSelect={setSelectedProduct}
                  categories={catMap}
                />
              ))}
            </div>
          </section>
        ))
      )}

      {!loading && products.length > 0 && (
        <div className="mb-4 text-center text-xs text-ink-400 font-medium">
          {filteredProducts.length} productos
          {products.length > 0
            ? ` · desde ${formatMoney(
                Math.min(
                  ...products.map((p) => {
                    const vars = p.variants || [];
                    if (vars.length) return Math.min(...vars.map((v) => Number(v.price) || 0));
                    return Number(p.price) || 0;
                  })
                )
              )}`
            : ''}
        </div>
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
