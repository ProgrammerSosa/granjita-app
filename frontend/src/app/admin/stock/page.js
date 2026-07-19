'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { adjustProductStock, fetchStockOverview, getImageUrl } from '@/lib/api';
import useToastStore from '@/store/useToastStore';

const STATUS_META = {
  out: { label: 'Agotado', cls: 'bg-red-100 text-red-800 border-red-200' },
  low: { label: 'Stock bajo', cls: 'bg-amber-100 text-amber-900 border-amber-200' },
  ok: { label: 'OK', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
};

export default function AdminStockPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [drafts, setDrafts] = useState({});
  const toast = useToastStore((s) => s.success);
  const toastError = useToastStore((s) => s.error);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const d = await fetchStockOverview();
      setData(d);
      const next = {};
      (d.products || []).forEach((p) => {
        next[p.id] = String(p.stock);
      });
      setDrafts(next);
    } catch (err) {
      toastError(err.message || 'Error cargando stock');
    } finally {
      setLoading(false);
    }
  }, [toastError]);

  useEffect(() => {
    load();
  }, [load]);

  const list = useMemo(() => {
    let items = data?.products || [];
    if (filter === 'out') items = items.filter((p) => p.status === 'out');
    if (filter === 'low') items = items.filter((p) => p.status === 'low');
    if (filter === 'ok') items = items.filter((p) => p.status === 'ok');
    const q = search.trim().toLowerCase();
    if (q) {
      items = items.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.category || '').toLowerCase().includes(q)
      );
    }
    return items;
  }, [data, filter, search]);

  async function saveStock(p) {
    const n = Math.max(0, parseInt(drafts[p.id], 10));
    if (Number.isNaN(n)) {
      toastError('Número inválido');
      return;
    }
    setBusyId(p.id);
    try {
      const res = await adjustProductStock(p.id, { stock: n });
      setData(res.overview);
      toast(
        n === 0
          ? `${p.name}: agotado (oculto como no disponible)`
          : `${p.name}: stock ${n}`
      );
    } catch (err) {
      toastError(err.message || 'Error al guardar');
    } finally {
      setBusyId(null);
    }
  }

  async function quickAdd(p, delta) {
    const current = Number(drafts[p.id] ?? p.stock) || 0;
    const next = Math.max(0, current + delta);
    setDrafts((d) => ({ ...d, [p.id]: String(next) }));
    setBusyId(p.id);
    try {
      const res = await adjustProductStock(p.id, { stock: next });
      setData(res.overview);
      toast(`${p.name}: ${next} u.`);
    } catch (err) {
      toastError(err.message || 'Error');
    } finally {
      setBusyId(null);
    }
  }

  if (loading && !data) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-10 bg-admin-200 rounded-xl w-48" />
        <div className="h-40 bg-admin-200 rounded-2xl" />
      </div>
    );
  }

  const c = data?.counts || {};

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-black text-admin-900">Stock / Inventario</h1>
        <p className="text-sm text-admin-500 mt-0.5">
          Cuando un producto llega a 0 se marca <strong>Agotado</strong> en la tienda. Entre 1 y el
          umbral (por defecto 5) llega alerta por WhatsApp y a la campana 🔔.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`card-admin p-4 text-left border-2 ${filter === 'all' ? 'border-primary-400' : 'border-transparent'}`}
        >
          <p className="text-[10px] font-bold uppercase text-admin-400">Total</p>
          <p className="text-2xl font-black">{c.total ?? 0}</p>
        </button>
        <button
          type="button"
          onClick={() => setFilter('ok')}
          className={`card-admin p-4 text-left border-2 ${filter === 'ok' ? 'border-emerald-400' : 'border-transparent'}`}
        >
          <p className="text-[10px] font-bold uppercase text-emerald-600">OK</p>
          <p className="text-2xl font-black text-emerald-700">{c.ok ?? 0}</p>
        </button>
        <button
          type="button"
          onClick={() => setFilter('low')}
          className={`card-admin p-4 text-left border-2 ${filter === 'low' ? 'border-amber-400' : 'border-transparent'}`}
        >
          <p className="text-[10px] font-bold uppercase text-amber-600">Bajo</p>
          <p className="text-2xl font-black text-amber-700">{c.low ?? 0}</p>
        </button>
        <button
          type="button"
          onClick={() => setFilter('out')}
          className={`card-admin p-4 text-left border-2 ${filter === 'out' ? 'border-red-400' : 'border-transparent'}`}
        >
          <p className="text-[10px] font-bold uppercase text-red-600">Agotado</p>
          <p className="text-2xl font-black text-red-700">{c.out ?? 0}</p>
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar producto…"
          className="input-admin flex-1 min-w-[180px]"
        />
        <button type="button" onClick={load} className="btn-admin text-sm">
          Actualizar
        </button>
      </div>

      <div className="card-admin overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-admin-50 text-left text-xs font-bold uppercase text-admin-500">
                <th className="px-4 py-3">Producto</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3">Umbral</th>
                <th className="px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-admin-400">
                    No hay productos en este filtro
                  </td>
                </tr>
              ) : (
                list.map((p) => {
                  const meta = STATUS_META[p.status] || STATUS_META.ok;
                  return (
                    <tr key={p.id} className="border-t border-admin-100 hover:bg-primary-50/20">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-admin-100 overflow-hidden shrink-0">
                            {p.image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={getImageUrl(p.image)}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-lg">
                                📦
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-admin-900 truncate">{p.name}</p>
                            <p className="text-xs text-admin-400">{p.category}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold border ${meta.cls}`}
                        >
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min="0"
                          value={drafts[p.id] ?? p.stock}
                          onChange={(e) =>
                            setDrafts((d) => ({ ...d, [p.id]: e.target.value }))
                          }
                          className="input-admin w-20 py-1.5 text-center font-black"
                          disabled={busyId === p.id}
                        />
                      </td>
                      <td className="px-4 py-3 text-admin-600 font-semibold">
                        ≤ {p.lowStockThreshold}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            disabled={busyId === p.id}
                            onClick={() => quickAdd(p, -1)}
                            className="px-2.5 py-1.5 rounded-lg border border-admin-200 text-xs font-bold hover:bg-admin-50"
                          >
                            −1
                          </button>
                          <button
                            type="button"
                            disabled={busyId === p.id}
                            onClick={() => quickAdd(p, 5)}
                            className="px-2.5 py-1.5 rounded-lg border border-admin-200 text-xs font-bold hover:bg-admin-50"
                          >
                            +5
                          </button>
                          <button
                            type="button"
                            disabled={busyId === p.id}
                            onClick={() => saveStock(p)}
                            className="btn-admin text-xs py-1.5 px-3"
                          >
                            Guardar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card-admin p-5 text-sm text-admin-600 space-y-1.5">
        <p className="font-black text-admin-900">Cómo funcionan las alertas</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            Stock <strong>0</strong> → se marca agotado en la web y aviso WhatsApp al dueño.
          </li>
          <li>
            Stock entre <strong>1 y el umbral</strong> (default 5) → aviso “stock bajo” por WA +
            campana.
          </li>
          <li>Cada venta descuenta stock automáticamente.</li>
          <li>Podés cambiar el umbral al editar el producto en Productos.</li>
        </ul>
      </div>
    </div>
  );
}
