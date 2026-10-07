import React, { useEffect, useMemo, useState } from 'react';
import {
  Receipt,
  Check,
  X,
  ExternalLink,
  Filter,
  CheckCircle,
  AlertCircle,
  MessageSquare,
  Send,
  Users,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Search
} from 'lucide-react';
import {
  apiGetRecibos,
  apiGetUsuarios,
  apiAprobarRecibo,
  apiRechazarRecibo,
  apiDispararWhatsAppMora,
  apiGetCierreMes
} from '../../api.js';
import {
  formatPeriodoLabel,
  getAdminClosingPeriod,
  getPreviousAdminClosingPeriod,
  getNextAdminClosingPeriod,
  formatDateLabel
} from '../../utils/periodo.js';
import { getReceiptMediaUrl, getReceiptViewerUrl } from '../../utils/media.js';

const ADMIN_CYCLE = getAdminClosingPeriod(new Date());

export default function RecibosAdmin() {
  const [recibos, setRecibos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cierreLoading, setCierreLoading] = useState(false);
  const [cierreData, setCierreData] = useState(null);
  const [filter, setFilter] = useState('en_revision');
  const [searchMoroso, setSearchMoroso] = useState('');
  const [selectedRecibo, setSelectedRecibo] = useState(null);
  const [nota, setNota] = useState('');
  const [processing, setProcessing] = useState(false);
  const [toast, setToast] = useState(null);
  const [startDate, setStartDate] = useState(ADMIN_CYCLE.startDate);
  const [endDate, setEndDate] = useState(ADMIN_CYCLE.endDate);
  const [brokenImages, setBrokenImages] = useState({});
  const [imageRetries, setImageRetries] = useState({});
  const [runningSweep, setRunningSweep] = useState(false);

  useEffect(() => {
    loadRecibos();
  }, []);

  useEffect(() => {
    if (startDate && endDate) {
      loadCierre(startDate, endDate);
    } else {
      setCierreData(null);
    }
  }, [startDate, endDate]);

  async function loadRecibos() {
    const res = await apiGetRecibos('all');
    if (res.success) {
      setRecibos([...res.data].sort((a, b) => new Date(b.fecha_subida) - new Date(a.fecha_subida)));
    }
    setLoading(false);
  }

  async function loadCierre(s, e) {
    if (!s || !e) return;
    setCierreLoading(true);
    try {
      const res = await apiGetCierreMes(s, e);
      if (res.success) {
        setCierreData(res.data);
      }
    } catch (err) {
      console.error('Error al cargar datos de cierre:', err);
    } finally {
      setCierreLoading(false);
    }
  }

  function handleSelectCycle(period) {
    setStartDate(period.startDate);
    setEndDate(period.endDate);
  }

  function handleVerTodos() {
    setStartDate('');
    setEndDate('');
  }

  function handleImageError(id) {
    setImageRetries(prev => {
      if (!prev[id]) {
        return { ...prev, [id]: true };
      }
      setBrokenImages(curr => ({ ...curr, [id]: true }));
      return prev;
    });
  }

  async function handleAprobar(recibo) {
    setProcessing(true);
    const notaFinal = nota || 'Aprobado por el administrador';

    // Actualización optimista
    setRecibos(prev => prev.map(item => item.id === recibo.id ? { ...item, estado: 'aprobado', admin_nota: notaFinal } : item));
    setSelectedRecibo(null);
    setNota('');
    showToast('success', 'Recibo aprobado correctamente');

    const res = await apiAprobarRecibo(recibo.id, notaFinal);
    if (!res.success) {
      showToast('error', res.error || 'Error al guardar la aprobación en el servidor');
      loadRecibos();
    } else {
      if (startDate && endDate) loadCierre(startDate, endDate);
    }
    setProcessing(false);
  }

  async function handleRechazar(recibo) {
    if (!nota) { showToast('error', 'Indica el motivo del rechazo'); return; }
    setProcessing(true);

    // Actualización optimista
    setRecibos(prev => prev.map(item => item.id === recibo.id ? { ...item, estado: 'rechazado', admin_nota: nota } : item));
    setSelectedRecibo(null);
    setNota('');
    showToast('success', 'Recibo rechazado');

    const res = await apiRechazarRecibo(recibo.id, nota);
    if (!res.success) {
      showToast('error', res.error || 'Error al guardar el rechazo en el servidor');
      loadRecibos();
    } else {
      if (startDate && endDate) loadCierre(startDate, endDate);
    }
    setProcessing(false);
  }

  function showToast(type, msg) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  }

  async function handleDispararBarrido() {
    setRunningSweep(true);
    try {
      const res = await apiDispararWhatsAppMora();
      if (res.success) {
        showToast('success', `Barrido finalizado: ${res.enviados || 0} enviados, ${res.omitidos || 0} ya notificados hoy`);
      } else {
        showToast('error', res.error || 'Error al ejecutar barrido de WhatsApp');
      }
    } catch (err) {
      showToast('error', 'Error al conectar: ' + err.message);
    } finally {
      setRunningSweep(false);
    }
  }

  function buildWhatsAppLink(user) {
    let num = String(user.celular || user.telefono || '').replace(/\D/g, '');
    if (num.length === 10 && num.startsWith('3')) num = '57' + num;
    const primerNombre = (user.nombre || '').split(' ')[0];
    const valorFmt = `$${Number(user.valor_tarifa || 0).toLocaleString('es-CO')}`;
    const corteDia = user.fecha_inicio ? new Date(user.fecha_inicio).getDate() : null;

    const periodoTxt = startDate && endDate
      ? `del ${startDate} al ${endDate}`
      : 'del ciclo actual';

    const msg = `Hola ${primerNombre} 👋, te saludamos del Parqueadero GoParking 🚗.\n\n` +
      `Te recordamos amablemente tu mensualidad correspondiente al ciclo ${periodoTxt}` +
      (corteDia ? ` (Día de corte: ${corteDia} de cada mes)` : '') + `.\n\n` +
      `💰 *Valor a cancelar:* ${valorFmt}\n\n` +
      `📌 Por favor sube tu comprobante en la aplicación web una vez realizado el pago para mantener tu registro al día.\n\n` +
      `¡Muchas gracias por tu puntualidad!`;

    return `https://wa.me/${num}?text=${encodeURIComponent(msg)}`;
  }

  // Recibos filtrados por el rango de fechas seleccionado
  const dateRangeRecibos = useMemo(() => {
    if (!startDate && !endDate) return recibos;
    return recibos.filter(r => {
      const uploadDate = r.fecha_subida ? r.fecha_subida.slice(0, 10) : (r.fecha_inicio ? r.fecha_inicio.slice(0, 10) : '');
      const fromMatches = !startDate || (uploadDate ? uploadDate >= startDate : true);
      const toMatches = !endDate || (uploadDate ? uploadDate <= endDate : true);
      return fromMatches && toMatches;
    });
  }, [recibos, startDate, endDate]);

  const filtered = useMemo(() => {
    if (filter === 'todos') return dateRangeRecibos;
    return dateRangeRecibos.filter(r => r.estado === filter);
  }, [dateRangeRecibos, filter]);

  const counts = useMemo(() => ({
    en_revision: dateRangeRecibos.filter(r => r.estado === 'en_revision').length,
    aprobado: dateRangeRecibos.filter(r => r.estado === 'aprobado').length,
    rechazado: dateRangeRecibos.filter(r => r.estado === 'rechazado').length,
    todos: dateRangeRecibos.length
  }), [dateRangeRecibos]);

  // Lista de usuarios pendientes del ciclo sincronizada con el backend (Cierre de Mes)
  const unpaidUsers = useMemo(() => {
    const list = cierreData?.usuariosPendientes || [];
    if (!searchMoroso.trim()) return list;
    const q = searchMoroso.toLowerCase();
    return list.filter(u =>
      (u.nombre || '').toLowerCase().includes(q) ||
      (u.placa || '').toLowerCase().includes(q) ||
      (u.correo || '').toLowerCase().includes(q) ||
      (u.celular || '').includes(q)
    );
  }, [cierreData?.usuariosPendientes, searchMoroso]);

  const totalPorCobrarUnpaid = cierreData?.totalPorCobrar || 0;

  function getUserBadge(user) {
    if (!user.fecha_inicio) return { text: 'Cobro pendiente', isOverdue: false };
    const billingDay = new Date(user.fecha_inicio).getDate();
    const today = new Date();
    const todayDay = today.getDate();

    if (todayDay === billingDay) {
      return { text: 'Corte hoy', isOverdue: true };
    }
    if (todayDay > billingDay) {
      return { text: `Vencido (día ${billingDay})`, isOverdue: true };
    }
    return { text: `Cobro pendiente (corte día ${billingDay})`, isOverdue: false };
  }

  return (
    <div className="page-enter">
      <div className="page-header">
        <h1>Recibos de Pago</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Filter size={16} color="var(--text-secondary)" />
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {counts.en_revision} en revisión ({counts.todos} recibos del período)
          </span>
        </div>
      </div>

      <div className="page-body">
        {/* Selector de Ciclo Contable y Rango de Fechas */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
            <div>
              <h3 className="card-title" style={{ margin: 0 }}>Período Contable de Recibos</h3>
              <p className="card-subtitle" style={{ margin: '4px 0 0' }}>
                Ciclo mensual del 12 al 11 · Sincronizado con el balance y cierre de caja
              </p>
            </div>

            {/* Accesos rápidos de ciclos contables */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ fontSize: 12, padding: '4px 10px' }}
                onClick={() => handleSelectCycle(getPreviousAdminClosingPeriod(startDate || new Date()))}
                title="Ver ciclo contable anterior (12 al 11)"
              >
                <ChevronLeft size={14} /> Ciclo anterior
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ fontSize: 12, padding: '4px 10px', borderColor: 'rgba(22,199,83,0.4)', color: 'var(--accent-green)' }}
                onClick={() => handleSelectCycle(ADMIN_CYCLE)}
                title="Volver al ciclo actual"
              >
                <Calendar size={14} /> Ciclo actual (12 al 11)
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ fontSize: 12, padding: '4px 10px' }}
                onClick={() => handleSelectCycle(getNextAdminClosingPeriod(startDate || new Date()))}
                title="Ver siguiente ciclo"
              >
                Ciclo siguiente <ChevronRight size={14} />
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ fontSize: 12, padding: '4px 10px' }}
                onClick={handleVerTodos}
                title="Ver todos los recibos sin límite de fecha"
              >
                Ver todos
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ marginBottom: 0, minWidth: 150 }}>
              <label>Desde</label>
              <input type="date" className="form-input" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0, minWidth: 150 }}>
              <label>Hasta</label>
              <input type="date" className="form-input" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
            {startDate && endDate && (
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', paddingBottom: 10 }}>
                Mostrando recibos y clientes del <strong>{startDate}</strong> al <strong>{endDate}</strong>
              </span>
            )}
          </div>
        </div>

        {/* Botones de filtro de recibos */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {[
            { key: 'en_revision', label: '⏳ En revisión', count: counts.en_revision },
            { key: 'aprobado', label: '✓ Aprobados', count: counts.aprobado },
            { key: 'rechazado', label: '✗ Rechazados', count: counts.rechazado },
            { key: 'todos', label: 'Todos', count: counts.todos },
          ].map(f => (
            <button key={f.key} className={`btn btn-sm ${filter === f.key ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFilter(f.key)}>
              {f.label} ({f.count})
            </button>
          ))}
        </div>

        {/* Tarjeta de Clientes con Pago Pendiente en este ciclo */}
        {startDate && endDate && (
          <div className="card" style={{ marginBottom: 20, borderColor: (cierreData?.usuariosPendientes?.length || 0) > 0 ? 'rgba(239, 68, 68, 0.4)' : undefined }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 10 }}>
              <div>
                <h3 className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Users size={18} color="var(--accent-red)" />
                  Estado de Cobros del Ciclo ({cierreData?.usuariosPendientes?.length || 0} clientes con cobro pendiente)
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                  Clientes activos sin comprobante registrado entre {startDate} y {endDate} · Cartera por recaudar: <strong style={{ color: 'var(--accent-yellow)' }}>${totalPorCobrarUnpaid.toLocaleString('es-CO')}</strong>
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', width: 180 }}>
                  <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: 10, top: 10 }} />
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Buscar cliente..."
                    value={searchMoroso}
                    onChange={e => setSearchMoroso(e.target.value)}
                    style={{ paddingLeft: 30, fontSize: 12, height: 32 }}
                  />
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: 12, color: '#25D366', borderColor: 'rgba(37, 211, 102, 0.4)', padding: '5px 12px' }}
                  onClick={handleDispararBarrido}
                  disabled={runningSweep}
                  title="Ejecutar barrido automático de Cloudflare para notificar morosos"
                >
                  {runningSweep ? <span className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} /> : <Send size={13} />}
                  Barrido WhatsApp
                </button>
              </div>
            </div>

            {cierreLoading ? (
              <div style={{ textAlign: 'center', padding: 20 }}><div className="spinner" style={{ margin: '0 auto', width: 20, height: 20 }} /></div>
            ) : unpaidUsers.length ? (
              <div style={{ display: 'grid', gap: 8, maxHeight: 350, overflowY: 'auto', marginTop: 10 }}>
                {unpaidUsers.map(user => {
                  const badgeInfo = getUserBadge(user);
                  return (
                    <div
                      key={user.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 12px',
                        borderRadius: 8,
                        background: 'var(--bg-secondary)',
                        border: badgeInfo.isOverdue ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid var(--border)'
                      }}
                    >
                      <div>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{user.nombre}</span>
                        <span style={{ color: 'var(--text-muted)', marginLeft: 8, fontSize: 12 }}>
                          {user.placa ? `${user.placa} · ` : ''}{user.tipo_vehiculo || 'Mensualidad'}
                        </span>
                        <span style={{ color: 'var(--accent-yellow)', marginLeft: 8, fontSize: 12, fontWeight: 700 }}>
                          ${Number(user.valor_tarifa || 0).toLocaleString('es-CO')}
                        </span>
                        {user.fecha_inicio && (
                          <span style={{ color: 'var(--text-secondary)', marginLeft: 8, fontSize: 11 }}>
                            · Corte día {new Date(user.fecha_inicio).getDate()} de cada mes
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                          className={`badge ${badgeInfo.isOverdue ? 'badge-rejected' : 'badge-review'}`}
                          style={{ fontSize: 11 }}
                        >
                          {badgeInfo.text}
                        </span>
                        {(user.celular || user.telefono) && (
                          <a
                            href={buildWhatsAppLink(user)}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-sm"
                            style={{
                              background: 'rgba(37, 211, 102, 0.15)',
                              color: '#25D366',
                              border: '1px solid rgba(37, 211, 102, 0.35)',
                              padding: '3px 8px',
                              fontSize: 11,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              textDecoration: 'none'
                            }}
                            title={`Abrir WhatsApp para recordar pago a ${user.nombre}`}
                          >
                            <MessageSquare size={12} /> WhatsApp
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p style={{ fontSize: 13, color: 'var(--accent-green)', margin: '10px 0 0' }}>
                ✓ Todos los clientes se encuentran al día con sus pagos en este ciclo ({startDate} al {endDate}).
              </p>
            )}
          </div>
        )}

        {/* Cuadrícula de Recibos */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <Receipt size={48} />
            <h3>Sin recibos</h3>
            <p>No hay recibos en esta categoría para el rango seleccionado</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 16 }}>
            {filtered.map(r => (
              <div key={r.id} className="card" style={{ cursor: 'pointer' }} onClick={() => { setSelectedRecibo(r); setNota(''); }}>
                {/* Imagen del recibo */}
                {getReceiptMediaUrl(r) && !brokenImages[r.id] ? (
                  <div style={{ borderRadius: 10, overflow: 'hidden', marginBottom: 14, border: '1px solid var(--border)' }}>
                    <img
                      src={getReceiptMediaUrl(r, Boolean(imageRetries[r.id]))}
                      alt="recibo"
                      loading="lazy"
                      onError={() => handleImageError(r.id)}
                      style={{ width: '100%', height: 160, objectFit: 'cover' }}
                    />
                  </div>
                ) : (
                  <div style={{ height: 120, background: 'var(--bg-secondary)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                    <Receipt size={36} color="var(--text-muted)" />
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: 14 }}>{r.usuario_nombre}</p>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{r.usuario_correo}</p>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                      {formatPeriodoLabel(r)}
                    </p>
                  </div>
                  <EstadoBadge estado={r.estado} />
                </div>

                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                  Subido: {new Date(r.fecha_subida).toLocaleDateString('es-CO')}
                </p>

                {getReceiptViewerUrl(r) && (
                  <a href={getReceiptViewerUrl(r)} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" style={{ marginTop: 10 }} onClick={e => e.stopPropagation()}>
                    <ExternalLink size={14} /> Ver recibo
                  </a>
                )}

                {r.estado === 'en_revision' && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }} onClick={e => e.stopPropagation()}>
                    <button className="btn btn-success btn-sm btn-full" onClick={() => { setSelectedRecibo(r); setNota(''); }}>
                      <Check size={14} /> Revisar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de revisión */}
      {selectedRecibo && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setSelectedRecibo(null)}>
          <div className="modal-box modal-lg">
            <div className="modal-header">
              <h2>Revisar Recibo — {selectedRecibo.usuario_nombre}</h2>
              <button className="modal-close" onClick={() => setSelectedRecibo(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', gap: 8, marginBottom: 12, fontSize: 13, color: 'var(--text-secondary)' }}>
                <span>📅 {formatPeriodoLabel(selectedRecibo)}</span>
                <span>·</span>
                <span>📧 {selectedRecibo.usuario_correo}</span>
                <span>·</span>
                <EstadoBadge estado={selectedRecibo.estado} />
              </div>

              {getReceiptMediaUrl(selectedRecibo) && !brokenImages[selectedRecibo.id] && (
                <div style={{ marginBottom: 16, position: 'relative' }}>
                  <img
                    src={getReceiptMediaUrl(selectedRecibo, Boolean(imageRetries[selectedRecibo.id]))}
                    alt="recibo"
                    onError={() => handleImageError(selectedRecibo.id)}
                    style={{ width: '100%', maxHeight: 340, objectFit: 'contain', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}
                  />
                </div>
              )}

              {getReceiptViewerUrl(selectedRecibo) && (
                <a href={getReceiptViewerUrl(selectedRecibo)} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" style={{ marginBottom: 16 }}>
                  <ExternalLink size={14} /> Ver recibo original
                </a>
              )}

              {selectedRecibo.estado === 'en_revision' && (
                <div className="form-group">
                  <label>Nota / Comentario (requerido para rechazo)</label>
                  <textarea
                    className="form-textarea"
                    value={nota}
                    onChange={e => setNota(e.target.value)}
                    placeholder="Ej: Pago aprobado. / El monto no coincide, por favor resubir."
                    rows={3}
                  />
                </div>
              )}

              {selectedRecibo.admin_nota && selectedRecibo.estado !== 'en_revision' && (
                <div style={{ background: 'var(--bg-secondary)', padding: '12px 14px', borderRadius: 8, fontSize: 13 }}>
                  <strong>Nota registrada:</strong> {selectedRecibo.admin_nota}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setSelectedRecibo(null)}>Cerrar</button>
              {selectedRecibo.estado === 'en_revision' && (
                <>
                  <button className="btn btn-danger" onClick={() => handleRechazar(selectedRecibo)} disabled={processing}>
                    {processing ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : <X size={15} />}
                    Rechazar
                  </button>
                  <button className="btn btn-success" onClick={() => handleAprobar(selectedRecibo)} disabled={processing}>
                    {processing ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : <Check size={15} />}
                    Aprobar
                  </button>
                </>
              )}
            </div>
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

function EstadoBadge({ estado }) {
  if (estado === 'aprobado') return <span className="badge badge-approved">Aprobado</span>;
  if (estado === 'rechazado') return <span className="badge badge-rejected">Rechazado</span>;
  return <span className="badge badge-review">En revisión</span>;
}
