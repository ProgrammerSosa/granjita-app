'use client';

import { useState, useEffect } from 'react';
import { fetchAllOrders, updateOrderStatus, updateOrderItems, fetchAdminProducts } from '@/lib/api';
import { AlertModal } from '@/components/ConfirmModal';
import { ClipboardIcon } from '@/lib/icons';

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pendiente', color: 'badge-yellow' },
  { value: 'confirmed', label: 'Confirmado', color: 'badge-blue' },
  { value: 'preparing', label: 'Preparando', color: 'badge-orange' },
  { value: 'in_transit', label: 'En camino', color: 'badge-blue' },
  { value: 'delivered', label: 'Entregado', color: 'badge-green' },
  { value: 'cancelled', label: 'Cancelado', color: 'badge-red' },
];

const PAYMENT_LABELS = {
  cash: 'Efectivo',
  card: 'Tarjeta',
};

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [error, setError] = useState('');
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertMsg, setAlertMsg] = useState('');

  const [editModal, setEditModal] = useState(false);
  const [editOrder, setEditOrder] = useState(null);
  const [editItems, setEditItems] = useState([]);
  const [saving, setSaving] = useState(false);

  const [allProducts, setAllProducts] = useState([]);
  const [showAddProduct, setShowAddProduct] = useState(false);


  useEffect(() => {
    loadOrders();
  }, [filterStatus, selectedDate]);

  async function loadOrders() {
    try {
      setLoading(true);
      setError('');
      const data = await fetchAllOrders({
        status: filterStatus || undefined,
        date: selectedDate || undefined,
      });
      setOrders(data.data);
    } catch (err) {
      setError(err.message);
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
      setAlertMsg(err.message);
      setAlertOpen(true);
    } finally {
      setUpdatingId(null);
    }
  }

  function openEditModal(order) {
    setEditOrder(order);
    setEditItems(order.items.map((item, i) => ({
      ...item,
      index: i,
    })));
    setEditModal(true);
    setShowAddProduct(false);
    loadAllProducts();
  }

  async function loadAllProducts() {
    try {
      const products = await fetchAdminProducts();
      setAllProducts(products);
    } catch (err) {
      console.error('Error cargando productos:', err);
    }
  }

  function updateEditItemQty(index, qty) {
    const newQty = Math.max(0.5, parseFloat(qty) || 1);
    setEditItems(prev => prev.map((item, i) =>
      i === index
        ? { ...item, quantity: newQty, subtotal: newQty * item.unitPrice }
        : item
    ));
  }

  function updateEditItemPrice(index, price) {
    const newPrice = Math.max(0, parseFloat(price) || 0);
    setEditItems(prev => prev.map((item, i) =>
      i === index
        ? { ...item, unitPrice: newPrice, subtotal: item.quantity * newPrice }
        : item
    ));
  }

  function removeEditItem(index) {
    setEditItems(prev => prev.filter((_, i) => i !== index));
  }

  function addProductToOrder(product) {
    const newItem = {
      product: product._id,
      productName: product.name,
      variant: { name: null, price: 0 },
      extras: [],
      quantity: 1,
      unitPrice: product.price,
      subtotal: product.price,
    };
    setEditItems(prev => [...prev, newItem]);
    setShowAddProduct(false);
  }

  async function saveEditItems() {
    if (!editOrder || editItems.length === 0) {
      setAlertMsg('El pedido debe tener al menos un producto');
      setAlertOpen(true);
      return;
    }
    try {
      setSaving(true);
      const itemsToSend = editItems.map(item => ({
        productId: item.product,
        productName: item.productName,
        variant: item.variant,
        extras: item.extras,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      }));
      await updateOrderItems(editOrder._id, itemsToSend);
      setEditModal(false);
      await loadOrders();
    } catch (err) {
      setAlertMsg(err.message);
      setAlertOpen(true);
    } finally {
      setSaving(false);
    }
  }

  function getStatusInfo(status) {
    return STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0];
  }

  function formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' });
  }

  function getUnavailableItems(order) {
    return order.items.filter(item => {
      const product = allProducts.find(p => p._id === item.product);
      return product && !product.available;
    });
  }

  const totalDelivered = orders.filter(o => o.orderStatus === 'delivered').reduce((s, o) => s + o.total, 0);
  const totalPending = orders.filter(o => ['pending', 'confirmed', 'preparing', 'in_transit'].includes(o.orderStatus)).length;

  const editSubtotal = editItems.reduce((sum, item) => sum + item.subtotal, 0);

  return (
    <div className="space-y-6">
      <AlertModal
        open={alertOpen}
        title="Mensaje"
        message={alertMsg}
        type="info"
        onClose={() => setAlertOpen(false)}
      />

      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => !saving && setEditModal(false)} />
          <div className="relative bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-black text-gray-900">Editar Pedido</h2>
                  <p className="text-xs text-gray-500">
                    #{editOrder?._id.toString().slice(-6).toUpperCase()}
                  </p>
                </div>
                <button onClick={() => !saving && setEditModal(false)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
                  <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {editItems.length === 0 && (
                <div className="text-center py-8 text-gray-400 text-sm">
                  No hay items. Agregue productos.
                </div>
              )}

              {editItems.map((item, i) => (
                <div key={i} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-sm font-semibold text-gray-900 flex-1">{item.productName}
                      {item.variant?.name ? ` (${item.variant.name})` : ''}
                    </span>
                    <button onClick={() => removeEditItem(i)}
                      className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center hover:bg-red-200 ml-2 flex-shrink-0">
                      <svg className="w-3 h-3 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <div>
                      <label className="text-xs text-gray-500">Cantidad</label>
                      <input type="number" step="0.5" min="0.5" value={item.quantity}
                        onChange={(e) => updateEditItemQty(i, e.target.value)}
                        className="w-20 input-field text-sm py-1.5 mt-0.5" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Precio unit.</label>
                      <input type="number" step="0.01" min="0" value={item.unitPrice}
                        onChange={(e) => updateEditItemPrice(i, e.target.value)}
                        className="w-24 input-field text-sm py-1.5 mt-0.5" />
                    </div>
                    <div className="text-right flex-1">
                      <label className="text-xs text-gray-500">Subtotal</label>
                      <p className="text-sm font-bold text-orange-600 mt-1.5">
                        Q {item.subtotal.toLocaleString('es-GT')}
                      </p>
                    </div>
                  </div>
                </div>
              ))}

              {showAddProduct ? (
                <div className="bg-orange-50 rounded-xl p-3 border border-orange-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-orange-700">Agregar producto</span>
                    <button onClick={() => setShowAddProduct(false)} className="text-xs text-orange-600 hover:text-orange-800 font-semibold">
                      Cancelar
                    </button>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {allProducts.filter(p => p.available).map(product => (
                      <button key={product._id} onClick={() => addProductToOrder(product)}
                        className="w-full text-left p-2 rounded-lg hover:bg-white transition-colors flex items-center justify-between">
                        <span className="text-sm text-gray-900">{product.name}</span>
                        <span className="text-sm font-bold text-orange-600">Q {product.price.toFixed(2)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowAddProduct(true)}
                  className="w-full py-2.5 border-2 border-dashed border-gray-300 rounded-xl text-sm font-semibold text-gray-500 hover:border-orange-400 hover:text-orange-600 transition-colors">
                  + Agregar producto
                </button>
              )}
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-semibold text-gray-600">Subtotal</span>
                <span className="text-lg font-black text-gray-900">Q {editSubtotal.toLocaleString('es-GT')}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => !saving && setEditModal(false)}
                  className="btn-outline flex-1 text-sm py-2.5" disabled={saving}>
                  Cancelar
                </button>
                <button onClick={saveEditItems} disabled={saving || editItems.length === 0}
                  className="btn-primary flex-1 text-sm py-2.5 flex items-center justify-center gap-2">
                  {saving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
                  Guardar cambios
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Pedidos</h1>
          <p className="text-gray-500 text-sm mt-0.5">{orders.length} pedidos encontrados</p>
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
          <p className="text-gray-500 text-xs font-medium">Entregados</p>
          <p className="text-xl font-black text-gray-900">
            Q {totalDelivered.toLocaleString('es-GT')}
          </p>
        </div>
        <div className="card-admin p-4 hover:shadow-md transition-shadow">
          <p className="text-gray-500 text-xs font-medium">Pendientes</p>
          <p className="text-xl font-black text-yellow-600">{totalPending}</p>
        </div>
        <div className="card-admin p-4 hover:shadow-md transition-shadow">
          <p className="text-gray-500 text-xs font-medium">Total</p>
          <p className="text-xl font-black text-gray-900">{orders.length}</p>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        <button
          onClick={() => setFilterStatus('')}
          className={`flex-shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            filterStatus === '' ? 'bg-gray-900 text-white shadow-sm' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
          }`}
        >
          Todos
        </button>
        {STATUS_OPTIONS.map(s => (
          <button
            key={s.value}
            onClick={() => setFilterStatus(s.value)}
            className={`flex-shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterStatus === s.value ? 'bg-gray-900 text-white shadow-sm' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-xl">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-200 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="card-admin p-10 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <ClipboardIcon className="w-8 h-8 text-gray-300" />
          </div>
          <p className="text-gray-600 font-bold">No hay pedidos</p>
          <p className="text-gray-400 text-sm mt-1">Los pedidos apareceran cuando los clientes hagan pedidos</p>
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
                  className="w-full text-left p-4 hover:bg-gray-50/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900 text-sm">
                            #{order._id.toString().slice(-6).toUpperCase()}
                          </span>
                          <span className={statusInfo.color}>{statusInfo.label}</span>
                        </div>
                        <p className="text-gray-500 text-xs mt-0.5">
                          {order.customer.name} — {formatDate(order.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-black text-gray-900">Q {order.total.toLocaleString('es-GT')}</p>
                        <p className="text-gray-500 text-xs">{PAYMENT_LABELS[order.paymentMethod]}</p>
                      </div>
                      <svg className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-200 p-4 space-y-4 animate-fade-in">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Cliente</h4>
                        <div className="bg-gray-50 rounded-xl p-3.5 text-sm space-y-1.5 border border-gray-100">
                          <p><strong>Nombre:</strong> {order.customer.name}</p>
                          <p><strong>Telefono:</strong> {order.customer.phone}</p>
                          <p><strong>Direccion:</strong> {order.customer.address}</p>
                          {order.customer.notes && (
                            <p><strong>Notas:</strong> {order.customer.notes}</p>
                          )}
                        </div>
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Productos</h4>
                        <div className="bg-gray-50 rounded-xl p-3.5 text-sm space-y-1.5 border border-gray-100">
                          {order.items.map((item, i) => (
                            <div key={i} className="flex justify-between">
                              <span className="text-gray-700">{item.quantity}x {item.productName}
                                {item.variant?.name ? ` (${item.variant.name})` : ''}
                              </span>
                              <span className="font-semibold text-gray-900">Q {item.subtotal.toLocaleString('es-GT')}</span>
                            </div>
                          ))}
                          <div className="border-t border-gray-200 pt-2 mt-2 flex justify-between font-black">
                            <span>Total</span>
                            <span>Q {order.total.toLocaleString('es-GT')}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => openEditModal(order)}
                        className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Editar pedido
                      </button>
                    </div>

                    <div>
                      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Cambiar estado</h4>
                      <div className="flex flex-wrap gap-2">
                        {STATUS_OPTIONS.map(s => (
                          <button
                            key={s.value}
                            onClick={() => handleStatusChange(order._id, s.value)}
                            disabled={updatingId === order._id || order.orderStatus === s.value}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                              order.orderStatus === s.value
                                ? 'bg-gray-900 text-white shadow-sm'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
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
