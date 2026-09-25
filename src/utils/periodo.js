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
    const clean = value.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
      const [year, month, day] = clean.split('-').map(Number);
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
export function getAdminClosingPeriod(referenceDate = new Date()) {
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

  const startDate = new Date(startYear, startMonth, 12);
  const endDate = new Date(startYear, startMonth + 1, 11);

  return {
    startDate: formatDateInput(startDate),
    endDate: formatDateInput(endDate)
  };
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

  // Determinar el inicio del período mensual activo
  let periodStart = addMonthsKeepingDay(today, 0, billingDay);
  if (today < periodStart) {
    periodStart = addMonthsKeepingDay(today, -1, billingDay);
  }

  // Si el período calculado es previo a la fecha de inicio del usuario, usar la fecha de inicio
  if (periodStart < start) {
    periodStart = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  }

  // Fin del período: 1 día antes del corte del mes siguiente
  const nextCutoff = addMonthsKeepingDay(periodStart, 1, billingDay);
  const periodEnd = new Date(nextCutoff.getFullYear(), nextCutoff.getMonth(), nextCutoff.getDate() - 1);

  const startDateStr = formatDateInput(periodStart);
  const endDateStr = formatDateInput(periodEnd);
  const cutoffDateStr = formatDateInput(nextCutoff);

  // Buscar si el usuario ya tiene un recibo para este período
  const periodReceipts = (userReceipts || []).filter(r => {
    // Coincidencia exacta con fecha_inicio registrada
    if (r.fecha_inicio && r.fecha_inicio.slice(0, 10) === startDateStr) {
      return true;
    }
    // O comprobante subido dentro de la ventana del período
    if (r.fecha_subida) {
      const uploadDate = r.fecha_subida.slice(0, 10);
      const toleranceEnd = formatDateInput(new Date(nextCutoff.getTime() + 5 * 86400000));
      return uploadDate >= startDateStr && uploadDate <= toleranceEnd;
    }
    return false;
  });

  const approved = periodReceipts.find(r => r.estado === 'aprobado');
  const inReview = periodReceipts.find(r => r.estado === 'en_revision');
  const activeReceipt = approved || inReview || periodReceipts[0] || null;

  // Cálculo de días restantes o vencimiento
  const msPerDay = 1000 * 60 * 60 * 24;
  const todayZero = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const cutoffZero = new Date(nextCutoff.getFullYear(), nextCutoff.getMonth(), nextCutoff.getDate());
  const diffDays = Math.round((cutoffZero - todayZero) / msPerDay);

  let status = 'pendiente'; // 'al_dia' | 'en_revision' | 'pendiente' | 'vencido'
  let message = '';
  let badge = '';

  if (approved) {
    status = 'al_dia';
    badge = 'Al día';
    message = `Estás al día. Tu próximo corte es el ${formatDateLabel(nextCutoff)}.`;
  } else if (inReview) {
    status = 'en_revision';
    badge = 'En revisión';
    message = 'Tu recibo de pago está siendo revisado por el administrador.';
  } else if (diffDays < 0) {
    status = 'vencido';
    badge = 'Pago vencido';
    const diasVencido = Math.abs(diffDays);
    message = `Tu pago venció hace ${diasVencido} ${diasVencido === 1 ? 'día' : 'días'} (el ${formatDateLabel(nextCutoff)}). Por favor sube tu comprobante.`;
  } else if (diffDays === 0) {
    status = 'vencido';
    badge = 'Corte hoy';
    message = `Hoy es tu fecha límite de pago (${formatDateLabel(nextCutoff)}). Sube tu comprobante.`;
  } else {
    status = 'pendiente';
    badge = `Corte en ${diffDays}d`;
    message = `Tu fecha de corte es el ${formatDateLabel(nextCutoff)}. Recuerda realizar tu pago.`;
  }

  return {
    billingDay,
    periodStart: startDateStr,
    periodEnd: endDateStr,
    cutoffDate: cutoffDateStr,
    status,
    badge,
    message,
    diffDays,
    receipt: activeReceipt
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
