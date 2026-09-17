import React, { useEffect, useMemo, useState } from 'react';
import { Receipt, Check, X, ExternalLink, Filter, CheckCircle, AlertCircle } from 'lucide-react';
import { apiGetRecibos, apiGetUsuarios, apiAprobarRecibo, apiRechazarRecibo } from '../../api.js';
import { calcularInicioPeriodo, formatPeriodoLabel, getClosedPeriods, getPeriodoKey, getPeriodoKeyForDate } from '../../utils/periodo.js';
import { getReceiptMediaUrl } from '../../utils/media.js';

const TODAY = new Date();
const CURRENT_PERIOD_START = calcularInicioPeriodo(TODAY);

export default function RecibosAdmin() {
  const [recibos, setRecibos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('en_revision');
  const [selectedRecibo, setSelectedRecibo] = useState(null);
  const [nota, setNota] = useState('');
  const [processing, setProcessing] = useState(false);
  const [toast, setToast] = useState(null);
  const [usuarios, setUsuarios] = useState([]);
  const [startDate, setStartDate] = useState(CURRENT_PERIOD_START);
  const [endDate, setEndDate] = useState('');
  const [includeClosed, setIncludeClosed] = useState(false);
  const [brokenImages, setBrokenImages] = useState({});

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

  async function handleAprobar(recibo) {
    setProcessing(true);
    const res = await apiAprobarRecibo(recibo.id, nota || 'Aprobado por el administrador');
    if (res.success) {
      showToast('success', 'Recibo aprobado correctamente');
      setSelectedRecibo(null); setNota('');
      loadRecibos();
    } else showToast('error', res.error || 'Error');
    setProcessing(false);
  }

  async function handleRechazar(recibo) {
    if (!nota) { showToast('error', 'Indica el motivo del rechazo'); return; }
    setProcessing(true);
    const res = await apiRechazarRecibo(recibo.id, nota);
    if (res.success) {
      showToast('success', 'Recibo rechazado');
      setSelectedRecibo(null); setNota('');
      loadRecibos();
    } else showToast('error', res.error || 'Error');
    setProcessing(false);
  }

  function showToast(type, msg) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  }

  const filtered = useMemo(() => recibos.filter(r => {
    const selectedPeriod = startDate ? getPeriodoKeyForDate(startDate) : '';
    const periodMatches = !selectedPeriod || getPeriodoKey(r) === selectedPeriod;
    const uploadDate = r.fecha_subida ? new Date(r.fecha_subida) : null;
    const to = endDate ? new Date(`${endDate}T23:59:59`) : null;
    const uploadMatchesEnd = !to || (uploadDate && uploadDate <= to);
    const closed = getClosedPeriods().includes(getPeriodoKey(r));
    return periodMatches && uploadMatchesEnd && (filter === 'todos' || r.estado === filter) && (includeClosed || !closed);
  }), [recibos, filter, startDate, endDate, includeClosed]);

  const unpaidUsers = useMemo(() => {
    const period = startDate ? getPeriodoKeyForDate(startDate) : getPeriodoKeyForDate(TODAY);
    const paidUserIds = new Set(recibos
      .filter(r => getPeriodoKey(r) === period)
      .map(r => String(r.usuario_id || r.user_id || r.id_usuario || '')));
    const paidEmails = new Set(recibos
      .filter(r => getPeriodoKey(r) === period)
      .map(r => String(r.usuario_correo || r.correo || '').toLowerCase()));
    return usuarios.filter(user => user.rol !== 'admin' && !paidUserIds.has(String(user.id)) && !paidEmails.has(String(user.correo || '').toLowerCase()));
  }, [usuarios, recibos, startDate]);

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
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, paddingBottom: 9 }}><input type="checkbox" checked={includeClosed} onChange={e => setIncludeClosed(e.target.checked)} /> Incluir meses cerrados</label>
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

        <div className="card" style={{ marginBottom: 20, borderColor: unpaidUsers.length ? 'rgba(245,158,11,0.4)' : undefined }}>
          <h3 className="card-title">Usuarios sin pago en {startDate.slice(0, 7)}</h3>
          <p className="card-subtitle">No tienen un recibo registrado para el período seleccionado.</p>
          {unpaidUsers.length ? (
            <ul style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 6, fontSize: 13 }}>
              {unpaidUsers.map(user => <li key={user.id}>{user.nombre}<span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>{user.correo}</span></li>)}
            </ul>
          ) : <p style={{ fontSize: 13, color: 'var(--accent-green)' }}>Todos los usuarios tienen recibo registrado.</p>}
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
                    <img src={getReceiptMediaUrl(r)} alt="recibo" onError={() => setBrokenImages(current => ({ ...current, [r.id]: true }))} style={{ width: '100%', height: 160, objectFit: 'cover' }} />
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

                {getReceiptMediaUrl(r) && (
                  <a href={getReceiptMediaUrl(r)} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" style={{ marginTop: 10 }} onClick={e => e.stopPropagation()}>
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
                  <img src={getReceiptMediaUrl(selectedRecibo)} alt="recibo" onError={() => setBrokenImages(current => ({ ...current, [selectedRecibo.id]: true }))} style={{ width: '100%', maxHeight: 340, objectFit: 'contain', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-secondary)' }} />
                </div>
              )}

              {getReceiptMediaUrl(selectedRecibo) && (
                <a href={getReceiptMediaUrl(selectedRecibo)} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" style={{ marginBottom: 16 }}>
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
