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
