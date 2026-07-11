'use client';

import { useState, useEffect, useRef } from 'react';
import { fetchAdminProducts, createProduct, updateProduct, deleteProduct, uploadImage, getImageUrl } from '@/lib/api';

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

const EMPTY_PRODUCT = {
  name: '',
  description: '',
  price: '',
  image: '',
  category: 'Pollo',
  available: true,
  variants: [],
  extras: [],
};

export default function AdminProductsPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_PRODUCT });
  const [filterCategory, setFilterCategory] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [variantName, setVariantName] = useState('');
  const [variantPrice, setVariantPrice] = useState('');
  const [extraName, setExtraName] = useState('');
  const [extraPrice, setExtraPrice] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    try {
      setLoading(true);
      const data = await fetchAdminProducts();
      setProducts(data);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  }

  const filtered = filterCategory
    ? products.filter(p => p.category === filterCategory)
    : products;

  function openCreate() {
    setEditingProduct(null);
    setForm({ ...EMPTY_PRODUCT });
    setError('');
    setUploadError('');
    setShowModal(true);
  }

  function openEdit(product) {
    setEditingProduct(product);
    setForm({
      name: product.name,
      description: product.description || '',
      price: product.price,
      image: product.image || '',
      category: product.category,
      available: product.available,
      variants: product.variants || [],
      extras: product.extras || [],
    });
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
    if (!variantName.trim() || !variantPrice) return;
    setForm(prev => ({
      ...prev,
      variants: [...prev.variants, { name: variantName.trim(), price: parseFloat(variantPrice) }],
    }));
    setVariantName('');
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

    if (!form.name.trim() || !form.price) {
      setError('Nombre y precio son obligatorios');
      return;
    }

    try {
      setSaving(true);
      const productData = {
        ...form,
        price: parseFloat(form.price),
      };

      if (editingProduct) {
        await updateProduct(editingProduct._id, productData);
      } else {
        await createProduct(productData);
      }
      await loadProducts();
      closeModal();
    } catch (err) {
      setError(err.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('¿Eliminar este producto?')) return;
    try {
      await deleteProduct(id);
      await loadProducts();
    } catch (err) {
      alert('Error al eliminar: ' + err.message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black text-admin-900">Productos</h1>
          <p className="text-admin-500 text-sm mt-0.5">{products.length} productos en total</p>
        </div>
        <button onClick={openCreate} className="btn-admin flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nuevo producto
        </button>
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
                      Q {product.price.toLocaleString('es-GT')}
                    </td>
                    <td className="px-4 py-3">
                      <span className={product.available ? 'badge-green' : 'badge-red'}>
                        {product.available ? 'Disponible' : 'No disponible'}
                      </span>
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-admin-600 uppercase tracking-wider">Precio (Q) *</label>
                  <input
                    type="number"
                    value={form.price}
                    onChange={(e) => setForm(prev => ({ ...prev, price: e.target.value }))}
                    className="input-admin mt-1"
                    placeholder="0"
                    min="0"
                    step="0.01"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-admin-600 uppercase tracking-wider">Categoría *</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm(prev => ({ ...prev, category: e.target.value }))}
                    className="input-admin mt-1"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.icon} {cat.label}</option>
                    ))}
                  </select>
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

              <div className="border-t border-admin-200 pt-4">
                <label className="text-xs font-bold text-admin-600 uppercase tracking-wider">Variantes</label>
                <div className="flex gap-2 mt-2">
                  <input
                    type="text"
                    value={variantName}
                    onChange={(e) => setVariantName(e.target.value)}
                    className="input-admin flex-1"
                    placeholder="Nombre (ej: 1kg)"
                  />
                  <input
                    type="number"
                    value={variantPrice}
                    onChange={(e) => setVariantPrice(e.target.value)}
                    className="input-admin w-24"
                    placeholder="Precio"
                    min="0"
                  />
                  <button type="button" onClick={addVariant} className="btn-admin px-3">+</button>
                </div>
                {form.variants.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {form.variants.map((v, i) => (
                      <div key={i} className="flex items-center justify-between bg-admin-50 px-3 py-2 rounded-lg text-sm border border-admin-100">
                        <span className="font-medium">{v.name} — <strong>Q {v.price.toLocaleString('es-GT')}</strong></span>
                        <button type="button" onClick={() => removeVariant(i)} className="text-red-500 hover:text-red-700 text-xs font-bold">✕</button>
                      </div>
                    ))}
                  </div>
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
