'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Link from 'next/link';
import useCartStore from '@/store/useCartStore';
import CartDrawer from './CartDrawer';
import BrandLogo from './BrandLogo';

const ADMIN_UNLOCK_TAPS = 10;
const TAP_RESET_MS = 2500;
const STORAGE_KEY = 'tienda_admin_gear_unlocked';

export default function Navbar() {
  const [cartOpen, setCartOpen] = useState(false);
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const tapCount = useRef(0);
  const tapTimer = useRef(null);
  const items = useCartStore((s) => s.items);
  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(STORAGE_KEY) === '1') {
        setAdminUnlocked(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const handleLogoTap = useCallback(() => {
    if (adminUnlocked) return;

    tapCount.current += 1;
    const n = tapCount.current;

    if (tapTimer.current) clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => {
      tapCount.current = 0;
    }, TAP_RESET_MS);

    if (n >= ADMIN_UNLOCK_TAPS) {
      tapCount.current = 0;
      setAdminUnlocked(true);
      try {
        sessionStorage.setItem(STORAGE_KEY, '1');
      } catch {
        /* ignore */
      }
      if (tapTimer.current) clearTimeout(tapTimer.current);
    }
  }, [adminUnlocked]);

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-40 bg-white/85 backdrop-blur-xl border-b border-ink-100/80 shadow-sm">
        <div className="max-w-lg mx-auto px-4 h-16 flex items-center justify-between">
          <Link
            href="/"
            onClick={handleLogoTap}
            className="flex items-center gap-3 group select-none"
            title="La Granjita"
          >
            <BrandLogo
              size={40}
              className="group-active:scale-95 transition-transform"
            />
            <div>
              <h1 className="text-lg font-black text-ink-900 leading-tight tracking-tight">
                La Granjita
              </h1>
              <p className="text-[10px] text-primary-600 font-semibold -mt-0.5 uppercase tracking-wider">
                Fresco · a domicilio
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-1.5">
            <Link
              href="/acerca-de"
              className="p-2.5 rounded-xl hover:bg-ink-100 transition-colors text-ink-500 hover:text-primary-700"
              title="Acerca de"
              aria-label="Acerca de"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </Link>
            {adminUnlocked && (
              <Link
                href="/admin/login"
                className="p-2.5 rounded-xl hover:bg-ink-100 transition-all text-ink-400 hover:text-ink-600 animate-scale-in"
                title="Panel Admin"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </Link>
            )}

            <button
              onClick={() => setCartOpen(true)}
              className="relative p-2.5 rounded-xl hover:bg-primary-50 transition-colors"
              aria-label="Abrir carrito"
            >
              <svg className="w-6 h-6 text-ink-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z"
                />
              </svg>
              {totalItems > 0 && (
                <span
                  className="absolute -top-0.5 -right-0.5 bg-primary-600 text-white text-[11px] font-bold
                               min-w-[1.25rem] h-5 px-1 rounded-full flex items-center justify-center shadow-md shadow-primary-300"
                >
                  {totalItems}
                </span>
              )}
            </button>
          </div>
        </div>
      </nav>

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </>
  );
}
