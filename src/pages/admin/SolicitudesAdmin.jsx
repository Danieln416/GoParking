import React, { useEffect, useState } from 'react';
import { MessageSquare, Send, CheckCircle, Clock, X, AlertCircle } from 'lucide-react';
import { apiGetSolicitudes, apiResponderSolicitud } from '../../api.js';

const TIPOS_COLOR = {
  sugerencia: { color: 'var(--accent-cyan)', label: '💡 Sugerencia' },
  reclamo: { color: 'var(--accent-red)', label: '⚠️ Reclamo' },
  solicitud: { color: 'var(--accent-blue)', label: '📋 Solicitud' },
};

export default function SolicitudesAdmin() {
  const [solicitudes, setSolicitudes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pendiente');
  const [selected, setSelected] = useState(null);
  const [respuesta, setRespuesta] = useState('');
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => { loadSolicitudes(); }, []);

  async function loadSolicitudes() {
    const res = await apiGetSolicitudes('all');
    if (res.success) {
      setSolicitudes([...res.data].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)));
    }
    setLoading(false);
  }

  async function handleResponder(e) {
    e.preventDefault();
    if (!respuesta.trim()) { showToast('error', 'Escribe una respuesta'); return; }
    setSending(true);
    const res = await apiResponderSolicitud(selected.id, respuesta);
    if (res.success) {
      showToast('success', 'Respuesta enviada');
      setSelected(null); setRespuesta('');
      loadSolicitudes();
    } else showToast('error', res.error || 'Error');
    setSending(false);
  }

  function showToast(type, msg) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  }

  const filtered = filter === 'todas' ? solicitudes : solicitudes.filter(s => s.estado === filter);

  return (
    <div className="page-enter">
      <div className="page-header">
        <h1>Solicitudes de Usuarios</h1>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          {solicitudes.filter(s => s.estado === 'pendiente').length} pendientes
        </span>
      </div>

      <div className="page-body">
        {/* Filtros */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {[
            { key: 'pendiente', label: '⏳ Pendientes', count: solicitudes.filter(s => s.estado === 'pendiente').length },
            { key: 'respondida', label: '✓ Respondidas', count: solicitudes.filter(s => s.estado === 'respondida').length },
            { key: 'todas', label: 'Todas', count: solicitudes.length },
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
            <MessageSquare size={48} />
            <h3>Sin solicitudes</h3>
            <p>No hay solicitudes en esta categoría</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtered.map(sol => (
              <div key={sol.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: TIPOS_COLOR[sol.tipo]?.color || 'var(--text-secondary)' }}>
                        {TIPOS_COLOR[sol.tipo]?.label || sol.tipo}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>·</span>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>{sol.usuario_nombre}</span>
                    </div>
                    <h3 style={{ fontSize: 15, fontWeight: 700 }}>{sol.asunto}</h3>
                    <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                      {new Date(sol.fecha).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  {sol.estado === 'respondida'
                    ? <span className="badge badge-responded"><CheckCircle size={11} /> Respondida</span>
                    : <span className="badge badge-pending"><Clock size={11} /> Pendiente</span>
                  }
                </div>

                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 10, lineHeight: 1.6 }}>{sol.descripcion}</p>

                {sol.respuesta && (
                  <div style={{ marginTop: 12, background: 'rgba(79,126,255,0.08)', border: '1px solid rgba(79,126,255,0.2)', padding: '12px 14px', borderRadius: 8 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-blue)', marginBottom: 4 }}>TU RESPUESTA</p>
                    <p style={{ fontSize: 13, color: 'var(--text-primary)' }}>{sol.respuesta}</p>
                  </div>
                )}

                {sol.estado === 'pendiente' && (
                  <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => { setSelected(sol); setRespuesta(''); }}>
                    <Send size={13} /> Responder
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal responder */}
      {selected && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setSelected(null)}>
          <div className="modal-box">
            <div className="modal-header">
              <h2>Responder a {selected.usuario_nombre}</h2>
              <button className="modal-close" onClick={() => setSelected(null)}><X size={16} /></button>
            </div>
            <form onSubmit={handleResponder}>
              <div className="modal-body">
                <div style={{ background: 'var(--bg-secondary)', padding: '12px 14px', borderRadius: 8, marginBottom: 16 }}>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{TIPOS_COLOR[selected.tipo]?.label} — {selected.asunto}</p>
                  <p style={{ fontSize: 13, color: 'var(--text-primary)' }}>{selected.descripcion}</p>
                </div>
                <div className="form-group">
                  <label>Tu respuesta</label>
                  <textarea
                    className="form-textarea"
                    value={respuesta}
                    onChange={e => setRespuesta(e.target.value)}
                    placeholder="Escribe tu respuesta al usuario..."
                    rows={4}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setSelected(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={sending}>
                  {sending ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : <Send size={14} />}
                  Enviar respuesta
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
