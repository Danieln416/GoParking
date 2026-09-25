import React, { useState, useEffect, useRef } from 'react';
import { 
  CreditCard, 
  Plus, 
  Edit2, 
  Trash2, 
  QrCode, 
  Copy, 
  Check, 
  X, 
  Upload, 
  AlertCircle, 
  CheckCircle,
  Eye,
  EyeOff,
  Building2,
  Wallet,
  Smartphone
} from 'lucide-react';
import { apiGetCuentasPago, apiGuardarCuentaPago, apiEliminarCuentaPago } from '../../api.js';

export default function OpcionesPago() {
  const [cuentas, setCuentas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCuenta, setEditingCuenta] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [zoomQr, setZoomQr] = useState(null);
  const [toast, setToast] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    nombre: '',
    entidad: 'Nequi',
    tipo_cuenta: 'Billetera Digital',
    numero: '',
    titular: '',
    instrucciones: '',
    qr_url: '',
    activo: true
  });
  const [qrFile, setQrFile] = useState(null);
  const [qrPreview, setQrPreview] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadCuentas();
  }, []);

  async function loadCuentas() {
    setLoading(true);
    try {
      const res = await apiGetCuentasPago();
      if (res.success) {
        setCuentas(res.data || []);
      } else {
        showToast('error', res.error || 'Error al cargar las opciones de pago');
      }
    } catch (err) {
      showToast('error', 'Error al conectar con el servidor: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  function showToast(type, msg) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  }

  function handleOpenCreate() {
    setEditingCuenta(null);
    setFormData({
      nombre: '',
      entidad: 'Nequi',
      tipo_cuenta: 'Billetera Digital',
      numero: '',
      titular: 'Administración GoParking',
      instrucciones: 'Enviar comprobante indicando tu nombre y número de bahía.',
      qr_url: '',
      activo: true
    });
    setQrFile(null);
    setQrPreview(null);
    setModalOpen(true);
  }

  function handleOpenEdit(cuenta) {
    setEditingCuenta(cuenta);
    setFormData({
      nombre: cuenta.nombre || '',
      entidad: cuenta.entidad || 'Nequi',
      tipo_cuenta: cuenta.tipo_cuenta || 'Billetera Digital',
      numero: cuenta.numero || '',
      titular: cuenta.titular || '',
      instrucciones: cuenta.instrucciones || '',
      qr_url: cuenta.qr_url || '',
      activo: cuenta.activo !== false
    });
    setQrFile(null);
    setQrPreview(cuenta.qr_url || null);
    setModalOpen(true);
  }

  function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('error', 'Por favor selecciona un archivo de imagen');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      showToast('error', 'La imagen no debe superar los 8MB');
      return;
    }

    setQrFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      setQrPreview(event.target.result);
    };
    reader.readAsDataURL(file);
  }

  async function handleToggleActivo(cuenta) {
    const updated = { ...cuenta, activo: !cuenta.activo };
    const res = await apiGuardarCuentaPago(updated);
    if (res.success) {
      setCuentas(prev => prev.map(c => c.id === cuenta.id ? updated : c));
      showToast('success', `Cuenta ${updated.activo ? 'activada' : 'desactivada'}`);
    } else {
      showToast('error', 'No se pudo actualizar el estado');
    }
  }

  async function handleDelete(id, nombre) {
    if (!window.confirm(`¿Estás seguro de eliminar la opción de pago "${nombre}"?`)) {
      return;
    }
    const res = await apiEliminarCuentaPago(id);
    if (res.success) {
      setCuentas(prev => prev.filter(c => c.id !== id));
      showToast('success', 'Opción de pago eliminada');
    } else {
      showToast('error', res.error || 'Error al eliminar');
    }
  }

  function handleCopy(text, id) {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    showToast('success', 'Número copiado al portapapeles');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!formData.nombre.trim() || !formData.numero.trim()) {
      showToast('error', 'Ingresa el nombre de la cuenta y el número');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...formData,
        id: editingCuenta ? editingCuenta.id : `cuenta-${Date.now()}`
      };

      if (qrFile && qrPreview) {
        payload.base64Data = qrPreview.split(',')[1];
        payload.fileName = qrFile.name;
        payload.mimeType = qrFile.type;
        payload.qr_url = qrPreview; // Inmediata visualización local
      }

      const res = await apiGuardarCuentaPago(payload);
      if (res.success) {
        showToast('success', editingCuenta ? 'Cuenta actualizada correctamente' : 'Nueva cuenta guardada');
        setModalOpen(false);
        loadCuentas();
      } else {
        showToast('error', res.error || 'Error al guardar la cuenta');
      }
    } catch (err) {
      showToast('error', 'Error inesperado: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  function getEntityIcon(entidad) {
    const e = (entidad || '').toLowerCase();
    if (e.includes('nequi') || e.includes('daviplata') || e.includes('dale') || e.includes('movii')) {
      return <Smartphone size={20} color="var(--accent-cyan)" />;
    }
    if (e.includes('efectivo') || e.includes('presencial')) {
      return <Wallet size={20} color="var(--accent-green)" />;
    }
    return <Building2 size={20} color="var(--accent-yellow)" />;
  }

  return (
    <div className="page-enter">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1>Opciones de Pago y QR</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
            Configura las cuentas bancarias, billeteras digitales y códigos QR disponibles para los usuarios.
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenCreate}>
          <Plus size={16} /> Nueva Opción de Pago
        </button>
      </div>

      <div className="page-body">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <span className="spinner" style={{ width: 32, height: 32 }} />
            <p style={{ marginTop: 14, color: 'var(--text-secondary)', fontSize: 14 }}>Cargando cuentas de pago...</p>
          </div>
        ) : cuentas.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
            <CreditCard size={44} color="var(--text-muted)" style={{ margin: '0 auto 16px' }} />
            <h3 style={{ fontSize: 18, marginBottom: 8 }}>No tienes cuentas configuradas</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, maxWidth: 440, margin: '0 auto 20px' }}>
              Agrega una cuenta bancaria, billetera digital (Nequi, Daviplata) o instrucciones de efectivo para que tus usuarios puedan realizar los pagos de las mensualidades.
            </p>
            <button className="btn btn-primary" onClick={handleOpenCreate}>
              <Plus size={16} /> Crear primera cuenta
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
            {cuentas.map(cuenta => {
              const isActive = cuenta.activo !== false;
              return (
                <div 
                  key={cuenta.id} 
                  className="card" 
                  style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    justifyContent: 'space-between',
                    border: isActive ? '1px solid var(--border)' : '1px dashed rgba(255,255,255,0.12)',
                    opacity: isActive ? 1 : 0.65,
                    transition: 'all 0.2s ease',
                    position: 'relative'
                  }}
                >
                  <div>
                    {/* Header de la tarjeta */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {getEntityIcon(cuenta.entidad)}
                        <span style={{ fontWeight: 800, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-secondary)' }}>
                          {cuenta.entidad || 'Entidad'}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button
                          type="button"
                          className={`badge ${isActive ? 'badge-approved' : 'badge-rejected'}`}
                          style={{ cursor: 'pointer', border: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
                          onClick={() => handleToggleActivo(cuenta)}
                          title={isActive ? 'Click para pausar cuenta' : 'Click para activar cuenta'}
                        >
                          {isActive ? <Eye size={11} /> : <EyeOff size={11} />}
                          {isActive ? 'Activa' : 'Inactiva'}
                        </button>
                      </div>
                    </div>

                    {/* Nombre y Número */}
                    <h3 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 4px', color: 'var(--text-primary)' }}>
                      {cuenta.nombre}
                    </h3>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 14 }}>
                      {cuenta.tipo_cuenta || 'Cuenta'}
                    </p>

                    <div 
                      style={{ 
                        background: 'rgba(0,0,0,0.25)', 
                        border: '1px solid var(--border)', 
                        borderRadius: 8, 
                        padding: '10px 14px', 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        marginBottom: 14 
                      }}
                    >
                      <div>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block' }}>
                          Número / Llave
                        </span>
                        <strong style={{ fontSize: 16, fontFamily: 'monospace', letterSpacing: 0.8, color: 'var(--accent-green)' }}>
                          {cuenta.numero}
                        </strong>
                      </div>

                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ padding: '6px 10px', height: 'auto' }}
                        onClick={() => handleCopy(cuenta.numero, cuenta.id)}
                        title="Copiar número"
                      >
                        {copiedId === cuenta.id ? <Check size={14} color="var(--accent-green)" /> : <Copy size={14} />}
                        <span style={{ fontSize: 11, marginLeft: 4 }}>
                          {copiedId === cuenta.id ? '¡Copiado!' : 'Copiar'}
                        </span>
                      </button>
                    </div>

                    {/* Titular */}
                    {cuenta.titular && (
                      <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
                        Titular: <strong style={{ color: 'var(--text-primary)' }}>{cuenta.titular}</strong>
                      </p>
                    )}

                    {/* Instrucciones */}
                    {cuenta.instrucciones && (
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: 14 }}>
                        "{cuenta.instrucciones}"
                      </p>
                    )}

                    {/* Previsualización de QR */}
                    {cuenta.qr_url ? (
                      <div 
                        style={{ 
                          marginTop: 10, 
                          padding: 10, 
                          background: 'rgba(255,255,255,0.03)', 
                          borderRadius: 8, 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 12,
                          cursor: 'pointer'
                        }}
                        onClick={() => setZoomQr({ url: cuenta.qr_url, nombre: cuenta.nombre })}
                      >
                        <img 
                          src={cuenta.qr_url} 
                          alt="QR" 
                          style={{ width: 54, height: 54, objectFit: 'cover', borderRadius: 6, background: '#fff', padding: 2 }} 
                        />
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', display: 'block' }}>
                            Código QR configurado
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--accent-cyan)' }}>
                            Click para ampliar QR 🔍
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div 
                        style={{ 
                          marginTop: 10, 
                          padding: '10px 14px', 
                          background: 'rgba(255,255,255,0.02)', 
                          borderRadius: 8, 
                          border: '1px dashed var(--border)',
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 8,
                          color: 'var(--text-muted)',
                          fontSize: 12
                        }}
                      >
                        <QrCode size={16} /> Sin código QR adjunto
                      </div>
                    )}
                  </div>

                  {/* Acciones */}
                  <div style={{ display: 'flex', gap: 10, marginTop: 18, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ flex: 1 }}
                      onClick={() => handleOpenEdit(cuenta)}
                    >
                      <Edit2 size={14} /> Editar
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      style={{ padding: '0 12px' }}
                      onClick={() => handleDelete(cuenta.id, cuenta.nombre)}
                      title="Eliminar opción de pago"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Crear / Editar */}
      {modalOpen && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && !saving && setModalOpen(false)}>
          <div className="modal-box" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h2>{editingCuenta ? 'Editar Opción de Pago' : 'Nueva Opción de Pago'}</h2>
              <button className="modal-close" onClick={() => !saving && setModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Nombre / Alias visible <span style={{ color: 'var(--accent-red)' }}>*</span></label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Ej: Nequi Principal, Bancolombia Ahorros, Efectivo..."
                    value={formData.nombre}
                    onChange={e => setFormData(f => ({ ...f, nombre: e.target.value }))}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Entidad / Banco</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Ej: Nequi, Bancolombia, Daviplata, Efectivo"
                      value={formData.entidad}
                      onChange={e => setFormData(f => ({ ...f, entidad: e.target.value }))}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Tipo de Cuenta</label>
                    <select
                      className="form-input"
                      value={formData.tipo_cuenta}
                      onChange={e => setFormData(f => ({ ...f, tipo_cuenta: e.target.value }))}
                    >
                      <option value="Billetera Digital">Billetera Digital</option>
                      <option value="Cuenta de Ahorros">Cuenta de Ahorros</option>
                      <option value="Cuenta Corriente">Cuenta Corriente</option>
                      <option value="Presencial / Efectivo">Presencial / Efectivo</option>
                      <option value="Llave Transfiya">Llave Transfiya</option>
                      <option value="Otro">Otro</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Número o Celular <span style={{ color: 'var(--accent-red)' }}>*</span></label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Ej: 3001234567 / 123-456789-01"
                      value={formData.numero}
                      onChange={e => setFormData(f => ({ ...f, numero: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Nombre del Titular</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Ej: Administración GoParking"
                      value={formData.titular}
                      onChange={e => setFormData(f => ({ ...f, titular: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Instrucciones o nota para el usuario</label>
                  <textarea
                    className="form-input"
                    rows={2}
                    placeholder="Ej: Enviar comprobante indicando tu número de bahía y placa."
                    value={formData.instrucciones}
                    onChange={e => setFormData(f => ({ ...f, instrucciones: e.target.value }))}
                  />
                </div>

                {/* Subir Código QR */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Código QR (Opcional)</label>
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 }}>
                    Sube una captura de tu código QR de Nequi, Bancolombia, etc. Los usuarios podrán escanearlo directamente.
                  </p>

                  {qrPreview ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'rgba(0,0,0,0.3)', padding: 10, borderRadius: 8, border: '1px solid var(--border)' }}>
                      <img 
                        src={qrPreview} 
                        alt="QR preview" 
                        style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 6, background: '#fff', padding: 4 }} 
                      />
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-green)', marginBottom: 6 }}>
                          ✓ Imagen de QR seleccionada
                        </p>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            Cambiar imagen
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => {
                              setQrFile(null);
                              setQrPreview(null);
                              setFormData(f => ({ ...f, qr_url: '' }));
                            }}
                          >
                            Quitar QR
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        border: '2px dashed var(--border)',
                        borderRadius: 8,
                        padding: '16px',
                        textAlign: 'center',
                        cursor: 'pointer',
                        background: 'rgba(255,255,255,0.02)'
                      }}
                    >
                      <Upload size={24} color="var(--accent-green)" style={{ margin: '0 auto 6px' }} />
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                        Haz clic aquí para subir la imagen del QR
                      </p>
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                        PNG, JPG o WEBP (máx. 8MB)
                      </span>
                    </div>
                  )}

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                  />
                </div>

                {/* Switch activo */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                  <input
                    type="checkbox"
                    id="cuentaActiva"
                    checked={formData.activo}
                    onChange={e => setFormData(f => ({ ...f, activo: e.target.checked }))}
                    style={{ width: 18, height: 18, accentColor: 'var(--accent-green)', cursor: 'pointer' }}
                  />
                  <label htmlFor="cuentaActiva" style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                    Cuenta activa (visible para los usuarios en la app)
                  </label>
                </div>
              </div>

              <div className="modal-footer" style={{ marginTop: 20 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setModalOpen(false)} disabled={saving}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? (
                    <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Guardando...</>
                  ) : (
                    <><Check size={16} /> {editingCuenta ? 'Guardar Cambios' : 'Crear Opción de Pago'}</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Zoom QR */}
      {zoomQr && (
        <div className="modal-overlay" onClick={() => setZoomQr(null)}>
          <div className="modal-box" style={{ maxWidth: 380, textAlign: 'center', padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>Código QR — {zoomQr.nombre}</h3>
              <button className="modal-close" onClick={() => setZoomQr(null)}>
                <X size={16} />
              </button>
            </div>
            <div style={{ background: '#fff', padding: 16, borderRadius: 12, display: 'inline-block', boxShadow: '0 8px 30px rgba(0,0,0,0.5)' }}>
              <img 
                src={zoomQr.url} 
                alt="Código QR Ampliado" 
                style={{ width: '100%', maxWidth: 280, height: 'auto', display: 'block' }} 
              />
            </div>
            <p style={{ marginTop: 14, fontSize: 12, color: 'var(--text-secondary)' }}>
              Escanea con tu aplicación bancaria o billetera digital favorita.
            </p>
          </div>
        </div>
      )}

      {/* Toast Notification */}
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
