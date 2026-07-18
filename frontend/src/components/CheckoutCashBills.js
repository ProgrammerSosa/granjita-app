'use client';

import { useMemo, useState, useEffect } from 'react';
import {
  BILL_DENOMS,
  COIN_DENOMS,
  billsTotal,
  billsToArray,
  formatBillsSummary,
  formatDenom,
  getBillCount,
  setBillCount,
  emptyBillsMap,
  exactPaymentMap,
} from '@/lib/bills';
import { formatMoney } from '@/lib/api';

/** Billete visual con “fondo” de patrón */
function BillChip({ denom, count, onAdd, onRemove, locked }) {
  const active = count > 0;
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border-2 transition-all duration-200 ${
        locked && !active
          ? 'border-ink-800 opacity-45'
          : active
          ? 'border-primary-400 shadow-glow scale-[1.02]'
          : 'border-ink-700/80 hover:border-primary-500/50'
      }`}
    >
      <div
        className="absolute inset-0 opacity-90"
        style={{
          background: active
            ? 'linear-gradient(135deg, #ea580c 0%, #9a3412 45%, #0a0a0a 100%)'
            : 'linear-gradient(135deg, #2a2a2a 0%, #141414 50%, #1a1a1a 100%)',
        }}
      />
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            'repeating-linear-gradient(45deg, transparent, transparent 6px, rgba(255,255,255,0.06) 6px, rgba(255,255,255,0.06) 12px)',
        }}
      />
      <div className="absolute -right-4 -top-4 w-16 h-16 rounded-full border border-white/10" />
      <div className="absolute -left-3 -bottom-3 w-12 h-12 rounded-full border border-white/10" />

      <button
        type="button"
        onClick={onAdd}
        disabled={locked}
        className="relative w-full p-3 text-left active:scale-[0.97] transition-transform disabled:active:scale-100 disabled:cursor-not-allowed"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/60">
              Billete
            </p>
            <p className="text-2xl font-black text-white drop-shadow-sm leading-none mt-0.5">
              {formatDenom(denom)}
            </p>
          </div>
          <div
            className={`min-w-[2.25rem] h-9 px-2 rounded-xl flex items-center justify-center font-black text-sm border ${
              active
                ? 'bg-ink-950 text-primary-400 border-primary-400/40'
                : 'bg-black/40 text-white/80 border-white/10'
            }`}
          >
            {count}
          </div>
        </div>
        <p className="relative text-[10px] text-white/55 mt-2 font-medium">
          {locked ? (active ? 'Incluido' : 'Máximo alcanzado') : 'Tocá para sumar'}
          {count > 0 ? ` · ${count}× = ${formatMoney(denom * count)}` : ''}
        </p>
      </button>

      {count > 0 && (
        <button
          type="button"
          onClick={onRemove}
          className="relative w-full text-[11px] font-bold py-1.5 bg-black/35 text-white/80 hover:text-white border-t border-white/10"
        >
          − Quitar uno
        </button>
      )}
    </div>
  );
}

/** Moneda circular */
function CoinChip({ denom, count, onAdd, onRemove, locked }) {
  const active = count > 0;
  const label = denom === 1 ? 'Q1' : denom === 0.5 ? '50¢' : '25¢';
  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={onAdd}
        disabled={locked}
        className={`relative w-[4.5rem] h-[4.5rem] rounded-full flex flex-col items-center justify-center transition-all active:scale-95 border-4 disabled:active:scale-100 disabled:cursor-not-allowed ${
          locked && !active
            ? 'border-ink-700 opacity-45 bg-ink-900'
            : active
            ? 'border-primary-400 shadow-lift bg-gradient-to-br from-primary-400 via-primary-500 to-primary-700'
            : 'border-ink-600 bg-gradient-to-br from-ink-700 via-ink-800 to-ink-950 hover:border-primary-500/60'
        }`}
        style={{
          boxShadow:
            active && !locked
              ? 'inset 0 2px 8px rgba(255,255,255,0.25), 0 8px 20px rgba(234,88,12,0.35)'
              : 'inset 0 2px 6px rgba(255,255,255,0.08)',
        }}
      >
        <span className="text-[10px] font-bold text-white/70 uppercase tracking-wide">
          mon
        </span>
        <span className="text-base font-black text-white leading-none">{label}</span>
        {count > 0 && (
          <span className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-ink-950 text-primary-400 text-xs font-black flex items-center justify-center border border-primary-500">
            {count}
          </span>
        )}
      </button>
      {count > 0 ? (
        <button
          type="button"
          onClick={onRemove}
          className="text-[10px] font-bold text-ink-400 hover:text-white"
        >
          −1
        </button>
      ) : (
        <span className="text-[10px] text-ink-500 font-medium">
          {locked ? 'listo' : 'tocá'}
        </span>
      )}
    </div>
  );
}

export default function CheckoutCashBills({ total, bills, onChange }) {
  const [capMsg, setCapMsg] = useState('');
  const tendered = useMemo(() => billsTotal(bills), [bills]);
  const change = Math.round((tendered - total) * 100) / 100;
  const enough = tendered + 1e-9 >= total;
  const selected = billsToArray(bills);
  const summary = formatBillsSummary(selected);

  useEffect(() => {
    if (!capMsg) return;
    const t = setTimeout(() => setCapMsg(''), 2800);
    return () => clearTimeout(t);
  }, [capMsg]);

  function add(d) {
    if (enough) {
      setCapMsg(
        `Ya alcanza con lo que tenés (${formatMoney(tendered)}). El pedido es ${formatMoney(total)}${
          change > 0 ? ` · vuelto ${formatMoney(change)}` : ' · pago cabal'
        }. No hace falta sumar más billetes.`
      );
      return;
    }
    onChange(setBillCount(bills, d, getBillCount(bills, d) + 1));
  }

  function remove(d) {
    setCapMsg('');
    onChange(setBillCount(bills, d, getBillCount(bills, d) - 1));
  }

  function pagoCabal() {
    setCapMsg('');
    onChange(exactPaymentMap(total));
  }

  function clear() {
    setCapMsg('');
    onChange(emptyBillsMap());
  }

  return (
    <div className="mt-3 rounded-3xl border border-primary-500/30 overflow-hidden animate-fade-in shadow-lift">
      <div className="relative bg-ink-950 px-4 pt-4 pb-3 overflow-hidden">
        <div
          className="absolute inset-0 opacity-40"
          style={{
            background:
              'radial-gradient(ellipse 80% 80% at 10% 0%, rgba(249,115,22,0.45), transparent), radial-gradient(ellipse 60% 60% at 100% 100%, rgba(249,115,22,0.2), transparent)',
          }}
        />
        <div className="relative">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-400">
            Efectivo · Guatemala
          </p>
          <p className="font-black text-white text-lg leading-tight mt-0.5">
            ¿Con cuánto vas a pagar?
          </p>
          <p className="text-xs text-ink-300 mt-1">
            Total a cubrir: <span className="text-primary-400 font-bold">{formatMoney(total)}</span>
          </p>
        </div>
      </div>

      <div className="bg-ink-900 p-3 space-y-4">
        <button
          type="button"
          onClick={pagoCabal}
          className="w-full relative overflow-hidden rounded-2xl py-3.5 px-4 font-black text-ink-950
                     bg-gradient-to-r from-primary-400 via-primary-500 to-primary-600
                     hover:from-primary-300 hover:to-primary-500
                     active:scale-[0.98] transition-all shadow-md shadow-primary-600/30"
        >
          <span className="relative z-10 flex items-center justify-center gap-2 text-sm sm:text-base">
            <span className="text-lg">✨</span>
            Pago cabal
            <span className="font-semibold opacity-80">· exacto {formatMoney(total)}</span>
          </span>
        </button>
        <p className="text-[11px] text-center text-ink-400 -mt-2">
          Un toque y te arma el desglose exacto · sin estar contando
        </p>

        {/* Aviso al tope */}
        {enough && (
          <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/15 px-3 py-3 text-center animate-scale-in">
            <p className="text-sm font-black text-emerald-300 leading-snug">
              ✓ Con la cantidad que tenés ya se puede cobrar el pedido
            </p>
            <p className="text-xs text-emerald-200/80 mt-1">
              {formatMoney(tendered)} cubre {formatMoney(total)}
              {change > 0 ? ` · te devuelven ${formatMoney(change)}` : ' · sin vuelto'}
              . No se pueden sumar más billetes.
            </p>
          </div>
        )}

        {capMsg && (
          <div className="rounded-2xl border border-primary-400/50 bg-primary-500/15 px-3 py-2.5 text-center animate-fade-in">
            <p className="text-xs font-bold text-primary-200 leading-relaxed">{capMsg}</p>
          </div>
        )}

        <div className={enough ? 'opacity-80' : ''}>
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary-400/90 mb-2 px-0.5">
            Billetes {enough ? '· bloqueados (ya alcanza)' : ''}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {BILL_DENOMS.map((d) => (
              <BillChip
                key={d}
                denom={d}
                count={getBillCount(bills, d)}
                onAdd={() => add(d)}
                onRemove={() => remove(d)}
                locked={enough}
              />
            ))}
          </div>
        </div>

        <div className={enough ? 'opacity-80' : ''}>
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary-400/90 mb-3 px-0.5">
            Monedas · quetzales y centavos
          </p>
          <div className="flex items-center justify-around py-1">
            {COIN_DENOMS.map((d) => (
              <CoinChip
                key={d}
                denom={d}
                count={getBillCount(bills, d)}
                onAdd={() => add(d)}
                onRemove={() => remove(d)}
                locked={enough}
              />
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={clear}
          className="w-full text-[11px] font-semibold text-ink-500 hover:text-ink-200 py-1"
        >
          Limpiar
        </button>

        <div
          className={`rounded-2xl p-3.5 border-2 ${
            tendered === 0
              ? 'border-ink-700 bg-ink-950'
              : enough
              ? 'border-emerald-500/40 bg-emerald-500/10'
              : 'border-amber-500/40 bg-amber-500/10'
          }`}
        >
          {tendered === 0 ? (
            <p className="text-sm text-ink-300 leading-relaxed">
              Tocá <strong className="text-primary-400">Pago cabal</strong> o sumá billetes y
              monedas. Cuando llegues al total, se bloquea para no pasarte de más.
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-black text-white leading-snug">
                Dijiste: {summary}
              </p>
              <p className="text-sm font-bold text-primary-300">
                Vas a pagar con {formatMoney(tendered)}
              </p>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-xl bg-ink-950/80 p-2 border border-ink-800">
                  <p className="text-ink-400">Pedido</p>
                  <p className="font-black text-white">{formatMoney(total)}</p>
                </div>
                <div className="rounded-xl bg-ink-950/80 p-2 border border-ink-800">
                  <p className="text-ink-400">Entregás</p>
                  <p className={`font-black ${enough ? 'text-primary-400' : 'text-amber-400'}`}>
                    {formatMoney(tendered)}
                  </p>
                </div>
                <div className="rounded-xl bg-ink-950/80 p-2 border border-ink-800">
                  <p className="text-ink-400">Vuelto</p>
                  <p className="font-black text-emerald-400">
                    {enough ? formatMoney(change) : '—'}
                  </p>
                </div>
              </div>
              {!enough && (
                <p className="text-xs font-bold text-amber-300 text-center">
                  Faltan {formatMoney(total - tendered)} · seguí sumando
                </p>
              )}
              {enough && change === 0 && (
                <p className="text-xs font-bold text-emerald-300 text-center">
                  ✓ Con esa cantidad se cobra cabal — sin vuelto
                </p>
              )}
              {enough && change > 0 && (
                <p className="text-xs font-bold text-emerald-300 text-center">
                  ✓ Con lo que tenés se puede cobrar · vuelto {formatMoney(change)}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
