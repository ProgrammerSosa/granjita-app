'use client';

import { useEffect, useState } from 'react';
import {
  fetchInvoices,
  formatMoney,
  getInvoicePdfUrl,
  resendOrderWhatsApp,
} from '@/lib/api';
import { formatBillsSummary } from '@/lib/bills';
import useToastStore from '@/store/useToastStore';

export default function AdminInvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState('');
  const [total, setTotal] = useState(0);
  const [resending, setResending] = useState(null);
  const toastSuccess = useToastStore((s) => s.success);
  const toastError = useToastStore((s) => s.error);

  useEffect(() => {
    load();
  }, [selectedDate]);

  async function load() {
    try {
      setLoading(true);
      const data = await fetchInvoices({
        date: selectedDate || undefined,
        limit: 100,
      });
      setInvoices(data.data || []);
      setTotal(data.total || 0);
    } catch (e) {
      toastError(e.message || 'Error al cargar facturas');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend(id) {
    try {
      setResending(id);
      const r = await resendOrderWhatsApp(id);
      if (r.whatsapp?.customer || r.whatsapp?.owner) {
        toastSuccess('WhatsApp reenviado (PDF + texto)');
      } else {
        toastError(r.whatsapp?.errors?.join(' · ') || 'No se pudo reenviar');
      }
    } catch (e) {
      toastError(e.message);
    } finally {
      setResending(null);
    }
  }

  const sumTotals = invoices.reduce((s, o) => s + (o.total || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <p className="section-label text-admin-400">Documentos</p>
          <h1 className="text-2xl font-black text-admin-900">Facturas</h1>
          <p className="text-admin-500 text-sm mt-0.5">
            {total} facturas · PDF para WhatsApp y descarga
          </p>
        </div>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="input-admin"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="card-admin p-4">
          <p className="text-admin-500 text-xs font-medium">Facturas listadas</p>
          <p className="text-xl font-black text-admin-900">{invoices.length}</p>
        </div>
        <div className="card-admin p-4">
          <p className="text-admin-500 text-xs font-medium">Suma totales</p>
          <p className="text-xl font-black text-primary-600">{formatMoney(sumTotals)}</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-admin-200 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : invoices.length === 0 ? (
        <div className="card-admin p-10 text-center">
          <span className="text-4xl opacity-40">🧾</span>
          <p className="text-admin-600 font-bold mt-3">No hay facturas todavía</p>
          <p className="text-admin-400 text-sm mt-1">
            Se crean al confirmar un pedido en la tienda
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {invoices.map((order) => (
            <div key={order._id} className="card-admin p-4 space-y-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="badge bg-ink-900 text-primary-400 font-mono text-xs">
                      {order.invoice?.number}
                    </span>
                    <span className="text-xs text-admin-500">
                      #{order._id.toString().slice(-6).toUpperCase()}
                    </span>
                  </div>
                  <p className="font-bold text-admin-900 mt-1">{order.customer?.name}</p>
                  <p className="text-xs text-admin-500">
                    {order.customer?.phone} ·{' '}
                    {order.invoice?.issuedAt
                      ? new Date(order.invoice.issuedAt).toLocaleString('es-GT')
                      : '—'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-black text-lg text-admin-900">
                    {formatMoney(order.total)}
                  </p>
                  <p className="text-xs text-admin-500">
                    {order.paymentMethod === 'cash' ? '💵 Efectivo' : '💳 Tarjeta'}
                  </p>
                </div>
              </div>

              {order.paymentMethod === 'cash' && order.cashIntent?.amountTendered > 0 && (
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm">
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">
                    Dinero (lo dijo el cliente — no editable)
                  </p>
                  <p className="font-bold text-emerald-900 mt-1">
                    Paga con: {formatBillsSummary(order.cashIntent.bills)}
                  </p>
                  <div className="grid grid-cols-3 gap-2 mt-2 text-center text-xs">
                    <div className="bg-white rounded-lg p-2 border border-emerald-100">
                      <p className="text-emerald-600">Cobrar</p>
                      <p className="font-black">{formatMoney(order.total)}</p>
                    </div>
                    <div className="bg-white rounded-lg p-2 border border-emerald-100">
                      <p className="text-emerald-600">Entrega</p>
                      <p className="font-black">
                        {formatMoney(order.cashIntent.amountTendered)}
                      </p>
                    </div>
                    <div className="bg-white rounded-lg p-2 border border-emerald-200">
                      <p className="text-emerald-600">Vuelto a llevar</p>
                      <p className="font-black text-emerald-700">
                        {formatMoney(order.cashIntent.change || 0)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <a
                  href={getInvoicePdfUrl(order._id)}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3.5 py-2 rounded-lg text-xs font-bold bg-ink-900 text-primary-400 hover:bg-ink-800 transition-colors"
                >
                  📄 Ver / bajar PDF
                </a>
                <button
                  type="button"
                  onClick={() => handleResend(order._id)}
                  disabled={resending === order._id}
                  className="px-3.5 py-2 rounded-lg text-xs font-bold bg-primary-500 text-ink-950 hover:bg-primary-400 disabled:opacity-50"
                >
                  {resending === order._id ? 'Enviando…' : '📲 Reenviar WA + PDF'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
