import { create } from 'zustand';

const useCartStore = create((set, get) => ({
  items: [],

  addItem: (product, { variant = null, quantity = 1, unitType = 'unit' }) => {
    set((state) => {
      const existingIndex = state.items.findIndex(
        (item) =>
          item.product._id === product._id &&
          item.variant?.name === variant?.name
      );

      if (existingIndex >= 0) {
        const updated = [...state.items];
        const existing = updated[existingIndex];
        const newQty = parseFloat((existing.quantity + quantity).toFixed(1));
        updated[existingIndex] = {
          ...existing,
          quantity: newQty,
          subtotal: existing.unitPrice * newQty,
        };
        return { items: updated };
      }

      const unitPrice = variant ? variant.price : product.price;

      return {
        items: [
          ...state.items,
          {
            product,
            variant,
            quantity,
            unitPrice,
            unitType,
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
      const step = state.items[index]?.unitType === 'weight' ? 0.5 : 1;
      if (quantity < step) {
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

  get totalItems() {
    return get().items.reduce((sum, i) => sum + i.quantity, 0);
  },

  get subtotal() {
    return get().items.reduce((sum, i) => sum + i.subtotal, 0);
  },
}));

export default useCartStore;
