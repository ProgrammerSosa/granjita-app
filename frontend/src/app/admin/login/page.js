'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { loginAdmin } from '@/lib/api';
import useAuthStore from '@/store/useAuthStore';
import BrandLogo from '@/components/BrandLogo';
import Link from 'next/link';

export default function AdminLoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await loginAdmin(password);
      login(data.token);
      router.push('/admin');
    } catch (err) {
      setError(err.message || 'Contraseña incorrecta');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden">
      <div className="absolute inset-0 bg-hero-mesh" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_rgba(249,115,22,0.25),_transparent_60%)]" />

      <div className="relative w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 w-fit shadow-2xl rounded-[1.5rem]">
            <BrandLogo size={88} rounded="rounded-[1.5rem]" ring={false} className="ring-2 ring-white/40" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight drop-shadow-sm">
            La Granjita
          </h1>
          <p className="text-primary-100/90 text-sm mt-1.5 font-medium">
            Panel de administración
          </p>
        </div>

        <div className="bg-white/12 backdrop-blur-xl rounded-3xl p-6 border border-white/20 shadow-2xl">
          <h2 className="text-lg font-bold text-white text-center mb-1">Bienvenido/a</h2>
          <p className="text-center text-white/60 text-xs mb-6">
            Entrá para manejar pedidos, catálogo y horarios
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-white/70 uppercase tracking-wider">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3.5 rounded-2xl bg-white/10 border border-white/25 text-white placeholder:text-white/40 focus:ring-2 focus:ring-primary-400 focus:border-primary-400 outline-none transition-all mt-1"
                placeholder="Ingresá la contraseña"
                autoFocus
                required
              />
            </div>

            {error && (
              <div className="bg-red-500/20 border border-red-400/40 text-red-100 text-sm p-3 rounded-xl">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-primary-500 to-primary-600 text-ink-950 py-3.5 rounded-2xl font-black hover:from-primary-400 hover:to-primary-500 active:scale-[0.98] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-primary-900/40"
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-ink-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                'Entrar al panel'
              )}
            </button>
          </form>
        </div>

        <Link
          href="/"
          className="block text-center text-white/70 text-sm mt-6 hover:text-white font-medium"
        >
          ← Volver a la tienda
        </Link>
      </div>
    </div>
  );
}
