'use client';

import { useState, useEffect } from 'react';
import {
  fetchAllOrders,
  updateOrderStatus,
  recordCashPayment,
  formatMoney,
  getInvoicePdfUrl,
  resendOrderWhatsApp,
} from '@/lib/api';
import useToastStore from '@/store/useToastStore';
import { formatBillsSummary } from '@/lib/bills';
import { OrderActions } from '@/components/OrderEditTools';

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Nuevo', color: 'badge-yellow' },
  { value: 'confirmed', label: 'Confirmado', color: 'badge-blue' },
  { value: 'preparing', label: 'En proceso', color: 'badge-blue' },
  { value: 'in_transit', label: 'En camino', color: 'badge-blue' },
  { value: 'delivered', label: 'Entregado', color: 'badge-green' },
  { value: 'cancelled', label: 'Cancelado', color: 'badge-red' },
];

/** Fecha de hoy en horario de Guatemala (YYYY-MM-DD) — no UTC */
function gtToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Guatemala',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** Resumen corto del flujo de trabajo (se muestra arriba en Pedidos) */
const FLOW_SUMMARY = [
  { icon: '🆕', name: 'Nuevo', desc: 'Entra el pedido. Se le avisa al cliente que un proveedor lo revisará.' },
  { icon: '✅', name: 'Confirmado', desc: 'El proveedor revisa el stock. Acá modificás o avisás si falta algo.' },
  { icon: '👨‍🍳', name: 'En proceso', desc: 'Se manda la factura al cliente. El pedido queda cerrado (no se edita).' },
  { icon: '🛵', name: 'En camino', desc: 'El pedido salió a ruta. Se le avisa al cliente.' },
  { icon: '🎉', name: 'Entregado', desc: '¡Llegó! Se manda un saludo y la invitación a pedir de nuevo.' },
];

const PAYMENT_LABELS = {
  cash: '💵 Efectivo al entregar',
  card: '💳 Terminal en casa',
};

/** Panel SOLO LECTURA: lo que el cliente dijo + vuelto a llevar */
function ClientCashReadOnly({ order, onConfirmPaid, saving }) {
  const intent = order.cashIntent;
  const paid = order.cashPayment?.amountTendered > 0;

  if (!intent?.amountTendered) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        Este pedido en efectivo no tiene billetes declarados por el cliente.
      </div>
    );
  }

  if (paid) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">✅</span>
          <p className="font-black text-emerald-900 text-sm">Cobro confirmado</p>
        </div>
        <p className="text-sm text-emerald-800">
          <strong>Pagó con:</strong> {formatBillsSummary(order.cashPayment.bills)}
        </p>
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="bg-white/80 rounded-xl p-2">
            <p className="text-emerald-600 font-medium">Total</p>
            <p className="font-black text-emerald-950">{formatMoney(order.total)}</p>
          </div>
          <div className="bg-white/80 rounded-xl p-2">
            <p className="text-emerald-600 font-medium">Entregó</p>
            <p className="font-black text-emerald-950">
              {formatMoney(order.cashPayment.amountTendered)}
            </p>
          </div>
          <div className="bg-white/80 rounded-xl p-2">
            <p className="text-emerald-600 font-medium">Vuelto</p>
            <p className="font-black text-emerald-950">
              {formatMoney(order.cashPayment.change)}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border-2 border-primary-400 bg-ink-950 text-white overflow-hidden">
      <div className="bg-gradient-to-r from-primary-600 to-primary-500 px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-ink-950/70">
          💰 Dinero · lo definió el cliente (no editable)
        </p>
        <p className="font-black text-ink-950 text-lg leading-tight">
          Total a cobrar {formatMoney(order.total)}
        </p>
      </div>
      <div className="p-4 space-y-3">
        <p className="text-sm font-bold">
          Cliente paga con:{' '}
          <span className="text-primary-300">{formatBillsSummary(intent.bills)}</span>
        </p>
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-xl bg-ink-900 border border-ink-700 p-3">
            <p className="text-ink-400">Cobrar</p>
            <p className="font-black text-white text-base">{formatMoney(order.total)}</p>
          </div>
          <div className="rounded-xl bg-ink-900 border border-ink-700 p-3">
            <p className="text-ink-400">Te entrega</p>
            <p className="font-black text-primary-300 text-base">
              {formatMoney(intent.amountTendered)}
            </p>
          </div>
          <div className="rounded-xl bg-ink-900 border border-emerald-700/60 p-3">
            <p className="text-emerald-400/90">Vuelto a llevar</p>
            <p className="font-black text-emerald-400 text-lg">
              {intent.change > 0 ? formatMoney(intent.change) : 'Q0'}
            </p>
          </div>
        </div>
        {intent.change > 0 ? (
          <p className="text-center text-sm font-black text-emerald-300">
            ⚠️ Llevá vuelto cabal de {formatMoney(intent.change)}
          </p>
        ) : (
          <p className="text-center text-sm font-bold text-ink-300">
            ✓ Pago cabal — no hace falta vuelto
          </p>
        )}
        <p className="text-[11px] text-ink-400 text-center">
          El admin no puede cambiar este monto. Lo eligió el cliente en el checkout.
        </p>
        <button
          type="button"
          disabled={saving}
          onClick={onConfirmPaid}
          className="w-full py-3 rounded-xl font-black text-sm bg-primary-500 text-ink-950 hover:bg-primary-400 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Guardando…' : '✅ Confirmar cobrado (según billetes del cliente)'}
        </button>
      </div>
    </div>
  );
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [selectedDate, setSelectedDate] = useState(gtToday());
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [savingCash, setSavingCash] = useState(false);
  const [resending, setResending] = useState(null);
  const toastSuccess = useToastStore((s) => s.success);
  const toastError = useToastStore((s) => s.error);

  useEffect(() => {
    loadOrders();
  }, [filterStatus, selectedDate]);

  async function loadOrders() {
    try {
      setLoading(true);
      const data = await fetchAllOrders({
        status: filterStatus || undefined,
        date: selectedDate || undefined,
      });
      setOrders(data.data);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(orderId, newStatus) {
    try {
      setUpdatingId(orderId);
      const updated = await updateOrderStatus(orderId, { orderStatus: newStatus });
      if (newStatus === 'in_transit' && updated?.invoice?.number) {
        toastSuccess(`En camino · Factura ${updated.invoice.number}`);
      } else {
        toastSuccess('Estado actualizado');
      }
      await loadOrders();
    } catch (err) {
      toastError('Error al actualizar: ' + err.message);
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleConfirmClientCash(orderId) {
    try {
      setSavingCash(true);
      const updated = await recordCashPayment(orderId, { useClientIntent: true });
      const ch = updated?.cashPayment?.change || 0;
      toastSuccess(
        ch > 0
          ? `Cobro OK · vuelto entregado ${formatMoney(ch)}`
          : 'Cobro cabal registrado'
      );
      await loadOrders();
    } catch (err) {
      toastError(err.message || 'No se pudo registrar el cobro');
    } finally {
      setSavingCash(false);
    }
  }

  async function handleResendWa(orderId) {
    try {
      setResending(orderId);
      const r = await resendOrderWhatsApp(orderId);
      if (r.whatsapp?.customer || r.whatsapp?.owner) {
        toastSuccess('WhatsApp + PDF reenviados');
      } else {
        toastError(r.whatsapp?.errors?.join(' · ') || 'Falló el reenvío');
      }
    } catch (e) {
      toastError(e.message);
    } finally {
      setResending(null);
    }
  }

  function getStatusInfo(status) {
    return STATUS_OPTIONS.find((s) => s.value === status) || STATUS_OPTIONS[0];
  }

  function formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' });
  }

  const totalDelivered = orders
    .filter((o) => o.orderStatus === 'delivered')
    .reduce((s, o) => s + o.total, 0);
  const totalPending = orders.filter((o) =>
    ['pending', 'confirmed', 'preparing', 'in_transit'].includes(o.orderStatus)
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <p className="section-label text-admin-400">Operaciones</p>
          <h1 className="text-2xl font-black text-admin-900">Pedidos</h1>
          <p className="text-admin-500 text-sm mt-0.5">
            {orders.length} pedidos · factura al pasar a "En proceso" · el cliente define el pago
          </p>
        </div>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="input-admin"
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="card-admin p-4 hover:shadow-md transition-shadow">
          <p className="text-admin-500 text-xs font-medium">Entregados (Q)</p>
          <p className="text-xl font-black text-admin-900">{formatMoney(totalDelivered)}</p>
        </div>
        <div className="card-admin p-4 hover:shadow-md transition-shadow">
          <p className="text-admin-500 text-xs font-medium">En proceso</p>
          <p className="text-xl font-black text-primary-600">{totalPending}</p>
        </div>
        <div className="card-admin p-4 hover:shadow-md transition-shadow">
          <p className="text-admin-500 text-xs font-medium">Total lista</p>
          <p className="text-xl font-black text-admin-900">{orders.length}</p>
        </div>
      </div>

      <details className="card-admin p-4 group" open>
        <summary className="flex items-center gap-2 cursor-pointer list-none font-black text-admin-900 text-sm select-none">
          <span className="text-lg">🔄</span>
          ¿Cómo funciona el flujo?
          <span className="ml-auto text-xs font-semibold text-admin-400 group-open:hidden">
            ver
          </span>
        </summary>
        <ol className="mt-3 space-y-2">
          {FLOW_SUMMARY.map((f, i) => (
            <li key={f.name} className="flex items-start gap-3 text-sm">
              <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-lg bg-admin-100 text-xs font-black text-admin-700">
                {i + 1}
              </span>
              <p className="text-admin-600 leading-relaxed">
                <span className="font-black text-admin-900">
                  {f.icon} {f.name}
                </span>{' '}
                — {f.desc}
              </p>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-primary-700 bg-primary-50 border border-primary-100 rounded-xl p-2.5 leading-relaxed">
          ✏️ <strong>Para modificar el pedido:</strong> tocá el pedido para abrirlo y usá el botón{' '}
          <strong>“Modificar pedido”</strong> del recuadro naranja. Solo se puede en{' '}
          <strong>Nuevo</strong> y <strong>Confirmado</strong> (antes de “En proceso”).
        </p>
      </details>

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        <button
          onClick={() => setFilterStatus('')}
          className={`flex-shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            filterStatus === ''
              ? 'bg-ink-900 text-white shadow-sm'
              : 'bg-admin-200 text-admin-600 hover:bg-admin-300'
          }`}
        >
          Todos
        </button>
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s.value}
            onClick={() => setFilterStatus(s.value)}
            className={`flex-shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterStatus === s.value
                ? 'bg-primary-500 text-ink-950 shadow-sm'
                : 'bg-admin-200 text-admin-600 hover:bg-admin-300'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-admin-200 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="card-admin p-10 text-center">
          <div className="w-16 h-16 bg-admin-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl opacity-50">📋</span>
          </div>
          <p className="text-admin-600 font-bold">No hay pedidos</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {orders.map((order) => {
            const statusInfo = getStatusInfo(order.orderStatus);
            const isExpanded = expandedOrder === order._id;
            const hasInvoice = !!order.invoice?.number;
            const showCash =
              order.paymentMethod === 'cash' &&
              !['cancelled'].includes(order.orderStatus);

            return (
              <div key={order._id} className="card-admin overflow-hidden">
                <button
                  onClick={() => setExpandedOrder(isExpanded ? null : order._id)}
                  className="w-full text-left p-4 hover:bg-admin-50/50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-admin-900 text-sm">
                          #{order._id.toString().slice(-6).toUpperCase()}
                        </span>
                        <span className={statusInfo.color}>{statusInfo.label}</span>
                        {hasInvoice && (
                          <span className="badge bg-ink-900 text-primary-400 font-mono text-[10px]">
                            {order.invoice.number}
                          </span>
                        )}
                        {order.paymentMethod === 'cash' && order.cashIntent?.change > 0 && (
                          <span className="badge bg-emerald-100 text-emerald-800 text-[10px]">
                            Vuelto {formatMoney(order.cashIntent.change)}
                          </span>
                        )}
                      </div>
                      <p className="text-admin-500 text-xs mt-0.5">
                        {order.customer.name} — {formatDate(order.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-black text-admin-900">{formatMoney(order.total)}</p>
                        <p className="text-admin-500 text-xs">
                          {PAYMENT_LABELS[order.paymentMethod]}
                        </p>
                      </div>
                      <svg
                        className={`w-4 h-4 text-admin-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-admin-200 p-4 space-y-4 animate-fade-in">
                    {hasInvoice ? (
                      <div className="rounded-2xl bg-ink-950 text-white p-4">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-primary-400">
                              Factura
                            </p>
                            <p className="font-black text-xl tracking-tight">
                              {order.invoice.number}
                            </p>
                            <p className="text-xs text-ink-400 mt-0.5">
                              Emitida{' '}
                              {new Date(order.invoice.issuedAt).toLocaleString('es-GT')}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-ink-400">Total a cobrar</p>
                            <p className="font-black text-primary-400 text-lg">
                              {formatMoney(order.total)}
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <a
                            href={getInvoicePdfUrl(order._id)}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-primary-500 text-ink-950"
                          >
                            📄 PDF
                          </a>
                          <button
                            type="button"
                            onClick={() => handleResendWa(order._id)}
                            disabled={resending === order._id}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-ink-800 text-white disabled:opacity-50"
                          >
                            {resending === order._id ? '…' : '📲 Reenviar WA + PDF'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-admin-300 bg-admin-50 p-3 text-sm text-admin-600">
                        La factura se genera al confirmar el pedido en la tienda.
                      </div>
                    )}

                    {/* DINERO — solo lectura del cliente */}
                    {showCash && (
                      <div>
                        <h4 className="text-xs font-bold text-admin-500 uppercase tracking-wider mb-2">
                          Dinero / billetes / vuelto
                        </h4>
                        <ClientCashReadOnly
                          order={order}
                          saving={savingCash}
                          onConfirmPaid={() => handleConfirmClientCash(order._id)}
                        />
                      </div>
                    )}

                    {order.paymentMethod === 'card' && (
                      <div className="rounded-xl bg-primary-50 border border-primary-200 p-3 text-sm text-primary-900">
                        <strong>💳 Terminal POS:</strong> el repartidor lleva el aparato. Cobrá{' '}
                        {formatMoney(order.total)} en la puerta.
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <h4 className="text-xs font-bold text-admin-500 uppercase tracking-wider mb-2">
                          Cliente
                        </h4>
                        <div className="bg-admin-50 rounded-xl p-3.5 text-sm space-y-1.5 border border-admin-100">
                          <p>
                            <strong>Nombre:</strong> {order.customer.name}
                          </p>
                          <p>
                            <strong>Teléfono:</strong> {order.customer.phone}
                          </p>
                          <p>
                            <strong>Dirección:</strong> {order.customer.address}
                          </p>
                          {order.customer.notes && (
                            <p>
                              <strong>Notas:</strong> {order.customer.notes}
                            </p>
                          )}
                        </div>
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-admin-500 uppercase tracking-wider mb-2">
                          Productos
                        </h4>
                        <div className="bg-admin-50 rounded-xl p-3.5 text-sm space-y-1.5 border border-admin-100">
                          {order.items.map((item, i) => {
                            const qtyLabel = item.unitType === 'weight'
                              ? `${Number(item.quantity).toFixed(1)} lb`
                              : `${item.quantity}x`;
                            return (
                            <div key={i} className="flex justify-between">
                              <span className="text-admin-700">
                                {qtyLabel} {item.productName}
                                {item.variant?.name ? ` (${item.variant.name})` : ''}
                              </span>
                              <span className="font-semibold text-admin-900">
                                {formatMoney(item.subtotal)}
                              </span>
                            </div>
                            );
                          })}
                          <div className="border-t border-admin-200 pt-2 mt-2 flex justify-between font-black">
                            <span>Total</span>
                            <span>{formatMoney(order.total)}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <OrderActions order={order} onChanged={loadOrders} />

                    <div>
                      <h4 className="text-xs font-bold text-admin-500 uppercase tracking-wider mb-2">
                        Cambiar estado
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {STATUS_OPTIONS.map((s) => (
                          <button
                            key={s.value}
                            onClick={() => handleStatusChange(order._id, s.value)}
                            disabled={updatingId === order._id || order.orderStatus === s.value}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                              order.orderStatus === s.value
                                ? 'bg-ink-900 text-primary-400 shadow-sm'
                                : 'bg-admin-100 text-admin-600 hover:bg-admin-200'
                            } disabled:opacity-50`}
                          >
                            {updatingId === order._id ? '...' : s.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
