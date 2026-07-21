'use client';

import { useMemo, useState } from 'react';
import {
  DENOMINATIONS,
  billsTotal,
  billsToArray,
  suggestBillCombos,
  formatBillsSummary,
  formatDenom,
  emptyBillsMap,
  getBillCount,
  setBillCount,
  exactPaymentMap,
} from '@/lib/bills';
import { formatMoney } from '@/lib/api';
import { BillFace, CoinFace } from '@/components/MoneyFaces';

/**
 * Panel de cobro en efectivo: billetes con los que paga + vuelto + sugerencias.
 */
export default function CashBillsPanel({
  total,
  onConfirm,
  saving = false,
  existing = null,
}) {
  const [bills, setBills] = useState(() => {
    const init = emptyBillsMap();
    if (existing?.bills?.length) {
      existing.bills.forEach((b) => {
        init[String(b.denomination)] = b.count;
      });
    }
    return init;
  });
  const [notes, setNotes] = useState(existing?.notes || '');

  const tendered = useMemo(() => billsTotal(bills), [bills]);
  const change = Math.round((tendered - total) * 100) / 100;
  const enough = tendered + 1e-9 >= total;
  const suggestions = useMemo(() => suggestBillCombos(total, 5), [total]);

  function setCount(denom, value) {
    const n = Math.max(0, Math.min(99, parseInt(value, 10) || 0));
    const current = getBillCount(bills, denom);
    // No permitir sumar más si ya alcanza el total
    if (n > current && enough) return;
    setBills((prev) => setBillCount(prev, denom, n));
  }

  function applySuggestion(combo) {
    setBills({ ...emptyBillsMap(), ...combo.bills });
  }

  function clear() {
    setBills(emptyBillsMap());
  }

  if (existing?.amountTendered > 0) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">✅</span>
          <p className="font-black text-emerald-900 text-sm">Cobro en efectivo registrado</p>
        </div>
        <p className="text-sm text-emerald-800">
          <strong>Paga con:</strong> {formatBillsSummary(existing.bills)}
        </p>
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="bg-white/80 rounded-xl p-2">
            <p className="text-emerald-600 font-medium">Total</p>
            <p className="font-black text-emerald-950">{formatMoney(total)}</p>
          </div>
          <div className="bg-white/80 rounded-xl p-2">
            <p className="text-emerald-600 font-medium">Entregó</p>
            <p className="font-black text-emerald-950">{formatMoney(existing.amountTendered)}</p>
          </div>
          <div className="bg-white/80 rounded-xl p-2">
            <p className="text-emerald-600 font-medium">Vuelto</p>
            <p className="font-black text-emerald-950">{formatMoney(existing.change)}</p>
          </div>
        </div>
        {existing.notes && (
          <p className="text-xs text-emerald-700">Nota: {existing.notes}</p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-ink-200 bg-ink-950 text-white overflow-hidden">
      <div className="bg-gradient-to-r from-primary-600 to-primary-500 px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-ink-950/70">
            Cobro en puerta
          </p>
          <p className="font-black text-ink-950 text-lg leading-tight">
            Total {formatMoney(total)}
          </p>
        </div>
        <span className="text-2xl">💵</span>
      </div>

      <div className="p-4 space-y-4">
        {/* Sugerencias */}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-primary-400 mb-2">
            ¿Con qué puede pagar?
          </p>
          <button
            type="button"
            onClick={() => applySuggestion({ bills: exactPaymentMap(total) })}
            className="w-full mb-2 py-2.5 rounded-xl font-black text-ink-950 bg-primary-500 hover:bg-primary-400 text-sm"
          >
            ✨ Pago cabal · {formatMoney(total)}
          </button>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => applySuggestion(s)}
                className="text-left px-3 py-2 rounded-xl bg-ink-800 border border-ink-700 hover:border-primary-500 hover:bg-ink-800/80 transition-all text-xs"
              >
                <span className="font-bold text-white block">{s.label}</span>
                <span className="text-ink-400">
                  {s.change > 0 ? `Vuelto ${formatMoney(s.change)}` : 'Exacto'}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Contadores de billetes / monedas */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-primary-400">
              Billetes y monedas
            </p>
            <button type="button" onClick={clear} className="text-[11px] text-ink-400 hover:text-white">
              Limpiar
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {DENOMINATIONS.map((d) => {
              const count = getBillCount(bills, d);
              return (
              <div
                key={d}
                className={`rounded-xl border p-2 flex items-center justify-between gap-2 ${
                  count > 0
                    ? 'border-primary-500 bg-primary-500/10'
                    : 'border-ink-700 bg-ink-900'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {d < 1 ? (
                    <CoinFace denom={d} className="w-9 h-9 shrink-0" />
                  ) : (
                    <div className="relative w-12 h-7 rounded-md overflow-hidden shrink-0 border border-black/20">
                      <BillFace denom={d} variant="thumb" className="absolute inset-0" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-[10px] text-ink-400 font-medium leading-none">
                      {d < 1 ? 'Moneda' : 'Billete'}
                    </p>
                    <p className="font-black text-primary-400 leading-tight">{formatDenom(d)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setCount(d, count - 1)}
                    className="w-8 h-8 rounded-lg bg-ink-800 hover:bg-ink-700 font-bold"
                  >
                    −
                  </button>
                  <span className="w-7 text-center font-black text-sm">{count}</span>
                  <button
                    type="button"
                    onClick={() => setCount(d, count + 1)}
                    className="w-8 h-8 rounded-lg bg-ink-800 hover:bg-ink-700 font-bold"
                  >
                    +
                  </button>
                </div>
              </div>
            );})}
          </div>
        </div>

        {/* Resumen */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-ink-900 border border-ink-800 p-3 text-center">
            <p className="text-[10px] text-ink-400 uppercase font-bold">A cobrar</p>
            <p className="font-black text-white text-sm">{formatMoney(total)}</p>
          </div>
          <div className="rounded-xl bg-ink-900 border border-ink-800 p-3 text-center">
            <p className="text-[10px] text-ink-400 uppercase font-bold">Entrega</p>
            <p className={`font-black text-sm ${enough ? 'text-primary-400' : 'text-red-400'}`}>
              {formatMoney(tendered)}
            </p>
          </div>
          <div className="rounded-xl bg-ink-900 border border-ink-800 p-3 text-center">
            <p className="text-[10px] text-ink-400 uppercase font-bold">Vuelto</p>
            <p className="font-black text-emerald-400 text-sm">
              {enough ? formatMoney(change) : '—'}
            </p>
          </div>
        </div>

        {!enough && tendered > 0 && (
          <p className="text-xs text-red-400 font-medium text-center">
            Faltan {formatMoney(total - tendered)}
          </p>
        )}

        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Nota opcional (ej: billete roto, propina…)"
          className="w-full px-3 py-2.5 rounded-xl bg-ink-900 border border-ink-700 text-sm text-white placeholder:text-ink-500 outline-none focus:border-primary-500"
        />

        <button
          type="button"
          disabled={!enough || saving}
          onClick={() =>
            onConfirm({
              bills: billsToArray(bills),
              notes,
              amountTendered: tendered,
              change: enough ? change : 0,
            })
          }
          className="w-full py-3.5 rounded-2xl font-black text-ink-950 bg-primary-500 hover:bg-primary-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
        >
          {saving ? 'Guardando…' : enough ? `Confirmar cobro · vuelto ${formatMoney(change)}` : 'Ingresá billetes'}
        </button>
      </div>
    </div>
  );
}
