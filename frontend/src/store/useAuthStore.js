import { create } from 'zustand';

const useAuthStore = create((set, get) => ({
  token: typeof window !== 'undefined' ? localStorage.getItem('tienda_admin_token') : null,
  isAuthenticated: false,
  loading: true,

  init: async () => {
    const token = localStorage.getItem('tienda_admin_token');
    if (!token) {
      set({ token: null, isAuthenticated: false, loading: false });
      return;
    }
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
      const res = await fetch(`${API_BASE}/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (data.success && data.data.valid) {
        set({ token, isAuthenticated: true, loading: false });
      } else {
        localStorage.removeItem('tienda_admin_token');
        set({ token: null, isAuthenticated: false, loading: false });
      }
    } catch {
      localStorage.removeItem('tienda_admin_token');
      set({ token: null, isAuthenticated: false, loading: false });
    }
  },

  login: (token) => {
    localStorage.setItem('tienda_admin_token', token);
    set({ token, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('tienda_admin_token');
    set({ token: null, isAuthenticated: false });
  },

  getToken: () => get().token,
}));

export default useAuthStore;
