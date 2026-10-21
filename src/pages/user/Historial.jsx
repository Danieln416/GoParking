import React, { useEffect, useState } from 'react';
import { Receipt, ExternalLink, Clock, CheckCircle, XCircle, AlertTriangle, AlertCircle, Upload } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { apiGetRecibos, apiGetCobrosAdicionales } from '../../api.js';
import { formatPeriodoLabel } from '../../utils/periodo.js';
import { getReceiptMediaUrl, getReceiptViewerUrl } from '../../utils/media.js';
import { Link } from 'react-router-dom';

function StatusBadge({ estado }) {
  if (estado === 'aprobado') return <span className="badge badge-approved"><CheckCircle size={11} /> Aprobado</span>;
  if (estado === 'rechazado') return <span className="badge badge-rejected"><XCircle size={11} /> Rechazado</span>;
  return <span className="badge badge-review"><Clock size={11} /> En revisión</span>;
}

export default function Historial() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('recibos'); // 'recibos' | 'cobros'
  const [recibos, setRecibos] = useState([]);
  const [cobros, setCobros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('todos');
  const [filterCobros, setFilterCobros] = useState('todos');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [brokenImages, setBrokenImages] = useState({});

  useEffect(() => {
    async function fetchData() {
      try {
        const [recRes, cobRes] = await Promise.all([
          apiGetRecibos(user.id),
          apiGetCobrosAdicionales(user.id)
        ]);

        if (recRes.success) {
          const sorted = [...recRes.data].sort((a, b) => new Date(b.fecha_subida) - new Date(a.fecha_subida));
          setRecibos(sorted);
        }

        if (cobRes.success) {
          const sortedCob = [...cobRes.data].sort((a, b) => new Date(b.fecha_creacion || b.fecha) - new Date(a.fecha_creacion || a.fecha));
          setCobros(sortedCob);
        }
      } catch (err) {
        console.error('Error cargando historial:', err);
      } finally {
        setLoading(false);
      }
    }
    if (user?.id) {
      fetchData();
    }
  }, [user?.id]);

  const filteredRecibos = recibos.filter(r => {
    const date = r.fecha_subida ? new Date(r.fecha_subida) : null;
    const from = startDate ? new Date(`${startDate}T00:00:00`) : null;
    const to = endDate ? new Date(`${endDate}T23:59:59`) : null;
    return (filter === 'todos' || r.estado === filter) && (!from || (date && date >= from)) && (!to || (date && date <= to));
  });

  const filteredCobros = cobros.filter(c => {
    if (filterCobros === 'todos') return true;
    if (filterCobros === 'pendiente') return c.estado === 'pendiente';
    if (filterCobros === 'pagado') return c.estado === 'pagado';
    if (filterCobros === 'multa') return c.tipo === 'multa';
    if (filterCobros === 'extra') return c.tipo === 'extra';
    return true;
  });

  const cobrosPendientesCount = cobros.filter(c => c.estado === 'pendiente').length;

  return (
    <div className="page-enter">
      <div className="page-header">
        <h1>Historial de Pagos y Cobros</h1>
      </div>

      <div className="page-body">
        {/* Selector de Sección Principal */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
          <button
            type="button"
            className={`btn ${activeTab === 'recibos' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('recibos')}
          >
            <Receipt size={16} /> Recibos de Mensualidad ({recibos.length})
          </button>
          <button
            type="button"
            className={`btn ${activeTab === 'cobros' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('cobros')}
            style={{ position: 'relative' }}
          >
            <AlertTriangle size={16} color={cobrosPendientesCount > 0 ? 'var(--accent-red)' : 'currentColor'} />
            Multas y Cobros Extras ({cobros.length})
            {cobrosPendientesCount > 0 && (
              <span
                style={{
                  marginLeft: 6,
                  background: 'var(--accent-red)',
                  color: '#fff',
                  borderRadius: 10,
                  padding: '1px 6px',
                  fontSize: 11,
                  fontWeight: 700
                }}
              >
                {cobrosPendientesCount} pend.
              </span>
            )}
          </button>
        </div>

        {/* PESTAÑA: RECIBOS DE MENSUALIDAD */}
        {activeTab === 'recibos' && (
          <>
            {/* Filtros */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              <div className="form-group" style={{ marginBottom: 0 }}><label>Desde</label><input type="date" className="form-input" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
              <div className="form-group" style={{ marginBottom: 0 }}><label>Hasta</label><input type="date" className="form-input" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
            </div>
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
            ) : filteredRecibos.length === 0 ? (
              <div className="empty-state">
                <Receipt size={48} />
                <h3>Sin recibos</h3>
                <p>No tienes recibos en esta categoría</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {filteredRecibos.map(recibo => (
                  <div key={recibo.id} className="card" style={{ display: 'flex', alignItems: 'flex-start', gap: 20 }}>
                    {/* Preview imagen */}
                    {getReceiptMediaUrl(recibo) && !brokenImages[recibo.id] ? (
                      <a href={getReceiptViewerUrl(recibo)} target="_blank" rel="noreferrer" style={{ flexShrink: 0 }}>
                        <img
                          src={getReceiptMediaUrl(recibo)}
                          alt="recibo"
                          loading="lazy"
                          onError={() => setBrokenImages(prev => ({ ...prev, [recibo.id]: true }))}
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
                            {formatPeriodoLabel(recibo)}
                          </h3>
                          <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                            Subido: {new Date(recibo.fecha_subida).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                        <StatusBadge estado={recibo.estado} />
                      </div>

                      {/* Notificación si la administración ajustó las fechas */}
                      {recibo.justificacion_fechas && (
                        <div style={{ marginTop: 10, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', padding: '8px 12px', borderRadius: 8, fontSize: 12, color: 'var(--accent-blue)' }}>
                          <strong>ℹ️ Período modificado por administración:</strong> {recibo.justificacion_fechas}
                        </div>
                      )}

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

                    {getReceiptViewerUrl(recibo) && (
                      <a href={getReceiptViewerUrl(recibo)} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" title="Ver recibo">
                        <ExternalLink size={16} /> Ver recibo
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* PESTAÑA: MULTAS Y COBROS EXTRAS */}
        {activeTab === 'cobros' && (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
              {[
                { key: 'todos', label: 'Todos', count: cobros.length },
                { key: 'pendiente', label: 'Pendientes', count: cobros.filter(c => c.estado === 'pendiente').length },
                { key: 'pagado', label: 'Pagados', count: cobros.filter(c => c.estado === 'pagado').length },
                { key: 'multa', label: 'Multas', count: cobros.filter(c => c.tipo === 'multa').length },
                { key: 'extra', label: 'Cobros Extras', count: cobros.filter(c => c.tipo === 'extra').length },
              ].map(f => (
                <button
                  key={f.key}
                  className={`btn btn-sm ${filterCobros === f.key ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setFilterCobros(f.key)}
                >
                  {f.label} <span style={{ opacity: 0.7 }}>({f.count})</span>
                </button>
              ))}
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
            ) : filteredCobros.length === 0 ? (
              <div className="empty-state">
                <CheckCircle size={48} color="var(--accent-green)" />
                <h3>Sin cobros ni multas</h3>
                <p>No tienes cobros adicionales registrados en esta categoría.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {filteredCobros.map(c => (
                  <div
                    key={c.id}
                    className="card"
                    style={{
                      borderLeft: `4px solid ${c.tipo === 'multa' ? 'var(--accent-red)' : 'var(--accent-cyan)'}`,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span
                            className="badge"
                            style={{
                              background: c.tipo === 'multa' ? 'rgba(239,68,68,0.2)' : 'rgba(6,182,212,0.2)',
                              color: c.tipo === 'multa' ? 'var(--accent-red)' : 'var(--accent-cyan)',
                              fontWeight: 700
                            }}
                          >
                            {c.tipo === 'multa' ? '🛑 Multa' : '➕ Cobro Extra'}
                          </span>
                          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
                            {c.concepto}
                          </h3>
                        </div>
                        <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
                          Fecha asignada: {c.fecha || c.fecha_creacion?.slice(0, 10)}
                        </p>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>
                          ${Number(c.valor).toLocaleString('es-CO')} COP
                        </div>
                        <span
                          className={`badge ${c.estado === 'pagado' ? 'badge-approved' : 'badge-rejected'}`}
                        >
                          {c.estado === 'pagado' ? '✅ Pagado' : '⏳ Pendiente de pago'}
                        </span>
                      </div>
                    </div>

                    {/* Justificación obligatoria del administrador */}
                    <div style={{ background: 'var(--bg-secondary)', padding: '10px 14px', borderRadius: 8, fontSize: 13 }}>
                      <strong style={{ color: 'var(--text-primary)' }}>Motivo / Justificación de la administración:</strong>
                      <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0 0', lineHeight: 1.4 }}>
                        {c.justificacion}
                      </p>
                    </div>

                    {c.estado === 'pendiente' && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                        <Link to="/usuario/subir-recibo" className="btn btn-primary btn-sm">
                          <Upload size={14} /> Subir comprobante de pago
                        </Link>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
