'use client';

import Link from 'next/link';
import BrandLogo from './BrandLogo';

const WHATSAPP =
  process.env.NEXT_PUBLIC_WHATSAPP || process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '';

const REASONS = [
  { icon: '🥚', text: 'Todo fresco, del día — nada de bodega' },
  { icon: '🛵', text: 'Te lo llevamos hasta la puerta' },
  { icon: '🤝', text: 'Pagás cuando lo tenés en la mano' },
];

const FACTS = [
  { icon: '📍', label: 'Dónde', value: 'Residenciales de San José Pinula' },
  { icon: '💳', label: 'Pagos', value: 'Efectivo o tarjeta (POS) al recibir' },
  { icon: '🧾', label: 'Factura', value: 'Te la mandamos por WhatsApp' },
];

export default function Footer() {
  const waLink = WHATSAPP ? `https://wa.me/${WHATSAPP.replace(/\D/g, '')}` : null;
  const year = new Date().getFullYear();

  return (
    <footer className="mt-10 relative overflow-hidden bg-ink-950 text-white">
      <div
        className="absolute inset-0 opacity-90 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 70% 60% at 12% 0%, rgba(249,115,22,0.30), transparent 60%), radial-gradient(ellipse 50% 50% at 100% 100%, rgba(249,115,22,0.14), transparent 55%)',
        }}
      />
      <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary-600 via-primary-400 to-primary-600" />

      <div className="relative max-w-lg mx-auto px-5 py-10">
        <div className="flex items-center gap-3 mb-5">
          <BrandLogo size={52} rounded="rounded-2xl" className="ring-2 ring-white/15" />
          <div>
            <p className="font-extrabold tracking-tight text-xl leading-none">La Granjita</p>
            <p className="text-[11px] text-primary-400 font-bold uppercase tracking-[0.18em] mt-1">
              De la granja a tu puerta
            </p>
          </div>
        </div>

        <p className="text-sm text-white/70 leading-relaxed mb-7">
          Somos un negocio de la zona. Pedí por acá y te llevamos los productos frescos hasta tu
          casa — sin vueltas y sin apps de por medio.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-7">
          <div className="space-y-3">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-primary-400/90">
              Por qué La Granjita
            </p>
            <ul className="space-y-2.5">
              {REASONS.map((r) => (
                <li key={r.text} className="flex items-center gap-2.5 text-sm text-white/80">
                  <span className="w-7 h-7 shrink-0 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center text-sm">
                    {r.icon}
                  </span>
                  {r.text}
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-primary-400/90">
              ¿Dudas? Escribinos
            </p>
            {waLink ? (
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-primary-500 to-primary-600 px-4 py-2.5 font-extrabold text-ink-950 shadow-lift active:scale-[0.98] transition-transform"
              >
                <span aria-hidden="true">💬</span> Escribinos por WhatsApp
              </a>
            ) : (
              <p className="text-sm text-white/70">Hacé tu pedido y te contactamos por WhatsApp.</p>
            )}
            <p className="text-xs text-white/50 leading-relaxed">
              Te avisamos cuando salga y cuando esté por llegar. Cualquier cambio, lo arreglamos por
              chat.
            </p>
          </div>
        </div>

        {/* Datos de la tienda */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {FACTS.map((f) => (
            <div
              key={f.label}
              className="rounded-2xl bg-white/[0.04] border border-white/10 px-3.5 py-3"
            >
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/45">
                {f.icon} {f.label}
              </p>
              <p className="text-[13px] text-white/85 font-semibold leading-snug mt-1">{f.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 pt-6 border-t border-white/10 flex flex-col items-center gap-3">
          <Link
            href="/acerca-de"
            className="text-sm font-bold text-primary-400 hover:text-primary-300 transition-colors"
          >
            Acerca de · cómo usar la tienda →
          </Link>
          <p className="text-center text-[11px] text-white/45">
            © {year} La Granjita · San José Pinula, Guatemala 🇬🇹
          </p>
        </div>
      </div>
    </footer>
  );
}
