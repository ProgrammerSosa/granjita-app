'use client';

import { useState, useEffect } from 'react';
import { fetchAdminStats } from '@/lib/api';

const STATUS_LABELS = {
  pending: 'Pendiente',
  confirmed: 'Confirmado',
  preparing: 'Preparando',
  in_transit: 'En camino',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};

const STATUS_COLORS = {
  pending: 'badge-yellow',
  confirmed: 'badge-blue',
  preparing: 'badge-orange',
  in_transit: 'badge-blue',
  delivered: 'badge-green',
  cancelled: 'badge-red',
};

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    loadStats();
  }, [selectedDate]);

  async function loadStats() {
    try {
      setLoading(true);
      const data = await fetchAdminStats(selectedDate);
      setStats(data);
    } catch (err) {
      console.error('Error cargando stats:', err);
    } finally {
      setLoading(false);
    }
  }

  function formatCurrency(amount) {
    return `Q ${amount.toLocaleString('es-GT')}`;
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-gray-200 rounded-lg w-48 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-gray-200 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">Resumen de ventas del día</p>
        </div>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="input-admin"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card-admin p-5 hover:shadow-md transition-shadow">
          <div className="flex gap-3">
            <div className="w-11 h-11 bg-orange-100 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <p className="text-gray-500 text-xs font-medium">Pedidos hoy</p>
              <p className="text-2xl font-black text-gray-900">{stats?.totalOrders || 0}</p>
            </div>
          </div>
        </div>

        <div className="card-admin p-5 hover:shadow-md transition-shadow">
          <div className="flex gap-3">
            <div className="w-11 h-11 bg-green-100 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-gray-500 text-xs font-medium">Ingresos totales</p>
              <p className="text-2xl font-black text-gray-900">{formatCurrency(stats?.totalRevenue || 0)}</p>
            </div>
          </div>
        </div>

        <div className="card-admin p-5 hover:shadow-md transition-shadow">
          <div className="flex gap-3">
            <div className="w-11 h-11 bg-yellow-100 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <p className="text-gray-500 text-xs font-medium">Efectivo ({stats?.cashOrders || 0})</p>
              <p className="text-2xl font-black text-gray-900">{formatCurrency(stats?.cashRevenue || 0)}</p>
            </div>
          </div>
        </div>

        <div className="card-admin p-5 hover:shadow-md transition-shadow">
          <div className="flex gap-3">
            <div className="w-11 h-11 bg-blue-100 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <div>
              <p className="text-gray-500 text-xs font-medium">Tarjeta ({stats?.cardOrders || 0})</p>
              <p className="text-2xl font-black text-gray-900">{formatCurrency(stats?.cardRevenue || 0)}</p>
            </div>
          </div>
        </div>
      </div>

      {stats?.statusCounts && Object.keys(stats.statusCounts).length > 0 && (
        <div className="card-admin p-5">
          <h3 className="text-sm font-bold text-gray-700 mb-3">Pedidos por estado</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.statusCounts).map(([status, count]) => (
              <span key={status} className={`${STATUS_COLORS[status] || 'badge-gray'} text-xs`}>
                {STATUS_LABELS[status] || status}: {count}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {stats?.topProducts?.length > 0 && (
          <div className="card-admin p-5">
            <h3 className="text-sm font-bold text-gray-700 mb-3">Productos más vendidos</h3>
            <div className="space-y-0">
              {stats.topProducts.map((p, i) => (
                <div key={i} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                      i === 0 ? 'bg-yellow-100 text-yellow-700' :
                      i === 1 ? 'bg-gray-100 text-gray-600' :
                      i === 2 ? 'bg-orange-100 text-orange-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {i + 1}
                    </span>
                    <span className="text-sm font-semibold text-gray-800">{p._id}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-gray-900">{p.totalSold} u.</span>
                    <span className="text-xs text-gray-500 ml-2">{formatCurrency(p.totalRevenue)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {stats?.hourlySales?.some(v => v > 0) && (
          <div className="card-admin p-5">
            <h3 className="text-sm font-bold text-gray-700 mb-3">Ventas por hora</h3>
            <div className="flex items-end gap-1 h-36">
              {stats.hourlySales.slice(8, 22).map((amount, i) => {
                const maxAmount = Math.max(...stats.hourlySales.filter(v => v > 0), 1);
                const height = Math.max((amount / maxAmount) * 100, amount > 0 ? 4 : 0);
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full rounded-t-md transition-all duration-500 hover:opacity-80"
                      style={{
                        height: `${height}%`,
                        background: amount > 0
                          ? 'linear-gradient(to top, #ea580c, #f97316)'
                          : '#e2e8f0',
                      }}
                      title={`${i + 8}:00 - ${formatCurrency(amount)}`}
                    />
                    <span className="text-[9px] text-gray-400 font-medium">{i + 8}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {(!stats?.totalOrders || stats.totalOrders === 0) && (
        <div className="card-admin p-10 text-center">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <p className="text-gray-600 font-bold text-lg">Sin ventas este día</p>
          <p className="text-gray-400 text-sm mt-1.5">Las estadísticas aparecerán cuando haya pedidos</p>
        </div>
      )}
    </div>
  );
}
