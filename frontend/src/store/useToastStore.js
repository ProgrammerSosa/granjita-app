import { create } from 'zustand';

let toastId = 0;

const useToastStore = create((set, get) => ({
  toasts: [],
  confirm: null,

  toast: (message, type = 'success', duration = 3200) => {
    const id = ++toastId;
    set((state) => ({
      toasts: [...state.toasts, { id, message, type }],
    }));
    if (duration > 0) {
      setTimeout(() => get().dismiss(id), duration);
    }
    return id;
  },

  success: (message) => get().toast(message, 'success'),
  error: (message) => get().toast(message, 'error', 4500),
  info: (message) => get().toast(message, 'info'),

  dismiss: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),

  askConfirm: ({ title, message, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', danger = false }) =>
    new Promise((resolve) => {
      set({
        confirm: {
          title,
          message,
          confirmLabel,
          cancelLabel,
          danger,
          resolve: (value) => {
            set({ confirm: null });
            resolve(value);
          },
        },
      });
    }),
}));

export default useToastStore;
