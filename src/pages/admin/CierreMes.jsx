import React, { useState, useEffect } from 'react';
import { Calculator, Plus, Trash2, TrendingUp, TrendingDown, DollarSign, CheckCircle, AlertCircle, X, Download } from 'lucide-react';
import { apiGetCierreMes, apiAgregarGasto, apiEliminarGasto } from '../../api.js';

const getFormattedDate = (date) => {
  return date.toISOString().split('T')[0];
};

export default function CierreMes() {
  const todayStr = getFormattedDate(new Date());
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = getFormattedDate(thirtyDaysAgo);

  const [startDate, setStartDate] = useState(thirtyDaysAgoStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [datos, setDatos] = useState(null);
  const [loading, setLoading] = useState(false);
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

  function showToast(type, msg) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  }

  function fmt(val) { return `$${Number(val || 0).toLocaleString('es-CO')}`; }

  function formatDateLocale(isoString) {
    if (!isoString) return '';
    return new Date(isoString).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
  }

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
          <p className="card-subtitle">Se calcularán los ingresos y gastos registrados entre estas fechas (inclusive)</p>
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
                <h3 className="card-title" style={{ marginBottom: 16 }}>📥 Detalle de Ingresos</h3>
                {datos.detalleIngresos?.length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Sin ingresos registrados en este rango de fechas</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {datos.detalleIngresos?.map((d, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 600 }}>{d.usuario}</p>
                          <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                            {d.placa} · {d.tipo_vehiculo} · Subido: {formatDateLocale(d.fecha)}
                          </p>
                        </div>
                        <span style={{ fontWeight: 700, color: 'var(--accent-green)', fontSize: 14 }}>{fmt(d.valor)}</span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 0', fontWeight: 800, color: 'var(--accent-green)' }}>
                      Total: {fmt(datos.totalIngresos)}
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
