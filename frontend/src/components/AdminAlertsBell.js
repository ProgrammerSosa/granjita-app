'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { fetchAdminAlerts, markAdminAlertsRead } from '@/lib/api';

/**
 * Campana de mensajes/alertas en el navbar admin (stock bajo / agotado).
 */
export default function AdminAlertsBell() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const ref = useRef(null);

  const load = useCallback(async () => {
    try {
      const d = await fetchAdminAlerts();
      setData(d);
    } catch {
      /* silencioso */
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 45_000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const low = data?.low || [];
  const out = data?.out || [];
  const events = data?.events || [];
  // badge: productos en problema + eventos no leídos
  const badge = (out.length || 0) + (low.length || 0);

  async function openPanel() {
    setOpen((v) => !v);
    if (!open) {
      await load();
      try {
        await markAdminAlertsRead();
        await load();
      } catch {
        /* ignore */
      }
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={openPanel}
        className="relative p-2.5 rounded-xl hover:bg-white/10 transition-colors"
        title="Mensajes y alertas de stock"
        aria-label="Mensajes"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {badge > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[1.15rem] h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center shadow-md animate-pulse">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[92vw] rounded-2xl bg-white text-admin-900 shadow-2xl border border-admin-200 z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-admin-100 bg-gradient-to-r from-primary-50 to-white flex items-center justify-between">
            <div>
              <p className="font-black text-sm">Mensajes / alertas</p>
              <p className="text-[11px] text-admin-500">Stock bajo y agotados</p>
            </div>
            <Link
              href="/admin/stock"
              onClick={() => setOpen(false)}
              className="text-xs font-bold text-primary-700 hover:underline"
            >
              Ir a Stock
            </Link>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {out.length === 0 && low.length === 0 && events.length === 0 ? (
              <p className="p-6 text-center text-sm text-admin-400">
                Sin alertas. Todo el stock está bien 🌿
              </p>
            ) : (
              <ul className="divide-y divide-admin-100">
                {out.map((p) => (
                  <li key={`out-${p.id}`} className="px-4 py-3 hover:bg-red-50/50">
                    <p className="text-xs font-black text-red-700">AGOTADO</p>
                    <p className="text-sm font-bold text-admin-900">{p.name}</p>
                    <p className="text-[11px] text-admin-500">0 unidades · no se vende en la web</p>
                  </li>
                ))}
                {low.map((p) => (
                  <li key={`low-${p.id}`} className="px-4 py-3 hover:bg-amber-50/50">
                    <p className="text-xs font-black text-amber-700">STOCK BAJO</p>
                    <p className="text-sm font-bold text-admin-900">{p.name}</p>
                    <p className="text-[11px] text-admin-500">
                      Quedan {p.stock} (aviso ≤ {p.lowStockThreshold})
                    </p>
                  </li>
                ))}
                {events.slice(0, 8).map((e) => (
                  <li key={e.id} className="px-4 py-2.5 bg-admin-50/50">
                    <p className="text-[11px] text-admin-600 leading-snug">{e.message}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
