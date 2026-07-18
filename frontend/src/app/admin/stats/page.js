'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { fetchAdminStats } from '@/lib/api';
import { gtTodayStr, formatGtTime, formatMoneyQ } from '@/lib/dates';

const STATUS_LABELS = {
  pending: 'Pendiente',
  confirmed: 'Confirmado',
  preparing: 'Preparando',
  in_transit: 'En camino',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};

const STATUS_COLORS = {
  pending: 'bg-amber-100 text-amber-800 border-amber-200',
  confirmed: 'bg-orange-100 text-orange-800 border-orange-200',
  preparing: 'bg-sky-100 text-sky-800 border-sky-200',
  in_transit: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  delivered: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  cancelled: 'bg-red-100 text-red-700 border-red-200',
};

const STATUS_CHART_COLORS = {
  pending: '#f59e0b',
  confirmed: '#ea580c',
  preparing: '#0ea5e9',
  in_transit: '#6366f1',
  delivered: '#10b981',
  cancelled: '#ef4444',
};

const PIE_COLORS = ['#f97316', '#0ea5e9', '#10b981', '#a855f7', '#eab308', '#64748b'];

function StatCard({ title, value, subtitle, icon, accent = 'primary' }) {
  const accents = {
    primary: 'from-primary-500/15 to-white border-primary-200',
    green: 'from-emerald-500/15 to-white border-emerald-200',
    yellow: 'from-amber-500/15 to-white border-amber-200',
    blue: 'from-sky-500/15 to-white border-sky-200',
  };
  return (
    <div
      className={`card-admin p-5 bg-gradient-to-br ${accents[accent] || accents.primary} border hover:shadow-md transition-shadow`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-admin-500 text-xs font-bold uppercase tracking-wide">{title}</p>
          <p className="text-2xl font-black text-admin-900 mt-1 tabular-nums">{value}</p>
          {subtitle && <p className="text-xs text-admin-500 mt-1 font-medium">{subtitle}</p>}
        </div>
        <div className="w-11 h-11 rounded-2xl bg-white/80 border border-admin-100 flex items-center justify-center text-xl shadow-sm">
          {icon}
        </div>
      </div>
    </div>
  );
}

function ChartTooltip({ active, payload, label, money = true }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl bg-ink-950 text-white px-3 py-2 shadow-xl border border-white/10 text-xs">
      <p className="font-bold text-primary-300 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="font-semibold" style={{ color: p.color || '#fff' }}>
          {p.name}: {money && typeof p.value === 'number' ? formatMoneyQ(p.value) : p.value}
        </p>
      ))}
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => gtTodayStr());

  const loadStats = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await fetchAdminStats(selectedDate);
      if (!data) throw new Error('Respuesta vacía del servidor');
      setStats(data);
    } catch (err) {
      console.error('Error cargando stats:', err);
      setStats(null);
      setError(err.message || 'No se pudieron cargar las estadísticas');
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  /** Ventas por hora (24h GT) */
  const hourData = useMemo(() => {
    const sales = stats?.hourlySales || Array(24).fill(0);
    const counts = stats?.hourlyOrders || Array(24).fill(0);
    return Array.from({ length: 24 }, (_, hour) => ({
      hour,
      label: `${hour}h`,
      ingresos: Math.round((sales[hour] || 0) * 100) / 100,
      pedidos: counts[hour] || 0,
      isBusiness: hour >= 10 && hour <= 20,
    }));
  }, [stats]);

  /** Últimos 7 días */
  const weekData = useMemo(() => {
    return (stats?.last7Days || []).map((d) => ({
      date: d.date,
      label: `${d.date.slice(8)}/${d.date.slice(5, 7)}`,
      ingresos: Math.round((d.revenue || 0) * 100) / 100,
      pedidos: d.orders || 0,
      isSelected: d.isSelected,
    }));
  }, [stats]);

  /** Métodos de pago */
  const paymentPie = useMemo(() => {
    const cash = stats?.cashRevenue || 0;
    const card = stats?.cardRevenue || 0;
    const data = [];
    if (cash > 0) data.push({ name: 'Efectivo', value: cash });
    if (card > 0) data.push({ name: 'Tarjeta / POS', value: card });
    if (data.length === 0) data.push({ name: 'Sin ventas', value: 1 });
    return data;
  }, [stats]);

  /** Estados del día */
  const statusBars = useMemo(() => {
    return Object.keys(STATUS_LABELS).map((key) => ({
      key,
      name: STATUS_LABELS[key],
      cantidad: stats?.statusCounts?.[key] || 0,
      fill: STATUS_CHART_COLORS[key],
    }));
  }, [stats]);

  /** Top productos para barras horizontales */
  const productBars = useMemo(() => {
    return (stats?.topProducts || []).slice(0, 6).map((p) => ({
      name: String(p._id || '').length > 18 ? `${String(p._id).slice(0, 16)}…` : p._id,
      fullName: p._id,
      unidades: p.totalSold || 0,
      ingresos: Math.round((p.totalRevenue || 0) * 100) / 100,
    }));
  }, [stats]);

  if (loading && !stats) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-10 bg-admin-200 rounded-xl w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-admin-200 rounded-2xl" />
          ))}
        </div>
        <div className="h-72 bg-admin-200 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-primary-600">La Granjita</p>
          <h1 className="text-2xl font-black text-admin-900">Estadísticas</h1>
          <p className="text-admin-500 text-sm mt-0.5">
            Apartado de gráficas · hora Guatemala
            {stats?.date ? ` · ${stats.date}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedDate(gtTodayStr())}
            className="btn-ghost text-xs font-bold border border-admin-200 bg-white"
          >
            Hoy
          </button>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="input-admin"
          />
          <button
            type="button"
            onClick={loadStats}
            disabled={loading}
            className="btn-admin text-sm py-2.5"
          >
            {loading ? '…' : 'Actualizar'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 text-red-700 p-4 text-sm font-semibold flex flex-wrap items-center justify-between gap-3">
          <span>⚠️ {error}</span>
          <button type="button" onClick={loadStats} className="btn-danger text-xs py-2 px-4">
            Reintentar
          </button>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Pedidos del día"
          value={stats?.totalOrders ?? 0}
          subtitle={`${stats?.activeOrders ?? 0} activos · ${stats?.cancelled ?? 0} canc.`}
          icon="📦"
          accent="primary"
        />
        <StatCard
          title="Ingresos del día"
          value={formatMoneyQ(stats?.totalRevenue)}
          subtitle={`Ticket prom. ${formatMoneyQ(stats?.avgTicket)}`}
          icon="💰"
          accent="green"
        />
        <StatCard
          title="Efectivo"
          value={formatMoneyQ(stats?.cashRevenue)}
          subtitle={`${stats?.cashOrders ?? 0} pedidos`}
          icon="💵"
          accent="yellow"
        />
        <StatCard
          title="Tarjeta / POS"
          value={formatMoneyQ(stats?.cardRevenue)}
          subtitle={`${stats?.cardOrders ?? 0} pedidos`}
          icon="💳"
          accent="blue"
        />
      </div>

      {/* GRÁFICO PRINCIPAL: Ventas por hora */}
      <div className="card-admin p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-2 mb-4">
          <div>
            <h3 className="font-black text-admin-900 text-lg">Ventas por hora</h3>
            <p className="text-xs text-admin-500 mt-0.5">
              Ingresos y pedidos · 24 h · Guatemala · zona naranja = horario de atención
            </p>
          </div>
          <div className="flex gap-3 text-[11px] font-bold text-admin-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-primary-500" /> Ingresos
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-emerald-500" /> Pedidos
            </span>
          </div>
        </div>
        <div className="h-72 sm:h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={hourData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradIngresos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f97316" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#f97316" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="gradPedidos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: '#71717a', fontWeight: 600 }}
                interval={1}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 10, fill: '#a1a1aa' }}
                axisLine={false}
                tickLine={false}
                width={40}
                tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v)}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 10, fill: '#a1a1aa' }}
                axisLine={false}
                tickLine={false}
                width={28}
                allowDecimals={false}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const row = payload[0]?.payload;
                  return (
                    <div className="rounded-xl bg-ink-950 text-white px-3 py-2.5 shadow-xl border border-white/10 text-xs min-w-[140px]">
                      <p className="font-black text-primary-300 mb-1.5">{label}</p>
                      <p className="font-semibold text-orange-300">
                        Ingresos: {formatMoneyQ(row?.ingresos)}
                      </p>
                      <p className="font-semibold text-emerald-300">Pedidos: {row?.pedidos}</p>
                      {row?.isBusiness && (
                        <p className="text-white/50 mt-1">Horario de atención</p>
                      )}
                    </div>
                  );
                }}
              />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="ingresos"
                name="Ingresos"
                stroke="#ea580c"
                strokeWidth={2.5}
                fill="url(#gradIngresos)"
                activeDot={{ r: 5, fill: '#ea580c', stroke: '#fff', strokeWidth: 2 }}
              />
              <Area
                yAxisId="right"
                type="monotone"
                dataKey="pedidos"
                name="Pedidos"
                stroke="#10b981"
                strokeWidth={2}
                fill="url(#gradPedidos)"
                activeDot={{ r: 4, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Semana + pago + estados */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* 7 días */}
        <div className="card-admin p-5 xl:col-span-2">
          <div className="flex flex-wrap items-end justify-between gap-2 mb-3">
            <div>
              <h3 className="font-black text-admin-900">Últimos 7 días</h3>
              <p className="text-xs text-admin-500">
                {stats?.weekOrders ?? 0} pedidos · {formatMoneyQ(stats?.weekRevenue)} · click en
                barra para ver ese día
              </p>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradWeek" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fb923c" />
                    <stop offset="100%" stopColor="#ea580c" />
                  </linearGradient>
                  <linearGradient id="gradWeekSel" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" />
                    <stop offset="100%" stopColor="#059669" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: '#71717a', fontWeight: 700 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#a1a1aa' }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                  tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v)}
                />
                <Tooltip content={<ChartTooltip />} />
                <Bar
                  dataKey="ingresos"
                  name="Ingresos"
                  radius={[10, 10, 4, 4]}
                  maxBarSize={48}
                  cursor="pointer"
                  onClick={(data) => {
                    if (data?.date) setSelectedDate(data.date);
                  }}
                >
                  {weekData.map((entry) => (
                    <Cell
                      key={entry.date}
                      fill={entry.isSelected ? 'url(#gradWeekSel)' : 'url(#gradWeek)'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie pagos */}
        <div className="card-admin p-5">
          <h3 className="font-black text-admin-900 mb-1">Pago del día</h3>
          <p className="text-xs text-admin-500 mb-2">Efectivo vs tarjeta</p>
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={paymentPie}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={48}
                  outerRadius={78}
                  paddingAngle={3}
                  stroke="#fff"
                  strokeWidth={2}
                >
                  {paymentPie.map((entry, i) => (
                    <Cell
                      key={entry.name}
                      fill={
                        entry.name === 'Sin ventas'
                          ? '#e4e4e7'
                          : entry.name.includes('Efectivo')
                            ? '#f59e0b'
                            : '#0ea5e9'
                      }
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v, name) =>
                    name === 'Sin ventas' ? ['—', name] : [formatMoneyQ(v), name]
                  }
                />
                <Legend
                  verticalAlign="bottom"
                  height={28}
                  iconType="circle"
                  wrapperStyle={{ fontSize: 11, fontWeight: 700 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-1 text-center text-xs font-bold">
            <div className="rounded-xl bg-amber-50 border border-amber-100 py-2">
              <p className="text-amber-700">Efectivo</p>
              <p className="text-admin-900 text-sm">{formatMoneyQ(stats?.cashRevenue)}</p>
            </div>
            <div className="rounded-xl bg-sky-50 border border-sky-100 py-2">
              <p className="text-sky-700">POS</p>
              <p className="text-admin-900 text-sm">{formatMoneyQ(stats?.cardRevenue)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Estados + top productos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card-admin p-5">
          <h3 className="font-black text-admin-900 mb-1">Pedidos por estado</h3>
          <p className="text-xs text-admin-500 mb-3">Cómo van los pedidos del día</p>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={statusBars}
                layout="vertical"
                margin={{ top: 0, right: 16, left: 8, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: '#a1a1aa' }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={88}
                  tick={{ fontSize: 11, fill: '#52525b', fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<ChartTooltip money={false} />} />
                <Bar dataKey="cantidad" name="Cantidad" radius={[0, 8, 8, 0]} maxBarSize={22}>
                  {statusBars.map((s) => (
                    <Cell key={s.key} fill={s.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {Object.keys(STATUS_LABELS).map((key) => {
              const count = stats?.statusCounts?.[key] || 0;
              return (
                <span
                  key={key}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${STATUS_COLORS[key]}`}
                >
                  {STATUS_LABELS[key]} {count}
                </span>
              );
            })}
          </div>
        </div>

        <div className="card-admin p-5">
          <h3 className="font-black text-admin-900 mb-1">Top productos</h3>
          <p className="text-xs text-admin-500 mb-3">Unidades vendidas del día</p>
          {!productBars.length ? (
            <p className="text-sm text-admin-400 py-16 text-center">Sin ventas de productos</p>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={productBars}
                  layout="vertical"
                  margin={{ top: 0, right: 16, left: 4, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="gradProd" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#ea580c" />
                      <stop offset="100%" stopColor="#fb923c" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: '#a1a1aa' }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={100}
                    tick={{ fontSize: 11, fill: '#3f3f46', fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const row = payload[0].payload;
                      return (
                        <div className="rounded-xl bg-ink-950 text-white px-3 py-2 shadow-xl text-xs">
                          <p className="font-black text-primary-300">{row.fullName}</p>
                          <p className="mt-1">{row.unidades} u. · {formatMoneyQ(row.ingresos)}</p>
                        </div>
                      );
                    }}
                  />
                  <Bar
                    dataKey="unidades"
                    name="Unidades"
                    fill="url(#gradProd)"
                    radius={[0, 8, 8, 0]}
                    maxBarSize={24}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Resumen rápido */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card-admin p-4 text-center">
          <p className="text-[10px] font-bold uppercase text-admin-400">Entregados</p>
          <p className="text-xl font-black text-emerald-600">{stats?.delivered ?? 0}</p>
        </div>
        <div className="card-admin p-4 text-center">
          <p className="text-[10px] font-bold uppercase text-admin-400">En proceso</p>
          <p className="text-xl font-black text-admin-900">
            {(stats?.totalOrders ?? 0) - (stats?.delivered ?? 0) - (stats?.cancelled ?? 0)}
          </p>
        </div>
        <div className="card-admin p-4 text-center">
          <p className="text-[10px] font-bold uppercase text-admin-400">Semana</p>
          <p className="text-xl font-black text-primary-600">{formatMoneyQ(stats?.weekRevenue)}</p>
        </div>
        <div className="card-admin p-4 text-center">
          <p className="text-[10px] font-bold uppercase text-admin-400">Histórico</p>
          <p className="text-xl font-black text-admin-900">{stats?.allTimeOrders ?? 0}</p>
        </div>
      </div>

      {/* Zonas */}
      {stats?.topZones?.length > 0 && (
        <div className="card-admin p-5">
          <h3 className="font-black text-admin-900 mb-3">Zonas del día</h3>
          <div className="flex flex-wrap gap-2">
            {stats.topZones.map((z, i) => (
              <span
                key={z.name}
                className="text-xs font-bold bg-white border border-admin-200 px-3 py-1.5 rounded-full text-admin-700"
                style={{ borderColor: PIE_COLORS[i % PIE_COLORS.length] + '55' }}
              >
                📍 {z.name} · {z.count}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tabla pedidos */}
      <div className="card-admin overflow-hidden">
        <div className="p-5 border-b border-admin-100 flex items-center justify-between">
          <div>
            <h3 className="font-black text-admin-900">Pedidos del día</h3>
            <p className="text-xs text-admin-500">{stats?.orders?.length || 0} registros</p>
          </div>
          <Link href="/admin/orders" className="text-xs font-bold text-primary-700 hover:underline">
            Ver todos →
          </Link>
        </div>
        {!stats?.orders?.length ? (
          <div className="p-10 text-center">
            <div className="text-4xl mb-2">🌿</div>
            <p className="text-admin-700 font-bold">Sin pedidos este día</p>
            <p className="text-admin-400 text-sm mt-1">Cuando entre uno, se llena el gráfico y la tabla</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-admin-50 text-left text-xs font-bold uppercase tracking-wide text-admin-500">
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Hora</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Zona</th>
                  <th className="px-4 py-3">Pago</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {stats.orders.map((o) => (
                  <tr key={o.id} className="border-t border-admin-100 hover:bg-primary-50/30">
                    <td className="px-4 py-3 font-black text-admin-900">#{o.shortId}</td>
                    <td className="px-4 py-3 text-admin-600 whitespace-nowrap">
                      {formatGtTime(o.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-admin-900">{o.customerName || '—'}</p>
                      {o.phone && <p className="text-xs text-admin-400">{o.phone}</p>}
                    </td>
                    <td className="px-4 py-3 text-admin-600 max-w-[140px] truncate">
                      {o.zone || '—'}
                    </td>
                    <td className="px-4 py-3">
                      {o.paymentMethod === 'cash' ? '💵 Efectivo' : '💳 POS'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                          STATUS_COLORS[o.status] || 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {STATUS_LABELS[o.status] || o.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-black text-primary-700 tabular-nums">
                      {formatMoneyQ(o.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
