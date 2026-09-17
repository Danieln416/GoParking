const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

function parseDate(value) {
  if (!value) return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateLabel(date) {
  const day = date.getDate();
  const month = MESES[date.getMonth()];
  return `${day} de ${month}`;
}

function formatDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function calcularFechaFin(fechaInicio) {
  if (!fechaInicio) return '';
  const [year, month, day] = fechaInicio.split('-').map(Number);
  const start = new Date(year, month - 1, day);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, start.getDate() - 1);
  return formatDateInput(end);
}

export function calcularInicioPeriodo(fecha = new Date()) {
  const date = typeof fecha === 'string' ? parseDate(fecha) : fecha;
  if (!date) return '';
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate() >= 12 ? 12 : 12);
  if (date.getDate() < 12) start.setMonth(start.getMonth() - 1);
  return formatDateInput(start);
}

export function calcularFinPeriodo(fecha = new Date()) {
  return calcularFechaFin(calcularInicioPeriodo(fecha));
}

export function formatPeriodoLabel(recibo = {}) {
  const start = parseDate(recibo.fecha_inicio || recibo.periodo_inicio || recibo.inicio_periodo);
  const end = parseDate(recibo.fecha_fin || recibo.periodo_fin || recibo.fin_periodo);

  if (start && end) {
    return `Del ${formatDateLabel(start)} al ${formatDateLabel(end)}`;
  }

  const mes = Number(recibo.mes || 1);
  const anio = Number(recibo.anio || new Date().getFullYear());

  if (mes && anio) {
    const dia = 12;
    const inicio = new Date(anio, mes - 1, dia);
    const siguienteMes = mes === 12 ? 1 : mes + 1;
    const anioSiguiente = mes === 12 ? anio + 1 : anio;
    const fin = new Date(anioSiguiente, siguienteMes - 1, dia - 1);
    return `Del ${formatDateLabel(inicio)} al ${formatDateLabel(fin)}`;
  }

  return 'Periodo no definido';
}

export function getPeriodoKey(value = {}) {
  const start = parseDate(value.fecha_inicio || value.periodo_inicio || value.inicio_periodo);
  if (start) return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;

  const mes = Number(value.mes);
  const anio = Number(value.anio);
  return mes && anio ? `${anio}-${String(mes).padStart(2, '0')}` : '';
}

export function getPeriodoKeyForDate(value) {
  return getPeriodoKey({ fecha_inicio: calcularInicioPeriodo(value) });
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
