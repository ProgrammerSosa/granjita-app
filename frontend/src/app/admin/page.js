'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  fetchAllOrders,
  fetchAdminStats,
  fetchStockOverview,
  updateOrderStatus,
  formatMoney,
} from '@/lib/api';
import { gtTodayStr, formatGtTime, formatMoneyQ } from '@/lib/dates';
import useToastStore from '@/store/useToastStore';
import { OrderActions, EDITABLE_STATUSES } from '@/components/OrderEditTools';

/** Flujo operativo del negocio (orden mental del admin) */
const FLOW = [
  {
    value: 'pending',
    label: 'Nuevo',
    short: 'Nuevo',
    hint: 'Recién entró',
    color: 'bg-amber-100 text-amber-900 border-amber-300',
    btn: 'bg-amber-500 hover:bg-amber-600 text-white',
  },
  {
    value: 'confirmed',
    label: 'Confirmado',
    short: 'OK',
    hint: 'Aceptado',
    color: 'bg-orange-100 text-orange-900 border-orange-300',
    btn: 'bg-orange-500 hover:bg-orange-600 text-white',
  },
  {
    value: 'preparing',
    label: 'En proceso',
    short: 'Proceso',
    hint: 'Preparando',
    color: 'bg-sky-100 text-sky-900 border-sky-300',
    btn: 'bg-sky-500 hover:bg-sky-600 text-white',
  },
  {
    value: 'in_transit',
    label: 'Listo / En camino',
    short: 'Listo',
    hint: 'Sale a entregar',
    color: 'bg-indigo-100 text-indigo-900 border-indigo-300',
    btn: 'bg-indigo-500 hover:bg-indigo-600 text-white',
  },
  {
    value: 'delivered',
    label: 'Entregado',
    short: 'Entregado',
    hint: 'Listo',
    color: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    btn: 'bg-emerald-500 hover:bg-emerald-600 text-white',
  },
  {
    value: 'cancelled',
    label: 'Cancelado',
    short: 'Cancelar',
    hint: 'No va',
    color: 'bg-red-100 text-red-800 border-red-300',
    btn: 'bg-red-500 hover:bg-red-600 text-white',
  },
];

const ACTIVE = new Set(['pending', 'confirmed', 'preparing', 'in_transit']);
const HOUR_MS = 60 * 60 * 1000;

function statusMeta(value) {
  return FLOW.find((s) => s.value === value) || FLOW[0];
}

function minutesAgo(iso) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'ahora';
  if (m === 1) return '1 min';
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h`;
}

export default function AdminHomePage() {
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState(null);
  const [stock, setStock] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [now, setNow] = useState(Date.now());
  const toast = useToastStore((s) => s.success);
  const toastError = useToastStore((s) => s.error);

  const load = useCallback(async () => {
    try {
      const day = gtTodayStr();
      const [ordRes, st, sk] = await Promise.all([
        fetchAllOrders({ date: day, limit: 100, page: 1 }),
        fetchAdminStats(day).catch(() => null),
        fetchStockOverview().catch(() => null),
      ]);
      setOrders(ordRes?.data || []);
      setStats(st);
      setStock(sk);
    } catch (err) {
      console.error(err);
      toastError(err.message || 'Error cargando dashboard');
    } finally {
      setLoading(false);
    }
  }, [toastError]);

  useEffect(() => {
    load();
    const poll = setInterval(load, 20_000);
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [load]);

  /** Pedidos de la última hora (usa `now` para refrescar cada 30s) */
  const lastHourOrders = useMemo(() => {
    void now;
    const cutoff = Date.now() - HOUR_MS;
    return (orders || [])
      .filter((o) => new Date(o.createdAt).getTime() >= cutoff)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)); // más viejo primero
  }, [orders, now]);

  /** Cola activa (sin entregados/cancelados) — el #1 es el que va primero */
  const queue = useMemo(
    () => lastHourOrders.filter((o) => ACTIVE.has(o.orderStatus)),
    [lastHourOrders]
  );

  const doneRecent = useMemo(
    () =>
      lastHourOrders.filter(
        (o) => o.orderStatus === 'delivered' || o.orderStatus === 'cancelled'
      ),
    [lastHourOrders]
  );

  const counts = useMemo(() => {
    const c = { pending: 0, confirmed: 0, preparing: 0, in_transit: 0 };
    queue.forEach((o) => {
      if (c[o.orderStatus] !== undefined) c[o.orderStatus] += 1;
    });
    return c;
  }, [queue]);

  async function setStatus(orderId, orderStatus) {
    setUpdatingId(orderId);
    try {
      await updateOrderStatus(orderId, { orderStatus });
      toast(
        orderStatus === 'cancelled'
          ? 'Pedido cancelado'
          : orderStatus === 'delivered'
            ? 'Marcado entregado'
            : `Estado → ${statusMeta(orderStatus).label}`
      );
      await load();
    } catch (err) {
      toastError(err.message || 'No se pudo actualizar');
    } finally {
      setUpdatingId(null);
    }
  }

  /** Siguiente estado lógico en el flujo */
  function nextSteps(current) {
    const order = ['pending', 'confirmed', 'preparing', 'in_transit', 'delivered'];
    const i = order.indexOf(current);
    if (i === -1 || current === 'cancelled' || current === 'delivered') return [];
    return order.slice(i + 1, i + 3); // próximos 1–2 pasos
  }

  if (loading && orders.length === 0) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-24 bg-admin-200 rounded-2xl" />
        <div className="h-40 bg-admin-200 rounded-2xl" />
        <div className="h-40 bg-admin-200 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-5xl">
      {/* 1. Cabecera clara */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-primary-600">
            Control en vivo
          </p>
          <h1 className="text-2xl font-black text-admin-900">Dashboard</h1>
          <p className="text-sm text-admin-500">
            Cola de la <strong>última hora</strong> · el de arriba es el más antiguo (va primero)
          </p>
        </div>
        <button type="button" onClick={load} className="btn-admin text-sm py-2.5">
          Actualizar
        </button>
      </div>

      {/* 2. Números principales (orden: atención → plata → stock) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card-admin p-4 border-2 border-amber-200 bg-amber-50/50">
          <p className="text-[10px] font-bold uppercase text-amber-700">En cola (1h)</p>
          <p className="text-3xl font-black text-amber-950">{queue.length}</p>
          <p className="text-[11px] text-amber-800/80 font-medium">
            {counts.pending} nuevos · {counts.preparing} en proceso
          </p>
        </div>
        <div className="card-admin p-4">
          <p className="text-[10px] font-bold uppercase text-admin-400">Ventas hoy</p>
          <p className="text-2xl font-black text-primary-600">
            {stats ? formatMoneyQ(stats.totalRevenue) : '—'}
          </p>
          <p className="text-[11px] text-admin-500">{stats?.totalOrders ?? 0} pedidos hoy</p>
        </div>
        <div className="card-admin p-4">
          <p className="text-[10px] font-bold uppercase text-admin-400">Stock bajo</p>
          <p className="text-2xl font-black text-amber-600">{stock?.counts?.low ?? 0}</p>
          <Link href="/admin/stock" className="text-[11px] font-bold text-primary-700">
            Ver stock →
          </Link>
        </div>
        <div className="card-admin p-4">
          <p className="text-[10px] font-bold uppercase text-admin-400">Agotados</p>
          <p className="text-2xl font-black text-red-600">{stock?.counts?.out ?? 0}</p>
          <Link href="/admin/stats" className="text-[11px] font-bold text-primary-700">
            Estadísticas →
          </Link>
        </div>
      </div>

      {/* 3. Pipeline visual */}
      <div className="card-admin p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-admin-400 mb-3">
          Flujo del pedido
        </p>
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs font-bold">
          {FLOW.filter((s) => s.value !== 'cancelled').map((s, i, arr) => (
            <div key={s.value} className="flex items-center gap-1.5 sm:gap-2">
              <span className={`px-2.5 py-1.5 rounded-xl border ${s.color}`}>
                {s.label}
                {counts[s.value] != null && counts[s.value] > 0 && (
                  <span className="ml-1 opacity-70">({counts[s.value]})</span>
                )}
              </span>
              {i < arr.length - 1 && <span className="text-admin-300">→</span>}
            </div>
          ))}
        </div>
        <div className="mt-3 grid gap-1.5 text-[11px] text-admin-500 leading-relaxed sm:grid-cols-2">
          <p><strong className="text-admin-800">🆕 Nuevo:</strong> entró el pedido, se le avisó al cliente.</p>
          <p><strong className="text-admin-800">✅ Confirmado:</strong> el proveedor revisa el stock (acá modificás o avisás si falta algo).</p>
          <p><strong className="text-admin-800">👨‍🍳 En proceso:</strong> se manda la factura; el pedido queda cerrado.</p>
          <p><strong className="text-admin-800">🛵 Listo / En camino:</strong> salió a ruta, se le avisó al cliente.</p>
          <p><strong className="text-admin-800">🎉 Entregado:</strong> llegó; saludo + invitación a pedir de nuevo.</p>
        </div>
        <p className="mt-2 text-[11px] text-primary-700 bg-primary-50 border border-primary-100 rounded-lg px-2.5 py-2">
          ✏️ Para <strong>modificar</strong> un pedido, usá el recuadro naranja en cada pedido de la
          cola (solo en <strong>Nuevo</strong> y <strong>Confirmado</strong>).
        </p>
      </div>

      {/* 4. COLA PRINCIPAL — lo más importante */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-black text-admin-900">Cola de pedidos</h2>
            <p className="text-xs text-admin-500">
              Orden: del más antiguo → al más reciente · tocá el estado para avanzar
            </p>
          </div>
          <span className="text-xs font-black bg-ink-900 text-white px-3 py-1.5 rounded-full">
            {queue.length} activos
          </span>
        </div>

        {queue.length === 0 ? (
          <div className="card-admin p-10 text-center">
            <p className="text-4xl mb-2">🌿</p>
            <p className="font-black text-admin-800">No hay pedidos activos en la última hora</p>
            <p className="text-sm text-admin-400 mt-1">
              Cuando entre uno, aparece acá primero el más viejo
            </p>
            <Link href="/admin/orders" className="btn-admin inline-flex mt-4 text-sm">
              Ver todos los pedidos
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {queue.map((order, index) => {
              const meta = statusMeta(order.orderStatus);
              const shortId = String(order._id).slice(-6).toUpperCase();
              const steps = nextSteps(order.orderStatus);
              const isFirst = index === 0;
              const busy = updatingId === order._id;

              return (
                <article
                  key={order._id}
                  className={`card-admin overflow-hidden border-2 transition-shadow ${
                    isFirst
                      ? 'border-primary-400 shadow-lift ring-2 ring-primary-200'
                      : 'border-admin-100'
                  }`}
                >
                  {isFirst && (
                    <div className="bg-gradient-to-r from-primary-600 to-primary-500 text-ink-950 text-xs font-black px-4 py-1.5 tracking-wide">
                      👉 SIGUIENTE · prepará este primero
                    </div>
                  )}
                  <div className="p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 ${
                            isFirst
                              ? 'bg-primary-500 text-ink-950'
                              : 'bg-admin-100 text-admin-600'
                          }`}
                        >
                          #{index + 1}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-black text-admin-900">
                              Pedido #{shortId}
                            </h3>
                            <span
                              className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${meta.color}`}
                            >
                              {meta.label}
                            </span>
                            <span className="text-[11px] font-semibold text-admin-400">
                              hace {minutesAgo(order.createdAt)} · {formatGtTime(order.createdAt)}
                            </span>
                          </div>
                          <p className="text-sm font-bold text-admin-800 mt-0.5">
                            {order.customer?.name || 'Cliente'}
                          </p>
                          <p className="text-xs text-admin-500 truncate max-w-md">
                            {order.customer?.zone ? `${order.customer.zone} · ` : ''}
                            {order.customer?.address}
                          </p>
                          <p className="text-xs text-admin-400 mt-0.5">
                            {order.paymentMethod === 'cash' ? '💵 Efectivo' : '💳 POS'}
                            {order.customer?.phone ? ` · ${order.customer.phone}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xl font-black text-primary-600">
                          {formatMoney(order.total)}
                        </p>
                        <p className="text-[11px] text-admin-400">
                          {(order.items || []).length} ítem(s)
                        </p>
                      </div>
                    </div>

                    {/* Ítems resumidos */}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {(order.items || []).slice(0, 6).map((it, i) => (
                        <span
                          key={i}
                          className="text-[11px] font-semibold bg-admin-50 border border-admin-100 px-2 py-1 rounded-lg text-admin-700"
                        >
                          {it.quantity}× {it.productName}
                        </span>
                      ))}
                      {(order.items || []).length > 6 && (
                        <span className="text-[11px] text-admin-400 font-medium px-2 py-1">
                          +{(order.items || []).length - 6} más
                        </span>
                      )}
                    </div>

                    {/* Modificar / avisar falta / seguir proceso (antes de "En proceso") */}
                    {EDITABLE_STATUSES.includes(order.orderStatus) && (
                      <div className="mt-4">
                        <OrderActions order={order} onChanged={load} />
                      </div>
                    )}

                    {/* Acciones de estado */}
                    <div className="mt-4 pt-3 border-t border-admin-100">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-admin-400 mb-2">
                        Cambiar estado
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {steps.map((st) => {
                          const m = statusMeta(st);
                          return (
                            <button
                              key={st}
                              type="button"
                              disabled={busy}
                              onClick={() => setStatus(order._id, st)}
                              className={`px-3 py-2 rounded-xl text-xs font-black transition-all disabled:opacity-50 ${m.btn}`}
                            >
                              → {m.short}
                            </button>
                          );
                        })}
                        {order.orderStatus !== 'cancelled' && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => setStatus(order._id, 'cancelled')}
                            className="px-3 py-2 rounded-xl text-xs font-black border-2 border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
                          >
                            Cancelar
                          </button>
                        )}
                        {busy && (
                          <span className="text-xs text-admin-400 self-center font-medium">
                            Guardando…
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* 5. Recientes cerrados (última hora) */}
      {doneRecent.length > 0 && (
        <section>
          <h2 className="text-sm font-black text-admin-700 mb-2">
            Cerrados en la última hora
          </h2>
          <div className="card-admin divide-y divide-admin-100">
            {doneRecent
              .slice()
              .reverse()
              .map((order) => {
                const meta = statusMeta(order.orderStatus);
                const shortId = String(order._id).slice(-6).toUpperCase();
                return (
                  <div
                    key={order._id}
                    className="px-4 py-3 flex flex-wrap items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-black text-admin-800">#{shortId}</span>
                      <span className="text-sm text-admin-600 truncate">
                        {order.customer?.name}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${meta.color}`}
                      >
                        {meta.label}
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-admin-500">
                      {formatMoney(order.total)} · {formatGtTime(order.createdAt)}
                    </div>
                  </div>
                );
              })}
          </div>
        </section>
      )}

      {/* 6. Atajos (secundarios, al final para no distraer) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { href: '/admin/orders', label: 'Todos los pedidos', icon: '🛵' },
          { href: '/admin/stats', label: 'Estadísticas', icon: '📊' },
          { href: '/admin/stock', label: 'Stock', icon: '📦' },
          { href: '/admin/whatsapp', label: 'WhatsApp', icon: '💬' },
        ].map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="card-admin p-3 text-center hover:border-primary-300 hover:shadow-sm transition-all"
          >
            <span className="text-xl">{l.icon}</span>
            <p className="text-xs font-bold text-admin-800 mt-1">{l.label}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
