'use client';

import { useEffect, useState } from 'react';
import {
  updateOrderItems,
  notifyOrderMissing,
  updateOrderStatus,
  fetchAdminProducts,
  formatMoney,
} from '@/lib/api';
import useToastStore from '@/store/useToastStore';

/** Estados donde el admin todavía puede editar los productos (antes de "En proceso") */
export const EDITABLE_STATUSES = ['pending', 'confirmed'];

const STATUS_FLOW = ['pending', 'confirmed', 'preparing', 'in_transit', 'delivered'];
const STATUS_LABELS = {
  pending: 'Nuevo',
  confirmed: 'Confirmado',
  preparing: 'En proceso',
  in_transit: 'En camino',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};

export function nextStatusOf(status) {
  const i = STATUS_FLOW.indexOf(status);
  return i >= 0 && i < STATUS_FLOW.length - 1 ? STATUS_FLOW[i + 1] : null;
}

let __editKeySeq = 1;

/** Editor de productos del pedido: agregar / quitar / cambiar cantidad */
function OrderItemsEditor({ order, onSaved, onCancel }) {
  const [catalog, setCatalog] = useState([]);
  const [loadingCat, setLoadingCat] = useState(true);
  const [items, setItems] = useState([]);
  const [pickerCat, setPickerCat] = useState('');
  const [pickerSearch, setPickerSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const toastSuccess = useToastStore((s) => s.success);
  const toastError = useToastStore((s) => s.error);

  useEffect(() => {
    setItems(
      (order.items || []).map((it) => ({
        key: __editKeySeq++,
        productId: String(it.product),
        productName: it.productName,
        variantName: it.variant?.name || null,
        unitType: it.unitType || 'unit',
        unitPrice: Number(it.unitPrice) || 0,
        quantity: Number(it.quantity) || 1,
        extras: (it.extras || []).map((e) => e.name),
      }))
    );
    let alive = true;
    fetchAdminProducts()
      .then((list) => {
        if (alive) setCatalog(list || []);
      })
      .catch(() => {})
      .finally(() => alive && setLoadingCat(false));
    return () => {
      alive = false;
    };
  }, [order._id]);

  const total = items.reduce((s, it) => s + it.unitPrice * it.quantity, 0);

  function stepFor(it) {
    return it.unitType === 'weight' ? 0.5 : 1;
  }

  function changeQty(key, delta) {
    setItems((prev) =>
      prev.map((it) => {
        if (it.key !== key) return it;
        const step = stepFor(it);
        const q = Math.max(step, Math.round((it.quantity + delta * step) * 100) / 100);
        return { ...it, quantity: q };
      })
    );
  }

  function removeItem(key) {
    setItems((prev) => prev.filter((it) => it.key !== key));
  }

  function priceFor(product, variantName) {
    const variants = product.variants || [];
    if (variants.length) {
      const v = variants.find((x) => x.name === variantName) || variants[0];
      return {
        unitPrice: Number(v.price) || 0,
        unitType: v.kind === 'weight' ? 'weight' : 'unit',
        variantName: v.name,
      };
    }
    return {
      unitPrice: Number(product.price) || 0,
      unitType: product.sellByWeight ? 'weight' : 'unit',
      variantName: null,
    };
  }

  function addProduct(product) {
    if (!product) return;
    const existing = items.find(
      (it) => it.productId === String(product._id) && !it.extras.length
    );
    const info = priceFor(product, null);
    if (existing && existing.variantName === info.variantName) {
      changeQty(existing.key, 1);
    } else {
      setItems((prev) => [
        ...prev,
        {
          key: __editKeySeq++,
          productId: String(product._id),
          productName: product.name,
          variantName: info.variantName,
          unitType: info.unitType,
          unitPrice: info.unitPrice,
          quantity: info.unitType === 'weight' ? 0.5 : 1,
          extras: [],
        },
      ]);
    }
  }

  function changeVariant(key, product, variantName) {
    const info = priceFor(product, variantName);
    setItems((prev) =>
      prev.map((it) =>
        it.key === key
          ? { ...it, variantName: info.variantName, unitPrice: info.unitPrice, unitType: info.unitType }
          : it
      )
    );
  }

  async function save() {
    if (items.length === 0) {
      toastError('El pedido debe quedar con al menos un producto');
      return;
    }
    try {
      setSaving(true);
      const payload = items.map((it) => ({
        productId: it.productId,
        variantName: it.variantName || undefined,
        quantity: it.quantity,
        unitType: it.unitType,
        extras: it.extras,
      }));
      const updated = await updateOrderItems(order._id, payload);
      toastSuccess('Pedido actualizado · se avisó al cliente');
      onSaved(updated);
    } catch (e) {
      toastError(e.message || 'No se pudo editar el pedido');
    } finally {
      setSaving(false);
    }
  }

  const availableCatalog = catalog.filter((p) => p.available !== false);
  const categories = [...new Set(availableCatalog.map((p) => p.category).filter(Boolean))].sort();
  const q = pickerSearch.trim().toLowerCase();
  const filteredCatalog = availableCatalog.filter((p) => {
    if (pickerCat && p.category !== pickerCat) return false;
    if (q && !p.name.toLowerCase().includes(q)) return false;
    return true;
  });

  return (
    <div className="rounded-2xl border-2 border-primary-300 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-black text-admin-900">✏️ Editar productos</h4>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs font-semibold text-admin-500 hover:text-admin-700"
        >
          Cancelar
        </button>
      </div>

      <div className="space-y-2">
        {items.map((it) => {
          const product = catalog.find((p) => String(p._id) === it.productId);
          const variants = product?.variants || [];
          const qtyLabel =
            it.unitType === 'weight' ? `${it.quantity.toFixed(1)} lb` : `${it.quantity}`;
          return (
            <div
              key={it.key}
              className="flex items-center gap-2 bg-admin-50 rounded-xl border border-admin-200 p-2.5"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-admin-900 truncate">{it.productName}</p>
                {variants.length > 1 ? (
                  <select
                    value={it.variantName || ''}
                    onChange={(e) => changeVariant(it.key, product, e.target.value)}
                    className="mt-1 text-xs border border-admin-200 rounded-lg px-1.5 py-0.5"
                  >
                    {variants.map((v) => (
                      <option key={v.name} value={v.name}>
                        {v.name} · {formatMoney(v.price)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-xs text-admin-500">{formatMoney(it.unitPrice)} c/u</p>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => changeQty(it.key, -1)}
                  className="w-7 h-7 rounded-lg bg-admin-100 text-admin-700 font-black hover:bg-admin-200"
                >
                  −
                </button>
                <span className="w-12 text-center text-sm font-bold text-admin-900">{qtyLabel}</span>
                <button
                  type="button"
                  onClick={() => changeQty(it.key, 1)}
                  className="w-7 h-7 rounded-lg bg-admin-100 text-admin-700 font-black hover:bg-admin-200"
                >
                  +
                </button>
              </div>
              <span className="w-16 text-right text-sm font-black text-admin-900">
                {formatMoney(it.unitPrice * it.quantity)}
              </span>
              <button
                type="button"
                onClick={() => removeItem(it.key)}
                className="w-7 h-7 rounded-lg bg-red-50 text-red-600 hover:bg-red-100"
                title="Quitar"
              >
                🗑
              </button>
            </div>
          );
        })}
        {items.length === 0 && (
          <p className="text-sm text-admin-500 text-center py-2">
            Sin productos. Agregá al menos uno.
          </p>
        )}
      </div>

      <div className="rounded-xl border border-admin-200 bg-admin-50 p-2.5 space-y-2">
        <p className="text-xs font-black text-admin-700">➕ Agregar producto</p>
        <div className="flex gap-2">
          <select
            value={pickerCat}
            onChange={(e) => setPickerCat(e.target.value)}
            disabled={loadingCat}
            className="flex-1 min-w-0 text-sm border border-admin-200 rounded-lg px-2 py-2 bg-white"
          >
            <option value="">📂 Todas las categorías</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={pickerSearch}
            onChange={(e) => setPickerSearch(e.target.value)}
            placeholder="🔍 Buscar…"
            className="flex-1 min-w-0 text-sm border border-admin-200 rounded-lg px-2.5 py-2 bg-white"
          />
        </div>
        <div className="max-h-48 overflow-y-auto space-y-1 pr-0.5">
          {loadingCat ? (
            <p className="text-xs text-admin-400 text-center py-3">Cargando catálogo…</p>
          ) : filteredCatalog.length === 0 ? (
            <p className="text-xs text-admin-400 text-center py-3">Sin resultados</p>
          ) : (
            filteredCatalog.map((p) => (
              <button
                key={p._id}
                type="button"
                onClick={() => addProduct(p)}
                className="w-full flex items-center justify-between gap-2 text-left px-2.5 py-2 rounded-lg bg-white border border-admin-200 hover:border-primary-400 hover:bg-primary-50 transition-colors"
              >
                <span className="text-sm font-semibold text-admin-900 truncate">{p.name}</span>
                <span className="flex items-center gap-1.5 whitespace-nowrap">
                  <span className="text-xs font-bold text-admin-600">
                    {formatMoney(p.variants?.length ? p.variants[0].price : p.price)}
                  </span>
                  <span className="w-5 h-5 rounded-md bg-ink-900 text-white text-xs font-black flex items-center justify-center">
                    +
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-primary-200 pt-3">
        <span className="text-sm font-bold text-admin-700">Nuevo total</span>
        <span className="text-lg font-black text-admin-900">{formatMoney(total)}</span>
      </div>

      <button
        type="button"
        onClick={save}
        disabled={saving || items.length === 0}
        className="w-full py-3 rounded-xl font-black text-sm bg-primary-500 text-ink-950 hover:bg-primary-400 disabled:opacity-50"
      >
        {saving ? 'Guardando…' : '💾 Guardar cambios y avisar al cliente'}
      </button>
    </div>
  );
}

/** Panel "avisar que falta algo": el proveedor marca qué no hay y avisa al cliente */
function MissingItemsPanel({ order, onSent, onClose }) {
  const [selected, setSelected] = useState([]);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const toastSuccess = useToastStore((s) => s.success);
  const toastError = useToastStore((s) => s.error);

  function labelFor(it) {
    const q = it.unitType === 'weight' ? `${Number(it.quantity).toFixed(1)} lb` : `${it.quantity}x`;
    return `${q} ${it.productName}${it.variant?.name ? ` (${it.variant.name})` : ''}`;
  }

  function toggle(label) {
    setSelected((p) => (p.includes(label) ? p.filter((x) => x !== label) : [...p, label]));
  }

  async function send() {
    if (selected.length === 0 && !note.trim()) {
      toastError('Marcá qué falta o escribí una nota');
      return;
    }
    try {
      setSending(true);
      await notifyOrderMissing(order._id, { items: selected, note: note.trim() });
      toastSuccess('Aviso enviado al cliente por WhatsApp');
      onSent();
    } catch (e) {
      toastError(e.message || 'No se pudo enviar el aviso');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 space-y-3">
      <p className="text-sm font-bold text-amber-900">¿Qué falta del pedido?</p>
      <div className="space-y-1.5">
        {order.items.map((it, i) => {
          const label = labelFor(it);
          return (
            <label key={i} className="flex items-center gap-2 text-sm text-admin-800 cursor-pointer">
              <input
                type="checkbox"
                checked={selected.includes(label)}
                onChange={() => toggle(label)}
                className="accent-amber-500 w-4 h-4"
              />
              {label}
            </label>
          );
        })}
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        placeholder="Nota opcional (ej: lo cambiamos por otra cosa, o llega en 20 min)"
        className="w-full text-sm border border-amber-200 rounded-lg p-2 bg-white"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={send}
          disabled={sending}
          className="flex-1 py-2.5 rounded-lg font-bold text-sm bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50"
        >
          {sending ? 'Enviando…' : '📲 Enviar aviso al cliente'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-2.5 rounded-lg text-sm font-semibold text-admin-500 hover:text-admin-700"
        >
          Cancelar
        </button>
      </div>
      <p className="text-[11px] text-amber-700">
        El cliente responde por WhatsApp qué hacer (quitar o cambiar) y el aviso te llega al chat del
        dueño. Después ajustás con “✏️ Modificar pedido”.
      </p>
    </div>
  );
}

/**
 * Bloque de acciones para un pedido ANTES de "En proceso":
 * Modificar productos · Avisar que falta algo · Seguir el proceso.
 * Se muestra solo en estados Nuevo/Confirmado. `onChanged` recarga la lista.
 */
export function OrderActions({ order, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [missing, setMissing] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const toastSuccess = useToastStore((s) => s.success);
  const toastError = useToastStore((s) => s.error);

  if (!EDITABLE_STATUSES.includes(order.orderStatus)) return null;

  const next = nextStatusOf(order.orderStatus);

  async function reload() {
    if (onChanged) await onChanged();
  }

  async function advance() {
    if (!next) return;
    try {
      setAdvancing(true);
      await updateOrderStatus(order._id, { orderStatus: next });
      toastSuccess(`Estado → ${STATUS_LABELS[next]}`);
      await reload();
    } catch (e) {
      toastError(e.message || 'No se pudo avanzar el estado');
    } finally {
      setAdvancing(false);
    }
  }

  return (
    <div className="rounded-2xl border-2 border-primary-300 bg-primary-50/40 p-4 space-y-3">
      <p className="text-xs font-black text-primary-700 uppercase tracking-wider">
        🔎 Revisá el pedido antes de mandar la factura
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => {
            setMissing(false);
            setEditing((v) => !v);
          }}
          className={`py-3 rounded-xl font-black text-sm border transition-colors ${
            editing
              ? 'bg-ink-900 text-white border-ink-900'
              : 'bg-white text-admin-800 border-admin-300 hover:bg-admin-50'
          }`}
        >
          ✏️ Modificar pedido
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setMissing((v) => !v);
          }}
          className={`py-3 rounded-xl font-black text-sm border transition-colors ${
            missing
              ? 'bg-amber-500 text-white border-amber-500'
              : 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200'
          }`}
        >
          ⚠️ Avisar que falta algo
        </button>
      </div>

      {editing && (
        <OrderItemsEditor
          order={order}
          onCancel={() => setEditing(false)}
          onSaved={async () => {
            setEditing(false);
            await reload();
          }}
        />
      )}

      {missing && (
        <MissingItemsPanel
          order={order}
          onClose={() => setMissing(false)}
          onSent={() => setMissing(false)}
        />
      )}

      <button
        type="button"
        onClick={advance}
        disabled={advancing}
        className="w-full py-3 rounded-xl font-black text-sm bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50"
      >
        ✅ Seguir el proceso → {STATUS_LABELS[next] || 'siguiente'}
      </button>
      <p className="text-[11px] text-admin-500 leading-relaxed">
        <strong>Modificar</strong>: agregás/quitás productos. ·{' '}
        <strong>Avisar que falta algo</strong>: le preguntás al cliente por WhatsApp. ·{' '}
        <strong>Seguir el proceso</strong>: al llegar a “En proceso” se manda la factura y ya no se
        puede editar.
      </p>
    </div>
  );
}
