const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateLabel(date) {
  const day = date.getDate();
  const month = MESES[date.getMonth()];
  const year = date.getFullYear();
  return `${day} de ${month}${year ? ` de ${year}` : ''}`;
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
    return `${MESES[mes - 1] || 'Mes'} ${anio}`;
  }

  return 'Periodo no definido';
}
