import React, { useEffect, useState } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Search,
  X,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import {
  apiGetUsuarios,
  apiCrearUsuario,
  apiActualizarUsuario,
  apiEliminarUsuario,
  apiGetPuestos,
  apiGetPuestosUsuario,
  apiAsignarPuestosUsuario
} from '../../api.js';
import { calcularFechaFin } from '../../utils/periodo.js';

const TIPOS_VEHICULO = [
  { value: '', label: 'Sin vehículo / Sin asignación' },
  { value: 'Carro', label: 'Carro' },
  { value: 'Moto', label: 'Moto' },
  { value: 'Carro y moto', label: 'Carro y moto' }
];

const TIPOS_TARIFA = ['Mensualidad', 'Por días', 'Por horas'];
const TODAY = new Date().toISOString().slice(0, 10);

const EMPTY_FORM = {
  nombre: '',
  cedula: '',
  correo: '',
  telefono: '',
  celular: '',
  direccion: '',
  placa_carro: '',
  placa_moto: '',
  tipo_vehiculo: '',
  puestoCarroId: '',
  puestoMotoId: '',
  tipo_tarifa: 'Mensualidad',
  valor_tarifa: '',
  contrasena: '',
  fecha_inicio: TODAY
};

export default function GestionUsuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [puestos, setPuestos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingPuestos, setLoadingPuestos] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState(null);

  useEffect(() => {
    loadUsuarios();
  }, []);

  async function loadUsuarios() {
    setLoading(true);

    try {
      const res = await apiGetUsuarios();

      if (res.success) {
        setUsuarios(
          (res.data || []).filter(usuario => usuario.rol !== 'admin')
        );
      } else {
        showToast('error', res.error || 'No fue posible cargar los usuarios');
      }
    } catch {
      showToast('error', 'Error de conexión al cargar los usuarios');
    } finally {
      setLoading(false);
    }
  }

  async function loadPuestos() {
    setLoadingPuestos(true);

    try {
      const res = await apiGetPuestos();

      if (res.success) {
        const lista = res.data || [];
        setPuestos(lista);
        return lista;
      }

      showToast('error', res.error || 'No fue posible cargar los puestos');
      return [];
    } catch {
      showToast('error', 'Error de conexión al cargar los puestos');
      return [];
    } finally {
      setLoadingPuestos(false);
    }
  }

  async function openCreate() {
    setEditingUser(null);

    setForm({
      ...EMPTY_FORM,
      fecha_inicio: TODAY
    });

    setShowModal(true);
    await loadPuestos();
  }

  async function openEdit(usuario) {
    setEditingUser(usuario);
    setShowModal(true);
    setLoadingPuestos(true);

    try {
      const [resPuestos, resPuestosUsuario] = await Promise.all([
        apiGetPuestos(),
        apiGetPuestosUsuario(usuario.id)
      ]);

      const todosLosPuestos = resPuestos.success
        ? resPuestos.data || []
        : [];

      const puestosUsuario = resPuestosUsuario.success
        ? resPuestosUsuario.data || []
        : [];

      const puestoCarro = puestosUsuario.find(
        puesto => String(puesto.tipo).toLowerCase() === 'carro'
      );

      const puestoMoto = puestosUsuario.find(
        puesto => String(puesto.tipo).toLowerCase() === 'moto'
      );

      setPuestos(todosLosPuestos);

      let tipoVehiculo = usuario.tipo_vehiculo || '';

      if (puestoCarro && puestoMoto) {
        tipoVehiculo = 'Carro y moto';
      } else if (puestoCarro && !tipoVehiculo) {
        tipoVehiculo = 'Carro';
      } else if (puestoMoto && !tipoVehiculo) {
        tipoVehiculo = 'Moto';
      }

      setForm({
        ...EMPTY_FORM,
        ...usuario,
        cedula: usuario.cedula?.toString() || '',
        placa_carro: usuario.placa_carro || '',
        placa_moto: usuario.placa_moto || '',
        valor_tarifa: usuario.valor_tarifa ?? '',
        contrasena: '',
        fecha_inicio: usuario.fecha_inicio || TODAY,
        tipo_vehiculo: tipoVehiculo,
        puestoCarroId: puestoCarro?.id || '',
        puestoMotoId: puestoMoto?.id || ''
      });

      if (!resPuestos.success) {
        showToast(
          'error',
          resPuestos.error || 'No fue posible cargar los puestos'
        );
      }

      if (!resPuestosUsuario.success) {
        showToast(
          'error',
          resPuestosUsuario.error ||
            'No fue posible cargar los puestos del usuario'
        );
      }
    } catch {
      showToast('error', 'Error de conexión al cargar los puestos');
    } finally {
      setLoadingPuestos(false);
    }
  }

  function closeModal() {
    if (saving) return;

    setShowModal(false);
    setEditingUser(null);
    setPuestos([]);
    setForm(EMPTY_FORM);
  }

  function showToast(type, msg) {
    setToast({ type, msg });

    window.setTimeout(() => {
      setToast(null);
    }, 4000);
  }

  function handleCedulaChange(value) {
    const cedulaSoloNumeros = value.replace(/\D/g, '').slice(0, 12);

    setForm(current => ({
      ...current,
      cedula: cedulaSoloNumeros
    }));
  }

  function handleTipoVehiculoChange(tipo) {
    setForm(current => ({
      ...current,
      tipo_vehiculo: tipo,
      placa_carro:
        tipo === 'Moto' || tipo === ''
          ? ''
          : current.placa_carro,
      placa_moto:
        tipo === 'Carro' || tipo === ''
          ? ''
          : current.placa_moto,
      puestoCarroId:
        tipo === 'Moto' || tipo === ''
          ? ''
          : current.puestoCarroId,
      puestoMotoId:
        tipo === 'Carro' || tipo === ''
          ? ''
          : current.puestoMotoId
    }));
  }

  function esTipoCarro() {
    return (
      form.tipo_vehiculo === 'Carro' ||
      form.tipo_vehiculo === 'Carro y moto'
    );
  }

  function esTipoMoto() {
    return (
      form.tipo_vehiculo === 'Moto' ||
      form.tipo_vehiculo === 'Carro y moto'
    );
  }

  function puestosDisponibles(tipo) {
    return puestos.filter(puesto => {
      const esTipoCorrecto =
        String(puesto.tipo).toLowerCase() === tipo;

      const estaLibre = puesto.estado === 'libre';

      const perteneceAlUsuarioEditado =
        editingUser &&
        String(puesto.usuario_id) === String(editingUser.id);

      return esTipoCorrecto && (estaLibre || perteneceAlUsuarioEditado);
    });
  }

  function placasUsuario(usuario) {
    const placas = [];

    if (usuario.placa_carro) {
      placas.push(`🚗 ${usuario.placa_carro}`);
    }

    if (usuario.placa_moto) {
      placas.push(`🏍️ ${usuario.placa_moto}`);
    }

    if (placas.length === 0 && usuario.placa) {
      placas.push(usuario.placa);
    }

    return placas.length ? placas.join(' · ') : '—';
  }

async function handleSave(event) {
  event.preventDefault();

  const nombre = String(form.nombre || '').trim();
  const cedula = String(form.cedula || '').trim();
  const correo = String(form.correo || '').trim().toLowerCase();
  const telefono = String(form.telefono || '').trim();
  const celular = String(form.celular || '').trim();
  const direccion = String(form.direccion || '').trim();
  const placaCarro = String(form.placa_carro || '')
    .trim()
    .toUpperCase();
  const placaMoto = String(form.placa_moto || '')
    .trim()
    .toUpperCase();

  if (!nombre) {
    showToast('error', 'El nombre es obligatorio');
    return;
  }

  if (esTipoCarro() && !placaCarro) {
    showToast('error', 'La placa del carro es obligatoria');
    return;
  }

  if (esTipoMoto() && !placaMoto) {
    showToast('error', 'La placa de la moto es obligatoria');
    return;
  }

  const fechaInicio = form.fecha_inicio || TODAY;
  const fechaFin = calcularFechaFin(fechaInicio);

  const payload = {
    nombre,
    cedula,
    correo,
    telefono,
    celular,
    direccion,
    placa_carro: esTipoCarro() ? placaCarro : '',
    placa_moto: esTipoMoto() ? placaMoto : '',
    tipo_vehiculo: String(form.tipo_vehiculo || ''),
    tipo_tarifa: String(form.tipo_tarifa || ''),
    valor_tarifa: form.valor_tarifa || 0,
    contrasena: String(form.contrasena || ''),
    fecha_inicio: fechaInicio,
    fecha_fin: fechaFin
  };

  setSaving(true);

  try {
    const resUsuario = editingUser
      ? await apiActualizarUsuario({
          ...payload,
          id: editingUser.id
        })
      : await apiCrearUsuario(payload);

    if (!resUsuario?.success) {
      showToast(
        'error',
        resUsuario?.error || 'No fue posible guardar el usuario'
      );
      return;
    }

    const userId = editingUser?.id || resUsuario?.data?.id;

    if (!userId) {
      showToast(
        'error',
        'El usuario fue guardado, pero no se recibió su identificador'
      );
      await loadUsuarios();
      return;
    }

    const tienePuestoSeleccionado =
      Boolean(form.puestoCarroId) || Boolean(form.puestoMotoId);

    if (tienePuestoSeleccionado) {
      const resPuestos = await apiAsignarPuestosUsuario({
        userId,
        userName: nombre,
        puestoCarroId: esTipoCarro() ? form.puestoCarroId : '',
        puestoMotoId: esTipoMoto() ? form.puestoMotoId : ''
      });

      if (!resPuestos?.success) {
        showToast(
          'error',
          resPuestos?.error ||
            'El usuario fue guardado, pero no se pudieron asignar los puestos'
        );

        await loadUsuarios();
        return;
      }
    }

    const mensaje = editingUser
      ? 'Usuario actualizado correctamente'
      : `Usuario creado. Contraseña inicial: ${
          resUsuario?.data?.passwordInicial ||
          payload.contrasena ||
          '123456'
        }`;

    showToast('success', mensaje);
    closeModal();
    await loadUsuarios();
  } catch (error) {
    console.error('Error al guardar usuario:', error);

    showToast(
      'error',
      'Error de conexión al guardar el usuario: ' +
        (error?.message || 'Error desconocido')
    );
  } finally {
    setSaving(false);
  }
}

  async function handleDelete(usuario) {
    const confirmar = window.confirm(
      `¿Eliminar al usuario ${usuario.nombre}?\n\n` +
        'El usuario quedará inactivo y sus puestos quedarán libres.'
    );

    if (!confirmar) return;

    try {
      const res = await apiEliminarUsuario(usuario.id);

      if (res.success) {
        showToast('success', 'Usuario eliminado y puestos liberados');
        await loadUsuarios();
      } else {
        showToast('error', res.error || 'No fue posible eliminar el usuario');
      }
    } catch {
      showToast('error', 'Error de conexión al eliminar el usuario');
    }
  }

  const searchText = search.toLowerCase().trim();

  const filtered = usuarios.filter(usuario => {
    if (!searchText) return true;

    return (
      usuario.nombre?.toLowerCase().includes(searchText) ||
      usuario.cedula?.toString().includes(searchText) ||
      usuario.correo?.toLowerCase().includes(searchText) ||
      usuario.placa?.toLowerCase().includes(searchText) ||
      usuario.placa_carro?.toLowerCase().includes(searchText) ||
      usuario.placa_moto?.toLowerCase().includes(searchText) ||
      usuario.celular?.toString().includes(searchText)
    );
  });

  function vehicleEmoji(tipo) {
    if (tipo === 'Moto') return '🏍️';
    if (tipo === 'Carro y moto') return '🚗 🏍️';
    if (!tipo) return '—';
    return '🚗';
  }

  return (
    <div className="page-enter">
      <div className="page-header">
        <h1>Gestión de Usuarios</h1>

        <button className="btn btn-primary" onClick={openCreate}>
          <Plus size={16} />
          Nuevo Usuario
        </button>
      </div>

      <div className="page-body">
        <div
          style={{
            position: 'relative',
            marginBottom: 20,
            maxWidth: 420
          }}
        >
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: 14,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)'
            }}
          />

          <input
            type="text"
            className="form-input"
            placeholder="Buscar por nombre, cédula, correo o placa..."
            value={search}
            onChange={event => setSearch(event.target.value)}
            style={{ paddingLeft: 40 }}
          />
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <div className="spinner" style={{ margin: '0 auto' }} />
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Cédula</th>
                  <th>Placas</th>
                  <th>Vehículo</th>
                  <th>Tarifa</th>
                  <th>Valor</th>
                  <th>Celular</th>
                  <th>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      style={{
                        textAlign: 'center',
                        padding: 40,
                        color: 'var(--text-secondary)'
                      }}
                    >
                      Sin usuarios registrados
                    </td>
                  </tr>
                ) : (
                  filtered.map(usuario => (
                    <tr key={usuario.id}>
                      <td>
                        <div>
                          <p style={{ fontWeight: 600 }}>
                            {usuario.nombre}
                          </p>

                          <p
                            style={{
                              fontSize: 11,
                              color: 'var(--text-secondary)'
                            }}
                          >
                            {usuario.correo || 'Sin correo registrado'}
                          </p>
                        </div>
                      </td>

                      <td>
                        <span
                          style={{
                            fontFamily: 'monospace',
                            fontWeight: 600,
                            fontSize: 13
                          }}
                        >
                          {usuario.cedula || '—'}
                        </span>
                      </td>

                      <td>
                        <span
                          style={{
                            fontFamily: 'monospace',
                            fontWeight: 700,
                            color: 'var(--accent-cyan)',
                            fontSize: 12
                          }}
                        >
                          {placasUsuario(usuario)}
                        </span>
                      </td>

                      <td>
                        {vehicleEmoji(usuario.tipo_vehiculo)}{' '}
                        {usuario.tipo_vehiculo || 'Sin vehículo'}
                      </td>

                      <td>
                        <span style={{ fontSize: 12 }}>
                          {usuario.tipo_tarifa || '—'}
                        </span>
                      </td>

                      <td>
                        <span
                          style={{
                            fontWeight: 700,
                            color: 'var(--accent-green)'
                          }}
                        >
                          $
                          {Number(usuario.valor_tarifa || 0).toLocaleString(
                            'es-CO'
                          )}
                        </span>
                      </td>

                      <td style={{ color: 'var(--text-secondary)' }}>
                        {usuario.celular || '—'}
                      </td>

                      <td>
                        <div className="td-actions">
                          <button
                            className="btn btn-ghost btn-icon"
                            onClick={() => openEdit(usuario)}
                            title="Editar"
                          >
                            <Edit2 size={15} />
                          </button>

                          <button
                            className="btn btn-danger btn-icon"
                            onClick={() => handleDelete(usuario)}
                            title="Eliminar"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div
          className="modal-overlay"
          onClick={event => {
            if (event.target === event.currentTarget) {
              closeModal();
            }
          }}
        >
          <div className="modal-box modal-lg">
            <div className="modal-header">
              <h2>{editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}</h2>

              <button
                type="button"
                className="modal-close"
                onClick={closeModal}
                disabled={saving}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label>Nombre completo *</label>

                    <input
                      type="text"
                      className="form-input"
                      value={form.nombre}
                      onChange={event =>
                        setForm(current => ({
                          ...current,
                          nombre: event.target.value
                        }))
                      }
                      placeholder="Juan Pérez"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Cédula</label>

                    <input
                      type="text"
                      className="form-input"
                      value={form.cedula}
                      onChange={event =>
                        handleCedulaChange(event.target.value)
                      }
                      placeholder="Ej: 1234567890"
                      inputMode="numeric"
                      maxLength={12}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Correo electrónico</label>

                  <input
                    type="email"
                    className="form-input"
                    value={form.correo}
                    onChange={event =>
                      setForm(current => ({
                        ...current,
                        correo: event.target.value
                      }))
                    }
                    placeholder="juan@correo.com"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Teléfono fijo</label>

                    <input
                      type="tel"
                      className="form-input"
                      value={form.telefono}
                      onChange={event =>
                        setForm(current => ({
                          ...current,
                          telefono: event.target.value
                        }))
                      }
                      placeholder="601 234 5678"
                    />
                  </div>

                  <div className="form-group">
                    <label>Celular</label>

                    <input
                      type="tel"
                      className="form-input"
                      value={form.celular}
                      onChange={event =>
                        setForm(current => ({
                          ...current,
                          celular: event.target.value
                        }))
                      }
                      placeholder="310 123 4567"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Dirección de residencia</label>

                  <input
                    type="text"
                    className="form-input"
                    value={form.direccion}
                    onChange={event =>
                      setForm(current => ({
                        ...current,
                        direccion: event.target.value
                      }))
                    }
                    placeholder="Calle 12 # 34-56, Bogotá"
                  />
                </div>

                <div className="form-group">
                  <label>Tipo de vehículo</label>

                  <select
                    className="form-select"
                    value={form.tipo_vehiculo}
                    onChange={event =>
                      handleTipoVehiculoChange(event.target.value)
                    }
                  >
                    {TIPOS_VEHICULO.map(tipo => (
                      <option key={tipo.value} value={tipo.value}>
                        {tipo.label}
                      </option>
                    ))}
                  </select>
                </div>

                {esTipoCarro() && (
                  <div className="form-group">
                    <label>Placa del carro *</label>

                    <input
                      type="text"
                      className="form-input"
                      value={form.placa_carro}
                      onChange={event =>
                        setForm(current => ({
                          ...current,
                          placa_carro: event.target.value
                            .toUpperCase()
                            .replace(/\s/g, '')
                        }))
                      }
                      placeholder="ABC123"
                      maxLength={8}
                      required
                    />
                  </div>
                )}

                {esTipoMoto() && (
                  <div className="form-group">
                    <label>Placa de la moto *</label>

                    <input
                      type="text"
                      className="form-input"
                      value={form.placa_moto}
                      onChange={event =>
                        setForm(current => ({
                          ...current,
                          placa_moto: event.target.value
                            .toUpperCase()
                            .replace(/\s/g, '')
                        }))
                      }
                      placeholder="ABC12D"
                      maxLength={8}
                      required
                    />
                  </div>
                )}

                {form.tipo_vehiculo && (
                  <div
                    style={{
                      marginBottom: 18,
                      padding: 14,
                      borderRadius: 8,
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-secondary)'
                    }}
                  >
                    <p
                      style={{
                        marginBottom: 12,
                        fontSize: 13,
                        fontWeight: 700
                      }}
                    >
                      Asignación de puestos
                    </p>

                    <p
                      style={{
                        marginTop: -6,
                        marginBottom: 14,
                        fontSize: 12,
                        color: 'var(--text-secondary)'
                      }}
                    >
                      La asignación es opcional. Puedes registrar el usuario
                      sin asignarle un puesto.
                    </p>

                    {loadingPuestos ? (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          fontSize: 13,
                          color: 'var(--text-secondary)'
                        }}
                      >
                        <div
                          className="spinner"
                          style={{
                            width: 16,
                            height: 16,
                            borderWidth: 2
                          }}
                        />
                        Cargando puestos disponibles...
                      </div>
                    ) : (
                      <div className="form-row">
                        {esTipoCarro() && (
                          <div className="form-group">
                            <label>Puesto de carro</label>

                            <select
                              className="form-select"
                              value={form.puestoCarroId}
                              onChange={event =>
                                setForm(current => ({
                                  ...current,
                                  puestoCarroId: event.target.value
                                }))
                              }
                            >
                              <option value="">
                                Sin puesto de carro asignado
                              </option>

                              {puestosDisponibles('carro').map(puesto => (
                                <option key={puesto.id} value={puesto.id}>
                                  Puesto {puesto.numero}
                                  {puesto.estado !== 'libre'
                                    ? ' — asignado actualmente'
                                    : ''}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {esTipoMoto() && (
                          <div className="form-group">
                            <label>Puesto de moto</label>

                            <select
                              className="form-select"
                              value={form.puestoMotoId}
                              onChange={event =>
                                setForm(current => ({
                                  ...current,
                                  puestoMotoId: event.target.value
                                }))
                              }
                            >
                              <option value="">
                                Sin puesto de moto asignado
                              </option>

                              {puestosDisponibles('moto').map(puesto => (
                                <option key={puesto.id} value={puesto.id}>
                                  Puesto {puesto.numero}
                                  {puesto.estado !== 'libre'
                                    ? ' — asignado actualmente'
                                    : ''}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="form-row">
                  <div className="form-group">
                    <label>Tipo de tarifa</label>

                    <select
                      className="form-select"
                      value={form.tipo_tarifa}
                      onChange={event =>
                        setForm(current => ({
                          ...current,
                          tipo_tarifa: event.target.value
                        }))
                      }
                    >
                      {TIPOS_TARIFA.map(tipo => (
                        <option key={tipo} value={tipo}>
                          {tipo}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Valor de la tarifa ($)</label>

                    <input
                      type="number"
                      className="form-input"
                      value={form.valor_tarifa}
                      onChange={event =>
                        setForm(current => ({
                          ...current,
                          valor_tarifa: event.target.value
                        }))
                      }
                      placeholder="150000"
                      min="0"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Fecha de inicio del periodo</label>

                  <input
                    type="date"
                    className="form-input"
                    value={form.fecha_inicio || TODAY}
                    onChange={event =>
                      setForm(current => ({
                        ...current,
                        fecha_inicio: event.target.value
                      }))
                    }
                  />

                  <small
                    style={{
                      color: 'var(--text-muted)',
                      fontSize: 11
                    }}
                  >
                    El fin del periodo se calcula automáticamente desde esta
                    fecha.
                  </small>
                </div>

                <div className="form-group">
                  <label>
                    {editingUser
                      ? 'Nueva contraseña (dejar vacío para no cambiar)'
                      : 'Contraseña inicial'}
                  </label>

                  <input
                    type="text"
                    className="form-input"
                    value={form.contrasena}
                    onChange={event =>
                      setForm(current => ({
                        ...current,
                        contrasena: event.target.value
                      }))
                    }
                    placeholder={editingUser ? '••••••••' : 'Ej: 123456'}
                  />

                  {!editingUser && (
                    <small
                      style={{
                        color: 'var(--text-muted)',
                        fontSize: 11
                      }}
                    >
                      Si lo dejas vacío, se asignará “123456” por defecto.
                    </small>
                  )}
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving || loadingPuestos}
                >
                  {saving && (
                    <span
                      className="spinner"
                      style={{
                        width: 16,
                        height: 16,
                        borderWidth: 2
                      }}
                    />
                  )}

                  {editingUser ? 'Guardar cambios' : 'Crear usuario'}
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
              toast.type === 'success'
                ? 'toast-success'
                : 'toast-error'
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