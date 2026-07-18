/** Billetes y monedas GT (en quetzales) */
export const BILL_DENOMS = [200, 100, 50, 20, 10, 5];
export const COIN_DENOMS = [1, 0.5, 0.25];
export const DENOMINATIONS = [...BILL_DENOMS, ...COIN_DENOMS];

/** Trabajar en centavos para evitar errores de float */
export function toCents(q) {
  return Math.round(Number(q) * 100);
}

export function fromCents(c) {
  return Math.round(Number(c)) / 100;
}

export function billsTotal(billsMap) {
  return DENOMINATIONS.reduce((sum, d) => {
    const key = String(d);
    return sum + d * (Number(billsMap[key] ?? billsMap[d]) || 0);
  }, 0);
}

export function billsToArray(billsMap) {
  return DENOMINATIONS
    .map((d) => {
      const key = String(d);
      const count = Number(billsMap[key] ?? billsMap[d]) || 0;
      return { denomination: d, count };
    })
    .filter((b) => b.count > 0);
}

export function emptyBillsMap() {
  const m = {};
  DENOMINATIONS.forEach((d) => {
    m[String(d)] = 0;
  });
  return m;
}

export function getBillCount(billsMap, d) {
  return Number(billsMap[String(d)] ?? billsMap[d]) || 0;
}

export function setBillCount(billsMap, d, count) {
  return { ...billsMap, [String(d)]: Math.max(0, Math.min(99, count)) };
}

/** Pago cabal: desglose exacto del total (greedy) */
export function exactPaymentMap(total) {
  let rest = toCents(total);
  const map = emptyBillsMap();
  const ordered = [...DENOMINATIONS].sort((a, b) => b - a);
  for (const d of ordered) {
    const c = toCents(d);
    if (c <= 0) continue;
    const n = Math.floor(rest / c);
    if (n > 0) {
      map[String(d)] = n;
      rest -= n * c;
    }
  }
  // residuales raros → monedas de 0.25
  if (rest > 0) {
    const n = Math.ceil(rest / 25);
    map['0.25'] = (map['0.25'] || 0) + n;
  }
  return map;
}

/**
 * Sugerencias de cómo pagar un total con billetes.
 */
export function suggestBillCombos(total, maxCombos = 6) {
  const amount = Number(total) || 0;
  if (amount <= 0) return [];

  const combos = [];
  const seen = new Set();

  function keyOf(map) {
    return DENOMINATIONS.map((d) => `${d}:${getBillCount(map, d)}`).join('|');
  }

  function addCombo(map, label) {
    const tendered = billsTotal(map);
    if (tendered + 1e-9 < amount) return;
    const k = keyOf(map);
    if (seen.has(k)) return;
    seen.add(k);
    combos.push({
      label,
      bills: { ...map },
      tendered,
      change: Math.round((tendered - amount) * 100) / 100,
    });
  }

  // Exacto
  addCombo(exactPaymentMap(amount), 'Pago cabal');

  for (const d of BILL_DENOMS) {
    if (d >= amount) {
      addCombo(setBillCount(emptyBillsMap(), d, 1), `1× Q${d}`);
    }
  }

  for (const d of [50, 20, 10, 5, 1]) {
    const n = Math.ceil(amount / d);
    if (n > 0 && n <= 12) {
      addCombo(setBillCount(emptyBillsMap(), d, n), `${n}× Q${d}`);
    }
  }

  return combos
    .sort((a, b) => a.change - b.change || a.tendered - b.tendered)
    .slice(0, maxCombos);
}

export function formatDenom(d) {
  if (d >= 1) return `Q${d}`;
  if (d === 0.5) return '50¢';
  if (d === 0.25) return '25¢';
  return `Q${d}`;
}

export function formatBillsSummary(bills) {
  if (!bills?.length) return '—';
  return bills
    .filter((b) => b.count > 0)
    .map((b) => `${b.count}× ${formatDenom(b.denomination)}`)
    .join(' · ');
}
