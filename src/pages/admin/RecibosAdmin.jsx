import React, { useEffect, useMemo, useState } from 'react';
import { Receipt, Check, X, ExternalLink, Filter, CheckCircle, AlertCircle } from 'lucide-react';
import { apiGetRecibos, apiGetUsuarios, apiAprobarRecibo, apiRechazarRecibo } from '../../api.js';
import {
  formatPeriodoLabel,
  getClosedPeriods,
  getPeriodoKey,
  getUserBillingInfo,
  getAdminClosingPeriod
} from '../../utils/periodo.js';
import { getReceiptMediaUrl, getReceiptViewerUrl } from '../../utils/media.js';

const TODAY = new Date();
const ADMIN_CYCLE = getAdminClosingPeriod(TODAY);

export default function RecibosAdmin() {
  const [recibos, setRecibos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('en_revision');
  const [selectedRecibo, setSelectedRecibo] = useState(null);
  const [nota, setNota] = useState('');
  const [processing, setProcessing] = useState(false);
  const [toast, setToast] = useState(null);
  const [usuarios, setUsuarios] = useState([]);
  const [startDate, setStartDate] = useState(ADMIN_CYCLE.startDate);
  const [endDate, setEndDate] = useState(ADMIN_CYCLE.endDate);
  const [includeClosed, setIncludeClosed] = useState(false);
  const [brokenImages, setBrokenImages] = useState({});
  const [imageRetries, setImageRetries] = useState({});

  useEffect(() => {
    loadRecibos();
    apiGetUsuarios().then(res => res.success && setUsuarios(res.data || []));
  }, []);

  useEffect(() => {
    const refresh = () => setIncludeClosed(false);
    window.addEventListener('goparking-period-closed', refresh);
    return () => window.removeEventListener('goparking-period-closed', refresh);
  }, []);

  async function loadRecibos() {
    const res = await apiGetRecibos('all');
    if (res.success) {
      setRecibos([...res.data].sort((a, b) => new Date(b.fecha_subida) - new Date(a.fecha_subida)));
    }
    setLoading(false);
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
    
    // Actualización optimista: refleja el cambio en la interfaz al instante
    setRecibos(prev => prev.map(item => item.id === recibo.id ? { ...item, estado: 'aprobado', admin_nota: notaFinal } : item));
    setSelectedRecibo(null);
    setNota('');
    showToast('success', 'Recibo aprobado correctamente');

    const res = await apiAprobarRecibo(recibo.id, notaFinal);
    if (!res.success) {
      showToast('error', res.error || 'Error al guardar la aprobación en el servidor');
      loadRecibos();
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
    }
    setProcessing(false);
  }

  function showToast(type, msg) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  }

  const filtered = useMemo(() => recibos.filter(r => {
    const uploadDate = r.fecha_subida ? r.fecha_subida.slice(0, 10) : (r.fecha_inicio ? r.fecha_inicio.slice(0, 10) : '');
    const fromMatches = !startDate || (uploadDate ? uploadDate >= startDate : true);
    const toMatches = !endDate || (uploadDate ? uploadDate <= endDate : true);
    const statusMatches = filter === 'todos' || r.estado === filter;
    const closed = getClosedPeriods().includes(getPeriodoKey(r));
    return fromMatches && toMatches && statusMatches && (includeClosed || !closed);
  }), [recibos, filter, startDate, endDate, includeClosed]);

  const unpaidUsers = useMemo(() => {
    return usuarios
      .filter(user => user.rol !== 'admin' && String(user.activo) !== 'false')
      .map(user => {
        const userReceipts = recibos.filter(r =>
          String(r.usuario_id || r.user_id || r.id_usuario || '') === String(user.id) ||
          (user.correo && String(r.usuario_correo || r.correo || '').toLowerCase() === String(user.correo).toLowerCase())
        );
        const billing = getUserBillingInfo(user.fecha_inicio, TODAY, userReceipts);
        return { ...user, billing };
      })
      .filter(u => u.billing.status === 'vencido' || u.billing.status === 'pendiente')
      .sort((a, b) => {
        if (a.billing.status === 'vencido' && b.billing.status !== 'vencido') return -1;
        if (a.billing.status !== 'vencido' && b.billing.status === 'vencido') return 1;
        return a.billing.diffDays - b.billing.diffDays;
      });
  }, [usuarios, recibos]);

  return (
    <div className="page-enter">
      <div className="page-header">
        <h1>Recibos de Pago</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Filter size={16} color="var(--text-secondary)" />
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {recibos.filter(r => r.estado === 'en_revision').length} pendientes
          </span>
        </div>
      </div>

      <div className="page-body">
        {/* Filtros */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ marginBottom: 0 }}><label>Desde</label><input type="date" className="form-input" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
          <div className="form-group" style={{ marginBottom: 0 }}><label>Hasta</label><input type="date" className="form-input" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => { setStartDate(ADMIN_CYCLE.startDate); setEndDate(ADMIN_CYCLE.endDate); }}
            style={{ height: 38 }}
          >
            Ciclo admin (12 al 11)
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => { setStartDate(''); setEndDate(''); }}
            style={{ height: 38 }}
          >
            Ver todos
          </button>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, paddingBottom: 9, marginLeft: 'auto' }}><input type="checkbox" checked={includeClosed} onChange={e => setIncludeClosed(e.target.checked)} /> Incluir meses cerrados</label>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {[
            { key: 'en_revision', label: '⏳ En revisión', count: recibos.filter(r => r.estado === 'en_revision').length },
            { key: 'aprobado', label: '✓ Aprobados', count: recibos.filter(r => r.estado === 'aprobado').length },
            { key: 'rechazado', label: '✗ Rechazados', count: recibos.filter(r => r.estado === 'rechazado').length },
            { key: 'todos', label: 'Todos', count: recibos.length },
          ].map(f => (
            <button key={f.key} className={`btn btn-sm ${filter === f.key ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFilter(f.key)}>
              {f.label} ({f.count})
            </button>
          ))}
        </div>

        <div className="card" style={{ marginBottom: 20, borderColor: unpaidUsers.some(u => u.billing.status === 'vencido') ? 'rgba(239, 68, 68, 0.4)' : unpaidUsers.length ? 'rgba(245,158,11,0.4)' : undefined }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 8 }}>
            <h3 className="card-title" style={{ margin: 0 }}>Estado de Pagos (Cortes Individuales)</h3>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {unpaidUsers.filter(u => u.billing.status === 'vencido').length} vencidos · {unpaidUsers.filter(u => u.billing.status === 'pendiente').length} pendientes
            </span>
          </div>
          <p className="card-subtitle" style={{ marginBottom: 12 }}>
            Cada usuario tiene su fecha de corte según su fecha de inicio registrada.
          </p>
          {unpaidUsers.length ? (
            <div style={{ display: 'grid', gap: 8, maxHeight: 250, overflowY: 'auto' }}>
              {unpaidUsers.map(user => (
                <div
                  key={user.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px',
                    borderRadius: 8,
                    background: 'var(--bg-secondary)',
                    border: user.billing.status === 'vencido' ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid var(--border)'
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{user.nombre}</span>
                    <span style={{ color: 'var(--text-muted)', marginLeft: 8, fontSize: 12 }}>
                      {user.correo || user.celular || '—'}
                    </span>
                    <span style={{ color: 'var(--text-secondary)', marginLeft: 8, fontSize: 11 }}>
                      · Corte día {user.billing.billingDay} de cada mes
                    </span>
                  </div>
                  <div>
                    <span
                      className={`badge ${user.billing.status === 'vencido' ? 'badge-rejected' : 'badge-review'}`}
                      style={{ fontSize: 11 }}
                    >
                      {user.billing.badge}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--accent-green)' }}>✓ Todos los usuarios se encuentran al día con sus pagos.</p>
          )}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <Receipt size={48} />
            <h3>Sin recibos</h3>
            <p>No hay recibos en esta categoría</p>
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
