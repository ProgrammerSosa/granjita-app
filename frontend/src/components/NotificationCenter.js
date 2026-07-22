'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  fetchAdminAlerts,
  markAdminAlertsRead,
  fetchAllOrders,
  fetchRecentRatings,
  formatMoney,
} from '@/lib/api';

const ORDERS_SEEN_KEY = 'granjita_nc_orders_seen';   // timestamp ms
const RATINGS_SEEN_KEY = 'granjita_nc_ratings_seen'; // timestamp ms
const ALERTS_SEEN_KEY = 'granjita_nc_alerts_seen';   // JSON: ids de stock vistos
const POLL_MS = 30_000;

const TABS = [
  { key: 'notif', label: 'Notificación', icon: '🛎️' },
  { key: 'msg', label: 'Mensaje', icon: '💬' },
  { key: 'alert', label: 'Alertas', icon: '⚠️' },
];

function timeAgo(iso) {
  try {
    const d = new Date(iso).getTime();
    const s = Math.floor((Date.now() - d) / 1000);
    if (s < 60) return 'hace un momento';
    if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
    if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
    return new Date(iso).toLocaleDateString('es-GT');
  } catch {
    return '';
  }
}

function StarRow({ stars }) {
  return (
    <span className="text-sm leading-none">
      <span className="text-primary-500">{'★'.repeat(stars)}</span>
      <span className="text-admin-300">{'★'.repeat(Math.max(0, 5 - stars))}</span>
    </span>
  );
}

export default function NotificationCenter() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('notif');
  const [alerts, setAlerts] = useState({ low: [], out: [], events: [] });
  const [orders, setOrders] = useState([]);
  const [ratings, setRatings] = useState([]);
  const [ratingAvg, setRatingAvg] = useState(0);
  const [ratingCount, setRatingCount] = useState(0);
  const [ordersSeen, setOrdersSeen] = useState(0);
  const [ratingsSeen, setRatingsSeen] = useState(0);
  const [alertsSeen, setAlertsSeen] = useState(() => new Set());
  const ref = useRef(null);

  useEffect(() => {
    try {
      const os = localStorage.getItem(ORDERS_SEEN_KEY);
      setOrdersSeen(os ? Number(os) : Date.now());
      const rs = localStorage.getItem(RATINGS_SEEN_KEY);
      setRatingsSeen(rs ? Number(rs) : Date.now());
      const as = localStorage.getItem(ALERTS_SEEN_KEY);
      if (as) setAlertsSeen(new Set(JSON.parse(as)));
    } catch {
      /* ignore */
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const [a, o, r] = await Promise.all([
        fetchAdminAlerts(),
        fetchAllOrders({ limit: 12 }),
        fetchRecentRatings(20).catch(() => null),
      ]);
      setAlerts(a || { low: [], out: [], events: [] });
      setOrders(o?.data || []);
      if (r) {
        setRatings(r.data || []);
        setRatingAvg(r.average || 0);
        setRatingCount(r.count || 0);
      }
    } catch {
      /* silencioso */
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const low = alerts.low || [];
  const out = alerts.out || [];
  const events = alerts.events || [];
  const stockItems = [...out, ...low];

  const unreadNotif = orders.filter(
    (o) => new Date(o.createdAt).getTime() > ordersSeen
  ).length;
  const unreadMsg = ratings.filter(
    (r) => r.at && new Date(r.at).getTime() > ratingsSeen
  ).length;
  const unreadAlert =
    stockItems.filter((p) => !alertsSeen.has(String(p.id))).length +
    events.filter((e) => !e.read).length;
  const totalUnread = unreadNotif + unreadMsg + unreadAlert;

  const markSeen = useCallback(
    async (which) => {
      if (which === 'notif') {
        const ts = Date.now();
        setOrdersSeen(ts);
        try {
          localStorage.setItem(ORDERS_SEEN_KEY, String(ts));
        } catch {
          /* ignore */
        }
      } else if (which === 'msg') {
        const ts = Date.now();
        setRatingsSeen(ts);
        try {
          localStorage.setItem(RATINGS_SEEN_KEY, String(ts));
        } catch {
          /* ignore */
        }
      } else if (which === 'alert') {
        setAlertsSeen((prev) => {
          const next = new Set(prev);
          stockItems.forEach((p) => next.add(String(p.id)));
          try {
            localStorage.setItem(ALERTS_SEEN_KEY, JSON.stringify([...next]));
          } catch {
            /* ignore */
          }
          return next;
        });
        try {
          await markAdminAlertsRead();
          await load();
        } catch {
          /* ignore */
        }
      }
    },
    [stockItems, load]
  );

  function openPanel() {
    const next = !open;
    setOpen(next);
    if (next) markSeen(tab);
  }

  function switchTab(k) {
    setTab(k);
    markSeen(k);
  }

  function go(href) {
    setOpen(false);
    router.push(href);
  }

  const countFor = (k) =>
    k === 'notif' ? unreadNotif : k === 'msg' ? unreadMsg : unreadAlert;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={openPanel}
        className="relative p-2.5 rounded-xl hover:bg-white/10 transition-colors"
        title="Notificaciones, mensajes y alertas"
        aria-label="Notificaciones"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {totalUnread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[1.15rem] h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center shadow-md animate-pulse">
            {totalUnread > 99 ? '99+' : totalUnread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[92vw] rounded-2xl bg-white text-admin-900 shadow-2xl border border-admin-200 z-50 overflow-hidden">
          <div className="flex border-b border-admin-100 bg-admin-50">
            {TABS.map((t) => {
              const c = countFor(t.key);
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => switchTab(t.key)}
                  className={`flex-1 px-2 py-2.5 text-[11px] font-bold flex items-center justify-center gap-1 border-b-2 transition-colors ${
                    active
                      ? 'border-primary-500 text-primary-700 bg-white'
                      : 'border-transparent text-admin-500 hover:text-admin-700'
                  }`}
                >
                  <span aria-hidden="true">{t.icon}</span>
                  <span className="hidden sm:inline">{t.label}</span>
                  {c > 0 && (
                    <span className="min-w-[1.05rem] h-[1.05rem] px-1 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center">
                      {c > 9 ? '9+' : c}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {/* NOTIFICACIÓN — pedidos nuevos */}
            {tab === 'notif' &&
              (orders.length === 0 ? (
                <Empty text="Sin pedidos por ahora 🌿" />
              ) : (
                <ul className="divide-y divide-admin-100">
                  {orders.map((o) => {
                    const isNew = new Date(o.createdAt).getTime() > ordersSeen;
                    return (
                      <li key={o._id}>
                        <button
                          type="button"
                          onClick={() => go('/admin/orders')}
                          className={`w-full text-left px-4 py-3 hover:bg-primary-50/40 ${
                            isNew ? 'bg-primary-50/60' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-black text-admin-900">
                              {isNew && (
                                <span className="inline-block w-2 h-2 rounded-full bg-primary-500 mr-1.5 align-middle" />
                              )}
                              #{String(o._id).slice(-6).toUpperCase()} · {o.customer?.name}
                            </p>
                            <span className="text-sm font-black text-primary-600">
                              {formatMoney(o.total)}
                            </span>
                          </div>
                          <p className="text-[11px] text-admin-500 mt-0.5">
                            {o.customer?.zone ? `${o.customer.zone} · ` : ''}
                            {timeAgo(o.createdAt)}
                          </p>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ))}

            {/* MENSAJE — calificaciones de clientes */}
            {tab === 'msg' && (
              <>
                {ratingCount > 0 && (
                  <div className="px-4 py-2.5 bg-primary-50/60 border-b border-primary-100 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-primary-700 uppercase tracking-wide">
                      Promedio de la tienda
                    </span>
                    <span className="flex items-center gap-1.5">
                      <StarRow stars={Math.round(ratingAvg)} />
                      <span className="text-xs font-black text-primary-700">
                        {ratingAvg} · {ratingCount}
                      </span>
                    </span>
                  </div>
                )}
                {ratings.length === 0 ? (
                  <Empty text="Todavía no hay calificaciones ⭐" />
                ) : (
                  <ul className="divide-y divide-admin-100">
                    {ratings.map((r) => {
                      const isNew = r.at && new Date(r.at).getTime() > ratingsSeen;
                      return (
                        <li
                          key={r.id}
                          className={`px-4 py-3 ${isNew ? 'bg-primary-50/60' : ''}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-bold text-admin-900">
                              {isNew && (
                                <span className="inline-block w-2 h-2 rounded-full bg-primary-500 mr-1.5 align-middle" />
                              )}
                              {r.customerName || 'Cliente'}
                            </p>
                            <StarRow stars={r.stars} />
                          </div>
                          {r.comment && (
                            <p className="text-[13px] text-admin-700 italic mt-1 leading-snug">
                              “{r.comment}”
                            </p>
                          )}
                          <p className="text-[10px] text-admin-400 mt-1">
                            #{r.code}
                            {r.at ? ` · ${timeAgo(r.at)}` : ''}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </>
            )}

            {/* ALERTAS — stock + eventos del sistema */}
            {tab === 'alert' &&
              (stockItems.length === 0 && events.length === 0 ? (
                <Empty text="Todo el stock está bien 🌿" />
              ) : (
                <ul className="divide-y divide-admin-100">
                  {out.map((p) => (
                    <li key={`out-${p.id}`}>
                      <button
                        type="button"
                        onClick={() => go('/admin/stock')}
                        className="w-full text-left px-4 py-3 hover:bg-red-50/50"
                      >
                        <p className="text-xs font-black text-red-700">AGOTADO</p>
                        <p className="text-sm font-bold text-admin-900">{p.name}</p>
                        <p className="text-[11px] text-admin-500">0 unidades · no se vende en la web</p>
                      </button>
                    </li>
                  ))}
                  {low.map((p) => (
                    <li key={`low-${p.id}`}>
                      <button
                        type="button"
                        onClick={() => go('/admin/stock')}
                        className="w-full text-left px-4 py-3 hover:bg-amber-50/50"
                      >
                        <p className="text-xs font-black text-amber-700">STOCK BAJO</p>
                        <p className="text-sm font-bold text-admin-900">{p.name}</p>
                        <p className="text-[11px] text-admin-500">
                          Quedan {p.stock} (aviso ≤ {p.lowStockThreshold})
                        </p>
                      </button>
                    </li>
                  ))}
                  {events.slice(0, 10).map((e) => (
                    <li key={e.id} className="px-4 py-2.5 bg-admin-50/50">
                      <p className="text-[11px] text-admin-600 leading-snug">{e.message}</p>
                      {e.at && <p className="text-[10px] text-admin-400 mt-0.5">{timeAgo(e.at)}</p>}
                    </li>
                  ))}
                </ul>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Empty({ text }) {
  return <p className="p-6 text-center text-sm text-admin-400">{text}</p>;
}
