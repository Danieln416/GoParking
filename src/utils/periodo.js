// ============================================================
// Utilidades de Fechas y Períodos de Cobro — GoParking
// ============================================================

export const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export function parseDate(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    const clean = trimmed.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
      const [year, month, day] = clean.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      return Number.isNaN(date.getTime()) ? null : date;
    }
    const dmyMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
    if (dmyMatch) {
      const day = Number(dmyMatch[1]);
      const month = Number(dmyMatch[2]);
      const year = Number(dmyMatch[3]);
      const date = new Date(year, month - 1, day);
      return Number.isNaN(date.getTime()) ? null : date;
    }
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateLabel(date) {
  if (!date) return '';
  const d = typeof date === 'string' ? parseDate(date) : date;
  if (!d) return '';
  const day = d.getDate();
  const month = MESES[d.getMonth()];
  return `${day} de ${month}`;
}

export function formatDateInput(date) {
  if (!date) return '';
  const d = typeof date === 'string' ? parseDate(date) : date;
  if (!d) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addMonthsKeepingDay(date, months, targetDay) {
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return new Date(target.getFullYear(), target.getMonth(), Math.min(targetDay, lastDay));
}

// ============================================================
// 1. CIERRE FINANCIERO DEL ADMINISTRADOR (Ciclo fijo 12 al 11)
// ============================================================

/**
 * Obtiene el período contable del administrador (el arriendo se paga el 12 de cada mes).
 * Ciclo: 12 de un mes al 11 del mes siguiente.
 */
export function getAdminClosingPeriod(referenceDate = new Date(), offsetMonths = 0) {
  const ref = typeof referenceDate === 'string' ? parseDate(referenceDate) : referenceDate;
  const d = ref || new Date();
  const year = d.getFullYear();
  const month = d.getMonth();
  const day = d.getDate();

  let startYear = year;
  let startMonth = month;

  // Si hoy es antes del 12, el ciclo actual comenzó el 12 del mes anterior
  if (day < 12) {
    startMonth = month - 1;
    if (startMonth < 0) {
      startMonth = 11;
      startYear -= 1;
    }
  }

  // Aplicar desplazamiento de meses (ej. -1 para ciclo anterior, +1 para ciclo siguiente)
  if (offsetMonths !== 0) {
    const shifted = new Date(startYear, startMonth + offsetMonths, 12);
    startYear = shifted.getFullYear();
    startMonth = shifted.getMonth();
  }

  const startDate = new Date(startYear, startMonth, 12);
  const endDate = new Date(startYear, startMonth + 1, 11);

  return {
    startDate: formatDateInput(startDate),
    endDate: formatDateInput(endDate)
  };
}

export function getPreviousAdminClosingPeriod(referenceDate = new Date()) {
  return getAdminClosingPeriod(referenceDate, -1);
}

export function getNextAdminClosingPeriod(referenceDate = new Date()) {
  return getAdminClosingPeriod(referenceDate, 1);
}

// Mantener compatibilidad con llamadas existentes
export function calcularInicioPeriodo(fecha = new Date()) {
  return getAdminClosingPeriod(fecha).startDate;
}

export function calcularFinPeriodo(fecha = new Date()) {
  return getAdminClosingPeriod(fecha).endDate;
}


// ============================================================
// 2. CICLO INDIVIDUAL DE COBRO DEL USUARIO (Fecha de inicio y corte)
// ============================================================

/**
 * Calcula la información completa de cobro y corte para un usuario.
 * @param {string} userStartDate Fecha de inicio del usuario (YYYY-MM-DD)
 * @param {Date|string} referenceDate Fecha de referencia (por defecto hoy)
 * @param {Array} userReceipts Lista de recibos del usuario
 */
export function getUserBillingInfo(userStartDate, referenceDate = new Date(), userReceipts = []) {
  const today = typeof referenceDate === 'string' ? parseDate(referenceDate) : referenceDate || new Date();
  const start = parseDate(userStartDate) || new Date();
  const billingDay = start.getDate();

  const msPerDay = 1000 * 60 * 60 * 24;
  const todayZero = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startZero = new Date(start.getFullYear(), start.getMonth(), start.getDate());

  // Si la fecha de inicio del usuario es en el futuro con respecto a hoy
  if (todayZero < startZero) {
    const diffDays = Math.round((startZero - todayZero) / msPerDay);
    return {
      billingDay,
      periodStart: formatDateInput(startZero),
      periodEnd: formatDateInput(addMonthsKeepingDay(startZero, 1, billingDay)),
      cutoffDate: formatDateInput(startZero),
      status: 'pendiente',
      badge: `Inicia en ${diffDays}d`,
      message: `Tu servicio inicia el ${formatDateLabel(startZero)}.`,
      diffDays,
      receipt: null
    };
  }

  // 1. Determinar el corte mensual más reciente (en o antes de hoy)
  let candidateCutoff = addMonthsKeepingDay(todayZero, 0, billingDay);
  if (todayZero < candidateCutoff) {
    candidateCutoff = addMonthsKeepingDay(todayZero, -1, billingDay);
  }
  // No puede ser antes de la fecha de inicio del usuario
  if (candidateCutoff < startZero) {
    candidateCutoff = startZero;
  }

  const nextCutoff = addMonthsKeepingDay(candidateCutoff, 1, billingDay);
  const periodEnd = new Date(nextCutoff.getFullYear(), nextCutoff.getMonth(), nextCutoff.getDate() - 1);

  const startDateStr = formatDateInput(candidateCutoff);
  const endDateStr = formatDateInput(periodEnd);
  const cutoffDateStr = formatDateInput(candidateCutoff);
  const nextCutoffDateStr = formatDateInput(nextCutoff);

  // Buscar si el usuario tiene un recibo para este ciclo mensual
  const candidateCutoffTime = candidateCutoff.getTime();
  const nextCutoffTime = nextCutoff.getTime();

  const matchingReceipts = (userReceipts || []).filter(r => {
    if (r.fecha_inicio && r.fecha_inicio.slice(0, 10) === startDateStr) {
      return true;
    }
    if (r.fecha_subida) {
      const uploadTime = new Date(r.fecha_subida).getTime();
      const minUpload = candidateCutoffTime - 12 * 86400000;
      const maxUpload = nextCutoffTime + 5 * 86400000;
      return uploadTime >= minUpload && uploadTime <= maxUpload;
    }
    return false;
  });

  const approved = matchingReceipts.find(r => r.estado === 'aprobado');
  const inReview = matchingReceipts.find(r => r.estado === 'en_revision');

  // Días transcurridos desde que venció la fecha de corte (si no ha pagado)
  const diffFromCutoff = Math.round((todayZero - candidateCutoff) / msPerDay);
  // Días que faltan para el siguiente corte (si ya pagó)
  const daysUntilNext = Math.round((nextCutoff - todayZero) / msPerDay);

  if (approved) {
    return {
      billingDay,
      periodStart: startDateStr,
      periodEnd: endDateStr,
      cutoffDate: nextCutoffDateStr,
      status: 'al_dia',
      badge: 'Al día',
      message: `Estás al día. Tu próximo corte es el ${formatDateLabel(nextCutoff)}.`,
      diffDays: daysUntilNext,
      receipt: approved
    };
  } else if (inReview) {
    return {
      billingDay,
      periodStart: startDateStr,
      periodEnd: endDateStr,
      cutoffDate: cutoffDateStr,
      status: 'en_revision',
      badge: 'En revisión',
      message: 'Tu recibo de pago está siendo revisado por el administrador.',
      diffDays: -diffFromCutoff,
      receipt: inReview
    };
  } else {
    return {
      billingDay,
      periodStart: startDateStr,
      periodEnd: endDateStr,
      cutoffDate: cutoffDateStr,
      status: 'vencido',
      badge: diffFromCutoff === 0 ? 'Corte hoy' : `Vencido hace ${diffFromCutoff}d`,
      message: diffFromCutoff === 0
        ? `Hoy es tu fecha límite de pago (${formatDateLabel(candidateCutoff)}). Sube tu comprobante.`
        : `Tu pago venció hace ${diffFromCutoff} ${diffFromCutoff === 1 ? 'día' : 'días'} (el ${formatDateLabel(candidateCutoff)}). Por favor sube tu comprobante.`,
      diffDays: -diffFromCutoff,
      receipt: null
    };
  }
}

/**
 * Genera las opciones estructuradas de período de pago para el usuario.
 */
export function getUserPeriodOptions(userStartDate, referenceDate = new Date(), userReceipts = []) {
  const billing = getUserBillingInfo(userStartDate, referenceDate, userReceipts);
  const start = parseDate(userStartDate) || new Date();
  const billingDay = start.getDate();

  const currentStart = parseDate(billing.periodStart) || new Date();
  
  // Mes anterior
  const prevStart = addMonthsKeepingDay(currentStart, -1, billingDay);
  const prevEnd = new Date(currentStart.getFullYear(), currentStart.getMonth(), currentStart.getDate() - 1);
  
  // Mes siguiente (adelanto)
  const nextStart = addMonthsKeepingDay(currentStart, 1, billingDay);
  const nextCutoff = addMonthsKeepingDay(nextStart, 1, billingDay);
  const nextEnd = new Date(nextCutoff.getFullYear(), nextCutoff.getMonth(), nextCutoff.getDate() - 1);

  const prevOption = {
    id: 'prev',
    label: 'Mes anterior',
    sublabel: 'Comprobante retroactivo o pendiente',
    fechaInicio: formatDateInput(prevStart),
    fechaFin: formatDateInput(prevEnd),
    periodText: `Del ${formatDateLabel(prevStart)} al ${formatDateLabel(prevEnd)}`,
    cutoffText: `Corte: ${formatDateLabel(currentStart)}`
  };

  const currentOption = {
    id: 'current',
    label: billing.isPreviousPeriodOverdue ? 'Mes vencido pendiente' : 'Mes actual',
    sublabel: `Corte mensual: Día ${billingDay} de cada mes`,
    fechaInicio: billing.periodStart,
    fechaFin: billing.periodEnd,
    periodText: `Del ${formatDateLabel(billing.periodStart)} al ${formatDateLabel(billing.periodEnd)}`,
    cutoffText: `Corte: ${formatDateLabel(billing.cutoffDate)}`,
    isRecommended: billing.status !== 'al_dia'
  };

  const nextOption = {
    id: 'next',
    label: 'Mes siguiente (Adelantado)',
    sublabel: 'Pagar anticipadamente el próximo ciclo',
    fechaInicio: formatDateInput(nextStart),
    fechaFin: formatDateInput(nextEnd),
    periodText: `Del ${formatDateLabel(nextStart)} al ${formatDateLabel(nextEnd)}`,
    cutoffText: `Corte: ${formatDateLabel(nextCutoff)}`,
    isRecommended: billing.status === 'al_dia'
  };

  return {
    billing,
    options: [
      currentOption,
      nextOption,
      prevOption
    ],
    defaultOptionId: (billing.status === 'al_dia') ? 'next' : 'current'
  };
}


export function calcularInicioPeriodoUsuario(fecha = new Date(), fechaInicioUsuario) {
  const info = getUserBillingInfo(fechaInicioUsuario, fecha);
  return info.periodStart;
}

export function calcularFinPeriodoUsuario(fecha = new Date(), fechaInicioUsuario) {
  const info = getUserBillingInfo(fechaInicioUsuario, fecha);
  return info.periodEnd;
}

export function calcularFechaFin(fechaInicio) {
  if (!fechaInicio) return '';
  const d = parseDate(fechaInicio);
  if (!d) return '';
  const end = new Date(d.getFullYear(), d.getMonth() + 1, d.getDate() - 1);
  return formatDateInput(end);
}

// ============================================================
// 3. ETIQUETAS Y FORMATOS
// ============================================================

export function formatPeriodoLabel(recibo = {}) {
  const start = parseDate(recibo.fecha_inicio || recibo.periodo_inicio || recibo.inicio_periodo);
  const end = parseDate(recibo.fecha_fin || recibo.periodo_fin || recibo.fin_periodo);

  if (start && end) {
    return `Del ${formatDateLabel(start)} al ${formatDateLabel(end)}`;
  }

  if (start) {
    const calculatedEnd = new Date(start.getFullYear(), start.getMonth() + 1, start.getDate() - 1);
    return `Del ${formatDateLabel(start)} al ${formatDateLabel(calculatedEnd)}`;
  }

  const mes = Number(recibo.mes || 1);
  const anio = Number(recibo.anio || new Date().getFullYear());

  if (mes && anio) {
    const inicio = new Date(anio, mes - 1, 12);
    const fin = new Date(anio, mes, 11);
    return `Del ${formatDateLabel(inicio)} al ${formatDateLabel(fin)}`;
  }

  return 'Periodo no definido';
}

export function getPeriodoKey(value = {}) {
  const start = parseDate(value.fecha_inicio || value.periodo_inicio || value.inicio_periodo);
  if (start) return formatDateInput(start);

  const mes = Number(value.mes);
  const anio = Number(value.anio);
  return mes && anio ? `${anio}-${String(mes).padStart(2, '0')}-12` : '';
}

export function getPeriodoKeyForDate(value) {
  return getPeriodoKey({ fecha_inicio: calcularInicioPeriodo(value) });
}

export function getPeriodoKeyForUser(value, fechaInicioUsuario) {
  return getPeriodoKey({
    fecha_inicio: calcularInicioPeriodoUsuario(value, fechaInicioUsuario)
  });
}

export function getClosedPeriods() {
  try {
    return JSON.parse(localStorage.getItem('goparking-periodos-cerrados') || '[]');
  } catch {
    return [];
  }
}

export function saveClosedPeriod(startDate, endDate) {
  const key = getPeriodoKey({ fecha_inicio: startDate, fecha_fin: endDate });
  if (!key) return;

  const periods = new Set(getClosedPeriods());
  periods.add(key);
  localStorage.setItem('goparking-periodos-cerrados', JSON.stringify([...periods]));
  window.dispatchEvent(new CustomEvent('goparking-period-closed'));
}
