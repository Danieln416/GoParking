import React, { useEffect, useState } from 'react';
import { Users, Plus, Edit2, Trash2, Search, X, CheckCircle, AlertCircle } from 'lucide-react';
import { apiGetUsuarios, apiCrearUsuario, apiActualizarUsuario, apiEliminarUsuario } from '../../api.js';

const TIPOS_VEHICULO = ['Carro', 'Moto', 'Bicicleta'];
const TIPOS_TARIFA = ['Mensualidad', 'Por días', 'Por horas'];

const EMPTY_FORM = {
  nombre: '', correo: '', telefono: '', celular: '',
  direccion: '', placa: '', tipo_vehiculo: 'Carro',
  tipo_tarifa: 'Mensualidad', valor_tarifa: '', contrasena: ''
};

export default function GestionUsuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState(null);

  useEffect(() => { loadUsuarios(); }, []);

  async function loadUsuarios() {
    const res = await apiGetUsuarios();
    if (res.success) setUsuarios(res.data.filter(u => u.rol !== 'admin'));
    setLoading(false);
  }

  function openCreate() {
    setEditingUser(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }

  function openEdit(u) {
    setEditingUser(u);
    setForm({ ...u, contrasena: '' });
    setShowModal(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.nombre || !form.correo) { showToast('error', 'Nombre y correo son requeridos'); return; }
    setSaving(true);
    const res = editingUser
      ? await apiActualizarUsuario({ ...form, id: editingUser.id })
      : await apiCrearUsuario(form);
    if (res.success) {
      showToast('success', editingUser ? 'Usuario actualizado' : `Usuario creado. Contraseña inicial: ${res.data?.passwordInicial || form.contrasena}`);
      setShowModal(false);
      loadUsuarios();
    } else {
      showToast('error', res.error || 'Error al guardar');
    }
    setSaving(false);
  }

  async function handleDelete(u) {
    if (!confirm(`¿Eliminar al usuario ${u.nombre}?`)) return;
    const res = await apiEliminarUsuario(u.id);
    if (res.success) { showToast('success', 'Usuario eliminado'); loadUsuarios(); }
    else showToast('error', res.error || 'Error');
  }

  function showToast(type, msg) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  }

  const filtered = usuarios.filter(u =>
    u.nombre?.toLowerCase().includes(search.toLowerCase()) ||
    u.correo?.toLowerCase().includes(search.toLowerCase()) ||
    u.placa?.toLowerCase().includes(search.toLowerCase())
  );

  function vehicleEmoji(tipo) {
    if (tipo === 'Moto') return '🏍️';
    if (tipo === 'Bicicleta') return '🚲';
    return '🚗';
  }

  return (
    <div className="page-enter">
      <div className="page-header">
        <h1>Gestión de Usuarios</h1>
        <button className="btn btn-primary" onClick={openCreate}>
          <Plus size={16} /> Nuevo Usuario
        </button>
      </div>

      <div className="page-body">
        {/* Buscador */}
        <div style={{ position: 'relative', marginBottom: 20, maxWidth: 360 }}>
          <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text" className="form-input" placeholder="Buscar por nombre, correo o placa..."
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 40 }}
          />
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Placa</th>
                  <th>Vehículo</th>
                  <th>Tarifa</th>
                  <th>Valor</th>
                  <th>Celular</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>Sin usuarios registrados</td></tr>
                ) : filtered.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div>
                        <p style={{ fontWeight: 600 }}>{u.nombre}</p>
                        <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{u.correo}</p>
                      </div>
                    </td>
                    <td><span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--accent-cyan)', fontSize: 13 }}>{u.placa || '—'}</span></td>
                    <td>{vehicleEmoji(u.tipo_vehiculo)} {u.tipo_vehiculo || '—'}</td>
                    <td><span style={{ fontSize: 12 }}>{u.tipo_tarifa || '—'}</span></td>
                    <td><span style={{ fontWeight: 700, color: 'var(--accent-green)' }}>${Number(u.valor_tarifa || 0).toLocaleString('es-CO')}</span></td>
                    <td style={{ color: 'var(--text-secondary)' }}>{u.celular || '—'}</td>
                    <td>
                      <div className="td-actions">
                        <button className="btn btn-ghost btn-icon" onClick={() => openEdit(u)} title="Editar">
                          <Edit2 size={15} />
                        </button>
                        <button className="btn btn-danger btn-icon" onClick={() => handleDelete(u)} title="Eliminar">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal-box modal-lg">
            <div className="modal-header">
              <h2>{editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label>Nombre completo *</label>
                    <input type="text" className="form-input" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Juan Pérez" />
                  </div>
                  <div className="form-group">
                    <label>Correo electrónico *</label>
                    <input type="email" className="form-input" value={form.correo} onChange={e => setForm(f => ({ ...f, correo: e.target.value }))} placeholder="juan@correo.com" />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Teléfono fijo</label>
                    <input type="tel" className="form-input" value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} placeholder="601 234 5678" />
                  </div>
                  <div className="form-group">
                    <label>Celular</label>
                    <input type="tel" className="form-input" value={form.celular} onChange={e => setForm(f => ({ ...f, celular: e.target.value }))} placeholder="310 123 4567" />
                  </div>
                </div>
                <div className="form-group">
                  <label>Dirección de residencia</label>
                  <input type="text" className="form-input" value={form.direccion} onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))} placeholder="Calle 12 # 34-56, Bogotá" />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Placa del vehículo</label>
                    <input type="text" className="form-input" value={form.placa} onChange={e => setForm(f => ({ ...f, placa: e.target.value.toUpperCase() }))} placeholder="ABC 123" maxLength={8} />
                  </div>
                  <div className="form-group">
                    <label>Tipo de vehículo</label>
                    <select className="form-select" value={form.tipo_vehiculo} onChange={e => setForm(f => ({ ...f, tipo_vehiculo: e.target.value }))}>
                      {TIPOS_VEHICULO.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Tipo de tarifa</label>
                    <select className="form-select" value={form.tipo_tarifa} onChange={e => setForm(f => ({ ...f, tipo_tarifa: e.target.value }))}>
                      {TIPOS_TARIFA.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Valor de la tarifa ($)</label>
                    <input type="number" className="form-input" value={form.valor_tarifa} onChange={e => setForm(f => ({ ...f, valor_tarifa: e.target.value }))} placeholder="150000" min="0" />
                  </div>
                </div>
                <div className="form-group">
                  <label>{editingUser ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña inicial'}</label>
                  <input type="text" className="form-input" value={form.contrasena} onChange={e => setForm(f => ({ ...f, contrasena: e.target.value }))} placeholder={editingUser ? '••••••••' : 'Ej: 123456'} />
                  {!editingUser && <small style={{ color: 'var(--text-muted)', fontSize: 11 }}>Si dejas vacío se asignará "123456" por defecto</small>}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : null}
                  {editingUser ? 'Guardar cambios' : 'Crear usuario'}
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
            <span style={{ flex: 1 }}>{toast.msg}</span>
          </div>
        </div>
      )}
    </div>
  );
}
