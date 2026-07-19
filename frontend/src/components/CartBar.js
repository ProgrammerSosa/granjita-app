'use client';

import { useState } from 'react';
import useCartStore from '@/store/useCartStore';
import { formatMoney } from '@/lib/api';
import CartDrawer from './CartDrawer';

export default function CartBar() {
  const [open, setOpen] = useState(false);
  const items = useCartStore((s) => s.items);
  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const total = items.reduce((sum, i) => sum + i.subtotal, 0);

  if (totalItems === 0) return null;

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-40 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pointer-events-none">
        <div className="max-w-lg mx-auto pointer-events-auto">
          <button
            onClick={() => setOpen(true)}
            className="w-full btn-primary py-3.5 flex items-center justify-between shadow-2xl shadow-primary-400/40"
          >
            <span className="flex items-center gap-2">
              <span className="bg-white/20 rounded-lg px-2.5 py-0.5 text-sm font-black">
                {totalItems}
              </span>
              <span className="font-bold">Ver carrito</span>
            </span>
            <span className="font-black">{formatMoney(total)}</span>
          </button>
        </div>
      </div>
      <CartDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}
