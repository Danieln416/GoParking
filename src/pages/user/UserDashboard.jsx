import React, { useEffect, useState } from 'react';
import { Receipt, Clock, CheckCircle, Upload, MessageSquare, Car, Bike, Truck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { apiGetRecibos, apiGetSolicitudes } from '../../api.js';
import { Link } from 'react-router-dom';
import { formatPeriodoLabel } from '../../utils/periodo.js';

function vehicleIcon(tipo) {
  if (tipo === 'moto') return <Bike size={20} />;
  if (tipo === 'bici') return <Bike size={20} />;
  return <Car size={20} />;
}

export default function UserDashboard() {
  const { user } = useAuth();
  const [recibos, setRecibos] = useState([]);
  const [solicitudes, setSolicitudes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [r, s] = await Promise.all([
        apiGetRecibos(user.id),
        apiGetSolicitudes(user.id),
      ]);
      if (r.success) setRecibos(r.data);
      if (s.success) setSolicitudes(s.data);
      setLoading(false);
    }
    load();
  }, [user.id]);

  const aprobados = recibos.filter(r => r.estado === 'aprobado').length;
  const enRevision = recibos.filter(r => r.estado === 'en_revision').length;
  const pendientesSol = solicitudes.filter(s => s.estado === 'pendiente').length;

  const ultimoRecibo = [...recibos].sort((a, b) => new Date(b.fecha_subida) - new Date(a.fecha_subida))[0];

  return (
    <div className="page-enter">
      <div className="page-header">
        <div>
          <h1>Bienvenido, {user?.nombre?.split(' ')[0]} 👋</h1>
        </div>
        <Link to="/usuario/subir-recibo" className="btn btn-primary">
          <Upload size={16} /> Subir Recibo
        </Link>
      </div>

      <div className="page-body">
        {/* Info del vehículo */}
        <div className="card" style={{ marginBottom: 24, background: 'linear-gradient(135deg,rgba(0,212,255,0.08),rgba(79,126,255,0.06))', borderColor: 'rgba(0,212,255,0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 56, height: 56, background: 'rgba(0,212,255,0.15)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-cyan)' }}>
              {vehicleIcon(user?.tipo_vehiculo)}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 2 }}>Mi vehículo</p>
              <h3 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: 1 }}>{user?.placa || '—'}</h3>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {user?.tipo_vehiculo} · {user?.tipo_tarifa} · ${Number(user?.valor_tarifa || 0).toLocaleString('es-CO')}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Valor mensualidad</p>
              <p style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent-cyan)' }}>
                ${Number(user?.valor_tarifa || 0).toLocaleString('es-CO')}
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="stats-grid">
          <div className="stat-card cyan">
            <div className="stat-icon cyan"><Receipt size={22} /></div>
            <div className="stat-info">
              <h3>{recibos.length}</h3>
              <p>Total de recibos</p>
            </div>
          </div>
          <div className="stat-card green">
            <div className="stat-icon green"><CheckCircle size={22} /></div>
            <div className="stat-info">
              <h3>{aprobados}</h3>
              <p>Pagos aprobados</p>
            </div>
          </div>
          <div className="stat-card yellow">
            <div className="stat-icon yellow"><Clock size={22} /></div>
            <div className="stat-info">
              <h3>{enRevision}</h3>
              <p>En revisión</p>
            </div>
          </div>
          <div className="stat-card purple">
            <div className="stat-icon purple"><MessageSquare size={22} /></div>
            <div className="stat-info">
              <h3>{pendientesSol}</h3>
              <p>Solicitudes pendientes</p>
            </div>
          </div>
        </div>

        {/* Último recibo */}
        {ultimoRecibo && (
          <div className="card" style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <h3 className="card-title">Último Recibo</h3>
                <p className="card-subtitle">
                  {formatPeriodoLabel(ultimoRecibo)} · Subido el {new Date(ultimoRecibo.fecha_subida).toLocaleDateString('es-CO')}
                </p>
              </div>
              <StatusBadge estado={ultimoRecibo.estado} />
            </div>
            {ultimoRecibo.url_imagen && (
              <a href={ultimoRecibo.url_imagen} target="_blank" rel="noreferrer">
                <img src={ultimoRecibo.url_imagen} alt="recibo" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} />
              </a>
            )}
            {ultimoRecibo.admin_nota && (
              <p style={{ marginTop: 12, fontSize: 13, color: 'var(--text-secondary)', background: 'var(--bg-secondary)', padding: '10px 14px', borderRadius: 8 }}>
                💬 <strong>Nota del admin:</strong> {ultimoRecibo.admin_nota}
              </p>
            )}
          </div>
        )}

        {/* Accesos rápidos */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 }}>
          <Link to="/usuario/subir-recibo" style={{ textDecoration: 'none' }}>
            <div className="card" style={{ cursor: 'pointer', textAlign: 'center', padding: 28 }}>
              <Upload size={28} color="var(--accent-cyan)" style={{ marginBottom: 8 }} />
              <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Subir Recibo</p>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Carga tu pago mensual</p>
            </div>
          </Link>
          <Link to="/usuario/historial" style={{ textDecoration: 'none' }}>
            <div className="card" style={{ cursor: 'pointer', textAlign: 'center', padding: 28 }}>
              <Receipt size={28} color="var(--accent-green)" style={{ marginBottom: 8 }} />
              <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Mis Pagos</p>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Ver historial completo</p>
            </div>
          </Link>
          <Link to="/usuario/solicitudes" style={{ textDecoration: 'none' }}>
            <div className="card" style={{ cursor: 'pointer', textAlign: 'center', padding: 28 }}>
              <MessageSquare size={28} color="var(--accent-purple)" style={{ marginBottom: 8 }} />
              <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Solicitudes</p>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Sugerencias y reclamos</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ estado }) {
  if (estado === 'aprobado') return <span className="badge badge-approved">✓ Aprobado</span>;
  if (estado === 'rechazado') return <span className="badge badge-rejected">✗ Rechazado</span>;
  return <span className="badge badge-review">⏳ En revisión</span>;
}
