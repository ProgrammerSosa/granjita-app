'use client';

import { useEffect, useState } from 'react';
import {
  fetchAdminCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '@/lib/api';
import useToastStore from '@/store/useToastStore';

const ICON_PRESETS = ['🐔', '🥩', '🧀', '💧', '🍦', '🧂', '🥤', '🍟', '🍞', '🍎', '🥚', '🥛', '🛒', '📦', '🌿', '🔥'];

const EMPTY = { name: '', icon: '📦', description: '', order: 0, active: true };

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const askConfirm = useToastStore((s) => s.askConfirm);
  const toastSuccess = useToastStore((s) => s.success);
  const toastError = useToastStore((s) => s.error);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setLoading(true);
      const data = await fetchAdminCategories();
      setCategories(data);
    } catch (err) {
      toastError(err.message || 'Error cargando categorías');
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY, order: (categories[categories.length - 1]?.order || 0) + 1 });
    setError('');
    setShowModal(true);
  }

  function openEdit(cat) {
    setEditing(cat);
    setForm({
      name: cat.name,
      icon: cat.icon || '📦',
      description: cat.description || '',
      order: cat.order || 0,
      active: cat.active !== false,
    });
    setError('');
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditing(null);
    setForm({ ...EMPTY });
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) {
      setError('El nombre es obligatorio');
      return;
    }
    try {
      setSaving(true);
      if (editing) {
        await updateCategory(editing._id, form);
        toastSuccess('Categoría actualizada');
      } else {
        await createCategory(form);
        toastSuccess('Categoría creada');
      }
      await load();
      closeModal();
    } catch (err) {
      setError(err.message || 'Error al guardar');
      toastError(err.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(cat) {
    const ok = await askConfirm({
      title: 'Eliminar categoría',
      message:
        cat.productCount > 0
          ? `“${cat.name}” tiene ${cat.productCount} producto(s). Primero movelos o eliminalos.`
          : `¿Eliminar la categoría “${cat.name}”? Esta acción no se puede deshacer.`,
      confirmLabel: cat.productCount > 0 ? 'Entendido' : 'Eliminar',
      danger: cat.productCount === 0,
    });
    if (!ok || cat.productCount > 0) return;

    try {
      await deleteCategory(cat._id);
      toastSuccess('Categoría eliminada');
      await load();
    } catch (err) {
      toastError(err.message || 'No se pudo eliminar');
    }
  }

  async function toggleActive(cat) {
    try {
      await updateCategory(cat._id, { active: !cat.active });
      toastSuccess(cat.active ? 'Categoría desactivada' : 'Categoría activada');
      await load();
    } catch (err) {
      toastError(err.message);
    }
  }

  async function move(cat, dir) {
    const idx = categories.findIndex((c) => c._id === cat._id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= categories.length) return;
    const a = categories[idx];
    const b = categories[swapIdx];
    try {
      await Promise.all([
        updateCategory(a._id, { order: b.order }),
        updateCategory(b._id, { order: a.order }),
      ]);
      await load();
    } catch (err) {
      toastError(err.message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <p className="section-label text-admin-400">Catálogo</p>
          <h1 className="text-2xl font-black text-admin-900">Categorías</h1>
          <p className="text-admin-500 text-sm mt-0.5">
            Creá, editá u ocultá categorías de la tienda
          </p>
        </div>
        <button onClick={openCreate} className="btn-admin flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nueva categoría
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-admin-200 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <div className="card-admin p-12 text-center">
          <div className="text-4xl mb-3">📂</div>
          <p className="font-bold text-admin-800">Sin categorías</p>
          <p className="text-sm text-admin-500 mt-1">Creá la primera para organizar productos</p>
          <button onClick={openCreate} className="btn-admin mt-5">
            Crear categoría
          </button>
        </div>
      ) : (
        <div className="card-admin divide-y divide-admin-100">
          {categories.map((cat, index) => (
            <div
              key={cat._id}
              className="p-4 flex items-center gap-3 hover:bg-admin-50/60 transition-colors"
            >
              <div className="w-12 h-12 rounded-2xl bg-primary-50 border border-primary-100 flex items-center justify-center text-2xl flex-shrink-0">
                {cat.icon || '📦'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-admin-900 truncate">{cat.name}</p>
                  <span className={cat.active ? 'badge-green' : 'badge-gray'}>
                    {cat.active ? 'Activa' : 'Oculta'}
                  </span>
                  <span className="badge-gray">{cat.productCount || 0} productos</span>
                </div>
                {cat.description && (
                  <p className="text-xs text-admin-500 mt-0.5 truncate">{cat.description}</p>
                )}
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => move(cat, -1)}
                  disabled={index === 0}
                  className="p-2 rounded-lg hover:bg-admin-100 text-admin-500 disabled:opacity-30"
                  title="Subir"
                >
                  ↑
                </button>
                <button
                  onClick={() => move(cat, 1)}
                  disabled={index === categories.length - 1}
                  className="p-2 rounded-lg hover:bg-admin-100 text-admin-500 disabled:opacity-30"
                  title="Bajar"
                >
                  ↓
                </button>
                <button
                  onClick={() => toggleActive(cat)}
                  className="p-2 rounded-lg hover:bg-admin-100 text-admin-500"
                  title={cat.active ? 'Ocultar' : 'Mostrar'}
                >
                  {cat.active ? '👁' : '🙈'}
                </button>
                <button
                  onClick={() => openEdit(cat)}
                  className="p-2 rounded-lg hover:bg-admin-100 text-admin-600"
                  title="Editar"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                </button>
                <button
                  onClick={() => handleDelete(cat)}
                  className="p-2 rounded-lg hover:bg-red-50 text-admin-400 hover:text-red-600"
                  title="Eliminar"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-white rounded-3xl w-full max-w-md shadow-2xl animate-scale-in border border-admin-100">
            <div className="px-6 py-4 border-b border-admin-100 flex items-center justify-between">
              <h2 className="text-lg font-black text-admin-900">
                {editing ? 'Editar categoría' : 'Nueva categoría'}
              </h2>
              <button onClick={closeModal} className="p-2 hover:bg-admin-100 rounded-full">
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-admin-600 uppercase tracking-wider">
                  Nombre *
                </label>
                <input
                  className="input-admin mt-1"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Ej: Frutas"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-admin-600 uppercase tracking-wider">
                  Icono
                </label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {ICON_PRESETS.map((ic) => (
                    <button
                      key={ic}
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, icon: ic }))}
                      className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center border-2 transition-all ${
                        form.icon === ic
                          ? 'border-primary-500 bg-primary-50 shadow-sm'
                          : 'border-admin-200 hover:border-admin-300'
                      }`}
                    >
                      {ic}
                    </button>
                  ))}
                </div>
                <input
                  className="input-admin mt-2"
                  value={form.icon}
                  onChange={(e) => setForm((p) => ({ ...p, icon: e.target.value }))}
                  placeholder="O pegá un emoji"
                  maxLength={8}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-admin-600 uppercase tracking-wider">
                  Descripción
                </label>
                <input
                  className="input-admin mt-1"
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Opcional · se muestra en la tienda"
                  maxLength={120}
                />
              </div>

              <div className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  id="cat-active"
                  checked={form.active}
                  onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))}
                  className="w-4 h-4 text-primary-600 rounded"
                />
                <label htmlFor="cat-active" className="text-sm font-semibold text-admin-700">
                  Visible en la tienda
                </label>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-xl">
                  {error}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={closeModal} className="btn-outline flex-1 text-sm py-2.5">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="btn-admin flex-1">
                  {saving ? 'Guardando…' : editing ? 'Guardar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
