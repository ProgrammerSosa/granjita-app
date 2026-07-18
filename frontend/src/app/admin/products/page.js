'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import {
  fetchAdminProducts,
  fetchAdminCategories,
  createProduct,
  updateProduct,
  deleteProduct,
  uploadImage,
  getImageUrl,
  formatMoney,
} from '@/lib/api';
import useToastStore from '@/store/useToastStore';
import Link from 'next/link';

const EMPTY_PRODUCT = {
  name: '',
  description: '',
  image: '',
  category: '',
  sellByUnit: true,
  sellByWeight: false,
  available: true,
  featured: false,
  trackStock: true,
  stock: 20,
  lowStockThreshold: 5,
  variants: [],
  extras: [],
};

function displayPrice(product) {
  const vars = product.variants || [];
  if (vars.length > 0) {
    return Math.min(...vars.map((v) => Number(v.price) || 0));
  }
  return Number(product.price) || 0;
}

/** Solo el número: 5 + unidad → "5 unidades" · 5 + peso → "5 lb" */
function formatVariantLabel(kind, qty) {
  const n = Number(qty);
  if (!Number.isFinite(n) || n <= 0) return '';
  // quitar ceros de más: 1.5 no 1.50
  const s = Number.isInteger(n) ? String(n) : String(Math.round(n * 1000) / 1000);
  if (kind === 'weight') {
    return `${s} lb`;
  }
  if (n === 1) return '1 unidad';
  return `${s} unidades`;
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_PRODUCT });
  const [filterCategory, setFilterCategory] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [variantQty, setVariantQty] = useState('');
  const [variantPrice, setVariantPrice] = useState('');
  const [variantKind, setVariantKind] = useState('unit');
  const [extraName, setExtraName] = useState('');
  const [extraPrice, setExtraPrice] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [search, setSearch] = useState('');
  const fileInputRef = useRef(null);
  const askConfirm = useToastStore((s) => s.askConfirm);
  const toastSuccess = useToastStore((s) => s.success);
  const toastError = useToastStore((s) => s.error);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    try {
      setLoading(true);
      const [prods, cats] = await Promise.all([
        fetchAdminProducts(),
        fetchAdminCategories(),
      ]);
      setProducts(prods);
      setCategories(cats);
    } catch (err) {
      console.error('Error:', err);
      toastError(err.message || 'Error cargando datos');
    } finally {
      setLoading(false);
    }
  }

  async function loadProducts() {
    try {
      const data = await fetchAdminProducts();
      setProducts(data);
    } catch (err) {
      console.error('Error:', err);
    }
  }

  const CATEGORIES = categories.map((c) => ({
    id: c.name,
    label: c.name,
    icon: c.icon || '📦',
    active: c.active,
  }));

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (filterCategory && p.category !== filterCategory) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q)
      );
    });
  }, [products, filterCategory, search]);

  function openCreate() {
    if (CATEGORIES.length === 0) {
      toastError('Primero creá una categoría en Categorías');
      return;
    }
    setEditingProduct(null);
    setForm({
      ...EMPTY_PRODUCT,
      category: CATEGORIES.find((c) => c.active !== false)?.id || CATEGORIES[0].id,
    });
    setError('');
    setUploadError('');
    setShowModal(true);
  }

  function openEdit(product) {
    setEditingProduct(product);
    const hasUnit = (product.variants || []).some((v) => (v.kind || 'unit') === 'unit');
    const hasWeight = (product.variants || []).some((v) => v.kind === 'weight');
    setForm({
      name: product.name,
      description: product.description || '',
      image: product.image || '',
      category: product.category,
      sellByUnit: product.sellByUnit !== false || hasUnit || (!hasUnit && !hasWeight),
      sellByWeight: Boolean(product.sellByWeight) || hasWeight,
      available: product.available,
      featured: !!product.featured,
      trackStock: product.trackStock !== false,
      stock: product.stock ?? 20,
      lowStockThreshold: product.lowStockThreshold ?? 5,
      variants: (product.variants || []).map((v) => ({
        name: v.name,
        price: v.price,
        kind: v.kind === 'weight' ? 'weight' : 'unit',
      })),
      extras: product.extras || [],
    });
    setVariantKind(
      product.sellByWeight && !product.sellByUnit ? 'weight' : 'unit'
    );
    setError('');
    setUploadError('');
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingProduct(null);
    setForm({ ...EMPTY_PRODUCT });
    setError('');
    setUploadError('');
  }

  function addVariant() {
    const qty = parseFloat(variantQty);
    const price = parseFloat(variantPrice);
    if (!Number.isFinite(qty) || qty <= 0) {
      toastError('Poné la cantidad (ej: 1, 2, 5)');
      return;
    }
    if (variantPrice === '' || variantPrice === null || Number.isNaN(price) || price < 0) {
      toastError('Poné el precio en Q');
      return;
    }

    let kind = variantKind;
    if (form.sellByUnit && !form.sellByWeight) kind = 'unit';
    if (!form.sellByUnit && form.sellByWeight) kind = 'weight';
    if (!form.sellByUnit && !form.sellByWeight) {
      toastError('Marcá Unidad y/o Peso antes de agregar variantes');
      return;
    }
    if (kind === 'unit' && !form.sellByUnit) {
      toastError('Activá “Por unidad” para agregar esa variante');
      return;
    }
    if (kind === 'weight' && !form.sellByWeight) {
      toastError('Activá “Por peso” para agregar esa variante');
      return;
    }

    const name = formatVariantLabel(kind, qty);
    // evitar duplicados del mismo nombre+kind
    if (form.variants.some((v) => v.name === name && (v.kind || 'unit') === kind)) {
      toastError(`Ya existe la opción “${name}”`);
      return;
    }

    setForm((prev) => ({
      ...prev,
      variants: [...prev.variants, { name, price, kind, amount: qty }],
    }));
    setVariantQty('');
    setVariantPrice('');
  }

  function removeVariant(index) {
    setForm(prev => ({
      ...prev,
      variants: prev.variants.filter((_, i) => i !== index),
    }));
  }

  function addExtra() {
    if (!extraName.trim() || !extraPrice) return;
    setForm(prev => ({
      ...prev,
      extras: [...prev.extras, { name: extraName.trim(), price: parseFloat(extraPrice) }],
    }));
    setExtraName('');
    setExtraPrice('');
  }

  function removeExtra(index) {
    setForm(prev => ({
      ...prev,
      extras: prev.extras.filter((_, i) => i !== index),
    }));
  }

  async function handleImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError('');
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!allowed.includes(ext)) {
      setUploadError('Solo se permiten imágenes JPG, PNG, WebP o GIF');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('La imagen no puede superar los 5MB');
      return;
    }

    try {
      setUploading(true);
      const data = await uploadImage(file);
      setForm(prev => ({ ...prev, image: data.url }));
    } catch (err) {
      setUploadError(err.message || 'Error al subir la imagen. Verificá que el archivo sea una imagen válida.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!form.name.trim()) {
      setError('El nombre es obligatorio');
      return;
    }
    if (!form.sellByUnit && !form.sellByWeight) {
      setError('Marcá al menos: por unidad y/o por peso');
      return;
    }
    if (!form.variants?.length) {
      setError('Agregá al menos una variante con su precio (unidad o peso)');
      return;
    }

    try {
      setSaving(true);
      const prices = form.variants.map((v) => Number(v.price) || 0);
      const productData = {
        ...form,
        // precio de vitrina = el más barato de las variantes
        price: Math.min(...prices),
        sellByUnit: Boolean(form.sellByUnit),
        sellByWeight: Boolean(form.sellByWeight),
        variants: form.variants.map((v) => ({
          name: v.name,
          price: Number(v.price),
          kind: v.kind === 'weight' ? 'weight' : 'unit',
        })),
        stock: Math.max(0, parseInt(form.stock, 10) || 0),
        lowStockThreshold: Math.max(0, parseInt(form.lowStockThreshold, 10) || 5),
        trackStock: form.trackStock !== false,
      };
      if (productData.trackStock && productData.stock <= 0) {
        productData.available = false;
      }

      if (editingProduct) {
        await updateProduct(editingProduct._id, productData);
        toastSuccess('Producto actualizado');
      } else {
        await createProduct(productData);
        toastSuccess('Producto creado');
      }
      await loadProducts();
      closeModal();
    } catch (err) {
      setError(err.message || 'Error al guardar');
      toastError(err.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    const ok = await askConfirm({
      title: 'Eliminar producto',
      message: 'Esta acción no se puede deshacer. ¿Eliminar el producto?',
      confirmLabel: 'Eliminar',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteProduct(id);
      toastSuccess('Producto eliminado');
      await loadProducts();
    } catch (err) {
      toastError('Error al eliminar: ' + err.message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black text-admin-900">Productos</h1>
          <p className="text-admin-500 text-sm mt-0.5">{products.length} productos en total</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/categories" className="btn-outline text-sm py-2.5 px-4">
            Categorías
          </Link>
          <button onClick={openCreate} className="btn-admin flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nuevo producto
          </button>
        </div>
      </div>

      <div className="relative">
        <svg
          className="w-4 h-4 text-admin-400 absolute left-3 top-1/2 -translate-y-1/2"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar producto por nombre..."
          className="input-admin pl-9 w-full sm:max-w-sm"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        <button
          onClick={() => setFilterCategory('')}
          className={`flex-shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            filterCategory === '' ? 'bg-admin-800 text-white shadow-sm' : 'bg-admin-200 text-admin-600 hover:bg-admin-300'
          }`}
        >
          Todos ({products.length})
        </button>
        {CATEGORIES.map(cat => {
          const count = products.filter(p => p.category === cat.id).length;
          return (
            <button
              key={cat.id}
              onClick={() => setFilterCategory(cat.id)}
              className={`flex-shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
                filterCategory === cat.id ? 'bg-admin-800 text-white shadow-sm' : 'bg-admin-200 text-admin-600 hover:bg-admin-300'
              }`}
            >
              <span>{cat.icon}</span>
              {cat.label} ({count})
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-admin-200 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card-admin p-10 text-center">
          <div className="w-16 h-16 bg-admin-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl opacity-50">📦</span>
          </div>
          <p className="text-admin-600 font-bold">No hay productos</p>
          <p className="text-admin-400 text-sm mt-1">Creá tu primer producto para empezar</p>
        </div>
      ) : (
        <div className="card-admin overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-admin-50 border-b border-admin-200">
                  <th className="text-left px-4 py-3 font-bold text-admin-600 text-xs uppercase tracking-wider">Producto</th>
                  <th className="text-left px-4 py-3 font-bold text-admin-600 text-xs uppercase tracking-wider">Categoría</th>
                  <th className="text-left px-4 py-3 font-bold text-admin-600 text-xs uppercase tracking-wider">Precio</th>
                  <th className="text-left px-4 py-3 font-bold text-admin-600 text-xs uppercase tracking-wider">Estado</th>
                  <th className="text-right px-4 py-3 font-bold text-admin-600 text-xs uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-admin-100">
                {filtered.map(product => (
                  <tr key={product._id} className="hover:bg-admin-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {product.image ? (
                          <img src={getImageUrl(product.image)} alt="" className="w-11 h-11 rounded-xl object-cover shadow-sm" />
                        ) : (
                          <div className="w-11 h-11 bg-admin-100 rounded-xl flex items-center justify-center">
                            <span className="text-lg">
                              {CATEGORIES.find(c => c.id === product.category)?.icon || '📦'}
                            </span>
                          </div>
                        )}
                        <div>
                          <p className="font-bold text-admin-900">{product.name}</p>
                          {product.variants?.length > 0 && (
                            <p className="text-admin-400 text-xs mt-0.5">{product.variants.length} variantes</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="badge-gray text-xs">
                        {CATEGORIES.find(c => c.id === product.category)?.icon} {product.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-black text-admin-900">
                      <span className="text-xs text-admin-400 font-medium">desde </span>
                      {formatMoney(displayPrice(product))}
                    </td>
                    <td className="px-4 py-3">
                      <span className={product.available ? 'badge-green' : 'badge-red'}>
                        {product.available ? 'Disponible' : 'Agotado'}
                      </span>
                      {product.trackStock !== false && (
                        <span
                          className={
                            (product.stock || 0) <= 0
                              ? 'badge-red'
                              : (product.stock || 0) <= (product.lowStockThreshold ?? 5)
                                ? 'badge-yellow'
                                : 'badge-gray'
                          }
                        >
                          Stock {product.stock ?? 0}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openEdit(product)}
                          className="p-2 hover:bg-admin-100 rounded-lg transition-colors text-admin-500 hover:text-admin-700"
                          title="Editar"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(product._id)}
                          className="p-2 hover:bg-red-50 rounded-lg transition-colors text-admin-400 hover:text-red-600"
                          title="Eliminar"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl animate-scale-in">
            <div className="sticky top-0 bg-white border-b border-admin-200 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
              <h2 className="text-lg font-bold text-admin-900">
                {editingProduct ? 'Editar producto' : 'Nuevo producto'}
              </h2>
              <button onClick={closeModal} className="p-2 hover:bg-admin-100 rounded-full transition-colors">
                <svg className="w-5 h-5 text-admin-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-admin-600 uppercase tracking-wider">Nombre *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                  className="input-admin mt-1"
                  placeholder="Ej: Pollo entero"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-admin-600 uppercase tracking-wider">Descripción</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                  className="input-admin mt-1 resize-none"
                  rows={2}
                  placeholder="Descripción del producto..."
                />
              </div>

              <div>
                <label className="text-xs font-bold text-admin-600 uppercase tracking-wider">Categoría *</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
                  className="input-admin mt-1"
                  required
                >
                  {CATEGORIES.length === 0 && <option value="">Sin categorías</option>}
                  {CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.icon} {cat.label}
                    </option>
                  ))}
                </select>
                {CATEGORIES.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    <Link href="/admin/categories" className="underline font-semibold">
                      Creá una categoría
                    </Link>{' '}
                    primero
                  </p>
                )}
              </div>

              {/* Cómo se vende: unidad / peso */}
              <div className="rounded-xl border border-admin-200 bg-admin-50/80 p-4 space-y-2">
                <p className="text-xs font-bold text-admin-600 uppercase tracking-wider">
                  ¿Cómo se vende? *
                </p>
                <p className="text-[11px] text-admin-500 leading-relaxed">
                  El admin decide: <strong>solo unidad</strong>, <strong>solo peso</strong>, o{' '}
                  <strong>ambas</strong>. Si marcás las dos, el cliente elige en la tienda si compra
                  por libra/kilo o por pieza. Podés cargar varias opciones de cada tipo (1 lb, 2 lb, 1
                  pieza…). El precio va en cada variante.
                </p>
                <div className="flex flex-wrap gap-4 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!form.sellByUnit}
                      onChange={(e) => {
                        const on = e.target.checked;
                        setForm((prev) => ({
                          ...prev,
                          sellByUnit: on,
                          variants: on
                            ? prev.variants
                            : prev.variants.filter((v) => v.kind !== 'unit'),
                        }));
                        if (on) setVariantKind('unit');
                        else if (form.sellByWeight) setVariantKind('weight');
                      }}
                      className="w-4 h-4 text-primary-600 rounded border-admin-300"
                    />
                    <span className="text-sm font-bold text-admin-800">📦 Por unidad</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!form.sellByWeight}
                      onChange={(e) => {
                        const on = e.target.checked;
                        setForm((prev) => ({
                          ...prev,
                          sellByWeight: on,
                          variants: on
                            ? prev.variants
                            : prev.variants.filter((v) => v.kind !== 'weight'),
                        }));
                        if (on && !form.sellByUnit) setVariantKind('weight');
                      }}
                      className="w-4 h-4 text-primary-600 rounded border-admin-300"
                    />
                    <span className="text-sm font-bold text-admin-800">⚖️ Por peso</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-admin-600 uppercase tracking-wider">Imagen del producto</label>
                <div className="mt-1">
                  {form.image ? (
                    <div className="relative inline-block">
                      <img
                        src={getImageUrl(form.image)}
                        alt="Preview"
                        className="w-32 h-32 object-cover rounded-xl border border-admin-200 shadow-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setForm(prev => ({ ...prev, image: '' }))}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 shadow-md"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-32 h-32 border-2 border-dashed border-admin-300 rounded-xl cursor-pointer hover:border-primary-400 hover:bg-primary-50 transition-all duration-200">
                      {uploading ? (
                        <div className="text-center">
                          <span className="w-7 h-7 border-2 border-primary-500 border-t-transparent rounded-full animate-spin inline-block" />
                          <p className="text-[10px] text-primary-600 mt-1.5 font-medium">Subiendo...</p>
                        </div>
                      ) : (
                        <>
                          <svg className="w-8 h-8 text-admin-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                          </svg>
                          <span className="text-xs text-admin-500 mt-1 font-medium">Subir foto</span>
                        </>
                      )}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                        disabled={uploading}
                      />
                    </label>
                  )}
                </div>
                {uploadError && (
                  <p className="text-red-500 text-xs mt-2 flex items-center gap-1">
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    {uploadError}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-admin-500 uppercase">Stock</label>
                  <input
                    type="number"
                    min="0"
                    value={form.stock}
                    onChange={(e) => setForm((prev) => ({ ...prev, stock: e.target.value }))}
                    className="input-admin mt-1"
                    disabled={form.trackStock === false}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-admin-500 uppercase">
                    Aviso si quedan ≤
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.lowStockThreshold}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, lowStockThreshold: e.target.value }))
                    }
                    className="input-admin mt-1"
                    disabled={form.trackStock === false}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  id="trackStock"
                  checked={form.trackStock !== false}
                  onChange={(e) => setForm((prev) => ({ ...prev, trackStock: e.target.checked }))}
                  className="w-4 h-4 text-primary-600 rounded border-admin-300 focus:ring-primary-500"
                />
                <label htmlFor="trackStock" className="text-sm font-semibold text-admin-700">
                  Controlar stock (descontar en cada pedido)
                </label>
              </div>

              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    id="available"
                    checked={form.available}
                    onChange={(e) => setForm(prev => ({ ...prev, available: e.target.checked }))}
                    className="w-4 h-4 text-primary-600 rounded border-admin-300 focus:ring-primary-500"
                  />
                  <label htmlFor="available" className="text-sm font-semibold text-admin-700">Disponible</label>
                </div>
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    id="featured"
                    checked={form.featured}
                    onChange={(e) => setForm(prev => ({ ...prev, featured: e.target.checked }))}
                    className="w-4 h-4 text-primary-600 rounded border-admin-300 focus:ring-primary-500"
                  />
                  <label htmlFor="featured" className="text-sm font-semibold text-admin-700">⭐ Destacado</label>
                </div>
              </div>

              <div className="border-t border-admin-200 pt-4">
                <label className="text-xs font-bold text-admin-600 uppercase tracking-wider">
                  Variantes y precios *
                </label>
                <p className="text-[11px] text-admin-500 mt-1 mb-2 leading-relaxed">
                  Solo poné el <strong>número</strong> y el precio. Ej: cantidad{' '}
                  <strong>5</strong> + Unidad → se guarda como <strong>“5 unidades”</strong>. Con
                  Peso → <strong>“5 lb”</strong>.
                </p>
                <div className="flex flex-col sm:flex-row gap-2 mt-2">
                  {form.sellByUnit && form.sellByWeight && (
                    <select
                      value={variantKind}
                      onChange={(e) => setVariantKind(e.target.value)}
                      className="input-admin sm:w-36"
                    >
                      <option value="unit">Unidad</option>
                      <option value="weight">Peso (lb)</option>
                    </select>
                  )}
                  <div className="relative flex-1 min-w-[7rem]">
                    <input
                      type="number"
                      value={variantQty}
                      onChange={(e) => setVariantQty(e.target.value)}
                      className="input-admin w-full pr-20"
                      placeholder="Cantidad"
                      min="0.01"
                      step="any"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-admin-400 pointer-events-none">
                      {(form.sellByUnit && form.sellByWeight
                        ? variantKind
                        : form.sellByWeight
                          ? 'weight'
                          : 'unit') === 'weight'
                        ? 'lb'
                        : 'unid.'}
                    </span>
                  </div>
                  <input
                    type="number"
                    value={variantPrice}
                    onChange={(e) => setVariantPrice(e.target.value)}
                    className="input-admin w-28"
                    placeholder="Q precio"
                    min="0"
                    step="0.01"
                  />
                  <button
                    type="button"
                    onClick={addVariant}
                    className="btn-admin px-3"
                    disabled={!form.sellByUnit && !form.sellByWeight}
                  >
                    +
                  </button>
                </div>
                {/* Vista previa en vivo */}
                {variantQty && Number(variantQty) > 0 && (
                  <p className="text-[11px] text-admin-500 mt-1.5 font-medium">
                    Se guardará como:{' '}
                    <strong className="text-primary-700">
                      “
                      {formatVariantLabel(
                        form.sellByUnit && form.sellByWeight
                          ? variantKind
                          : form.sellByWeight
                            ? 'weight'
                            : 'unit',
                        variantQty
                      )}
                      ”
                    </strong>
                    {variantPrice !== '' && !Number.isNaN(parseFloat(variantPrice)) && (
                      <> · {formatMoney(parseFloat(variantPrice))}</>
                    )}
                  </p>
                )}
                {form.variants.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {form.variants.map((v, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between bg-admin-50 px-3 py-2 rounded-lg text-sm border border-admin-100"
                      >
                        <span className="font-medium">
                          <span className="text-[10px] font-black uppercase text-admin-400 mr-1.5">
                            {v.kind === 'weight' ? 'Peso' : 'Unidad'}
                          </span>
                          {v.name} —{' '}
                          <strong>Q {Number(v.price).toLocaleString('es-GT')}</strong>
                        </span>
                        <button
                          type="button"
                          onClick={() => removeVariant(i)}
                          className="text-red-500 hover:text-red-700 text-xs font-bold"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {form.variants.length > 0 && (
                  <p className="text-[11px] text-primary-700 font-semibold mt-2">
                    En la tienda se muestra desde{' '}
                    {formatMoney(Math.min(...form.variants.map((v) => Number(v.price) || 0)))}
                  </p>
                )}
              </div>

              <div className="border-t border-admin-200 pt-4">
                <label className="text-xs font-bold text-admin-600 uppercase tracking-wider">Extras</label>
                <div className="flex gap-2 mt-2">
                  <input
                    type="text"
                    value={extraName}
                    onChange={(e) => setExtraName(e.target.value)}
                    className="input-admin flex-1"
                    placeholder="Nombre extra"
                  />
                  <input
                    type="number"
                    value={extraPrice}
                    onChange={(e) => setExtraPrice(e.target.value)}
                    className="input-admin w-24"
                    placeholder="Precio"
                    min="0"
                  />
                  <button type="button" onClick={addExtra} className="btn-admin px-3">+</button>
                </div>
                {form.extras.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {form.extras.map((e, i) => (
                      <div key={i} className="flex items-center justify-between bg-admin-50 px-3 py-2 rounded-lg text-sm border border-admin-100">
                        <span className="font-medium">{e.name} — <strong>+Q {e.price.toLocaleString('es-GT')}</strong></span>
                        <button type="button" onClick={() => removeExtra(i)} className="text-red-500 hover:text-red-700 text-xs font-bold">✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-xl flex items-start gap-2">
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  {error}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={closeModal} className="btn-outline flex-1 text-sm py-2.5">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="btn-admin flex-1 flex items-center justify-center gap-2">
                  {saving ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    editingProduct ? 'Guardar cambios' : 'Crear producto'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
