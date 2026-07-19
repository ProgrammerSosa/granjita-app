'use client';

import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import useCartStore from '@/store/useCartStore';
import CartDrawer from './CartDrawer';
import { SettingsIcon } from '@/lib/icons';

export default function Navbar() {
  const [cartOpen, setCartOpen] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const items = useCartStore((s) => s.items);
  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);

  const tapCount = useRef(0);
  const tapTimer = useRef(null);
  const hideTimer = useRef(null);

  const handleLogoTap = useCallback(() => {
    tapCount.current += 1;

    clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => {
      tapCount.current = 0;
    }, 1500);

    if (tapCount.current >= 10) {
      tapCount.current = 0;
      clearTimeout(tapTimer.current);
      setShowAdmin(true);

      clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => {
        setShowAdmin(false);
      }, 8000);
    }
  }, []);

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-lg border-b border-gray-100 shadow-sm">
        <div className="max-w-lg mx-auto px-4 h-16 flex items-center justify-between">
          <button onClick={handleLogoTap} className="flex items-center gap-3">
            <img src="/images/logo.png" alt="Granjita" className="h-10 w-10 rounded-xl object-cover shadow-md shadow-gray-200" />
            <div>
              <h1 className="text-lg font-black text-gray-900 leading-tight tracking-tight">
                GRANJITA
              </h1>
              <p className="text-[10px] text-orange-600 font-semibold -mt-0.5 uppercase tracking-wider">
                Productos frescos
              </p>
            </div>
          </button>

          <div className="flex items-center gap-2">
            {showAdmin && (
              <Link
                href="/admin/login"
                className="p-2 rounded-xl bg-orange-500 text-white shadow-lg shadow-orange-300 animate-fade-in"
                title="Panel Admin"
              >
                <SettingsIcon className="w-5 h-5" />
              </Link>
            )}

            <button
              onClick={() => setCartOpen(true)}
              className="relative p-2.5 rounded-xl hover:bg-orange-50 transition-colors"
            >
              <svg className="w-6 h-6 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
              </svg>
              {totalItems > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-orange-500 text-white text-xs font-bold
                               w-5 h-5 rounded-full flex items-center justify-center shadow-md shadow-orange-300">
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
