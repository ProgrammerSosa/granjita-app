'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import useAuthStore from '@/store/useAuthStore';
import BrandLogo from '@/components/BrandLogo';
import NotificationCenter from '@/components/NotificationCenter';
import NewOrderNotifier from '@/components/NewOrderNotifier';

const SIDEBAR_KEY = 'granjita_admin_sidebar_open';

const NAV_ITEMS = [
  {
    label: 'Inicio',
    href: '/admin',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
        />
      </svg>
    ),
  },
  {
    label: 'Estadísticas',
    href: '/admin/stats',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
        />
      </svg>
    ),
  },
  {
    label: 'Stock',
    href: '/admin/stock',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
        />
      </svg>
    ),
  },
  {
    label: 'Categorías',
    href: '/admin/categories',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
        />
      </svg>
    ),
  },
  {
    label: 'Productos',
    href: '/admin/products',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
        />
      </svg>
    ),
  },
  {
    label: 'Pedidos',
    href: '/admin/orders',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
        />
      </svg>
    ),
  },
  {
    label: 'Facturas',
    href: '/admin/invoices',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    ),
  },
  {
    label: 'Calendario',
    href: '/admin/store',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  },
  {
    label: 'WhatsApp',
    href: '/admin/whatsapp',
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
    ),
  },
  {
    label: 'Acerca de',
    href: '/admin/about',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  },
];

/** Siempre las 3 barritas — se reconoce al instante */
function HamburgerIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function NavLinks({ pathname, onNavigate, collapsed = false }) {
  return (
    <nav className="p-3 space-y-1">
      {NAV_ITEMS.map((item) => {
        const active =
          pathname === item.href ||
          (item.href !== '/admin' && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            title={item.label}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              collapsed ? 'justify-center' : ''
            } ${
              active
                ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-900/40'
                : 'text-orange-100/80 hover:bg-white/10 hover:text-white'
            }`}
          >
            {item.icon}
            {!collapsed && <span>{item.label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

export default function AdminLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  /** Menú abierto/cerrado (móvil drawer + desktop panel) */
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const { isAuthenticated, loading, init, logout } = useAuthStore();
  const isLoginPage = pathname === '/admin/login';

  useEffect(() => {
    init();
  }, [init]);

  // Restaurar preferencia del menú
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SIDEBAR_KEY);
      if (saved === '0') setSidebarOpen(false);
      else if (saved === '1') setSidebarOpen(true);
      else {
        // Por defecto en móvil cerrado, en desktop abierto
        setSidebarOpen(typeof window !== 'undefined' ? window.innerWidth >= 1024 : true);
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(SIDEBAR_KEY, sidebarOpen ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [sidebarOpen, hydrated]);

  useEffect(() => {
    if (!loading && !isAuthenticated && !isLoginPage) {
      router.push('/admin/login');
    }
  }, [loading, isAuthenticated, isLoginPage, router]);

  // En navegación en móvil, cerrar el menú al cambiar de ruta
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  }, [pathname]);

  if (isLoginPage) return <>{children}</>;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-cream-50 to-primary-50 flex items-center justify-center">
        <div className="text-center">
          <BrandLogo size={56} className="mx-auto mb-3 animate-float" />
          <div className="w-10 h-10 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  function handleLogout() {
    logout();
    router.push('/admin/login');
  }

  function toggleSidebar() {
    setSidebarOpen((v) => !v);
  }

  const Brand = ({ compact = false }) => (
    <div className={`flex items-center gap-3 ${compact ? 'justify-center' : ''}`}>
      <BrandLogo size={compact ? 36 : 44} ring={false} className="ring-2 ring-white/25 shadow-lg" />
      {!compact && (
        <div>
          <h2 className="font-black text-sm leading-tight tracking-tight text-white">La Granjita</h2>
          <p className="text-primary-200/90 text-[11px] font-medium">Panel del negocio</p>
        </div>
      )}
    </div>
  );

  const FooterLinks = ({ compact = false }) => (
    <div className="p-3 border-t border-white/10 space-y-1 bg-black/10">
      <button
        onClick={handleLogout}
        title="Cerrar sesión"
        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-red-300 hover:bg-white/10 hover:text-red-200 transition-colors w-full ${
          compact ? 'justify-center' : ''
        }`}
      >
        <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
          />
        </svg>
        {!compact && 'Cerrar sesión'}
      </button>
      <Link
        href="/"
        title="Ver tienda"
        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-orange-100/70 hover:bg-white/10 hover:text-white transition-colors ${
          compact ? 'justify-center' : ''
        }`}
      >
        <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 19l-7-7m0 0l7-7m-7 7h18"
          />
        </svg>
        {!compact && 'Ver tienda'}
      </Link>
    </div>
  );

  const sidebarClass =
    'bg-gradient-to-b from-ink-950 via-ink-900 to-primary-950 text-white flex flex-col';

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#fff8f1] via-[#f4f6f8] to-[#fff0e6]">
      {/* Barra superior — botón MENÚ bien visible con las 3 barritas */}
      <header className="sticky top-0 z-40 bg-gradient-to-r from-ink-950 to-primary-900 text-white px-3 sm:px-4 py-2.5 flex items-center justify-between shadow-md border-b border-white/10">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={toggleSidebar}
            className={`
              inline-flex items-center gap-2
              px-3 sm:px-3.5 py-2.5 rounded-xl font-bold text-sm
              active:scale-95 transition-all shadow-md
              ${
                sidebarOpen
                  ? 'bg-white text-ink-900 hover:bg-primary-50 ring-2 ring-primary-400/50'
                  : 'bg-primary-500 text-ink-950 hover:bg-primary-400 ring-2 ring-white/30 animate-pulse'
              }
            `}
            aria-label={sidebarOpen ? 'Ocultar menú' : 'Mostrar menú'}
            title={sidebarOpen ? 'Cerrar menú lateral' : 'Abrir menú lateral'}
          >
            <HamburgerIcon />
            <span className="font-black tracking-wide">
              {sidebarOpen ? 'Cerrar' : 'Menú'}
            </span>
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <BrandLogo size={32} ring={false} className="ring-1 ring-white/30 hidden sm:block" />
            <div className="min-w-0">
              <p className="font-black text-sm tracking-tight truncate">La Granjita</p>
              <p className="text-[10px] text-primary-200/90 font-medium hidden md:block">
                Panel admin
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <NewOrderNotifier />
          <NotificationCenter />
          <Link
            href="/admin/stats"
            className="hidden sm:inline-flex text-xs font-bold px-3 py-2 rounded-xl hover:bg-white/10 text-white/90"
          >
            Stats
          </Link>
          <Link href="/" className="p-2.5 rounded-xl hover:bg-white/10" title="Ver tienda">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
              />
            </svg>
          </Link>
        </div>
      </header>

      {/* Overlay móvil cuando el menú está abierto */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/45 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar — drawer en móvil, panel fijo en desktop */}
      <aside
        className={`
          ${sidebarClass}
          fixed z-50 top-[52px] bottom-0 left-0
          w-72 max-w-[85vw]
          shadow-2xl
          transition-transform duration-300 ease-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:top-0 lg:pt-[52px]
        `}
        aria-hidden={!sidebarOpen}
      >
        <div className="p-5 border-b border-white/10 flex items-start justify-between gap-2">
          <Brand />
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold"
            aria-label="Cerrar menú"
            title="Cerrar menú"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
            <span className="hidden sm:inline">Cerrar</span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto admin-scroll">
          <NavLinks
            pathname={pathname}
            onNavigate={() => {
              if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                setSidebarOpen(false);
              }
            }}
          />
        </div>
        <FooterLinks />
      </aside>

      {/* Contenido: se expande cuando el menú está cerrado */}
      <main
        className={`
          min-h-[calc(100vh-52px)] p-4 sm:p-6 lg:p-8 admin-scroll
          transition-[margin] duration-300 ease-out
          ${sidebarOpen ? 'lg:ml-72' : 'lg:ml-0'}
        `}
      >
        {children}
      </main>
    </div>
  );
}
