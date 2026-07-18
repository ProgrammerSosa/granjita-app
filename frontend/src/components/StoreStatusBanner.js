'use client';

import { useEffect, useState } from 'react';
import { fetchStoreStatus, formatMoney } from '@/lib/api';

export default function StoreStatusBanner({ compact = false }) {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const data = await fetchStoreStatus();
        if (alive) setStatus(data);
      } catch {
        /* silencioso: no bloquear la tienda si falla el status */
      }
    }
    load();
    const t = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  if (!status) return null;

  const open = status.open;

  if (compact) {
    return (
      <div
        className={`rounded-xl px-3 py-2 text-xs font-semibold border ${
          open
            ? 'bg-forest-50 border-forest-200 text-forest-800'
            : 'bg-amber-50 border-amber-200 text-amber-900'
        }`}
      >
        <span className="mr-1">{open ? '🟢' : '🔴'}</span>
        {status.message}
        {status.minOrder != null && (
          <span className="opacity-80"> · Mín. {formatMoney(status.minOrder)}</span>
        )}
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl p-4 border mb-5 ${
        open
          ? 'bg-gradient-to-br from-forest-50 to-white border-forest-200'
          : 'bg-gradient-to-br from-amber-50 to-white border-amber-200'
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${
            open ? 'bg-forest-100' : 'bg-amber-100'
          }`}
        >
          {open ? '✅' : '⏸️'}
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-black ${open ? 'text-forest-800' : 'text-amber-950'}`}>
            {open ? 'Aceptamos pedidos ahora' : 'No aceptamos pedidos ahora'}
          </p>
          <p className={`text-xs mt-0.5 leading-relaxed ${open ? 'text-forest-700' : 'text-amber-900/80'}`}>
            {!open && status.closedGreeting
              ? status.closedGreeting
              : `${status.message}${!open && status.nextOpenHint ? ` ${status.nextOpenHint}.` : ''}`}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wide bg-white/80 border border-ink-100 text-ink-600 px-2 py-0.5 rounded-full">
              {status.hoursLabel || '10:30 am – 3:00 pm · 4:00 pm – 8:00 pm'}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wide bg-white/80 border border-ink-100 text-ink-600 px-2 py-0.5 rounded-full">
              {status.workDaysLabel || 'Lunes a sábado'}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wide bg-white/80 border border-primary-100 text-primary-700 px-2 py-0.5 rounded-full">
              Mín. {formatMoney(status.minOrder ?? 15)}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wide bg-white/80 border border-forest-100 text-forest-700 px-2 py-0.5 rounded-full">
              Solo residenciales · San José Pinula
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Hook reutilizable para cart/checkout */
export function useStoreStatus() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const data = await fetchStoreStatus();
        if (alive) setStatus(data);
      } catch {
        if (alive) setStatus(null);
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    const t = setInterval(load, 45_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  return { status, loading };
}
