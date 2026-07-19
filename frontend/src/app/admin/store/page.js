'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchAdminStoreSettings,
  setStoreClosed,
  toggleStoreDay,
  setStoreMinOrder,
  fetchAdminStats,
  formatMoney,
} from '@/lib/api';
import useToastStore from '@/store/useToastStore';

const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTHS = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const STATUS_LABELS = {
  pending: 'Pendiente',
  confirmed: 'Confirmado',
  preparing: 'Preparando',
  in_transit: 'En camino',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};

function toDateStr(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function buildMonthCells(year, month) {
  const first = new Date(year, month, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, dateStr: toDateStr(year, month, d) });
  }
  return cells;
}

export default function AdminStorePage() {
  const now = new Date();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState(
    toDateStr(now.getFullYear(), now.getMonth(), now.getDate())
  );
  const [dayStats, setDayStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [restReason, setRestReason] = useState('');
  const [closeReason, setCloseReason] = useState('');
  const [minOrderInput, setMinOrderInput] = useState('15');
  const [busy, setBusy] = useState(false);

  const toast = useToastStore((s) => s.success);
  const toastError = useToastStore((s) => s.error);
  const askConfirm = useToastStore((s) => s.askConfirm);

  const restMap = useMemo(() => {
    const m = {};
    (data?.restDays || []).forEach((r) => {
      m[r.date] = r;
    });
    return m;
  }, [data]);

  const openMap = useMemo(() => {
    const m = {};
    (data?.openDays || []).forEach((r) => {
      m[r.date] = r;
    });
    return m;
  }, [data]);

  const todayStr = data?.status?.today || toDateStr(now.getFullYear(), now.getMonth(), now.getDate());

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const d = await fetchAdminStoreSettings();
      setData(d);
      setMinOrderInput(String(d.minOrder ?? 15));
      setCloseReason(d.forceClosedReason || '');
    } catch (err) {
      toastError?.(err.message || 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }, [toastError]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!selectedDate) return;
    let alive = true;
    async function loadStats() {
      setStatsLoading(true);
      try {
        const stats = await fetchAdminStats(selectedDate);
        if (alive) setDayStats(stats);
      } catch {
        if (alive) setDayStats(null);
      } finally {
        if (alive) setStatsLoading(false);
      }
    }
    loadStats();
    return () => {
      alive = false;
    };
  }, [selectedDate]);

  const cells = useMemo(() => buildMonthCells(viewYear, viewMonth), [viewYear, viewMonth]);

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else setViewMonth((m) => m - 1);
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else setViewMonth((m) => m + 1);
  }

  function dayMeta(dateStr) {
    const rest = restMap[dateStr];
    const special = openMap[dateStr];
    const [y, m, d] = dateStr.split('-').map(Number);
    const weekday = new Date(y, m - 1, d).getDay();
    const isSunday = weekday === 0;
    if (rest) return { type: 'rest', rest, special, isSunday };
    if (isSunday && special) return { type: 'sunday_open', rest, special, isSunday };
    if (isSunday) return { type: 'sunday', rest, special, isSunday };
    return { type: 'open', rest, special, isSunday };
  }

  async function handleToggleDay() {
    if (!selectedDate) return;
    const meta = dayMeta(selectedDate);

    let title = 'Actualizar día';
    let message = '';
    let confirmLabel = 'Confirmar';
    let danger = false;

    if (meta.type === 'rest') {
      title = 'Abrir este día';
      message = `Se quita el descanso del ${selectedDate}. Se usará el horario normal.`;
      confirmLabel = 'Abrir día';
    } else if (meta.type === 'sunday') {
      title = 'Habilitar domingo';
      message = `El ${selectedDate} se abrirá con el horario normal (10:30–15:00 y 16:00–20:00).`;
      confirmLabel = 'Habilitar domingo';
    } else if (meta.type === 'sunday_open') {
      title = 'Cerrar este domingo';
      message = `Se desactiva la apertura especial del ${selectedDate}. Volverá a estar cerrado.`;
      confirmLabel = 'Cerrar domingo';
      danger = true;
    } else {
      title = 'Cerrar este día';
      message = `El ${selectedDate} no se aceptarán pedidos (descanso planificado).`;
      confirmLabel = 'Cerrar día';
      danger = true;
    }

    const ok = await askConfirm({ title, message, confirmLabel, danger });
    if (!ok) return;

    setBusy(true);
    try {
      const d = await toggleStoreDay(selectedDate, restReason || '');
      setData(d);
      setRestReason('');
      const action = d.action;
      if (action === 'opened_special') toast(`Domingo habilitado · ${selectedDate}`);
      else if (action === 'closed_special') toast(`Domingo cerrado · ${selectedDate}`);
      else if (action === 'added_rest') toast(`Descanso · ${selectedDate}`);
      else toast(`Día actualizado · ${selectedDate}`);
    } catch (err) {
      toastError(err.message || 'Error');
    } finally {
      setBusy(false);
    }
  }

  async function handleForceClose(closed) {
    if (closed) {
      const ok = await askConfirm({
        title: 'Cerrar tienda YA',
        message:
          'Pausa todos los pedidos de inmediato, aunque sea horario de atención. Podés reabrir cuando quieras.',
        confirmLabel: 'Cerrar ahora',
        danger: true,
      });
      if (!ok) return;
    }
    setBusy(true);
    try {
      const d = await setStoreClosed(closed, closeReason);
      setData(d);
      toast(closed ? 'Pedidos pausados' : 'Reabierta según horario');
    } catch (err) {
      toastError(err.message || 'Error');
    } finally {
      setBusy(false);
    }
  }

  async function handleMinOrder(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await setStoreMinOrder(Number(minOrderInput));
      toast(`Pedido mínimo: Q ${minOrderInput}`);
      await load();
    } catch (err) {
      toastError(err.message || 'Error');
    } finally {
      setBusy(false);
    }
  }

  const selectedMeta = selectedDate ? dayMeta(selectedDate) : null;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-admin-200 rounded-lg w-56 animate-pulse" />
        <div className="h-64 bg-admin-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  const status = data?.status;

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-black text-admin-900">Calendario y control</h1>
        <p className="text-admin-500 text-sm mt-0.5">
          Tocá un día para ver estadísticas, cerrarlo o reabrirlo. Entrega solo en residenciales de
          San José Pinula.
        </p>
      </div>

      {/* Estado live */}
      <div
        className={`card-admin p-5 border-2 ${
          status?.open ? 'border-emerald-300 bg-emerald-50/40' : 'border-amber-300 bg-amber-50/40'
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-admin-500 mb-1">
              Ahora mismo
            </p>
            <p className="text-lg font-black text-admin-900">
              {status?.open ? '🟢 Aceptando pedidos' : '🔴 No acepta pedidos'}
            </p>
            <p className="text-sm text-admin-600 mt-1 max-w-xl">{status?.message}</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className="bg-white border border-admin-200 px-2.5 py-1 rounded-full">
              {status?.hoursLabel}
            </span>
            <span className="bg-white border border-admin-200 px-2.5 py-1 rounded-full">
              {status?.workDaysLabel}
            </span>
            <span className="bg-white border border-admin-200 px-2.5 py-1 rounded-full">
              Mín. {formatMoney(data?.minOrder ?? 15)}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Calendario */}
        <div className="lg:col-span-3 card-admin p-5">
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={prevMonth}
              className="p-2 rounded-xl hover:bg-admin-100 font-bold text-admin-700"
              aria-label="Mes anterior"
            >
              ‹
            </button>
            <h2 className="font-black text-admin-900">
              {MONTHS[viewMonth]} {viewYear}
            </h2>
            <button
              type="button"
              onClick={nextMonth}
              className="p-2 rounded-xl hover:bg-admin-100 font-bold text-admin-700"
              aria-label="Mes siguiente"
            >
              ›
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1.5 mb-2">
            {WEEKDAYS.map((w) => (
              <div
                key={w}
                className="text-center text-[10px] font-bold uppercase tracking-wide text-admin-400 py-1"
              >
                {w}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {cells.map((cell, i) => {
              if (!cell) return <div key={`e-${i}`} className="aspect-square" />;
              const meta = dayMeta(cell.dateStr);
              const selected = selectedDate === cell.dateStr;
              const isToday = cell.dateStr === todayStr;

              let bg = 'bg-white border-admin-200 hover:border-primary-400 text-admin-900';
              if (meta.type === 'rest') {
                bg = 'bg-red-50 border-red-300 text-red-800 hover:border-red-500';
              } else if (meta.type === 'sunday_open') {
                bg = 'bg-sky-50 border-sky-300 text-sky-900 hover:border-sky-500';
              } else if (meta.type === 'sunday') {
                bg = 'bg-admin-100 border-admin-200 text-admin-400';
              } else {
                bg = 'bg-emerald-50/60 border-emerald-200 text-emerald-900 hover:border-emerald-400';
              }
              if (selected) bg += ' ring-2 ring-primary-500 ring-offset-1';

              return (
                <button
                  key={cell.dateStr}
                  type="button"
                  onClick={() => setSelectedDate(cell.dateStr)}
                  className={`aspect-square rounded-xl border text-sm font-bold transition-all flex flex-col items-center justify-center relative ${bg}`}
                  title={
                    meta.type === 'rest'
                      ? meta.rest?.reason || 'Descanso'
                      : meta.type === 'sunday_open'
                        ? 'Domingo habilitado'
                        : meta.type === 'sunday'
                          ? 'Domingo cerrado — tocá para habilitar'
                          : 'Abierto según horario'
                  }
                >
                  <span>{cell.day}</span>
                  {meta.type === 'rest' && (
                    <span className="text-[9px] font-semibold leading-none mt-0.5">Cerrado</span>
                  )}
                  {meta.type === 'sunday_open' && (
                    <span className="text-[9px] font-semibold leading-none mt-0.5">Esp.</span>
                  )}
                  {isToday && (
                    <span className="absolute bottom-1 w-1 h-1 rounded-full bg-primary-600" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-3 mt-4 text-[11px] font-semibold text-admin-500">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300" /> Abierto
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-red-50 border border-red-300" /> Descanso
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-admin-100 border border-admin-200" /> Domingo
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-sky-50 border border-sky-300" /> Domingo especial
            </span>
          </div>
        </div>

        {/* Panel del día */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card-admin p-5 space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-admin-400">Día elegido</p>
            <h3 className="text-xl font-black text-admin-900">{selectedDate}</h3>
            <p className="text-sm text-admin-600">
              {selectedMeta?.type === 'rest' && (
                <span className="text-red-700 font-bold">
                  🔴 Cerrado — {selectedMeta.rest?.reason || 'Descanso planificado'}
                </span>
              )}
              {selectedMeta?.type === 'sunday' && (
                <span className="text-admin-500 font-bold">
                  ⚫ Domingo cerrado — podés habilitarlo
                </span>
              )}
              {selectedMeta?.type === 'sunday_open' && (
                <span className="text-sky-700 font-bold">
                  🔵 Domingo especial abierto —{' '}
                  {selectedMeta.special?.reason || 'horario normal'}
                </span>
              )}
              {selectedMeta?.type === 'open' && (
                <span className="text-emerald-700 font-bold">
                  🟢 Abierto según horario ({status?.hoursLabel})
                </span>
              )}
            </p>

            {(selectedMeta?.type === 'open' || selectedMeta?.type === 'sunday') && (
              <input
                type="text"
                value={restReason}
                onChange={(e) => setRestReason(e.target.value)}
                placeholder={
                  selectedMeta?.type === 'sunday'
                    ? 'Motivo apertura especial (opcional)'
                    : 'Motivo al cerrar (opcional)'
                }
                className="input-admin"
                disabled={busy}
              />
            )}
            <button
              type="button"
              disabled={busy}
              onClick={handleToggleDay}
              className={
                selectedMeta?.type === 'rest' || selectedMeta?.type === 'sunday'
                  ? 'btn-admin w-full'
                  : 'btn-danger w-full text-sm py-2.5'
              }
            >
              {selectedMeta?.type === 'rest' && 'Abrir este día (quitar descanso)'}
              {selectedMeta?.type === 'sunday' && 'Habilitar este domingo'}
              {selectedMeta?.type === 'sunday_open' && 'Cerrar este domingo'}
              {selectedMeta?.type === 'open' && 'Cerrar este día (descanso)'}
            </button>
          </div>

          {/* Stats del día */}
          <div className="card-admin p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-admin-900">Estadísticas del día</h3>
              {statsLoading && (
                <span className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
              )}
            </div>

            {!dayStats && !statsLoading ? (
              <p className="text-sm text-admin-400">Sin datos para este día.</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-admin-50 border border-admin-200 p-3">
                    <p className="text-[10px] font-bold uppercase text-admin-400">Pedidos</p>
                    <p className="text-xl font-black text-admin-900">
                      {dayStats?.totalOrders ?? 0}
                    </p>
                  </div>
                  <div className="rounded-xl bg-primary-50 border border-primary-200 p-3">
                    <p className="text-[10px] font-bold uppercase text-primary-600">Ventas</p>
                    <p className="text-xl font-black text-primary-800">
                      {formatMoney(dayStats?.totalRevenue ?? 0)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-admin-50 border border-admin-200 p-3">
                    <p className="text-[10px] font-bold uppercase text-admin-400">Ticket prom.</p>
                    <p className="text-lg font-black text-admin-900">
                      {formatMoney(dayStats?.avgTicket ?? 0)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-admin-50 border border-admin-200 p-3">
                    <p className="text-[10px] font-bold uppercase text-admin-400">Entregados</p>
                    <p className="text-lg font-black text-admin-900">
                      {dayStats?.delivered ?? 0}
                      <span className="text-xs font-semibold text-admin-400 ml-1">
                        · {dayStats?.cancelled ?? 0} canc.
                      </span>
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 text-xs font-semibold text-admin-600">
                  <span>💵 Efectivo: {dayStats?.cashOrders ?? 0}</span>
                  <span>💳 Tarjeta: {dayStats?.cardOrders ?? 0}</span>
                </div>

                {dayStats?.statusCounts && Object.keys(dayStats.statusCounts).length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(dayStats.statusCounts).map(([k, v]) => (
                      <span
                        key={k}
                        className="text-[10px] font-bold bg-white border border-admin-200 px-2 py-0.5 rounded-full"
                      >
                        {STATUS_LABELS[k] || k}: {v}
                      </span>
                    ))}
                  </div>
                )}

                {dayStats?.topProducts?.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-admin-400 uppercase mb-1.5">
                      Top productos
                    </p>
                    <ul className="space-y-1">
                      {dayStats.topProducts.slice(0, 5).map((p) => (
                        <li
                          key={p._id}
                          className="flex justify-between text-xs text-admin-700 font-medium"
                        >
                          <span className="truncate pr-2">{p._id}</span>
                          <span className="shrink-0">
                            {p.totalSold} · {formatMoney(p.totalRevenue)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {dayStats?.topZones?.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-admin-400 uppercase mb-1.5">
                      Zonas del día
                    </p>
                    <ul className="space-y-1">
                      {dayStats.topZones.map((z) => (
                        <li
                          key={z.name}
                          className="flex justify-between text-xs text-admin-700 font-medium"
                        >
                          <span className="truncate pr-2">{z.name}</span>
                          <span>{z.count}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {dayStats?.orders?.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-admin-400 uppercase mb-1.5">
                      Pedidos ({dayStats.orders.length})
                    </p>
                    <ul className="max-h-40 overflow-y-auto space-y-1.5 admin-scroll">
                      {dayStats.orders.map((o) => (
                        <li
                          key={o.id}
                          className="text-xs flex justify-between gap-2 border-b border-admin-100 pb-1"
                        >
                          <span className="font-bold">#{o.shortId}</span>
                          <span className="truncate text-admin-500">
                            {o.customerName}
                            {o.zone ? ` · ${o.zone}` : ''}
                          </span>
                          <span className="font-semibold shrink-0">{formatMoney(o.total)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Emergencia + mínimo + zonas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="card-admin p-5 space-y-3">
          <h2 className="font-black text-admin-900">Cierre de emergencia</h2>
          <p className="text-sm text-admin-500">
            Cierra YA sin importar el calendario (imprevisto, stock, clima…).
          </p>
          <input
            type="text"
            value={closeReason}
            onChange={(e) => setCloseReason(e.target.value)}
            placeholder="Motivo"
            className="input-admin"
            disabled={busy}
          />
          {!data?.forceClosed ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => handleForceClose(true)}
              className="btn-danger text-sm py-2.5 px-5"
            >
              Cerrar pedidos ahora
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => handleForceClose(false)}
              className="btn-admin text-sm py-2.5 px-5"
            >
              Reabrir según horario
            </button>
          )}
        </div>

        <div className="card-admin p-5 space-y-3">
          <h2 className="font-black text-admin-900">Pedido mínimo</h2>
          <form onSubmit={handleMinOrder} className="flex flex-wrap gap-2 items-center">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-admin-400">
                Q
              </span>
              <input
                type="number"
                min="0"
                step="1"
                value={minOrderInput}
                onChange={(e) => setMinOrderInput(e.target.value)}
                className="input-admin pl-8 w-32"
                disabled={busy}
              />
            </div>
            <button type="submit" disabled={busy} className="btn-admin">
              Guardar
            </button>
          </form>
          <p className="text-xs text-admin-400">Por defecto Q 15.</p>
        </div>
      </div>

      <div className="card-admin p-5">
        <h2 className="font-black text-admin-900 mb-1">Zona de entrega</h2>
        <p className="text-sm text-admin-600 mb-3">
          Solo <strong>zonas residenciales de San José Pinula</strong>. El cliente elige su
          residencial en el checkout; si no está en la lista, no puede pedir.
        </p>
        <p className="text-xs text-admin-400">
          Horario fijo: 10:30 am–3:00 pm y 4:00 pm–8:00 pm · Lun–Sáb · Domingos cerrados
        </p>
      </div>
    </div>
  );
}
