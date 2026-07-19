const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '../../data');
const SETTINGS_PATH = path.join(DATA_DIR, 'store-settings.json');

/** Guatemala sin DST */
const TIMEZONE = 'America/Guatemala';

/** Pedido mínimo en quetzales */
const DEFAULT_MIN_ORDER = 15;

/** Turnos: 10:30–15:00 y 16:00–20:00 */
const DEFAULT_SHIFTS = [
  { start: '10:30', end: '15:00' },
  { start: '16:00', end: '20:00' },
];

/** 0 = domingo … 6 = sábado. Cerrado los domingos. */
const DEFAULT_CLOSED_WEEKDAYS = [0];

const DAY_NAMES_ES = [
  'domingo',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
];

function ensureDefaults(raw = {}) {
  return {
    minOrder: Number(raw.minOrder) > 0 ? Number(raw.minOrder) : DEFAULT_MIN_ORDER,
    timezone: TIMEZONE,
    shifts:
      Array.isArray(raw.shifts) && raw.shifts.length
        ? raw.shifts
        : DEFAULT_SHIFTS.map((s) => ({ ...s })),
    closedWeekdays: Array.isArray(raw.closedWeekdays)
      ? raw.closedWeekdays
      : [...DEFAULT_CLOSED_WEEKDAYS],
    forceClosed: Boolean(raw.forceClosed),
    forceClosedReason: String(raw.forceClosedReason || '').trim(),
    restDays: Array.isArray(raw.restDays) ? raw.restDays : [],
    /** Días especiales abiertos (ej. un domingo puntual) */
    openDays: Array.isArray(raw.openDays) ? raw.openDays : [],
  };
}

function findOpenDay(settings, dateStr) {
  return (settings.openDays || []).find((d) => d.date === dateStr) || null;
}

function isDayNormallyClosed(settings, weekday, dateStr) {
  const forcedOpen = Boolean(findOpenDay(settings, dateStr));
  if (forcedOpen) return false;
  return (settings.closedWeekdays || []).includes(weekday);
}

function friendlyClosedMessage(reason, customMessage, nextHint) {
  const bye = '¡Que tengas un muy buen día! 🌿';
  const base = customMessage || 'Ahora mismo no estamos tomando pedidos.';
  const next = nextHint ? ` ${nextHint}.` : '';
  return `${base}${next} ${bye}`;
}

function readSettings() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(SETTINGS_PATH)) {
      const defaults = ensureDefaults();
      fs.writeFileSync(SETTINGS_PATH, JSON.stringify(defaults, null, 2), 'utf8');
      return defaults;
    }
    const raw = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
    return ensureDefaults(raw);
  } catch (err) {
    console.error('[store] Error leyendo settings:', err.message);
    return ensureDefaults();
  }
}

function writeSettings(settings) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const clean = ensureDefaults(settings);
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(clean, null, 2), 'utf8');
  return clean;
}

/** Partes de fecha/hora en America/Guatemala */
function getGtParts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(date).filter((p) => p.type !== 'literal').map((p) => [p.type, p.value])
  );
  // weekday short en en-CA: Sun Mon Tue...
  const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const weekday = weekdayMap[parts.weekday] ?? 0;
  let hour = parseInt(parts.hour, 10);
  if (hour === 24) hour = 0; // algunos entornos devuelven 24
  const minute = parseInt(parts.minute, 10);
  const dateStr = `${parts.year}-${parts.month}-${parts.day}`;
  const minutesOfDay = hour * 60 + minute;
  return { dateStr, weekday, hour, minute, minutesOfDay };
}

function parseHm(hm) {
  const [h, m] = String(hm).split(':').map((n) => parseInt(n, 10));
  return (h || 0) * 60 + (m || 0);
}

function formatHm12(hm) {
  const [hRaw, mRaw] = String(hm).split(':').map((n) => parseInt(n, 10));
  let h = hRaw || 0;
  const m = mRaw || 0;
  const ampm = h >= 12 ? 'pm' : 'am';
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function hoursLabel(settings) {
  const shifts = settings.shifts || DEFAULT_SHIFTS;
  return shifts
    .map((s) => `${formatHm12(s.start)} – ${formatHm12(s.end)}`)
    .join(' · ');
}

function workDaysLabel(settings) {
  const closed = new Set(settings.closedWeekdays || []);
  const open = DAY_NAMES_ES.filter((_, i) => !closed.has(i));
  if (open.length === 6 && closed.has(0)) return 'Lunes a sábado';
  return open.map((d) => d.charAt(0).toUpperCase() + d.slice(1)).join(', ');
}

function findRestDay(settings, dateStr) {
  return (settings.restDays || []).find((d) => d.date === dateStr) || null;
}

function isWithinShifts(minutesOfDay, settings) {
  return (settings.shifts || DEFAULT_SHIFTS).some((s) => {
    const start = parseHm(s.start);
    const end = parseHm(s.end);
    return minutesOfDay >= start && minutesOfDay < end;
  });
}

function nextOpenHint(settings, fromDate = new Date()) {
  // Buscar en los próximos 14 días el próximo turno de apertura
  for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
    const probe = new Date(fromDate.getTime() + dayOffset * 24 * 60 * 60 * 1000);
    // Ajustar con partes GT del "ahora" + offset conceptual por dateStr
    const base = getGtParts(fromDate);
    // Construir fecha candidatos desde dateStr + offset
    const [y, mo, d] = base.dateStr.split('-').map(Number);
    const candidateUtc = new Date(Date.UTC(y, mo - 1, d + dayOffset, 12, 0, 0));
    const parts = getGtParts(candidateUtc);
    // Para dayOffset 0 usamos hora real; para siguientes, empezamos en 0
    const weekday = parts.weekday;
    if (isDayNormallyClosed(settings, weekday, parts.dateStr)) continue;
    if (findRestDay(settings, parts.dateStr)) continue;

    for (const shift of settings.shifts || DEFAULT_SHIFTS) {
      const startMin = parseHm(shift.start);
      if (dayOffset === 0) {
        const nowParts = getGtParts(fromDate);
        if (nowParts.minutesOfDay < startMin) {
          return `Abre hoy a las ${formatHm12(shift.start)}`;
        }
        // si ya pasó este turno, probar el siguiente del mismo día
        continue;
      }
      const dayName = DAY_NAMES_ES[weekday];
      if (dayOffset === 1) {
        return `Abre mañana (${dayName}) a las ${formatHm12(shift.start)}`;
      }
      return `Abre el ${dayName} ${parts.dateStr.slice(8)}/${parts.dateStr.slice(5, 7)} a las ${formatHm12(shift.start)}`;
    }
  }
  return 'Consultá por WhatsApp el próximo horario';
}

/**
 * Estado actual de la tienda para pedidos.
 */
function getStoreStatus(date = new Date()) {
  const settings = readSettings();
  const parts = getGtParts(date);
  const rest = findRestDay(settings, parts.dateStr);
  const labelHours = hoursLabel(settings);
  const labelDays = workDaysLabel(settings);
  const minOrder = settings.minOrder;

  const specialOpen = findOpenDay(settings, parts.dateStr);
  const nextHint = nextOpenHint(settings, date);

  const base = {
    open: false,
    minOrder,
    timezone: TIMEZONE,
    hoursLabel: labelHours,
    workDaysLabel: labelDays,
    shifts: settings.shifts,
    closedWeekdays: settings.closedWeekdays,
    forceClosed: settings.forceClosed,
    forceClosedReason: settings.forceClosedReason || '',
    restDays: settings.restDays,
    openDays: settings.openDays,
    today: parts.dateStr,
    localTime: `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`,
    weekday: parts.weekday,
    weekdayName: DAY_NAMES_ES[parts.weekday],
    closedGreeting: null,
  };

  if (settings.forceClosed) {
    const reason = settings.forceClosedReason || 'Hoy estamos cerrados por un imprevisto';
    return {
      ...base,
      open: false,
      reason: 'force_closed',
      message: reason,
      nextOpenHint: nextHint,
      closedGreeting: friendlyClosedMessage(
        'force_closed',
        reason,
        nextHint
      ),
    };
  }

  if (rest) {
    const msg = rest.reason
      ? `Hoy descansamos: ${rest.reason}`
      : 'Hoy no estamos tomando pedidos (descanso planificado)';
    return {
      ...base,
      open: false,
      reason: 'rest_day',
      message: msg,
      restDay: rest,
      nextOpenHint: nextHint,
      closedGreeting: friendlyClosedMessage('rest_day', msg, nextHint),
    };
  }

  if (isDayNormallyClosed(settings, parts.weekday, parts.dateStr)) {
    const msg =
      parts.weekday === 0
        ? 'Los domingos normalmente descansamos. Podés pedir de lunes a sábado.'
        : 'Hoy no abrimos. Revisá nuestros días de atención.';
    return {
      ...base,
      open: false,
      reason: 'closed_weekday',
      message: msg,
      nextOpenHint: nextHint,
      closedGreeting: friendlyClosedMessage('closed_weekday', msg, nextHint),
    };
  }

  if (!isWithinShifts(parts.minutesOfDay, settings)) {
    const gap = findRecessGap(parts.minutesOfDay, settings);
    const msg = gap
      ? `Estamos en receso (${formatHm12(gap.start)} – ${formatHm12(gap.end)}). El segundo turno abre a las ${formatHm12(gap.end)}.`
      : `Ahora estamos fuera de horario. Atendemos ${labelHours} (${labelDays}).`;
    return {
      ...base,
      open: false,
      reason: gap ? 'between_shifts' : 'outside_hours',
      message: msg,
      nextOpenHint: nextHint,
      closedGreeting: friendlyClosedMessage(
        gap ? 'between_shifts' : 'outside_hours',
        msg,
        nextHint
      ),
    };
  }

  return {
    ...base,
    open: true,
    reason: specialOpen ? 'open_special' : 'open',
    message: specialOpen
      ? `Abiertos (día especial) · ${labelHours}`
      : `Abiertos · ${labelHours}`,
    nextOpenHint: null,
    closedGreeting: null,
  };
}

/**
 * Valida si se puede crear un pedido por horario/descanso y monto mínimo.
 * @returns {{ ok: true } | { ok: false, message: string, code: string }}
 */
function validateOrderAllowed(subtotal, date = new Date()) {
  const status = getStoreStatus(date);
  if (!status.open) {
    return {
      ok: false,
      code: status.reason || 'closed',
      message: status.message + (status.nextOpenHint ? ` ${status.nextOpenHint}.` : ''),
      status,
    };
  }
  const min = status.minOrder;
  if (Number(subtotal) < min) {
    return {
      ok: false,
      code: 'min_order',
      message: `El pedido mínimo es Q ${min}. Tu carrito suma Q ${Number(subtotal).toFixed(2)}.`,
      status,
    };
  }
  return { ok: true, status };
}

function setForceClosed(closed, reason = '') {
  const s = readSettings();
  s.forceClosed = Boolean(closed);
  s.forceClosedReason = closed ? String(reason || 'Tienda temporalmente cerrada').trim() : '';
  return writeSettings(s);
}

function addRestDay(date, reason = '') {
  const s = readSettings();
  const dateStr = String(date).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new Error('Fecha inválida (usá YYYY-MM-DD)');
  }
  // quitar si ya existe ese día
  s.restDays = (s.restDays || []).filter((d) => d.date !== dateStr);
  s.restDays.push({
    id: crypto.randomBytes(6).toString('hex'),
    date: dateStr,
    reason: String(reason || '').trim(),
    createdAt: new Date().toISOString(),
  });
  s.restDays.sort((a, b) => a.date.localeCompare(b.date));
  return writeSettings(s);
}

function removeRestDay(idOrDate) {
  const s = readSettings();
  const key = String(idOrDate);
  s.restDays = (s.restDays || []).filter((d) => d.id !== key && d.date !== key);
  return writeSettings(s);
}

function addOpenDay(date, reason = '') {
  const s = readSettings();
  const dateStr = String(date).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new Error('Fecha inválida (usá YYYY-MM-DD)');
  }
  // Si estaba en descanso, quitarlo
  s.restDays = (s.restDays || []).filter((d) => d.date !== dateStr);
  s.openDays = (s.openDays || []).filter((d) => d.date !== dateStr);
  s.openDays.push({
    id: crypto.randomBytes(6).toString('hex'),
    date: dateStr,
    reason: String(reason || 'Apertura especial').trim(),
    createdAt: new Date().toISOString(),
  });
  s.openDays.sort((a, b) => a.date.localeCompare(b.date));
  return writeSettings(s);
}

function removeOpenDay(idOrDate) {
  const s = readSettings();
  const key = String(idOrDate);
  s.openDays = (s.openDays || []).filter((d) => d.id !== key && d.date !== key);
  return writeSettings(s);
}

/**
 * Alterna estado de un día en el calendario.
 * - Día normal abierto → descanso
 * - Descanso → reabre
 * - Domingo (cerrado fijo) → habilita apertura especial
 * - Domingo ya habilitado → vuelve a cerrado
 */
function toggleRestDay(date, reason = '') {
  const dateStr = String(date).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new Error('Fecha inválida (usá YYYY-MM-DD)');
  }
  const s = readSettings();
  const gt = getGtParts(new Date(`${dateStr}T12:00:00.000-06:00`));
  const rest = findRestDay(s, dateStr);
  const special = findOpenDay(s, dateStr);
  const isFixedClosed = (s.closedWeekdays || []).includes(gt.weekday);

  // Quitar descanso → queda abierto (o domingo sin special)
  if (rest) {
    const settings = removeRestDay(dateStr);
    return {
      closed: isFixedClosed && !findOpenDay(settings, dateStr),
      action: 'removed_rest',
      settings,
      restDay: null,
      openDay: findOpenDay(settings, dateStr),
    };
  }

  // Domingo (u otro día fijo cerrado) sin apertura especial → habilitar
  if (isFixedClosed && !special) {
    const settings = addOpenDay(dateStr, reason || 'Apertura especial de domingo');
    return {
      closed: false,
      action: 'opened_special',
      settings,
      restDay: null,
      openDay: findOpenDay(settings, dateStr),
    };
  }

  // Domingo ya habilitado → quitar apertura especial
  if (isFixedClosed && special) {
    const settings = removeOpenDay(dateStr);
    return {
      closed: true,
      action: 'closed_special',
      settings,
      restDay: null,
      openDay: null,
    };
  }

  // Día laboral normal → marcar descanso
  const settings = addRestDay(dateStr, reason || 'Descanso planificado');
  return {
    closed: true,
    action: 'added_rest',
    settings,
    restDay: findRestDay(settings, dateStr),
    openDay: null,
  };
}

/** Info de un día para el calendario admin */
function getDayPlan(dateStr) {
  const settings = readSettings();
  const d = String(dateStr).slice(0, 10);
  const gt = getGtParts(new Date(`${d}T12:00:00.000-06:00`));
  const rest = findRestDay(settings, d);
  const special = findOpenDay(settings, d);
  const isFixedClosed = (settings.closedWeekdays || []).includes(gt.weekday);

  let status = 'open_planned';
  let label = 'Abierto (según horario)';
  if (rest) {
    status = 'rest';
    label = rest.reason || 'Descanso planificado';
  } else if (isFixedClosed && special) {
    status = 'special_open';
    label = special.reason || 'Apertura especial (domingo)';
  } else if (isFixedClosed) {
    status = 'weekday_closed';
    label = 'Cerrado (domingo) — podés habilitarlo';
  }

  return {
    date: d,
    weekday: gt.weekday,
    weekdayName: DAY_NAMES_ES[gt.weekday],
    status,
    label,
    restDay: rest,
    openDay: special,
    isRest: Boolean(rest),
    isSpecialOpen: Boolean(special),
    isWeekdayClosed: isFixedClosed && !special,
    shifts: settings.shifts,
    hoursLabel: hoursLabel(settings),
  };
}

/** Si la hora cae en el hueco (receso) entre dos turnos consecutivos, devuelve {start,end} en HH:MM. */
function findRecessGap(minutesOfDay, settings) {
  const shifts = [...(settings.shifts || DEFAULT_SHIFTS)]
    .map((s) => ({ start: s.start, end: s.end, startMin: parseHm(s.start), endMin: parseHm(s.end) }))
    .sort((a, b) => a.startMin - b.startMin);
  for (let i = 0; i < shifts.length - 1; i++) {
    if (minutesOfDay >= shifts[i].endMin && minutesOfDay < shifts[i + 1].startMin) {
      return { start: shifts[i].end, end: shifts[i + 1].start };
    }
  }
  return null;
}

/** Valida y normaliza turnos [{start,end}] (formato HH:MM, inicio<fin, sin solaparse, 1 a 4). */
function validateShifts(shifts) {
  if (!Array.isArray(shifts) || shifts.length < 1) {
    throw new Error('Debe haber al menos un turno');
  }
  if (shifts.length > 4) {
    throw new Error('Máximo 4 turnos');
  }
  const hmRe = /^([01]\d|2[0-3]):([0-5]\d)$/;
  const clean = shifts.map((s, i) => {
    const start = String(s?.start || '').trim();
    const end = String(s?.end || '').trim();
    if (!hmRe.test(start) || !hmRe.test(end)) {
      throw new Error(`Turno ${i + 1}: horas inválidas (usá HH:MM, de 00:00 a 23:59)`);
    }
    if (parseHm(start) >= parseHm(end)) {
      throw new Error(`Turno ${i + 1}: la hora de inicio debe ser menor que la de fin`);
    }
    return { start, end };
  });
  clean.sort((a, b) => parseHm(a.start) - parseHm(b.start));
  for (let i = 0; i < clean.length - 1; i++) {
    if (parseHm(clean[i].end) > parseHm(clean[i + 1].start)) {
      throw new Error('Los turnos no pueden solaparse');
    }
  }
  return clean;
}

/** Admin: guardar los turnos de atención (turno 1 · receso · turno 2 · …). */
function updateShifts(shifts) {
  const clean = validateShifts(shifts);
  const s = readSettings();
  s.shifts = clean;
  return writeSettings(s);
}

function updateMinOrder(minOrder) {
  const n = Number(minOrder);
  if (!Number.isFinite(n) || n < 0) throw new Error('Pedido mínimo inválido');
  const s = readSettings();
  s.minOrder = n;
  return writeSettings(s);
}

module.exports = {
  DEFAULT_MIN_ORDER,
  DEFAULT_SHIFTS,
  readSettings,
  writeSettings,
  getStoreStatus,
  validateOrderAllowed,
  setForceClosed,
  addRestDay,
  removeRestDay,
  addOpenDay,
  removeOpenDay,
  toggleRestDay,
  getDayPlan,
  updateShifts,
  updateMinOrder,
  hoursLabel,
  TIMEZONE,
  getGtParts,
};
