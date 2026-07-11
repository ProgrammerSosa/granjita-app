'use client';

import { useState, useEffect } from 'react';
import { fetchAllOrders, updateOrderStatus } from '@/lib/api';

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pendiente', color: 'badge-yellow' },
  { value: 'confirmed', label: 'Confirmado', color: 'badge-blue' },
  { value: 'preparing', label: 'Preparando', color: 'badge-blue' },
  { value: 'in_transit', label: 'En camino', color: 'badge-blue' },
  { value: 'delivered', label: 'Entregado', color: 'badge-green' },
  { value: 'cancelled', label: 'Cancelado', color: 'badge-red' },
];

const PAYMENT_LABELS = {
  cash: '💵 Efectivo',
  card: '💳 Tarjeta',
};

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);

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
      await updateOrderStatus(orderId, { orderStatus: newStatus });
      await loadOrders();
    } catch (err) {
      alert('Error al actualizar: ' + err.message);
    } finally {
      setUpdatingId(null);
    }
  }

  function getStatusInfo(status) {
    return STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0];
  }

  function formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  }

  const totalDelivered = orders.filter(o => o.orderStatus === 'delivered').reduce((s, o) => s + o.total, 0);
  const totalPending = orders.filter(o => ['pending', 'confirmed', 'preparing', 'in_transit'].includes(o.orderStatus)).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black text-admin-900">Pedidos</h1>
          <p className="text-admin-500 text-sm mt-0.5">{orders.length} pedidos encontrados</p>
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
          <p className="text-admin-500 text-xs font-medium">Entregados</p>
          <p className="text-xl font-black text-admin-900">
            Q {totalDelivered.toLocaleString('es-GT')}
          </p>
        </div>
        <div className="card-admin p-4 hover:shadow-md transition-shadow">
          <p className="text-admin-500 text-xs font-medium">Pendientes</p>
          <p className="text-xl font-black text-yellow-600">{totalPending}</p>
        </div>
        <div className="card-admin p-4 hover:shadow-md transition-shadow">
          <p className="text-admin-500 text-xs font-medium">Total</p>
          <p className="text-xl font-black text-admin-900">{orders.length}</p>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        <button
          onClick={() => setFilterStatus('')}
          className={`flex-shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            filterStatus === '' ? 'bg-admin-800 text-white shadow-sm' : 'bg-admin-200 text-admin-600 hover:bg-admin-300'
          }`}
        >
          Todos
        </button>
        {STATUS_OPTIONS.map(s => (
          <button
            key={s.value}
            onClick={() => setFilterStatus(s.value)}
            className={`flex-shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterStatus === s.value ? 'bg-admin-800 text-white shadow-sm' : 'bg-admin-200 text-admin-600 hover:bg-admin-300'
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
          <p className="text-admin-400 text-sm mt-1">Los pedidos aparecerán cuando los clientes hagan pedidos</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {orders.map(order => {
            const statusInfo = getStatusInfo(order.orderStatus);
            const isExpanded = expandedOrder === order._id;
            return (
              <div key={order._id} className="card-admin overflow-hidden">
                <button
                  onClick={() => setExpandedOrder(isExpanded ? null : order._id)}
                  className="w-full text-left p-4 hover:bg-admin-50/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-admin-900 text-sm">
                            #{order._id.toString().slice(-6).toUpperCase()}
                          </span>
                          <span className={statusInfo.color}>{statusInfo.label}</span>
                        </div>
                        <p className="text-admin-500 text-xs mt-0.5">
                          {order.customer.name} — {formatDate(order.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-black text-admin-900">Q {order.total.toLocaleString('es-GT')}</p>
                        <p className="text-admin-500 text-xs">{PAYMENT_LABELS[order.paymentMethod]}</p>
                      </div>
                      <svg className={`w-4 h-4 text-admin-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-admin-200 p-4 space-y-4 animate-fade-in">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <h4 className="text-xs font-bold text-admin-500 uppercase tracking-wider mb-2">Cliente</h4>
                        <div className="bg-admin-50 rounded-xl p-3.5 text-sm space-y-1.5 border border-admin-100">
                          <p><strong>Nombre:</strong> {order.customer.name}</p>
                          <p><strong>Teléfono:</strong> {order.customer.phone}</p>
                          <p><strong>Dirección:</strong> {order.customer.address}</p>
                          {order.customer.notes && (
                            <p><strong>Notas:</strong> {order.customer.notes}</p>
                          )}
                        </div>
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-admin-500 uppercase tracking-wider mb-2">Productos</h4>
                        <div className="bg-admin-50 rounded-xl p-3.5 text-sm space-y-1.5 border border-admin-100">
                          {order.items.map((item, i) => (
                            <div key={i} className="flex justify-between">
                              <span className="text-admin-700">{item.quantity}x {item.productName}
                                {item.variant?.name ? ` (${item.variant.name})` : ''}
                              </span>
                              <span className="font-semibold text-admin-900">Q {item.subtotal.toLocaleString('es-GT')}</span>
                            </div>
                          ))}
                          <div className="border-t border-admin-200 pt-2 mt-2 flex justify-between font-black">
                            <span>Total</span>
                            <span>Q {order.total.toLocaleString('es-GT')}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs font-bold text-admin-500 uppercase tracking-wider mb-2">Cambiar estado</h4>
                      <div className="flex flex-wrap gap-2">
                        {STATUS_OPTIONS.map(s => (
                          <button
                            key={s.value}
                            onClick={() => handleStatusChange(order._id, s.value)}
                            disabled={updatingId === order._id || order.orderStatus === s.value}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                              order.orderStatus === s.value
                                ? 'bg-admin-800 text-white shadow-sm'
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
