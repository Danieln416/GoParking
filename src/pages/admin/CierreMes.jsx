import React, { useState, useEffect } from 'react';
import { Calculator, Plus, Trash2, TrendingUp, TrendingDown, DollarSign, CheckCircle, AlertCircle, X, Download } from 'lucide-react';
import { apiGetCierreMes, apiAgregarGasto, apiEliminarGasto } from '../../api.js';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export default function CierreMes() {
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [anio, setAnio] = useState(now.getFullYear());
  const [datos, setDatos] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showAddGasto, setShowAddGasto] = useState(false);
  const [gastoForm, setGastoForm] = useState({ descripcion: '', valor: '' });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  async function loadCierre() {
    setLoading(true);
    const res = await apiGetCierreMes(mes, anio);
    if (res.success) setDatos(res.data);
    else showToast('error', res.error || 'Error al cargar');
    setLoading(false);
  }

  async function handleAddGasto(e) {
    e.preventDefault();
    if (!gastoForm.descripcion || !gastoForm.valor) { showToast('error', 'Completa todos los campos'); return; }
    setSaving(true);
    const res = await apiAgregarGasto({ ...gastoForm, mes, anio });
    if (res.success) {
      showToast('success', 'Gasto agregado');
      setShowAddGasto(false);
      setGastoForm({ descripcion: '', valor: '' });
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

  return (
    <div className="page-enter">
      <div className="page-header">
        <h1>Cierre de Mes</h1>
        {datos && (
          <button className="btn btn-ghost" onClick={() => window.print()}>
            <Download size={15} /> Imprimir
          </button>
        )}
      </div>

      <div className="page-body">
        {/* Selector de período */}
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 className="card-title">Seleccionar período</h3>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ marginBottom: 0, minWidth: 160 }}>
              <label>Mes</label>
              <select className="form-select" value={mes} onChange={e => setMes(Number(e.target.value))}>
                {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Año</label>
              <select className="form-select" value={anio} onChange={e => setAnio(Number(e.target.value))}>
                {years.map(y => <option key={y}>{y}</option>)}
              </select>
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
                <div className="label">Ingresos ({datos.cantidadRecibos} recibos)</div>
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
                <div className="label">Balance del mes</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              {/* Detalle de ingresos */}
              <div className="card">
                <h3 className="card-title" style={{ marginBottom: 16 }}>📥 Detalle de Ingresos</h3>
                {datos.detalleIngresos?.length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Sin ingresos registrados</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {datos.detalleIngresos?.map((d, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 600 }}>{d.usuario}</p>
                          <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{d.placa} · {d.tipo_vehiculo}</p>
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
                    <p style={{ fontSize: 13 }}>Sin gastos registrados</p>
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
                          <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{new Date(g.fecha_registro).toLocaleDateString('es-CO')}</p>
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
              <h2>Agregar Gasto — {MESES[mes - 1]} {anio}</h2>
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
