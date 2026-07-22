'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchAllOrders, formatMoney } from '@/lib/api';
import useToastStore from '@/store/useToastStore';

const PREF_KEY = 'granjita_order_sound';       // '1' | '0'
const SEEN_KEY = 'granjita_order_lastseen';     // timestamp (ms) del pedido más nuevo visto
const POLL_MS = 20_000;

/**
 * Vigila pedidos nuevos mientras el panel admin está abierto y avisa con:
 *  - sonido "ding-dong" (Web Audio, sin archivo)
 *  - notificación del navegador
 *  - toast dentro de la app
 * No usa WhatsApp. Solo funciona con el panel abierto en una pestaña.
 */
export default function NewOrderNotifier() {
  const [enabled, setEnabled] = useState(true);
  const [perm, setPerm] = useState('default');
  const lastSeenRef = useRef(null);
  const initRef = useRef(false);
  const audioRef = useRef(null);
  const enabledRef = useRef(true);
  const toastSuccess = useToastStore((s) => s.success);

  // mantener ref sincronizada para usarla dentro del intervalo
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  // preferencia guardada + permiso actual
  useEffect(() => {
    try {
      const saved = localStorage.getItem(PREF_KEY);
      if (saved === '0') setEnabled(false);
      const seen = localStorage.getItem(SEEN_KEY);
      if (seen) {
        lastSeenRef.current = Number(seen);
        initRef.current = true;
      }
    } catch {
      /* ignore */
    }
    if (typeof Notification !== 'undefined') setPerm(Notification.permission);
  }, []);

  const chime = useCallback(() => {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!audioRef.current) audioRef.current = new Ctx();
      const ctx = audioRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      // dos notas: ding (alto) → dong (bajo)
      const now = ctx.currentTime;
      [[880, 0], [660, 0.18]].forEach(([freq, at]) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, now + at);
        gain.gain.exponentialRampToValueAtTime(0.35, now + at + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.35);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + at);
        osc.stop(now + at + 0.4);
      });
    } catch {
      /* ignore */
    }
  }, []);

  const showBrowserNotif = useCallback((order) => {
    try {
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
      const idShort = String(order._id).slice(-6).toUpperCase();
      const n = new Notification('🛎️ Nuevo pedido', {
        body: `#${idShort} · ${order.customer?.name || 'Cliente'} · ${formatMoney(order.total)}`,
        tag: 'granjita-order-' + order._id,
        icon: '/la-granjita.png',
        badge: '/la-granjita.png',
      });
      n.onclick = () => {
        window.focus();
        window.location.href = '/admin/orders';
      };
    } catch {
      /* ignore */
    }
  }, []);

  const speak = useCallback((text) => {
    try {
      const synth = window.speechSynthesis;
      if (!synth || !text) return;
      synth.cancel(); // corta cualquier lectura previa
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'es-GT';
      u.rate = 0.98;
      u.pitch = 1;
      const voices = synth.getVoices() || [];
      const es =
        voices.find((v) => /es[-_]?(GT|MX|419|US|ES)/i.test(v.lang)) ||
        voices.find((v) => /^es/i.test(v.lang));
      if (es) u.voice = es;
      synth.speak(u);
    } catch {
      /* ignore */
    }
  }, []);

  const buildSpeech = useCallback((order) => {
    const c = order.customer || {};
    const parts = [];
    const name = (c.name || '').trim();
    parts.push(`Hay un nuevo pedido${name ? ' de ' + name : ''}`);
    const zone = (c.zone || '').trim();
    if (zone) parts.push(`residencial ${zone}`);
    const address = (c.address || '').trim();
    if (address) parts.push(address);
    const notes = (c.notes || '').trim();
    if (notes) parts.push(`referencia: ${notes}`);
    return parts.join('. ') + '.';
  }, []);

  const notify = useCallback(
    (order) => {
      chime();
      showBrowserNotif(order);
      const idShort = String(order._id).slice(-6).toUpperCase();
      toastSuccess(
        `🛎️ Nuevo pedido #${idShort} · ${order.customer?.name || 'Cliente'} · ${formatMoney(order.total)}`
      );
      // la voz habla después del ding-dong para que no se pisen
      setTimeout(() => speak(buildSpeech(order)), 500);
    },
    [chime, showBrowserNotif, toastSuccess, speak, buildSpeech]
  );

  const check = useCallback(async () => {
    try {
      const res = await fetchAllOrders({ limit: 1 });
      const newest = res?.data?.[0];
      if (!newest) return;
      const ts = new Date(newest.createdAt).getTime();
      if (!initRef.current) {
        lastSeenRef.current = ts;
        initRef.current = true;
        try {
          localStorage.setItem(SEEN_KEY, String(ts));
        } catch {
          /* ignore */
        }
        return;
      }
      if (ts > (lastSeenRef.current || 0)) {
        lastSeenRef.current = ts;
        try {
          localStorage.setItem(SEEN_KEY, String(ts));
        } catch {
          /* ignore */
        }
        if (enabledRef.current) notify(newest);
      }
    } catch {
      /* silencioso (sesión/red) */
    }
  }, [notify]);

  useEffect(() => {
    check();
    const t = setInterval(check, POLL_MS);
    return () => clearInterval(t);
  }, [check]);

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    try {
      localStorage.setItem(PREF_KEY, next ? '1' : '0');
    } catch {
      /* ignore */
    }
    if (next) {
      // desbloquear audio + voz + pedir permiso (requiere gesto del usuario)
      chime();
      speak('Avisos de pedidos activados.');
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        Notification.requestPermission().then((p) => setPerm(p)).catch(() => {});
      }
    } else {
      try {
        window.speechSynthesis?.cancel();
      } catch {
        /* ignore */
      }
    }
  }

  const title = enabled
    ? perm === 'granted'
      ? 'Avisos de pedidos: activados (sonido + notificación)'
      : 'Sonido activado · tocá para permitir notificaciones del navegador'
    : 'Avisos de pedidos: silenciados';

  return (
    <button
      type="button"
      onClick={toggle}
      className="relative p-2.5 rounded-xl hover:bg-white/10 transition-colors text-lg leading-none"
      title={title}
      aria-label={title}
    >
      <span aria-hidden="true">{enabled ? '🔔' : '🔕'}</span>
      {enabled && perm !== 'granted' && (
        <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-400 border border-ink-900" />
      )}
    </button>
  );
}
