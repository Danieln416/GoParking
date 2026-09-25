import React, { useState, useEffect } from 'react';
import { Calculator, Plus, Trash2, TrendingUp, TrendingDown, DollarSign, CheckCircle, AlertCircle, X, Download } from 'lucide-react';
import { apiGetCierreMes, apiAgregarGasto, apiEliminarGasto, apiCerrarMes } from '../../api.js';
import { calcularFinPeriodo, calcularInicioPeriodo, saveClosedPeriod } from '../../utils/periodo.js';

const getFormattedDate = (date) => {
  return date.toISOString().split('T')[0];
};

export default function CierreMes() {
  const today = new Date();
  const todayStr = getFormattedDate(today);
  const currentPeriodStart = calcularInicioPeriodo(today);
  const currentPeriodEnd = calcularFinPeriodo(today);

  const [startDate, setStartDate] = useState(currentPeriodStart);
  const [endDate, setEndDate] = useState(currentPeriodEnd);
  const [datos, setDatos] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filtroMetodo, setFiltroMetodo] = useState('todos');
  const [showAddGasto, setShowAddGasto] = useState(false);
  const [gastoForm, setGastoForm] = useState({ descripcion: '', valor: '', fecha: todayStr });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    loadCierre();
  }, []);

  async function loadCierre() {
    if (!startDate || !endDate) { showToast('error', 'Selecciona el rango de fechas'); return; }
    setLoading(true);
    const res = await apiGetCierreMes(startDate, endDate);
    if (res.success) setDatos(res.data);
    else showToast('error', res.error || 'Error al cargar');
    setLoading(false);
  }

  async function handleAddGasto(e) {
    e.preventDefault();
    if (!gastoForm.descripcion || !gastoForm.valor || !gastoForm.fecha) {
      showToast('error', 'Completa todos los campos');
      return;
    }
    setSaving(true);
    const res = await apiAgregarGasto(gastoForm);
    if (res.success) {
      showToast('success', 'Gasto agregado');
      setShowAddGasto(false);
      setGastoForm({ descripcion: '', valor: '', fecha: todayStr });
      loadCierre();
    } else showToast('error', res.error || 'Error');
    setSaving(false);
  }

  async function handleEliminarGasto(id) {
    if (!confirm('¿Eliminar este gasto?')) return;
    const res = await apiEliminarGasto(id);
    if (res.success) { showToast('success', 'Gasto eliminado'); loadCierre(); }
    else showToast('error', res.error || 'Error');
  }

  async function handleCerrarMes() {
    if (!startDate || !endDate) {
      showToast('error', 'Selecciona el rango que deseas cerrar');
      return;
    }
    if (!confirm(`¿Cerrar el período del ${startDate} al ${endDate}? Los recibos quedarán ocultos por defecto.`)) return;

    setSaving(true);
    const res = await apiCerrarMes(startDate, endDate);
    if (res.success) {
      saveClosedPeriod(startDate, endDate);
      showToast('success', 'Período cerrado correctamente');
    } else {
      showToast('error', res.error || 'El backend no pudo cerrar este período');
    }
    setSaving(false);
  }

  function showToast(type, msg) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  }

  function fmt(val) { return `$${Number(val || 0).toLocaleString('es-CO')}`; }

  function formatDateLocale(isoString) {
    if (!isoString) return '';
    return new Date(isoString).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  const metodosDisponibles = React.useMemo(() => {
    if (!datos?.detalleIngresos) return [];
    const set = new Set();
    datos.detalleIngresos.forEach(d => {
      const m = d.metodo_pago || 'No especificado';
      set.add(m);
    });
    return Array.from(set);
  }, [datos?.detalleIngresos]);

  const ingresosFiltrados = React.useMemo(() => {
    if (!datos?.detalleIngresos) return [];
    if (filtroMetodo === 'todos') return datos.detalleIngresos;
    return datos.detalleIngresos.filter(d => (d.metodo_pago || 'No especificado') === filtroMetodo);
  }, [datos?.detalleIngresos, filtroMetodo]);

  const subtotalIngresosFiltrados = React.useMemo(() => {
    return ingresosFiltrados.reduce((sum, d) => sum + (Number(d.valor) || 0), 0);
  }, [ingresosFiltrados]);

  return (
    <div className="page-enter">
      <div className="page-header">
        <h1>Cierre de Caja / Período</h1>
        {datos && (
          <button className="btn btn-ghost" onClick={() => window.print()}>
            <Download size={15} /> Imprimir
          </button>
        )}
      </div>

      <div className="page-body">
        {/* Selector de período móvil */}
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 className="card-title">Seleccionar rango de fechas</h3>
          <p className="card-subtitle">Período general del parqueadero: del 12 al 11 del siguiente mes</p>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ marginBottom: 0, minWidth: 160 }}>
              <label>Fecha de Inicio</label>
              <input
                type="date"
                className="form-input"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0, minWidth: 160 }}>
              <label>Fecha de Fin</label>
              <input
                type="date"
                className="form-input"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
              />
            </div>
            <button className="btn btn-primary" onClick={loadCierre} disabled={loading}>
              {loading ? <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : <Calculator size={16} />}
              Calcular
            </button>
            <button className="btn btn-danger" onClick={handleCerrarMes} disabled={loading || saving || !datos}>
              <CheckCircle size={16} /> Cerrar período
            </button>
          </div>
        </div>

        {datos && (
          <>
            {/* Resumen financiero */}
            <div className="cierre-stats">
              <div className="cierre-stat" style={{ borderTop: '3px solid var(--accent-green)' }}>
                <TrendingUp size={24} color="var(--accent-green)" />
                <div className="amount amount-income">{fmt(datos.totalIngresos)}</div>
                <div className="label">Ingresos ({datos.cantidadRecibos} recibos aprobados)</div>
              </div>
              <div className="cierre-stat" style={{ borderTop: '3px solid var(--accent-red)' }}>
                <TrendingDown size={24} color="var(--accent-red)" />
                <div className="amount amount-expense">{fmt(datos.totalGastos)}</div>
                <div className="label">Gastos ({datos.gastos?.length || 0} items)</div>
              </div>
              <div className="cierre-stat" style={{ borderTop: `3px solid ${datos.balance >= 0 ? 'var(--accent-cyan)' : 'var(--accent-red)'}` }}>
                <DollarSign size={24} color={datos.balance >= 0 ? 'var(--accent-cyan)' : 'var(--accent-red)'} />
                <div className={`amount ${datos.balance >= 0 ? 'amount-balance-pos' : 'amount-balance-neg'}`}>
                  {datos.balance >= 0 ? '+' : ''}{fmt(datos.balance)}
                </div>
                <div className="label">Balance del período</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              {/* Detalle de ingresos */}
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                  <h3 className="card-title" style={{ margin: 0 }}>📥 Detalle de Ingresos</h3>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {ingresosFiltrados.length} {ingresosFiltrados.length === 1 ? 'recibo' : 'recibos'}
                  </span>
                </div>

                {/* Filtro por método de pago */}
                {datos.detalleIngresos?.length > 0 && metodosDisponibles.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginRight: 2 }}>
                        Filtrar:
                      </span>
                      <button
                        type="button"
                        className={`btn btn-sm ${filtroMetodo === 'todos' ? 'btn-primary' : 'btn-ghost'}`}
                        style={{ padding: '3px 9px', fontSize: 11, height: 'auto' }}
                        onClick={() => setFiltroMetodo('todos')}
                      >
                        Todos ({datos.detalleIngresos.length})
                      </button>
                      {metodosDisponibles.map(metodo => {
                        const count = datos.detalleIngresos.filter(d => (d.metodo_pago || 'No especificado') === metodo).length;
                        const isSelected = filtroMetodo === metodo;
                        return (
                          <button
                            key={metodo}
                            type="button"
                            className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-ghost'}`}
                            style={{ padding: '3px 9px', fontSize: 11, height: 'auto' }}
                            onClick={() => setFiltroMetodo(metodo)}
                          >
                            {metodo} ({count})
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {ingresosFiltrados.length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)', fontSize: 13, padding: '16px 0' }}>
                    {filtroMetodo === 'todos' 
                      ? 'Sin ingresos registrados en este rango de fechas' 
                      : `No hay recibos con el método de pago "${filtroMetodo}"`}
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {ingresosFiltrados.map((d, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                            <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>{d.usuario}</p>
                            <span 
                              className="badge" 
                              style={{ 
                                fontSize: 10, 
                                background: 'rgba(22, 199, 83, 0.15)', 
                                color: 'var(--accent-green)', 
                                border: '1px solid rgba(22, 199, 83, 0.3)' 
                              }}
                            >
                              {d.metodo_pago || 'No especificado'}
                            </span>
                          </div>
                          <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0 }}>
                            {d.placa} · {d.tipo_vehiculo} · Subido: {formatDateLocale(d.fecha)}
                          </p>
                        </div>
                        <span style={{ fontWeight: 700, color: 'var(--accent-green)', fontSize: 14 }}>{fmt(d.valor)}</span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', fontWeight: 800, color: 'var(--accent-green)' }}>
                      <span>
                        {filtroMetodo === 'todos' ? 'Total Ingresos:' : `Subtotal (${filtroMetodo}):`}
                      </span>
                      <span>{fmt(subtotalIngresosFiltrados)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Gastos */}
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 className="card-title" style={{ marginBottom: 0 }}>📤 Gastos</h3>
                  <button className="btn btn-danger btn-sm" onClick={() => setShowAddGasto(true)}>
                    <Plus size={14} /> Agregar
                  </button>
                </div>

                {datos.gastos?.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-secondary)' }}>
                    <p style={{ fontSize: 13 }}>Sin gastos registrados en este rango de fechas</p>
                    <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => setShowAddGasto(true)}>
                      <Plus size={14} /> Agregar gasto
                    </button>
                  </div>
                ) : (
                  <div>
                    {datos.gastos?.map((g, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 600 }}>{g.descripcion}</p>
                          <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{formatDateLocale(g.fecha_registro)}</p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 700, color: 'var(--accent-red)' }}>{fmt(g.valor)}</span>
                          <button className="btn btn-danger btn-icon" style={{ width: 28, height: 28 }} onClick={() => handleEliminarGasto(g.id)}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 0', fontWeight: 800, color: 'var(--accent-red)' }}>
                      Total: {fmt(datos.totalGastos)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modal agregar gasto */}
      {showAddGasto && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowAddGasto(false)}>
          <div className="modal-box">
            <div className="modal-header">
              <h2>Registrar Gasto</h2>
              <button className="modal-close" onClick={() => setShowAddGasto(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleAddGasto}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Descripción del gasto</label>
                  <input
                    type="text" className="form-input"
                    placeholder="Ej: Arriendo, Servicios, Mantenimiento..."
                    value={gastoForm.descripcion}
                    onChange={e => setGastoForm(f => ({ ...f, descripcion: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label>Valor ($)</label>
                  <input
                    type="number" className="form-input"
                    placeholder="0"
                    value={gastoForm.valor}
                    onChange={e => setGastoForm(f => ({ ...f, valor: e.target.value }))}
                    min="0"
                  />
                </div>
                <div className="form-group">
                  <label>Fecha de gasto</label>
                  <input
                    type="date"
                    className="form-input"
                    value={gastoForm.fecha}
                    onChange={e => setGastoForm(f => ({ ...f, fecha: e.target.value }))}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowAddGasto(false)}>Cancelar</button>
                <button type="submit" className="btn btn-danger" disabled={saving}>
                  {saving ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : <Plus size={14} />}
                  Agregar Gasto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && (
        <div className="toast-container">
          <div className={`toast ${toast.type === 'success' ? 'toast-success' : 'toast-error'}`}>
            {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
            {toast.msg}
          </div>
        </div>
      )}
    </div>
  );
}
