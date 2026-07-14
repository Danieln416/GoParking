import React, { useEffect, useState } from 'react';
import { Users, Receipt, MapPin, CheckCircle, Clock, MessageSquare, TrendingUp } from 'lucide-react';
import { apiGetUsuarios, apiGetRecibos, apiGetPuestos, apiGetSolicitudes } from '../../api.js';
import { Link } from 'react-router-dom';

export default function AdminDashboard() {
  const [stats, setStats] = useState({ usuarios: 0, recibosTotal: 0, enRevision: 0, aprobados: 0, puestosLibres: 0, puestosOcupados: 0, solicitudesPendientes: 0 });
  const [recientesRecibos, setRecientesRecibos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [u, r, p, s] = await Promise.all([
        apiGetUsuarios(), apiGetRecibos('all'), apiGetPuestos(), apiGetSolicitudes('all')
      ]);
      const recibos = r.success ? r.data : [];
      const puestos = p.success ? p.data : [];
      const solicitudes = s.success ? s.data : [];
      setStats({
        usuarios: u.success ? u.data.length : 0,
        recibosTotal: recibos.length,
        enRevision: recibos.filter(x => x.estado === 'en_revision').length,
        aprobados: recibos.filter(x => x.estado === 'aprobado').length,
        puestosLibres: puestos.filter(x => x.estado === 'libre').length,
        puestosOcupados: puestos.filter(x => x.estado === 'ocupado').length,
        solicitudesPendientes: solicitudes.filter(x => x.estado === 'pendiente').length,
      });
      setRecientesRecibos([...recibos].sort((a, b) => new Date(b.fecha_subida) - new Date(a.fecha_subida)).slice(0, 5));
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>;

  return (
    <div className="page-enter">
      <div className="page-header">
        <h1>Panel de Administración</h1>
        <Link to="/admin/recibos" className="btn btn-primary">
          <Receipt size={16} /> Ver Recibos Pendientes
        </Link>
      </div>

      <div className="page-body">
        <div className="stats-grid">
          <div className="stat-card cyan">
            <div className="stat-icon cyan"><Users size={22} /></div>
            <div className="stat-info"><h3>{stats.usuarios}</h3><p>Usuarios activos</p></div>
          </div>
          <div className="stat-card yellow">
            <div className="stat-icon yellow"><Clock size={22} /></div>
            <div className="stat-info"><h3>{stats.enRevision}</h3><p>Recibos en revisión</p></div>
          </div>
          <div className="stat-card green">
            <div className="stat-icon green"><CheckCircle size={22} /></div>
            <div className="stat-info"><h3>{stats.aprobados}</h3><p>Recibos aprobados</p></div>
          </div>
          <div className="stat-card blue">
            <div className="stat-icon blue"><MapPin size={22} /></div>
            <div className="stat-info"><h3>{stats.puestosLibres}</h3><p>Puestos libres</p></div>
          </div>
          <div className="stat-card red">
            <div className="stat-icon red"><MapPin size={22} /></div>
            <div className="stat-info"><h3>{stats.puestosOcupados}</h3><p>Puestos ocupados</p></div>
          </div>
          <div className="stat-card purple">
            <div className="stat-icon purple"><MessageSquare size={22} /></div>
            <div className="stat-info"><h3>{stats.solicitudesPendientes}</h3><p>Solicitudes pendientes</p></div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 8 }}>
          {/* Recibos recientes */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 className="card-title" style={{ marginBottom: 0 }}>Últimos Recibos</h3>
              <Link to="/admin/recibos" style={{ fontSize: 12, color: 'var(--accent-cyan)', textDecoration: 'none' }}>Ver todos →</Link>
            </div>
            {recientesRecibos.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Sin recibos aún</p>
            ) : recientesRecibos.map(r => (
              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600 }}>{r.usuario_nombre}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    {new Date(r.fecha_subida).toLocaleDateString('es-CO')}
                  </p>
                </div>
                <EstadoBadge estado={r.estado} />
              </div>
            ))}
          </div>

          {/* Accesos rápidos */}
          <div className="card">
            <h3 className="card-title" style={{ marginBottom: 16 }}>Accesos Rápidos</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { to: '/admin/usuarios', icon: <Users size={18} />, label: 'Agregar Usuario', desc: 'Registrar nuevo cliente' },
                { to: '/admin/recibos', icon: <Receipt size={18} />, label: 'Revisar Recibos', desc: `${stats.enRevision} pendientes` },
                { to: '/admin/puestos', icon: <MapPin size={18} />, label: 'Ver Parqueadero', desc: `${stats.puestosLibres} libres disponibles` },
                { to: '/admin/cierre-mes', icon: <TrendingUp size={18} />, label: 'Cierre de Mes', desc: 'Ver ingresos y gastos' },
              ].map(item => (
                <Link key={item.to} to={item.to} style={{ textDecoration: 'none' }}>
                  <div className="card" style={{ padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ color: 'var(--accent-cyan)' }}>{item.icon}</div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{item.label}</p>
                      <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{item.desc}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EstadoBadge({ estado }) {
  if (estado === 'aprobado') return <span className="badge badge-approved">Aprobado</span>;
  if (estado === 'rechazado') return <span className="badge badge-rejected">Rechazado</span>;
  return <span className="badge badge-review">En revisión</span>;
}
