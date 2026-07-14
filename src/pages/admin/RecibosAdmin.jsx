import React, { useEffect, useState } from 'react';
import { Receipt, Check, X, ExternalLink, Filter, CheckCircle, AlertCircle } from 'lucide-react';
import { apiGetRecibos, apiAprobarRecibo, apiRechazarRecibo } from '../../api.js';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export default function RecibosAdmin() {
  const [recibos, setRecibos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('en_revision');
  const [selectedRecibo, setSelectedRecibo] = useState(null);
  const [nota, setNota] = useState('');
  const [processing, setProcessing] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => { loadRecibos(); }, []);

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

  const filtered = filter === 'todos' ? recibos : recibos.filter(r => r.estado === filter);

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
                {r.url_imagen ? (
                  <div style={{ borderRadius: 10, overflow: 'hidden', marginBottom: 14, border: '1px solid var(--border)' }}>
                    <img src={r.url_imagen} alt="recibo" style={{ width: '100%', height: 160, objectFit: 'cover' }} />
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
                      {MESES[(r.mes || 1) - 1]} {r.anio}
                    </p>
                  </div>
                  <EstadoBadge estado={r.estado} />
                </div>

                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                  Subido: {new Date(r.fecha_subida).toLocaleDateString('es-CO')}
                </p>

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
                <span>📅 {MESES[(selectedRecibo.mes || 1) - 1]} {selectedRecibo.anio}</span>
                <span>·</span>
                <span>📧 {selectedRecibo.usuario_correo}</span>
                <span>·</span>
                <EstadoBadge estado={selectedRecibo.estado} />
              </div>

              {selectedRecibo.url_imagen && (
                <div style={{ marginBottom: 16, position: 'relative' }}>
                  <img src={selectedRecibo.url_imagen} alt="recibo" style={{ width: '100%', maxHeight: 340, objectFit: 'contain', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-secondary)' }} />
                  <a href={selectedRecibo.url_imagen} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" style={{ position: 'absolute', top: 8, right: 8 }}>
                    <ExternalLink size={14} /> Ver original
                  </a>
                </div>
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
