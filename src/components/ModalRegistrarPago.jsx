import React, { useState, useEffect, useMemo } from 'react';
import { X, CheckCircle, Calendar, DollarSign, CreditCard, User, AlertCircle } from 'lucide-react';
import { apiRegistrarPagoManual, apiGetUsuarios, apiGetRecibos } from '../api.js';
import { getUserPeriodOptions, formatDateLabel, parseDate, formatDateInput } from '../utils/periodo.js';

const METODOS_PAGO = [
  'Efectivo (Presencial)',
  'Nequi',
  'Daviplata',
  'Bancolombia',
  'Transferencia Bancaria',
  'Acuerdo Administrativo',
  'Otro'
];

export default function ModalRegistrarPago({
  isOpen,
  onClose,
  onSuccess,
  usuarioInicial = null,
  periodoInicial = null,
  usuariosDisponibles = []
}) {
  const [usuarios, setUsuarios] = useState(usuariosDisponibles);
  const [loadingUsuarios, setLoadingUsuarios] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [userSearch, setUserSearch] = useState('');

  // Fechas y período
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [modoPersonalizado, setModoPersonalizado] = useState(false);
  const [opcionPeriodoId, setOpcionPeriodoId] = useState('current');

  // Datos del pago
  const [valor, setValor] = useState('');
  const [metodoPago, setMetodoPago] = useState('Efectivo (Presencial)');
  const [fechaPago, setFechaPago] = useState(new Date().toISOString().slice(0, 10));
  const [nota, setNota] = useState('Pago manual registrado por administración');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [userReceipts, setUserReceipts] = useState([]);

  // Cargar lista de usuarios si no se pasaron como prop
  useEffect(() => {
    if (!isOpen) return;
    if (usuariosDisponibles && usuariosDisponibles.length > 0) {
      setUsuarios(usuariosDisponibles.filter(u => u.rol !== 'admin' && u.activo !== 0));
    } else {
      setLoadingUsuarios(true);
      apiGetUsuarios().then(res => {
        if (res.success) {
          const list = (res.data || []).filter(u => u.rol !== 'admin' && u.activo !== 0);
          setUsuarios(list);
        }
      }).finally(() => setLoadingUsuarios(false));
    }
  }, [isOpen, usuariosDisponibles]);

  // Al abrir el modal o cambiar el usuario inicial
  useEffect(() => {
    if (!isOpen) {
      setError('');
      return;
    }

    setError('');
    setSaving(false);
    setMetodoPago('Efectivo (Presencial)');
    setFechaPago(new Date().toISOString().slice(0, 10));
    setNota('Pago manual registrado por administración');

    if (usuarioInicial) {
      setSelectedUserId(usuarioInicial.id);
      setUserSearch(usuarioInicial.nombre || '');
      setValor(usuarioInicial.valor_tarifa || '');
      cargarRecibosYPeriodos(usuarioInicial);
    } else if (usuarios.length > 0 && !selectedUserId) {
      setSelectedUserId(usuarios[0].id);
      setValor(usuarios[0].valor_tarifa || '');
      cargarRecibosYPeriodos(usuarios[0]);
    }
  }, [isOpen, usuarioInicial]);

  const selectedUser = useMemo(() => {
    return usuarios.find(u => String(u.id) === String(selectedUserId)) || usuarioInicial || null;
  }, [usuarios, selectedUserId, usuarioInicial]);

  // Cuando cambia el usuario seleccionado
  function handleSelectUser(u) {
    setSelectedUserId(u.id);
    setUserSearch(u.nombre || '');
    setValor(u.valor_tarifa || '');
    cargarRecibosYPeriodos(u);
  }

  async function cargarRecibosYPeriodos(u) {
    if (!u) return;
    try {
      const res = await apiGetRecibos(u.id);
      const recs = res.success ? (res.data || []) : [];
      setUserReceipts(recs);

      // Si nos pasaron un período inicial forzado (ej. desde el ciclo de cobro)
      if (periodoInicial?.fechaInicio && periodoInicial?.fechaFin) {
        setFechaInicio(periodoInicial.fechaInicio);
        setFechaFin(periodoInicial.fechaFin);
        setModoPersonalizado(false);
        setOpcionPeriodoId('cycle');
        return;
      }

      // De lo contrario, calcular sugerencias de períodos
      const periodData = getUserPeriodOptions(u.fecha_inicio, new Date(), recs);
      if (periodData?.options?.length) {
        const opt = periodData.options.find(o => o.isRecommended) || periodData.options[0];
        setOpcionPeriodoId(opt.id);
        setFechaInicio(opt.fechaInicio);
        setFechaFin(opt.fechaFin);
        setModoPersonalizado(false);
      }
    } catch (e) {
      console.error('Error calculando período para usuario:', e);
    }
  }

  // Opciones de período calculadas para el usuario actual
  const periodOptions = useMemo(() => {
    if (!selectedUser) return [];
    return getUserPeriodOptions(selectedUser.fecha_inicio, new Date(), userReceipts).options || [];
  }, [selectedUser, userReceipts]);

  function handlePeriodOptionClick(opt) {
    setOpcionPeriodoId(opt.id);
    setModoPersonalizado(false);
    setFechaInicio(opt.fechaInicio);
    setFechaFin(opt.fechaFin);
  }

  function handleCustomStartDateChange(e) {
    const startVal = e.target.value;
    setFechaInicio(startVal);
    setModoPersonalizado(true);
    setOpcionPeriodoId('custom');

    // Calcular fin automáticamente (+1 mes - 1 día)
    if (startVal) {
      const d = parseDate(startVal);
      if (d) {
        const end = new Date(d.getFullYear(), d.getMonth() + 1, d.getDate() - 1);
        setFechaFin(formatDateInput(end));
      }
    }
  }

  const filteredUsuarios = useMemo(() => {
    if (!userSearch.trim()) return usuarios;
    const q = userSearch.toLowerCase();
    return usuarios.filter(u =>
      (u.nombre || '').toLowerCase().includes(q) ||
      (u.correo || '').toLowerCase().includes(q) ||
      (u.placa || '').toLowerCase().includes(q) ||
      (u.placa_carro || '').toLowerCase().includes(q) ||
      (u.placa_moto || '').toLowerCase().includes(q)
    );
  }, [usuarios, userSearch]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!selectedUserId) {
      setError('Debes seleccionar un cliente.');
      return;
    }
    if (!fechaInicio) {
      setError('Debes ingresar la fecha de inicio del período.');
      return;
    }
    if (!fechaFin) {
      setError('Debes ingresar la fecha de fin del período.');
      return;
    }

    setSaving(true);
    try {
      const startObj = parseDate(fechaInicio);
      const res = await apiRegistrarPagoManual({
        usuarioId: selectedUserId,
        fechaInicio,
        fechaFin,
        mes: startObj ? startObj.getMonth() + 1 : (new Date().getMonth() + 1),
        anio: startObj ? startObj.getFullYear() : new Date().getFullYear(),
        metodoPago,
        valor: Number(valor) || 0,
        nota: nota.trim() || 'Pago manual registrado por administración',
        fechaPago
      });

      if (res.success) {
        if (onSuccess) {
          onSuccess(res.data, selectedUser);
        }
        onClose();
      } else {
        setError(res.error || 'Error al registrar el pago');
      }
    } catch (err) {
      setError('Error inesperado: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
      <div
        className="modal-box"
        style={{
          width: '100%',
          maxWidth: 620,
          background: 'var(--bg-card)',
          borderRadius: 14,
          border: '1px solid var(--border)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.45)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh'
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
            background: 'linear-gradient(135deg, rgba(22, 199, 83, 0.12) 0%, rgba(14, 165, 233, 0.05) 100%)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: 'rgba(22, 199, 83, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <CheckCircle size={20} color="var(--accent-green)" />
            </div>
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Marcar Período como Pagado
              </h2>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                Registrar pago manual y poner al día a cualquier cliente
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onClose}
            style={{ padding: 4, height: 'auto' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto' }}>
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {error && (
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  padding: '10px 14px',
                  borderRadius: 8,
                  fontSize: 13,
                  color: 'var(--accent-red)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}
              >
                <AlertCircle size={16} /> {error}
              </div>
            )}

            {/* SELECCIÓN DE USUARIO */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 700, display: 'block', marginBottom: 6 }}>
                👤 Cliente a registrar pago:
              </label>

              {usuarioInicial ? (
                <div
                  style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: '10px 14px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <strong style={{ fontSize: 14, color: 'var(--text-primary)' }}>{usuarioInicial.nombre}</strong>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                      {usuarioInicial.correo || 'Sin correo'} · Placa: <strong>{usuarioInicial.placa || usuarioInicial.placa_carro || usuarioInicial.placa_moto || 'N/A'}</strong>
                    </p>
                  </div>
                  <span
                    className="badge"
                    style={{ background: 'rgba(22, 199, 83, 0.15)', color: 'var(--accent-green)', fontWeight: 700 }}
                  >
                    ${Number(usuarioInicial.valor_tarifa || 0).toLocaleString('es-CO')} COP
                  </span>
                </div>
              ) : (
                <div>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="🔍 Buscar cliente por nombre, placa o correo..."
                    value={userSearch}
                    onChange={e => setUserSearch(e.target.value)}
                    style={{ marginBottom: 6 }}
                  />
                  <select
                    className="form-input"
                    value={selectedUserId}
                    onChange={e => {
                      const u = usuarios.find(x => String(x.id) === e.target.value);
                      if (u) handleSelectUser(u);
                    }}
                    style={{ fontWeight: 600 }}
                  >
                    {filteredUsuarios.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.nombre} — {u.placa || u.placa_carro || u.placa_moto || u.tipo_vehiculo || 'Mensualidad'} (${Number(u.valor_tarifa || 0).toLocaleString('es-CO')})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* SELECCIÓN DE PERÍODO */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 700, display: 'block', marginBottom: 6 }}>
                📅 Período de facturación a marcar como pagado:
              </label>

              {/* Botones de sugerencias de período */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 8, marginBottom: 10 }}>
                {periodOptions.map(opt => {
                  const isSelected = opcionPeriodoId === opt.id && !modoPersonalizado;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handlePeriodOptionClick(opt)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 8,
                        textAlign: 'left',
                        cursor: 'pointer',
                        background: isSelected ? 'rgba(22, 199, 83, 0.15)' : 'var(--bg-secondary)',
                        border: isSelected ? '2px solid var(--accent-green)' : '1px solid var(--border)',
                        color: isSelected ? 'var(--accent-green)' : 'var(--text-primary)',
                        transition: 'all 0.15s'
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 700 }}>
                        {opt.id === 'current' ? '⭐ ' : ''}{opt.label}
                      </div>
                      <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2 }}>
                        {opt.periodText}
                      </div>
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => {
                    setModoPersonalizado(true);
                    setOpcionPeriodoId('custom');
                  }}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 8,
                    textAlign: 'left',
                    cursor: 'pointer',
                    background: modoPersonalizado ? 'rgba(56, 189, 248, 0.15)' : 'var(--bg-secondary)',
                    border: modoPersonalizado ? '2px solid var(--accent-cyan)' : '1px solid var(--border)',
                    color: modoPersonalizado ? 'var(--accent-cyan)' : 'var(--text-primary)',
                    transition: 'all 0.15s'
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700 }}>⚙️ Personalizado</div>
                  <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2 }}>Elegir otras fechas</div>
                </button>
              </div>

              {/* Inputs de fecha de inicio y fin */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, background: 'var(--bg-secondary)', padding: 12, borderRadius: 8, border: '1px solid var(--border)' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Fecha de Inicio</label>
                  <input
                    type="date"
                    className="form-input"
                    value={fechaInicio}
                    onChange={handleCustomStartDateChange}
                    required
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Fecha de Fin</label>
                  <input
                    type="date"
                    className="form-input"
                    value={fechaFin}
                    onChange={e => {
                      setFechaFin(e.target.value);
                      setModoPersonalizado(true);
                      setOpcionPeriodoId('custom');
                    }}
                    required
                  />
                </div>
              </div>
            </div>

            {/* DETALLES DEL PAGO */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: 12, fontWeight: 700 }}>💵 Valor pagado ($ COP)</label>
                <input
                  type="number"
                  className="form-input"
                  value={valor}
                  onChange={e => setValor(e.target.value)}
                  placeholder="Ej: 80000"
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: 12, fontWeight: 700 }}>💳 Método de pago</label>
                <select
                  className="form-input"
                  value={metodoPago}
                  onChange={e => setMetodoPago(e.target.value)}
                >
                  {METODOS_PAGO.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: 12, fontWeight: 700 }}>📅 Fecha del pago</label>
                <input
                  type="date"
                  className="form-input"
                  value={fechaPago}
                  onChange={e => setFechaPago(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: 12, fontWeight: 700 }}>📝 Justificación / Nota</label>
                <input
                  type="text"
                  className="form-input"
                  value={nota}
                  onChange={e => setNota(e.target.value)}
                  placeholder="Ej: Recibido en efectivo en portería"
                />
              </div>
            </div>

            <div style={{ padding: '8px 12px', background: 'rgba(56, 189, 248, 0.08)', borderRadius: 6, fontSize: 12, color: 'var(--accent-cyan)' }}>
              ℹ️ Al confirmar, el sistema creará un recibo <strong>aprobado</strong> para este período. El cliente pasará a estado <strong>Al Día</strong> de inmediato y se contabilizará en el ciclo contable de ingresos.
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              padding: '14px 20px',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 10,
              background: 'var(--bg-secondary)'
            }}
          >
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving}
              style={{ background: 'var(--accent-green)', borderColor: 'var(--accent-green)', color: '#fff', gap: 8 }}
            >
              {saving ? (
                <>
                  <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                  Guardando...
                </>
              ) : (
                <>
                  <CheckCircle size={16} /> Confirmar y Marcar como Pagado
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
