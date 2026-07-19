'use client';

import { useState, useEffect, useRef } from 'react';
import { fetchAdminProducts, createProduct, updateProduct, deleteProduct, uploadImage, getImageUrl } from '@/lib/api';
import { ConfirmModal, AlertModal } from '@/components/ConfirmModal';
import { CategoryIcon, EmptyBoxIcon } from '@/lib/icons';

const CATEGORIES = [
  { id: 'Pollo', label: 'Pollo' },
  { id: 'Carnes', label: 'Carnes' },
  { id: 'Lácteos', label: 'Lácteos' },
  { id: 'Aguas', label: 'Aguas' },
  { id: 'Helados', label: 'Helados' },
  { id: 'Condimentos', label: 'Condimentos' },
  { id: 'Bebidas', label: 'Bebidas' },
  { id: 'Extras', label: 'Extras' },
];

const EMPTY_PRODUCT = {
  name: '',
  description: '',
  price: '',
  image: '',
  category: 'Pollo',
  available: true,
  stock: '',
  sellBy: 'unit',
  variants: [],
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
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertMsg, setAlertMsg] = useState('');

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
      stock: product.stock !== null && product.stock !== undefined ? product.stock : '',
      sellBy: product.sellBy || 'unit',
      variants: product.variants || [],
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

  async function handleImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    await processImageFile(file);
  }

  function handleDragOver(e) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    setDragOver(false);
  }

  async function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await processImageFile(file);
  }

  async function processImageFile(file) {
    setUploadError('');
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!allowed.includes(ext)) {
      setUploadError('Solo se permiten imagenes JPG, PNG, WebP o GIF');
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
      setUploadError(err.message || 'Error al subir la imagen.');
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

    if (!form.sellBy) {
      setError('Selecciona al menos un tipo de venta (unidad o peso)');
      return;
    }

    try {
      setSaving(true);
      const productData = { ...form, price: parseFloat(form.price), stock: form.stock === '' || form.stock === null || form.stock === undefined ? null : parseInt(form.stock) };

      if (editingProduct) {
        const data = await updateProduct(editingProduct._id, productData);
        if (!data) throw new Error('Error al actualizar');
      } else {
        const data = await createProduct(productData);
        if (!data) throw new Error('Error al crear');
      }
      await loadProducts();
      closeModal();
    } catch (err) {
      setError(err.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  function handleDeleteClick(id) {
    setDeleteId(id);
    setConfirmOpen(true);
  }

  async function handleDeleteConfirm() {
    setConfirmOpen(false);
    try {
      await deleteProduct(deleteId);
      await loadProducts();
    } catch (err) {
      setAlertMsg(err.message);
      setAlertOpen(true);
    }
    setDeleteId(null);
  }

  return (
    <div className="space-y-6">
      <ConfirmModal
        open={confirmOpen}
        title="Eliminar producto"
        message="Esta accion no se puede deshacer. Se eliminara el producto permanentemente."
        confirmText="Eliminar"
        cancelText="Cancelar"
        danger
        onConfirm={handleDeleteConfirm}
        onCancel={() => { setConfirmOpen(false); setDeleteId(null); }}
      />
      <AlertModal
        open={alertOpen}
        title="Error"
        message={alertMsg}
        type="error"
        onClose={() => setAlertOpen(false)}
      />

      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Productos</h1>
          <p className="text-gray-500 text-sm mt-0.5">{products.length} productos en total</p>
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
            filterCategory === '' ? 'bg-gray-900 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
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
                filterCategory === cat.id ? 'bg-gray-900 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
              }`}
            >
              <CategoryIcon category={cat.id} />
              {cat.label} ({count})
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card-admin p-10 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <EmptyBoxIcon className="w-8 h-8 text-gray-300" />
          </div>
          <p className="text-gray-600 font-bold">No hay productos</p>
          <p className="text-gray-400 text-sm mt-1">Crea tu primer producto para empezar</p>
        </div>
      ) : (
        <div className="card-admin overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-bold text-gray-600 text-xs uppercase">Producto</th>
                  <th className="text-left px-4 py-3 font-bold text-gray-600 text-xs uppercase">Categoria</th>
                  <th className="text-left px-4 py-3 font-bold text-gray-600 text-xs uppercase">Venta</th>
                  <th className="text-left px-4 py-3 font-bold text-gray-600 text-xs uppercase">Precio</th>
                  <th className="text-left px-4 py-3 font-bold text-gray-600 text-xs uppercase">Stock</th>
                  <th className="text-left px-4 py-3 font-bold text-gray-600 text-xs uppercase">Estado</th>
                  <th className="text-right px-4 py-3 font-bold text-gray-600 text-xs uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(product => (
                  <tr key={product._id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {product.image ? (
                          <img src={getImageUrl(product.image)} alt="" className="w-11 h-11 rounded-xl object-cover shadow-sm" />
                        ) : (
                          <div className="w-11 h-11 bg-gray-100 rounded-xl flex items-center justify-center">
                            <CategoryIcon category={product.category} className="text-gray-400" />
                          </div>
                        )}
                        <div>
                          <p className="font-bold text-gray-900">{product.name}</p>
                          {product.variants?.length > 0 && (
                            <p className="text-gray-400 text-xs mt-0.5">{product.variants.length} variantes</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="badge-gray text-xs">
                        {product.category}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="badge-gray text-xs">
                        {product.sellBy === 'weight' ? 'Peso' : product.sellBy === 'both' ? 'Ambos' : 'Unidad'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-black text-gray-900">
                      Q {product.price.toLocaleString('es-GT')}
                    </td>
                    <td className="px-4 py-3">
                      {product.stock !== null && product.stock !== undefined ? (
                        <span className={`text-sm font-bold ${product.stock === 0 ? 'text-red-600' : product.stock <= 5 ? 'text-orange-600' : 'text-gray-900'}`}>
                          {product.stock}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">&mdash;</span>
                      )}
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
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500 hover:text-gray-700"
                          title="Editar"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteClick(product._id)}
                          className="p-2 hover:bg-red-50 rounded-lg transition-colors text-gray-400 hover:text-red-600"
                          title="Eliminar"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && closeModal()}>
          <div className="bg-white w-full max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto shadow-2xl m-4">
            <div className="sticky top-0 bg-white z-10 p-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-bold text-lg text-gray-900">
                {editingProduct ? 'Editar producto' : 'Nuevo producto'}
              </h2>
              <button onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-xl">{error}</div>
              )}

              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Nombre</label>
                <input type="text" value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
                  className="input-field mt-1" placeholder="Ej: Pollo a la brasa" required />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Descripcion</label>
                <textarea value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))}
                  className="input-field mt-1 resize-none" rows={2} placeholder="Opcional" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Precio base</label>
                  <input type="number" step="0.01" min="0" value={form.price}
                    onChange={(e) => setForm(p => ({ ...p, price: e.target.value }))}
                    className="input-field mt-1" placeholder="0.00" required />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Categoria</label>
                  <select value={form.category} onChange={(e) => setForm(p => ({ ...p, category: e.target.value }))}
                    className="input-field mt-1">
                    {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Stock disponible</label>
                <input type="number" step="1" min="0" value={form.stock}
                  onChange={(e) => setForm(p => ({ ...p, stock: e.target.value }))}
                  className="input-field mt-1" placeholder="Dejar vacio para stock ilimitado" />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Tipo de venta</label>
                <div className="mt-2 space-y-2">
                  <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                    form.sellBy === 'unit' || form.sellBy === 'both'
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}>
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                      form.sellBy === 'unit' || form.sellBy === 'both'
                        ? 'border-orange-500 bg-orange-500'
                        : 'border-gray-300'
                    }`}>
                      {(form.sellBy === 'unit' || form.sellBy === 'both') && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={form.sellBy === 'unit' || form.sellBy === 'both'}
                      onChange={() => {
                        if (form.sellBy === 'weight') setForm(p => ({ ...p, sellBy: 'both' }));
                        else if (form.sellBy === 'both') setForm(p => ({ ...p, sellBy: 'weight' }));
                        else if (form.sellBy === 'unit') setForm(p => ({ ...p, sellBy: '' }));
                        else setForm(p => ({ ...p, sellBy: 'unit' }));
                      }}
                    />
                    <div>
                      <span className="text-sm font-semibold text-gray-900">Vender por unidad</span>
                      <span className="block text-xs text-gray-500">Piezas enteras (1, 2, 3...)</span>
                    </div>
                  </label>

                  <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                    form.sellBy === 'weight' || form.sellBy === 'both'
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}>
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                      form.sellBy === 'weight' || form.sellBy === 'both'
                        ? 'border-orange-500 bg-orange-500'
                        : 'border-gray-300'
                    }`}>
                      {(form.sellBy === 'weight' || form.sellBy === 'both') && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={form.sellBy === 'weight' || form.sellBy === 'both'}
                      onChange={() => {
                        if (form.sellBy === 'unit') setForm(p => ({ ...p, sellBy: 'both' }));
                        else if (form.sellBy === 'both') setForm(p => ({ ...p, sellBy: 'unit' }));
                        else if (form.sellBy === 'weight') setForm(p => ({ ...p, sellBy: '' }));
                        else setForm(p => ({ ...p, sellBy: 'weight' }));
                      }}
                    />
                    <div>
                      <span className="text-sm font-semibold text-gray-900">Vender por peso</span>
                      <span className="block text-xs text-gray-500">Libras (0.5, 1, 1.5...)</span>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Imagen</label>
                <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} className="hidden" />
                {form.image ? (
                  <div className="mt-2 relative group">
                    <img src={getImageUrl(form.image)} alt="" className="w-full h-40 rounded-xl object-cover shadow-sm" />
                    <div className="absolute inset-0 bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button type="button" onClick={() => setForm(p => ({ ...p, image: '' }))}
                        className="bg-red-500 hover:bg-red-600 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors">
                        Quitar imagen
                      </button>
                    </div>
                    {uploading && (
                      <div className="absolute inset-0 bg-white/80 rounded-xl flex items-center justify-center">
                        <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`mt-2 border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                      dragOver
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-gray-300 hover:border-orange-400 hover:bg-gray-50'
                    }`}
                  >
                    {uploading ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm text-gray-500">Subiendo imagen...</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                        </svg>
                        <span className="text-sm text-gray-500">
                          <span className="font-semibold text-orange-600">Click</span> o arrastra tu imagen aqui
                        </span>
                        <span className="text-xs text-gray-400">JPG, PNG, WebP o GIF (max 5MB)</span>
                      </div>
                    )}
                  </div>
                )}
                {uploadError && <p className="text-xs text-red-500 mt-1">{uploadError}</p>}
              </div>

              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Variantes</label>
                <div className="flex gap-2 mt-1">
                  <input type="text" value={variantName} onChange={(e) => setVariantName(e.target.value)}
                    className="input-field flex-1" placeholder="Ej: 1/4 de libra" />
                  <input type="number" step="0.01" min="0" value={variantPrice}
                    onChange={(e) => setVariantPrice(e.target.value)}
                    className="input-field w-24" placeholder="Precio" />
                  <button type="button" onClick={addVariant}
                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-bold transition-colors">+</button>
                </div>
                {form.variants.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {form.variants.map((v, i) => (
                      <div key={i} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-lg">
                        <span className="text-sm font-medium text-gray-700">{v.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-orange-600">Q {v.price.toFixed(2)}</span>
                          <button type="button" onClick={() => removeVariant(i)}
                            className="text-xs text-red-500 hover:text-red-600 font-semibold">X</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <input type="checkbox" id="available" checked={form.available}
                  onChange={(e) => setForm(p => ({ ...p, available: e.target.checked }))}
                  className="w-4 h-4 text-orange-500 border-gray-300 rounded focus:ring-orange-500" />
                <label htmlFor="available" className="text-sm font-medium text-gray-700">Producto disponible</label>
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={closeModal} className="btn-outline flex-1 text-sm py-2.5">Cancelar</button>
                <button type="submit" disabled={saving}
                  className="btn-primary flex-1 text-sm py-2.5 flex items-center justify-center gap-2">
                  {saving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : editingProduct ? 'Guardar cambios' : 'Crear producto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
