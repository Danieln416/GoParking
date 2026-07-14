import React, { useEffect, useState } from 'react';
import { Receipt, ExternalLink, Clock, CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { apiGetRecibos } from '../../api.js';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function StatusBadge({ estado }) {
  if (estado === 'aprobado') return <span className="badge badge-approved"><CheckCircle size={11} /> Aprobado</span>;
  if (estado === 'rechazado') return <span className="badge badge-rejected"><XCircle size={11} /> Rechazado</span>;
  return <span className="badge badge-review"><Clock size={11} /> En revisión</span>;
}

export default function Historial() {
  const { user } = useAuth();
  const [recibos, setRecibos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('todos');

  useEffect(() => {
    apiGetRecibos(user.id).then(res => {
      if (res.success) {
        const sorted = [...res.data].sort((a, b) => new Date(b.fecha_subida) - new Date(a.fecha_subida));
        setRecibos(sorted);
      }
      setLoading(false);
    });
  }, [user.id]);

  const filtered = filter === 'todos' ? recibos : recibos.filter(r => r.estado === filter);

  return (
    <div className="page-enter">
      <div className="page-header">
        <h1>Historial de Pagos</h1>
      </div>

      <div className="page-body">
        {/* Filtros */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {[
            { key: 'todos', label: 'Todos', count: recibos.length },
            { key: 'aprobado', label: 'Aprobados', count: recibos.filter(r => r.estado === 'aprobado').length },
            { key: 'en_revision', label: 'En revisión', count: recibos.filter(r => r.estado === 'en_revision').length },
            { key: 'rechazado', label: 'Rechazados', count: recibos.filter(r => r.estado === 'rechazado').length },
          ].map(f => (
            <button
              key={f.key}
              className={`btn btn-sm ${filter === f.key ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label} <span style={{ opacity: 0.7 }}>({f.count})</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <Receipt size={48} />
            <h3>Sin recibos</h3>
            <p>No tienes recibos en esta categoría</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtered.map(recibo => (
              <div key={recibo.id} className="card" style={{ display: 'flex', alignItems: 'flex-start', gap: 20 }}>
                {/* Preview imagen */}
                {recibo.url_imagen ? (
                  <a href={recibo.url_imagen} target="_blank" rel="noreferrer" style={{ flexShrink: 0 }}>
                    <img
                      src={recibo.url_imagen}
                      alt="recibo"
                      style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--border)' }}
                    />
                  </a>
                ) : (
                  <div style={{ width: 80, height: 80, borderRadius: 10, background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Receipt size={28} color="var(--text-muted)" />
                  </div>
                )}

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 2 }}>
                        {MESES[(recibo.mes || 1) - 1]} {recibo.anio}
                      </h3>
                      <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        Subido: {new Date(recibo.fecha_subida).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    <StatusBadge estado={recibo.estado} />
                  </div>

                  {recibo.admin_nota && (
                    <div style={{ marginTop: 10, background: 'var(--bg-secondary)', padding: '8px 12px', borderRadius: 8, fontSize: 12 }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Nota del admin: </span>
                      <span style={{ color: 'var(--text-primary)' }}>{recibo.admin_nota}</span>
                    </div>
                  )}

                  {recibo.fecha_revision && recibo.fecha_revision !== '' && (
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                      Revisado: {new Date(recibo.fecha_revision).toLocaleDateString('es-CO')}
                    </p>
                  )}
                </div>

                {recibo.url_imagen && (
                  <a href={recibo.url_imagen} target="_blank" rel="noreferrer" className="btn btn-ghost btn-icon" title="Ver recibo">
                    <ExternalLink size={16} />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
