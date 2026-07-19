'use client';

import Link from 'next/link';
import BrandLogo from './BrandLogo';

const WHATSAPP = process.env.NEXT_PUBLIC_WHATSAPP || '';

export default function Footer() {
  const waLink = WHATSAPP
    ? `https://wa.me/${WHATSAPP.replace(/\D/g, '')}`
    : null;

  return (
    <footer className="mt-8 border-t border-ink-100 bg-white">
      <div className="max-w-lg mx-auto px-4 py-10">
        <div className="flex items-center gap-3 mb-6">
          <BrandLogo size={48} />
          <div>
            <p className="font-black text-ink-900 tracking-tight text-lg">La Granjita</p>
            <p className="text-xs text-primary-600 font-semibold uppercase tracking-wider">
              De la granja a tu puerta
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm text-ink-600">
          <div className="space-y-2.5">
            <p className="section-label">Por qué pedirnos</p>
            <ul className="space-y-2">
              {[
                'Productos frescos del día',
                'Solo residenciales de San José Pinula',
                'Efectivo o terminal POS en casa',
              ].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary-50 text-primary-700 flex items-center justify-center text-xs font-bold">
                    ✓
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-2.5">
            <p className="section-label">Contacto</p>
            {waLink ? (
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-primary-700 font-bold hover:text-primary-800"
              >
                <span aria-hidden="true">💬</span> WhatsApp
              </a>
            ) : (
              <p>Pedí online y te avisamos por WhatsApp</p>
            )}
            <p className="text-xs text-ink-400 leading-relaxed">
              Al confirmar tu pedido recibirás actualizaciones del estado de entrega.
            </p>
          </div>
        </div>

        <div className="mt-8 flex justify-center">
          <Link
            href="/acerca-de"
            className="text-sm font-bold text-primary-700 hover:text-primary-800"
          >
            Acerca de · cómo usar la tienda
          </Link>
        </div>

        <p className="text-center text-[11px] text-ink-400 mt-6 pt-5 border-t border-ink-100">
          © {new Date().getFullYear()} La Granjita · San José Pinula, Guatemala
        </p>
      </div>
    </footer>
  );
}
