import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Calculator, Plus, Trash2, TrendingUp, TrendingDown, DollarSign, CheckCircle, AlertCircle, X, Download, ChevronLeft, ChevronRight, Calendar, Receipt, Users, MessageSquare } from 'lucide-react';
import { apiGetCierreMes, apiAgregarGasto, apiEliminarGasto, apiCerrarMes } from '../../api.js';
import {
  calcularFinPeriodo,
  calcularInicioPeriodo,
  getAdminClosingPeriod,
  getPreviousAdminClosingPeriod,
  getNextAdminClosingPeriod,
  saveClosedPeriod
} from '../../utils/periodo.js';

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
  const [incluirEnRevision, setIncluirEnRevision] = useState(false);

  useEffect(() => {
    loadCierre();
  }, []);

  async function loadCierre(overrideStart, overrideEnd) {
    const s = overrideStart || startDate;
    const e = overrideEnd || endDate;
    if (!s || !e) { showToast('error', 'Selecciona el rango de fechas'); return; }
    setLoading(true);
    const res = await apiGetCierreMes(s, e);
    if (res.success) setDatos(res.data);
    else showToast('error', res.error || 'Error al cargar');
    setLoading(false);
  }

  function handleSelectCycle(period) {
    setStartDate(period.startDate);
    setEndDate(period.endDate);
    loadCierre(period.startDate, period.endDate);
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
    if (!confirm(`¿Cerrar el período del ${startDate} al ${endDate}? Los recibos quedarán archivados.`)) return;

    setSaving(true);
    const res = await apiCerrarMes(startDate, endDate);
    if (res.success) {
      saveClosedPeriod(startDate, endDate);
      showToast('success', 'Período cerrado correctamente');
      loadCierre();
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

  // Ingresos del período contable (recibos aprobados + opcionalmente en revisión para cálculo proyectado)
  const ingresosValidados = React.useMemo(() => {
    if (!datos?.detalleIngresos) return [];
    if (incluirEnRevision && datos.recibosPendientes?.length > 0) {
      return [...datos.detalleIngresos, ...datos.recibosPendientes];
    }
    return datos.detalleIngresos;
  }, [datos?.detalleIngresos, datos?.recibosPendientes, incluirEnRevision]);

  const totalIngresos = React.useMemo(() => {
    return ingresosValidados.reduce((sum, d) => sum + (Number(d.valor) || 0), 0);
  }, [ingresosValidados]);

  const totalGastos = React.useMemo(() => {
    return (datos?.gastos || []).reduce((sum, g) => sum + (Number(g.valor) || 0), 0);
  }, [datos?.gastos]);

  const balance = totalIngresos - totalGastos;
  const cantidadRecibos = ingresosValidados.length;

  const metodosDisponibles = React.useMemo(() => {
    const set = new Set();
    ingresosValidados.forEach(d => {
      const m = d.metodo_pago || 'No especificado';
      set.add(m);
    });
    return Array.from(set);
  }, [ingresosValidados]);

  const ingresosFiltrados = React.useMemo(() => {
    if (filtroMetodo === 'todos') return ingresosValidados;
    return ingresosValidados.filter(d => (d.metodo_pago || 'No especificado') === filtroMetodo);
  }, [ingresosValidados, filtroMetodo]);

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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
            <div>
              <h3 className="card-title" style={{ margin: 0 }}>Rango de Cierre Financiero</h3>
              <p className="card-subtitle" style={{ margin: '4px 0 0' }}>
                Ciclo contable del parqueadero: del 12 al 11 de cada mes (fecha de pago de arriendo)
              </p>
            </div>

            {/* Accesos rápidos de ciclos contables */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ fontSize: 12, padding: '4px 10px' }}
                onClick={() => handleSelectCycle(getPreviousAdminClosingPeriod(startDate))}
                title="Ver mes contable anterior (12 al 11)"
              >
                <ChevronLeft size={14} /> Ciclo anterior
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ fontSize: 12, padding: '4px 10px', borderColor: 'rgba(22,199,83,0.4)', color: 'var(--accent-green)' }}
                onClick={() => handleSelectCycle(getAdminClosingPeriod(new Date()))}
                title="Volver al ciclo contable actual"
              >
                <Calendar size={14} /> Ciclo actual (12 al 11)
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ fontSize: 12, padding: '4px 10px' }}
                onClick={() => handleSelectCycle(getNextAdminClosingPeriod(startDate))}
                title="Ver siguiente ciclo"
              >
                Ciclo siguiente <ChevronRight size={14} />
              </button>
            </div>
          </div>

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
            <button className="btn btn-primary" onClick={() => loadCierre()} disabled={loading}>
              {loading ? <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : <Calculator size={16} />}
              Calcular
            </button>
            <button className="btn btn-danger" onClick={handleCerrarMes} disabled={loading || saving || !datos}>
              <CheckCircle size={16} /> Cerrar período
            </button>
          </div>

          <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
            💡 <strong>Criterio contable:</strong> Se contabilizan los ingresos recaudados en este ciclo (del <strong>{startDate}</strong> al <strong>{endDate}</strong>) y los pagos que cubren las mensualidades de este período.
          </div>
        </div>

        {datos && (
          <>
            {/* Aviso de recibos en revisión */}
            {datos.recibosPendientes && datos.recibosPendientes.length > 0 && (
              <div
                className="card"
                style={{
                  marginBottom: 20,
                  border: '1px solid rgba(234, 179, 8, 0.4)',
                  background: 'rgba(234, 179, 8, 0.08)',
                  padding: '14px 18px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <AlertCircle size={22} color="var(--accent-yellow)" />
                    <div>
                      <p style={{ margin: 0, fontWeight: 700, color: 'var(--accent-yellow)', fontSize: 14 }}>
                        {datos.recibosPendientes.length} {datos.recibosPendientes.length === 1 ? 'recibo' : 'recibos'} en revisión ({fmt(datos.totalPendientes)})
                      </p>
                      <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                        Pendientes de aprobación: {datos.recibosPendientes.map(r => `${r.usuario} (${fmt(r.valor)})`).join(', ')}.
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', color: 'var(--text-primary)' }}>
                      <input
                        type="checkbox"
                        checked={incluirEnRevision}
                        onChange={e => setIncluirEnRevision(e.target.checked)}
                      />
                      Incluir en cálculo tentativo
                    </label>
                    <Link to="/admin/recibos" className="btn btn-sm btn-ghost" style={{ borderColor: 'var(--accent-yellow)', color: 'var(--accent-yellow)', fontSize: 12 }}>
                      <Receipt size={14} /> Revisar y Aprobar →
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* Resumen financiero */}
            <div className="cierre-stats">
              <div className="cierre-stat" style={{ borderTop: '3px solid var(--accent-green)' }}>
                <TrendingUp size={24} color="var(--accent-green)" />
                <div className="amount amount-income">{fmt(totalIngresos)}</div>
                <div className="label">Ingresos Recaudados ({cantidadRecibos} {cantidadRecibos === 1 ? 'recibo' : 'recibos'})</div>
              </div>
              <div className="cierre-stat" style={{ borderTop: '3px solid var(--accent-yellow)' }}>
                <Users size={24} color="var(--accent-yellow)" />
                <div className="amount" style={{ color: 'var(--accent-yellow)' }}>{fmt(datos.totalPorCobrar || 0)}</div>
                <div className="label">Por Cobrar ({datos.cantidadUsuariosPendientes || (datos.usuariosPendientes?.length || 0)} clientes)</div>
              </div>
              <div className="cierre-stat" style={{ borderTop: '3px solid var(--accent-cyan)' }}>
                <Calculator size={24} color="var(--accent-cyan)" />
                <div className="amount" style={{ color: 'var(--accent-cyan)' }}>{fmt(datos.totalEsperado || 0)}</div>
                <div className="label">Meta Mensual Esperada</div>
              </div>
              <div className="cierre-stat" style={{ borderTop: '3px solid var(--accent-red)' }}>
                <TrendingDown size={24} color="var(--accent-red)" />
                <div className="amount amount-expense">{fmt(totalGastos)}</div>
                <div className="label">Gastos ({datos.gastos?.length || 0} items)</div>
              </div>
              <div className="cierre-stat" style={{ borderTop: `3px solid ${balance >= 0 ? 'var(--accent-cyan)' : 'var(--accent-red)'}` }}>
                <DollarSign size={24} color={balance >= 0 ? 'var(--accent-cyan)' : 'var(--accent-red)'} />
                <div className={`amount ${balance >= 0 ? 'amount-balance-pos' : 'amount-balance-neg'}`}>
                  {balance >= 0 ? '+' : ''}{fmt(balance)}
                </div>
                <div className="label">Balance de Caja</div>
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
                {ingresosValidados.length > 0 && metodosDisponibles.length > 0 && (
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
                        Todos ({ingresosValidados.length})
                      </button>
                      {metodosDisponibles.map(metodo => {
                        const count = ingresosValidados.filter(d => (d.metodo_pago || 'No especificado') === metodo).length;
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
                            {d.estado === 'en_revision' && (
                              <span className="badge badge-review" style={{ fontSize: 10 }}>
                                En revisión
                              </span>
                            )}
                          </div>
                          <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0 }}>
                            {d.placa ? `${d.placa} · ` : ''}{d.tipo_vehiculo} · Subido: {formatDateLocale(d.fecha)}
                            {d.fecha_inicio ? ` · Ciclo: ${d.fecha_inicio.slice(0, 10)} al ${d.fecha_fin ? d.fecha_fin.slice(0, 10) : ''}` : ''}
                          </p>
                        </div>
                        <span style={{ fontWeight: 700, color: d.estado === 'en_revision' ? 'var(--accent-yellow)' : 'var(--accent-green)', fontSize: 14 }}>
                          {fmt(d.valor)}
                        </span>
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

            {/* Clientes pendientes de pago del período */}
            {datos.usuariosPendientes && datos.usuariosPendientes.length > 0 && (
              <div className="card" style={{ marginTop: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <h3 className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Users size={18} color="var(--accent-yellow)" />
                      Clientes Pendientes de Pago en este Ciclo ({datos.usuariosPendientes.length})
                    </h3>
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                      Clientes activos que aún no han registrado su pago entre {datos.startDate} y {datos.endDate}. Cartera por recaudar: <strong style={{ color: 'var(--accent-yellow)' }}>{fmt(datos.totalPorCobrar)}</strong>
                    </p>
                  </div>
                  <Link to="/admin/recibos" className="btn btn-sm btn-ghost" style={{ fontSize: 12 }}>
                    <Receipt size={14} /> Ir a Recibos →
                  </Link>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 10 }}>
                  {datos.usuariosPendientes.map(u => {
                    let num = String(u.celular || u.telefono || '').replace(/\D/g, '');
                    if (num.length === 10 && num.startsWith('3')) num = '57' + num;
                    const primerNombre = (u.nombre || '').split(' ')[0];
                    const valorFmt = fmt(u.valor_tarifa);
                    
                    let msg = '';
                    if (u.isToday) {
                      msg = `Hola ${primerNombre} 👋, te saludamos del Parqueadero GoParking 🚗.\n\n` +
                        `Te recordamos amablemente que *hoy vence tu mensualidad* (Fecha de corte: ${u.dueDate || 'hoy'}).\n\n` +
                        `💰 *Valor a cancelar:* ${valorFmt}\n\n` +
                        `📌 Por favor sube tu comprobante en la aplicación web una vez realizado el pago para mantener tu registro al día.\n\n` +
                        `¡Muchas gracias por tu puntualidad!`;
                    } else if (u.isOverdue) {
                      msg = `Hola ${primerNombre} 👋, te saludamos del Parqueadero GoParking 🚗.\n\n` +
                        `Te recordamos amablemente que tu mensualidad presenta *${u.diasMora} día(s) de vencimiento* (Fecha de corte: ${u.dueDate}).\n\n` +
                        `💰 *Valor a cancelar:* ${valorFmt}\n\n` +
                        `📌 Por favor sube tu comprobante en la aplicación web una vez realizado el pago para mantener tu registro al día.\n\n` +
                        `¡Muchas gracias por tu puntualidad!`;
                    } else {
                      msg = `Hola ${primerNombre} 👋, te saludamos del Parqueadero GoParking 🚗.\n\n` +
                        `Te recordamos amablemente tu mensualidad correspondiente al ciclo del ${datos.startDate} al ${datos.endDate} (Fecha límite de pago: ${u.dueDate}).\n\n` +
                        `💰 *Valor a cancelar:* ${valorFmt}\n\n` +
                        `📌 Por favor sube tu comprobante en la aplicación web una vez realizado el pago para mantener tu registro al día.\n\n` +
                        `¡Muchas gracias por tu puntualidad!`;
                    }

                    const waLink = num ? `https://wa.me/${num}?text=${encodeURIComponent(msg)}` : null;

                    return (
                      <div
                        key={u.id}
                        style={{
                          padding: '12px 14px',
                          borderRadius: 8,
                          background: 'var(--bg-secondary)',
                          border: (u.isOverdue || u.isToday) ? '1px solid rgba(239, 68, 68, 0.45)' : '1px solid var(--border)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 10
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontWeight: 600, fontSize: 13 }}>{u.nombre}</span>
                            {u.badgeText && (
                              <span
                                className={`badge ${u.isOverdue || u.isToday ? 'badge-rejected' : 'badge-review'}`}
                                style={{ fontSize: 10 }}
                              >
                                {u.badgeText}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                            {u.placa ? `${u.placa} · ` : ''}{u.tipo_vehiculo || 'Mensualidad'}
                            {u.billingDay ? ` · Corte día ${u.billingDay} de cada mes` : ''}
                          </div>
                          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--accent-yellow)', marginTop: 4 }}>
                            {fmt(u.valor_tarifa)}
                          </div>
                        </div>
                        {waLink && (
                          <a
                            href={waLink}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-sm"
                            style={{
                              background: 'rgba(37, 211, 102, 0.15)',
                              color: '#25D366',
                              border: '1px solid rgba(37, 211, 102, 0.35)',
                              padding: '5px 10px',
                              fontSize: 11,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5,
                              textDecoration: 'none',
                              flexShrink: 0
                            }}
                          >
                            <MessageSquare size={13} /> Cobrar
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
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
