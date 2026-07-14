import React, { useState, useEffect } from 'react';
import { MessageSquare, Plus, Send, CheckCircle, Clock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { apiGetSolicitudes, apiCrearSolicitud } from '../../api.js';

const TIPOS = [
  { value: 'sugerencia', label: '💡 Sugerencia', color: 'var(--accent-cyan)' },
  { value: 'reclamo', label: '⚠️ Reclamo', color: 'var(--accent-red)' },
  { value: 'solicitud', label: '📋 Solicitud', color: 'var(--accent-blue)' },
];

export default function Solicitudes() {
  const { user } = useAuth();
  const [solicitudes, setSolicitudes] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({ tipo: 'sugerencia', asunto: '', descripcion: '' });
  const [toast, setToast] = useState(null);

  useEffect(() => { loadSolicitudes(); }, []);

  async function loadSolicitudes() {
    const res = await apiGetSolicitudes(user.id);
    if (res.success) {
      setSolicitudes([...res.data].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)));
    }
    setLoading(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.asunto || !form.descripcion) { setToast({ type: 'error', msg: 'Completa todos los campos' }); return; }
    setSending(true);
    const res = await apiCrearSolicitud({ ...form, userId: user.id, userName: user.nombre });
    if (res.success) {
      setToast({ type: 'success', msg: 'Solicitud enviada correctamente' });
      setShowForm(false);
      setForm({ tipo: 'sugerencia', asunto: '', descripcion: '' });
      loadSolicitudes();
    } else {
      setToast({ type: 'error', msg: res.error || 'Error al enviar' });
    }
    setSending(false);
    setTimeout(() => setToast(null), 3500);
  }

  function getTipoBadge(tipo) {
    const t = TIPOS.find(x => x.value === tipo);
    return <span style={{ fontSize: 12, fontWeight: 600, color: t?.color || 'var(--text-secondary)' }}>{t?.label || tipo}</span>;
  }

  return (
    <div className="page-enter">
      <div className="page-header">
        <h1>Solicitudes</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          <Plus size={16} /> Nueva Solicitud
        </button>
      </div>

      <div className="page-body">
        {/* Formulario */}
        {showForm && (
          <div className="card" style={{ marginBottom: 24, borderColor: 'rgba(0,212,255,0.2)' }}>
            <h3 className="card-title">Nueva Solicitud / Sugerencia / Reclamo</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Tipo</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {TIPOS.map(t => (
                    <button
                      key={t.value}
                      type="button"
                      className={`btn btn-sm ${form.tipo === t.value ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => setForm(f => ({ ...f, tipo: t.value }))}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label>Asunto</label>
                <input
                  type="text" className="form-input"
                  placeholder="Describe brevemente el asunto"
                  value={form.asunto}
                  onChange={e => setForm(f => ({ ...f, asunto: e.target.value }))}
                  maxLength={120}
                />
              </div>
              <div className="form-group">
                <label>Descripción</label>
                <textarea
                  className="form-textarea"
                  placeholder="Describe tu solicitud con el mayor detalle posible..."
                  value={form.descripcion}
                  onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                  rows={4}
                />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" className="btn btn-primary" disabled={sending}>
                  {sending ? <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : <Send size={15} />}
                  Enviar
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancelar</button>
              </div>
            </form>
          </div>
        )}

        {/* Lista de solicitudes */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
        ) : solicitudes.length === 0 ? (
          <div className="empty-state">
            <MessageSquare size={48} />
            <h3>Sin solicitudes</h3>
            <p>Aún no has enviado ninguna solicitud</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {solicitudes.map(sol => (
              <div key={sol.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    {getTipoBadge(sol.tipo)}
                    <h3 style={{ fontSize: 15, fontWeight: 700, marginTop: 4, marginBottom: 2 }}>{sol.asunto}</h3>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {new Date(sol.fecha).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  {sol.estado === 'respondida'
                    ? <span className="badge badge-responded"><CheckCircle size={11} /> Respondida</span>
                    : <span className="badge badge-pending"><Clock size={11} /> Pendiente</span>
                  }
                </div>

                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 10, lineHeight: 1.6 }}>
                  {sol.descripcion}
                </p>

                {sol.respuesta && (
                  <div style={{ marginTop: 12, background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)', padding: '12px 14px', borderRadius: 8 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-purple)', marginBottom: 4 }}>RESPUESTA DEL ADMINISTRADOR</p>
                    <p style={{ fontSize: 13, color: 'var(--text-primary)' }}>{sol.respuesta}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="toast-container">
          <div className={`toast ${toast.type === 'success' ? 'toast-success' : 'toast-error'}`}>
            {toast.type === 'success' ? <CheckCircle size={16} /> : null}
            {toast.msg}
          </div>
        </div>
      )}
    </div>
  );
}
