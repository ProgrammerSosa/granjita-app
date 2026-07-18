'use client';

import { useEffect, useState } from 'react';
import { fetchStoreStatus } from '@/lib/api';
import BrandLogo from './BrandLogo';

const SESSION_KEY = 'granjita_closed_greeting_shown';

/**
 * Si la tienda está cerrada, saluda al cliente con un mensaje amable
 * (una vez por sesión del navegador).
 */
export default function ClosedWelcome() {
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    let alive = true;
    async function check() {
      try {
        if (typeof window !== 'undefined') {
          if (sessionStorage.getItem(SESSION_KEY) === '1') return;
        }
        const data = await fetchStoreStatus();
        if (!alive || !data || data.open) return;
        setStatus(data);
        setVisible(true);
      } catch {
        /* ignore */
      }
    }
    // pequeño delay para no chocar con el primer paint
    const t = setTimeout(check, 400);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, []);

  function dismiss() {
    try {
      sessionStorage.setItem(SESSION_KEY, '1');
    } catch {
      /* ignore */
    }
    setVisible(false);
  }

  if (!visible || !status) return null;

  const greeting =
    status.closedGreeting ||
    `${status.message || 'Ahora mismo no estamos tomando pedidos.'} ¡Que tengas un muy buen día! 🌿`;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-ink-950/55 backdrop-blur-sm"
        onClick={dismiss}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden animate-slide-up border border-ink-100">
        <div className="relative h-28 bg-hero-mesh">
          <div className="absolute inset-0 flex items-center justify-center">
            <BrandLogo size={72} rounded="rounded-[1.25rem]" />
          </div>
        </div>
        <div className="p-6 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary-600 mb-1">
            La Granjita
          </p>
          <h2 className="text-xl font-black text-ink-900">Ahora estamos cerrados</h2>
          <p className="text-sm text-ink-600 mt-3 leading-relaxed">{greeting}</p>
          {status.hoursLabel && (
            <p className="mt-3 text-xs font-semibold text-ink-500 bg-cream-100 rounded-xl px-3 py-2">
              Horario: {status.hoursLabel}
              <br />
              {status.workDaysLabel}
            </p>
          )}
          <button type="button" onClick={dismiss} className="btn-primary w-full mt-5 py-3">
            Entendido · ¡buen día!
          </button>
          <p className="text-[11px] text-ink-400 mt-3">
            Podés mirar el catálogo igual; los pedidos se habilitan al abrir.
          </p>
        </div>
      </div>
    </div>
  );
}
