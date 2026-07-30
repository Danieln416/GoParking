import React, { useEffect, useState } from 'react';
import {
  MapPin,
  Settings,
  RefreshCw,
  Car,
  Bike,
  CheckCircle,
  AlertCircle,
  X,
  User,
  LockKeyhole,
  Unlock,
  CircleParking
} from 'lucide-react';
import {
  apiGetPuestos,
  apiUpdatePuesto,
  apiUpdateConfigPuestos,
  apiGetParkingMapUrl
} from '../../api.js';

export default function GestionPuestos() {
  const [puestos, setPuestos] = useState([]);
  const [config, setConfig] = useState({});
  const [mapUrl, setMapUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showConfig, setShowConfig] = useState(false);
  const [configForm, setConfigForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [liberandoId, setLiberandoId] = useState(null);
  const [toast, setToast] = useState(null);
  const [tipoFiltro, setTipoFiltro] = useState('todos');
  const [estadoFiltro, setEstadoFiltro] = useState('todos');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);

    try {
      const [resPuestos, resMapa] = await Promise.all([
        apiGetPuestos(),
        apiGetParkingMapUrl()
      ]);

      if (resPuestos.success) {
        const nuevaConfig = resPuestos.config || {};

        setPuestos(resPuestos.data || []);
        setConfig(nuevaConfig);

        setConfigForm({
          total_puestos_carro: nuevaConfig.total_puestos_carro || 20,
          total_puestos_moto: nuevaConfig.total_puestos_moto || 15,
          total_puestos_bici: nuevaConfig.total_puestos_bici || 10,
          nombre_parqueadero:
            nuevaConfig.nombre_parqueadero || 'Parqueadero Central'
        });
      } else {
        showToast(
          'error',
          resPuestos.error || 'No fue posible cargar los puestos'
        );
      }

      if (resMapa.success && resMapa.url) {
        setMapUrl(resMapa.url);
      }
    } catch {
      showToast('error', 'Error de conexión al cargar los puestos');
    } finally {
      setLoading(false);
    }
  }

  function showToast(type, msg) {
    setToast({ type, msg });

    window.setTimeout(() => {
      setToast(null);
    }, 3500);
  }

  async function liberarPuesto(puesto) {
    if (puesto.estado === 'libre') {
      return;
    }

    const confirmar = window.confirm(
      `¿Liberar el puesto #${puesto.numero}?\n\n` +
        `Actualmente está asignado a: ${puesto.usuario_nombre || 'Usuario no identificado'}.\n\n` +
        'El usuario dejará de tener este puesto asignado.'
    );

    if (!confirmar) {
      return;
    }

    setLiberandoId(puesto.id);

    try {
      const res = await apiUpdatePuesto({
        id: puesto.id,
        estado: 'libre',
        usuario_id: '',
        usuario_nombre: ''
      });

      if (res.success) {
        setPuestos(actuales =>
          actuales.map(item =>
            item.id === puesto.id
              ? {
                  ...item,
                  estado: 'libre',
                  usuario_id: '',
                  usuario_nombre: ''
                }
              : item
          )
        );

        showToast('success', `Puesto #${puesto.numero} liberado correctamente`);
      } else {
        showToast('error', res.error || 'No fue posible liberar el puesto');
      }
    } catch {
      showToast('error', 'Error de conexión al liberar el puesto');
    } finally {
      setLiberandoId(null);
    }
  }

  async function handleSaveConfig(event) {
    event.preventDefault();

    const rebuild = window.confirm(
      '¿Deseas reconstruir la lista de puestos con los nuevos totales?\n\n' +
        'Aceptar: se eliminan las asignaciones y se generan puestos nuevos.\n' +
        'Cancelar: solo se actualiza el nombre del parqueadero.'
    );

    setSaving(true);

    try {
      const res = await apiUpdateConfigPuestos({
        ...configForm,
        rebuild
      });

      if (res.success) {
        showToast(
          'success',
          rebuild
            ? 'Configuración guardada y puestos reconstruidos'
            : 'Configuración guardada correctamente'
        );

        setShowConfig(false);
        await loadData();
      } else {
        showToast('error', res.error || 'No fue posible guardar la configuración');
      }
    } catch {
      showToast('error', 'Error de conexión al guardar la configuración');
    } finally {
      setSaving(false);
    }
  }

  const libres = puestos.filter(
    puesto => puesto.estado === 'libre'
  ).length;

  const ocupados = puestos.filter(
    puesto => puesto.estado === 'ocupado'
  ).length;

  const tiposPuestos = ['todos', 'carro', 'moto', 'bici'];

  const filteredPuestos = puestos.filter(puesto => {
    const tipoCoincide =
      tipoFiltro === 'todos' ||
      String(puesto.tipo).toLowerCase() === tipoFiltro;

    const estadoCoincide =
      estadoFiltro === 'todos' ||
      puesto.estado === estadoFiltro;

    return tipoCoincide && estadoCoincide;
  });

  function puestosByTipo(tipo) {
    return puestos.filter(
      puesto => String(puesto.tipo).toLowerCase() === tipo
    );
  }

  function tipoIcon(tipo) {
    if (tipo === 'moto') return '🏍️';
    if (tipo === 'bici') return '🚲';
    return '🚗';
  }

  function nombreTipo(tipo) {
    if (tipo === 'moto') return 'Motos';
    if (tipo === 'bici') return 'Bicicletas';
    return 'Carros';
  }

  return (
    <div className="page-enter">
      <div className="page-header">
        <div>
          <h1>Gestión de Puestos</h1>

          <p
            style={{
              marginTop: 4,
              fontSize: 13,
              color: 'var(--text-secondary)'
            }}
          >
            {config.nombre_parqueadero || 'Parqueadero Central'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-ghost"
            onClick={loadData}
            disabled={loading}
          >
            <RefreshCw size={15} />
            Actualizar
          </button>

          <button
            className="btn btn-primary"
            onClick={() => setShowConfig(true)}
            disabled={loading}
          >
            <Settings size={15} />
            Configurar
          </button>
        </div>
      </div>

      <div className="page-body">
        <div className="stats-grid" style={{ marginBottom: 20 }}>
          <div className="stat-card green">
            <div className="stat-icon green">
              <Unlock size={22} />
            </div>

            <div className="stat-info">
              <h3>{libres}</h3>
              <p>Puestos libres</p>
            </div>
          </div>

          <div className="stat-card red">
            <div className="stat-icon red">
              <LockKeyhole size={22} />
            </div>

            <div className="stat-info">
              <h3>{ocupados}</h3>
              <p>Puestos ocupados</p>
            </div>
          </div>

          <div className="stat-card blue">
            <div className="stat-icon blue">
              <Car size={22} />
            </div>

            <div className="stat-info">
              <h3>
                {
                  puestosByTipo('carro').filter(
                    puesto => puesto.estado === 'libre'
                  ).length
                }
                /{puestosByTipo('carro').length}
              </h3>

              <p>Carros libres</p>
            </div>
          </div>

          <div className="stat-card cyan">
            <div className="stat-icon cyan">
              <Bike size={22} />
            </div>

            <div className="stat-info">
              <h3>
                {
                  puestosByTipo('moto').filter(
                    puesto => puesto.estado === 'libre'
                  ).length
                }
                /{puestosByTipo('moto').length}
              </h3>

              <p>Motos libres</p>
            </div>
          </div>
        </div>

        {mapUrl && (
          <div
            className="card"
            style={{
              marginBottom: 20,
              padding: 0,
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <h3 style={{ fontSize: 15, fontWeight: 700 }}>
                🗺️ Mapa del Parqueadero
              </h3>

              <span
                style={{
                  fontSize: 12,
                  color: 'var(--text-secondary)'
                }}
              >
                Imagen referencial
              </span>
            </div>

            <img
              src={mapUrl}
              alt="Mapa del parqueadero"
              style={{
                width: '100%',
                maxHeight: 360,
                objectFit: 'contain',
                background: '#0a0e1a'
              }}
            />
          </div>
        )}

        <div
          className="card"
          style={{
            marginBottom: 20,
            padding: '14px 16px',
            background: 'rgba(6, 182, 212, 0.05)'
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10
            }}
          >
            <CircleParking
              size={18}
              style={{
                color: 'var(--accent-cyan)',
                flexShrink: 0,
                marginTop: 1
              }}
            />

            <div>
              <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 3 }}>
                Asignación desde Gestión de Usuarios
              </p>

              <p
                style={{
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  lineHeight: 1.5
                }}
              >
                Los puestos ocupados se asignan al crear o editar usuarios.
                Aquí puedes consultar su estado y liberar puestos cuando sea
                necesario.
              </p>
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 16,
            flexWrap: 'wrap'
          }}
        >
          <div
            style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap'
            }}
          >
            {tiposPuestos.map(tipo => (
              <button
                key={tipo}
                className={`btn btn-sm ${
                  tipoFiltro === tipo ? 'btn-primary' : 'btn-ghost'
                }`}
                onClick={() => setTipoFiltro(tipo)}
              >
                {tipo === 'todos'
                  ? 'Todos'
                  : `${tipoIcon(tipo)} ${nombreTipo(tipo)}`}

                {tipo !== 'todos' && (
                  <span style={{ opacity: 0.7 }}>
                    {' '}
                    ({puestosByTipo(tipo).length})
                  </span>
                )}
              </button>
            ))}
          </div>

          <div
            style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap'
            }}
          >
            <button
              className={`btn btn-sm ${
                estadoFiltro === 'todos' ? 'btn-primary' : 'btn-ghost'
              }`}
              onClick={() => setEstadoFiltro('todos')}
            >
              Todos los estados
            </button>

            <button
              className={`btn btn-sm ${
                estadoFiltro === 'libre' ? 'btn-primary' : 'btn-ghost'
              }`}
              onClick={() => setEstadoFiltro('libre')}
            >
              Libres ({libres})
            </button>

            <button
              className={`btn btn-sm ${
                estadoFiltro === 'ocupado' ? 'btn-primary' : 'btn-ghost'
              }`}
              onClick={() => setEstadoFiltro('ocupado')}
            >
              Ocupados ({ocupados})
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <div className="spinner" style={{ margin: '0 auto' }} />
          </div>
        ) : (
          <div className="card">
            <p
              style={{
                fontSize: 12,
                color: 'var(--text-secondary)',
                marginBottom: 16
              }}
            >
              Haz clic sobre un puesto ocupado para ver el usuario asignado y
              liberarlo. Los puestos libres se asignan desde Gestión de
              Usuarios.
            </p>

            {filteredPuestos.length === 0 ? (
              <div
                style={{
                  padding: 35,
                  textAlign: 'center',
                  color: 'var(--text-secondary)'
                }}
              >
                No hay puestos para el filtro seleccionado.
              </div>
            ) : (
              <div
                className="puestos-grid"
                style={{
                  gridTemplateColumns:
                    'repeat(auto-fill, minmax(105px, 1fr))'
                }}
              >
                {filteredPuestos.map(puesto => {
                  const ocupado = puesto.estado === 'ocupado';
                  const liberando = liberandoId === puesto.id;

                  return (
                    <button
                      key={puesto.id}
                      type="button"
                      className={`puesto-cell ${
                        ocupado ? 'puesto-ocupado' : 'puesto-libre'
                      }`}
                      onClick={() => {
                        if (ocupado && !liberando) {
                          liberarPuesto(puesto);
                        }
                      }}
                      disabled={!ocupado || liberando}
                      title={
                        ocupado
                          ? `Puesto #${puesto.numero} — ${puesto.usuario_nombre || 'Usuario no identificado'}`
                          : `Puesto #${puesto.numero} — Libre`
                      }
                      style={{
                        border: 'none',
                        cursor: ocupado ? 'pointer' : 'default',
                        minHeight: 85,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                        opacity: liberando ? 0.65 : 1
                      }}
                    >
                      {liberando ? (
                        <span
                          className="spinner"
                          style={{
                            width: 18,
                            height: 18,
                            borderWidth: 2
                          }}
                        />
                      ) : (
                        <>
                          <span style={{ fontSize: 18 }}>
                            {tipoIcon(
                              String(puesto.tipo || '').toLowerCase()
                            )}
                          </span>

                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 800
                            }}
                          >
                            #{puesto.numero}
                          </span>

                          <span
                            style={{
                              fontSize: 9,
                              maxWidth: 95,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              opacity: 0.9
                            }}
                          >
                            {ocupado
                              ? puesto.usuario_nombre || 'Ocupado'
                              : 'Libre'}
                          </span>

                          {ocupado && (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3,
                                fontSize: 9,
                                opacity: 0.8
                              }}
                            >
                              <User size={10} />
                              Liberar
                            </span>
                          )}
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {showConfig && (
        <div
          className="modal-overlay"
          onClick={event => {
            if (event.target === event.currentTarget && !saving) {
              setShowConfig(false);
            }
          }}
        >
          <div className="modal-box">
            <div className="modal-header">
              <h2>Configurar Parqueadero</h2>

              <button
                type="button"
                className="modal-close"
                onClick={() => setShowConfig(false)}
                disabled={saving}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveConfig}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Nombre del parqueadero</label>

                  <input
                    type="text"
                    className="form-input"
                    value={configForm.nombre_parqueadero || ''}
                    onChange={event =>
                      setConfigForm(form => ({
                        ...form,
                        nombre_parqueadero: event.target.value
                      }))
                    }
                  />
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    gap: 12
                  }}
                >
                  <div className="form-group">
                    <label>🚗 Carros</label>

                    <input
                      type="number"
                      className="form-input"
                      min="0"
                      value={configForm.total_puestos_carro || 0}
                      onChange={event =>
                        setConfigForm(form => ({
                          ...form,
                          total_puestos_carro: event.target.value
                        }))
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label>🏍️ Motos</label>

                    <input
                      type="number"
                      className="form-input"
                      min="0"
                      value={configForm.total_puestos_moto || 0}
                      onChange={event =>
                        setConfigForm(form => ({
                          ...form,
                          total_puestos_moto: event.target.value
                        }))
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label>🚲 Bicicletas</label>

                    <input
                      type="number"
                      className="form-input"
                      min="0"
                      value={configForm.total_puestos_bici || 0}
                      onChange={event =>
                        setConfigForm(form => ({
                          ...form,
                          total_puestos_bici: event.target.value
                        }))
                      }
                    />
                  </div>
                </div>

                <div
                  style={{
                    background: 'rgba(245, 158, 11, 0.08)',
                    border: '1px solid rgba(245, 158, 11, 0.25)',
                    borderRadius: 8,
                    padding: '10px 14px',
                    fontSize: 12,
                    color: 'var(--accent-yellow)',
                    lineHeight: 1.5
                  }}
                >
                  ⚠️ Si eliges reconstruir los puestos, todas las asignaciones
                  actuales de carro, moto y bicicleta se eliminarán.
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setShowConfig(false)}
                  disabled={saving}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                >
                  {saving ? (
                    <span
                      className="spinner"
                      style={{
                        width: 14,
                        height: 14,
                        borderWidth: 2
                      }}
                    />
                  ) : (
                    <Settings size={14} />
                  )}

                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && (
        <div className="toast-container">
          <div
            className={`toast ${
              toast.type === 'success' ? 'toast-success' : 'toast-error'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle size={16} />
            ) : (
              <AlertCircle size={16} />
            )}

            <span style={{ flex: 1 }}>{toast.msg}</span>
          </div>
        </div>
      )}
    </div>
  );
}