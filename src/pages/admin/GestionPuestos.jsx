import React, { useEffect, useState } from 'react';
import { MapPin, Settings, RefreshCw, Car, Bike, CheckCircle, AlertCircle, X } from 'lucide-react';
import { apiGetPuestos, apiUpdatePuesto, apiUpdateConfigPuestos, apiGetParkingMapUrl } from '../../api.js';

export default function GestionPuestos() {
  const [puestos, setPuestos] = useState([]);
  const [config, setConfig] = useState({});
  const [mapUrl, setMapUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showConfig, setShowConfig] = useState(false);
  const [configForm, setConfigForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [tipoFiltro, setTipoFiltro] = useState('todos');

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const [p, m] = await Promise.all([apiGetPuestos(), apiGetParkingMapUrl()]);
    if (p.success) {
      setPuestos(p.data);
      setConfig(p.config || {});
      setConfigForm({
        total_puestos_carro: p.config?.total_puestos_carro || 20,
        total_puestos_moto: p.config?.total_puestos_moto || 15,
        total_puestos_bici: p.config?.total_puestos_bici || 10,
        nombre_parqueadero: p.config?.nombre_parqueadero || 'Parqueadero Central',
      });
    }
    if (m.success && m.url) setMapUrl(m.url);
    setLoading(false);
  }

  async function togglePuesto(puesto) {
    const nuevoEstado = puesto.estado === 'libre' ? 'ocupado' : 'libre';
    const res = await apiUpdatePuesto({
      id: puesto.id,
      estado: nuevoEstado,
      usuario_id: nuevoEstado === 'libre' ? '' : puesto.usuario_id,
      usuario_nombre: nuevoEstado === 'libre' ? '' : puesto.usuario_nombre,
    });
    if (res.success) {
      setPuestos(prev => prev.map(p => p.id === puesto.id ? { ...p, estado: nuevoEstado } : p));
    } else showToast('error', res.error || 'Error');
  }

  async function handleSaveConfig(e) {
    e.preventDefault();
    setSaving(true);
    const rebuild = confirm('¿Reconstruir la lista de puestos con los nuevos totales? Esto reiniciará los estados actuales.');
    const res = await apiUpdateConfigPuestos({ ...configForm, rebuild });
    if (res.success) {
      showToast('success', 'Configuración guardada');
      setShowConfig(false);
      loadData();
    } else showToast('error', res.error || 'Error');
    setSaving(false);
  }

  function showToast(type, msg) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  }

  const libres = puestos.filter(p => p.estado === 'libre').length;
  const ocupados = puestos.filter(p => p.estado === 'ocupado').length;

  const tiposPuestos = ['todos', 'carro', 'moto', 'bici'];
  const filteredPuestos = tipoFiltro === 'todos' ? puestos : puestos.filter(p => p.tipo?.toLowerCase() === tipoFiltro);

  function puestosByTipo(tipo) {
    return puestos.filter(p => p.tipo?.toLowerCase() === tipo);
  }

  function tipoIcon(tipo) {
    if (tipo === 'moto') return '🏍️';
    if (tipo === 'bici') return '🚲';
    return '🚗';
  }

  return (
    <div className="page-enter">
      <div className="page-header">
        <h1>Gestión de Puestos</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={loadData}>
            <RefreshCw size={15} /> Actualizar
          </button>
          <button className="btn btn-primary" onClick={() => setShowConfig(true)}>
            <Settings size={15} /> Configurar
          </button>
        </div>
      </div>

      <div className="page-body">
        {/* Resumen */}
        <div className="stats-grid" style={{ marginBottom: 20 }}>
          <div className="stat-card green">
            <div className="stat-icon green"><MapPin size={22} /></div>
            <div className="stat-info"><h3>{libres}</h3><p>Puestos libres</p></div>
          </div>
          <div className="stat-card red">
            <div className="stat-icon red"><MapPin size={22} /></div>
            <div className="stat-info"><h3>{ocupados}</h3><p>Puestos ocupados</p></div>
          </div>
          <div className="stat-card blue">
            <div className="stat-icon blue"><Car size={22} /></div>
            <div className="stat-info">
              <h3>{puestosByTipo('carro').filter(p => p.estado === 'libre').length}/{puestosByTipo('carro').length}</h3>
              <p>Carros libres</p>
            </div>
          </div>
          <div className="stat-card cyan">
            <div className="stat-icon cyan"><Bike size={22} /></div>
            <div className="stat-info">
              <h3>{puestosByTipo('moto').filter(p => p.estado === 'libre').length}/{puestosByTipo('moto').length}</h3>
              <p>Motos libres</p>
            </div>
          </div>
        </div>

        {/* Imagen del parqueadero */}
        {mapUrl && (
          <div className="card" style={{ marginBottom: 20, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 15, fontWeight: 700 }}>🗺️ Mapa del Parqueadero</h3>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Imagen referencial</span>
            </div>
            <img src={mapUrl} alt="Mapa parqueadero" style={{ width: '100%', maxHeight: 360, objectFit: 'contain', background: '#0a0e1a' }} />
          </div>
        )}

        {/* Filtros por tipo */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {tiposPuestos.map(t => (
            <button key={t} className={`btn btn-sm ${tipoFiltro === t ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTipoFiltro(t)}>
              {t === 'todos' ? 'Todos' : tipoIcon(t.toLowerCase())} {t !== 'todos' && t}
              {t !== 'todos' && <span style={{ opacity: 0.7 }}>({puestosByTipo(t).length})</span>}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
        ) : (
          <div className="card">
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
              Haz clic en un puesto para cambiar su estado entre <strong style={{ color: 'var(--accent-green)' }}>Libre</strong> y <strong style={{ color: 'var(--accent-red)' }}>Ocupado</strong>
            </p>
            <div className="puestos-grid" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(64px, 1fr))` }}>
              {filteredPuestos.map(puesto => (
                <div
                  key={puesto.id}
                  className={`puesto-cell ${puesto.estado === 'libre' ? 'puesto-libre' : 'puesto-ocupado'}`}
                  onClick={() => togglePuesto(puesto)}
                  title={`Puesto #${puesto.numero} — ${puesto.estado}${puesto.usuario_nombre ? ' — ' + puesto.usuario_nombre : ''}`}
                >
                  <span style={{ fontSize: 14 }}>{tipoIcon(puesto.tipo?.toLowerCase())}</span>
                  <span style={{ fontSize: 10, fontWeight: 800 }}>#{puesto.numero}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal configuración */}
      {showConfig && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowConfig(false)}>
          <div className="modal-box">
            <div className="modal-header">
              <h2>Configurar Parqueadero</h2>
              <button className="modal-close" onClick={() => setShowConfig(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleSaveConfig}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Nombre del parqueadero</label>
                  <input type="text" className="form-input" value={configForm.nombre_parqueadero} onChange={e => setConfigForm(f => ({ ...f, nombre_parqueadero: e.target.value }))} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label>🚗 Carros</label>
                    <input type="number" className="form-input" min="0" value={configForm.total_puestos_carro} onChange={e => setConfigForm(f => ({ ...f, total_puestos_carro: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>🏍️ Motos</label>
                    <input type="number" className="form-input" min="0" value={configForm.total_puestos_moto} onChange={e => setConfigForm(f => ({ ...f, total_puestos_moto: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>🚲 Bicis</label>
                    <input type="number" className="form-input" min="0" value={configForm.total_puestos_bici} onChange={e => setConfigForm(f => ({ ...f, total_puestos_bici: e.target.value }))} />
                  </div>
                </div>
                <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--accent-yellow)' }}>
                  ⚠️ Al guardar se te preguntará si deseas reconstruir la lista de puestos con los nuevos totales.
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowConfig(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : <Settings size={14} />}
                  Guardar
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
