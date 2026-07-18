import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],

      addItem: (product, { variant = null, extras = [], quantity = 1 }) => {
        set((state) => {
          const existingIndex = state.items.findIndex(
            (item) =>
              item.product._id === product._id &&
              item.variant?.name === variant?.name &&
              JSON.stringify((item.extras || []).map((e) => e.name).sort()) ===
                JSON.stringify((extras || []).map((e) => e.name).sort())
          );

          if (existingIndex >= 0) {
            const updated = [...state.items];
            const existing = updated[existingIndex];
            const newQty = existing.quantity + quantity;
            updated[existingIndex] = {
              ...existing,
              quantity: newQty,
              subtotal: existing.unitPrice * newQty,
            };
            return { items: updated };
          }

          let unitPrice = variant ? variant.price : product.price;
          const extrasTotal = (extras || []).reduce((sum, e) => sum + e.price, 0);
          unitPrice += extrasTotal;

          return {
            items: [
              ...state.items,
              {
                product,
                variant,
                extras,
                quantity,
                unitPrice,
                subtotal: unitPrice * quantity,
              },
            ],
          };
        });
      },

      removeItem: (index) =>
        set((state) => ({
          items: state.items.filter((_, i) => i !== index),
        })),

      updateQuantity: (index, quantity) =>
        set((state) => {
          if (quantity <= 0) {
            return { items: state.items.filter((_, i) => i !== index) };
          }
          const updated = [...state.items];
          updated[index] = {
            ...updated[index],
            quantity,
            subtotal: updated[index].unitPrice * quantity,
          };
          return { items: updated };
        }),

      clearCart: () => set({ items: [] }),

      getTotalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
      getSubtotal: () => get().items.reduce((sum, i) => sum + i.subtotal, 0),
    }),
    {
      name: 'tienda-cart',
      partialize: (state) => ({ items: state.items }),
    }
  )
);

export default useCartStore;
