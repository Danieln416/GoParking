import React, { useEffect, useState, useMemo } from 'react';
import {
  IdCard,
  Car,
  Bike,
  CheckCircle,
  Clock,
  AlertCircle,
  QrCode,
  Printer,
  Maximize2,
  Minimize2,
  ShieldCheck,
  Copy,
  Check,
  Calendar,
  MapPin,
  RotateCw,
  BadgeCheck,
  Upload
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { apiGetPuestosUsuario, apiGetRecibos } from '../../api.js';
import { getUserBillingInfo, formatDateLabel } from '../../utils/periodo.js';
import { Link } from 'react-router-dom';

export default function CarnetID() {
  const { user } = useAuth();
  const [puestos, setPuestos] = useState([]);
  const [recibos, setRecibos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [fullscreenMode, setFullscreenMode] = useState(false);
  const [zoomQr, setZoomQr] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (!user?.id) return;
      setLoading(true);
      try {
        const [pRes, rRes] = await Promise.all([
          apiGetPuestosUsuario(user.id),
          apiGetRecibos(user.id)
        ]);

        if (pRes.success) setPuestos(pRes.data || []);
        if (rRes.success) setRecibos(rRes.data || []);
      } catch (err) {
        console.error('Error cargando datos del carnet:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [user?.id]);

  const billingInfo = useMemo(() => {
    return getUserBillingInfo(user?.fecha_inicio, new Date(), recibos);
  }, [user?.fecha_inicio, recibos]);

  // Formato de código único de carnet
  const memberCode = useMemo(() => {
    const rawNum = String(user?.cedula || user?.id || '').replace(/\D/g, '');
    const suffix = rawNum.length >= 4 ? rawNum.slice(-5) : '01984';
    return `GP-${suffix}`;
  }, [user?.cedula, user?.id]);

  // Texto codificado en el código QR para validación rápida en garita
  const qrDataText = useMemo(() => {
    const placas = [user?.placa_carro, user?.placa_moto, user?.placa].filter(Boolean).join(' / ');
    const puestosTexto = puestos.length > 0 ? puestos.map(p => `#${p.numero}`).join(', ') : 'Pendiente';
    return `GOPARKING | ID: ${memberCode} | USUARIO: ${user?.nombre || ''} | CC: ${user?.cedula || 'N/A'} | PLACA: ${placas || 'N/A'} | PUESTO: ${puestosTexto} | ESTADO: ${billingInfo.status === 'al_dia' ? 'AL DIA' : 'PENDIENTE'}`;
  }, [user, memberCode, puestos, billingInfo]);

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&margin=8&data=${encodeURIComponent(qrDataText)}`;

  function handleCopyId() {
    navigator.clipboard.writeText(memberCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handlePrint() {
    window.print();
  }

  const initial = user?.nombre?.charAt(0)?.toUpperCase() || 'U';

  const isAlDia = billingInfo.status === 'al_dia';
  const isEnRevision = billingInfo.status === 'en_revision';
  const isVencido = billingInfo.status === 'vencido';

  return (
    <div className={`page-enter ${fullscreenMode ? 'fullscreen-carnet-view' : ''}`}>
      {/* Estilos para impresión y pantalla completa */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .carnet-print-area, .carnet-print-area * {
            visibility: visible;
          }
          .carnet-print-area {
            position: absolute;
            left: 50%;
            top: 20px;
            transform: translateX(-50%);
            width: 100% !important;
            max-width: 480px !important;
            box-shadow: none !important;
            border: 2px solid #000 !important;
            page-break-inside: avoid;
          }
          .no-print {
            display: none !important;
          }
        }
        .fullscreen-carnet-view {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: #060d19;
          z-index: 99999;
          overflow-y: auto;
          padding: 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }
      `}</style>

      {/* Header (oculto en pantalla completa e impresión) */}
      {!fullscreenMode && (
        <div className="page-header no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1>Credencial / Carnet Digital</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
              Identificación oficial que certifica tu pertenencia y autorización de parqueo en GoParking.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setFullscreenMode(true)}
              title="Abrir en pantalla completa para mostrar rápidamente en portería"
            >
              <Maximize2 size={15} /> Modo Pantalla Completa
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={handlePrint}
              title="Imprimir carnet o guardar en PDF"
            >
              <Printer size={15} /> Imprimir / Guardar
            </button>
          </div>
        </div>
      )}

      {/* Barra de control para salir del modo pantalla completa */}
      {fullscreenMode && (
        <div className="no-print" style={{ width: '100%', maxWidth: 480, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ color: '#fff', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
            <ShieldCheck size={16} color="var(--accent-green)" /> Modo Presentación Garita
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setFullscreenMode(false)}
            style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.2)' }}
          >
            <Minimize2 size={14} /> Salir
          </button>
        </div>
      )}

      <div className="page-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* CARNET DIGITAL OFICIAL */}
        <div
          className="carnet-print-area"
          style={{
            width: '100%',
            maxWidth: 480,
            background: 'linear-gradient(145deg, #0d1b2a 0%, #0a111e 60%, #051410 100%)',
            borderRadius: 20,
            border: '2px solid rgba(22, 199, 83, 0.45)',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6), 0 0 30px rgba(22, 199, 83, 0.15)',
            overflow: 'hidden',
            position: 'relative'
          }}
        >
          {/* Marca de agua decorativa de fondo */}
          <div
            style={{
              position: 'absolute',
              right: -30,
              bottom: -30,
              opacity: 0.04,
              pointerEvents: 'none',
              transform: 'rotate(-15deg)'
            }}
          >
            <Car size={320} color="#fff" />
          </div>

          {/* Encabezado del Carnet */}
          <div
            style={{
              padding: '18px 22px 14px',
              background: 'linear-gradient(90deg, rgba(22, 199, 83, 0.22) 0%, rgba(14, 165, 233, 0.1) 100%)',
              borderBottom: '1px solid rgba(22, 199, 83, 0.25)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, #16c753 0%, #0f8a37 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(22, 199, 83, 0.35)'
                }}
              >
                <Car size={22} color="#fff" />
              </div>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 900, margin: 0, letterSpacing: 0.5, color: '#fff', textTransform: 'uppercase' }}>
                  GoParking
                </h2>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-green)', letterSpacing: 1.2, textTransform: 'uppercase' }}>
                  Credencial Oficial de Usuario
                </span>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 10,
                  fontWeight: 800,
                  padding: '3px 8px',
                  borderRadius: 12,
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: 'rgba(255, 255, 255, 0.85)',
                  border: '1px solid rgba(255, 255, 255, 0.15)'
                }}
              >
                <BadgeCheck size={12} color="var(--accent-green)" /> AUTORIZADO
              </span>
            </div>
          </div>

          {/* Cuerpo del Carnet */}
          <div style={{ padding: '20px 22px' }}>
            {/* Fila principal: Avatar + Datos personales + ID de Membresía */}
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 18 }}>
              {/* Avatar con foto o inicial */}
              <div
                style={{
                  width: 68,
                  height: 68,
                  borderRadius: 18,
                  background: 'linear-gradient(135deg, #16c753 0%, #064e3b 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 28,
                  fontWeight: 900,
                  color: '#fff',
                  border: '2px solid rgba(255, 255, 255, 0.3)',
                  boxShadow: '0 6px 16px rgba(0,0,0,0.4)',
                  flexShrink: 0
                }}
              >
                {initial}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>
                  Titular de la Membresía
                </span>
                <h3 style={{ fontSize: 17, fontWeight: 800, margin: '2px 0 3px 0', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user?.nombre || 'Usuario Registrado'}
                </h3>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', margin: 0 }}>
                  CC: <strong>{user?.cedula || 'En verificación'}</strong>
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 800, color: 'var(--accent-cyan)' }}>
                    ID: {memberCode}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyId}
                    className="no-print"
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      color: copied ? 'var(--accent-green)' : 'var(--text-muted)',
                      display: 'inline-flex',
                      alignItems: 'center'
                    }}
                    title="Copiar ID de usuario"
                  >
                    {copied ? <Check size={12} /> : <Copy size={12} />}
                  </button>
                </div>
              </div>
            </div>

            {/* SECCIÓN PUESTO Y VEHÍCULO (Visualización destacada) */}
            <div
              style={{
                background: 'rgba(0, 0, 0, 0.35)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 12,
                padding: '12px 14px',
                marginBottom: 16,
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 12
              }}
            >
              {/* Puesto Asignado */}
              <div>
                <span style={{ fontSize: 10, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <MapPin size={11} color="var(--accent-cyan)" /> Puesto / Bahía
                </span>
                <div style={{ marginTop: 4 }}>
                  {puestos.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {puestos.map(p => (
                        <span
                          key={p.id || p.numero}
                          style={{
                            fontSize: 16,
                            fontWeight: 900,
                            color: '#fff',
                            background: 'rgba(56, 189, 248, 0.18)',
                            border: '1px solid rgba(56, 189, 248, 0.4)',
                            padding: '2px 8px',
                            borderRadius: 6
                          }}
                        >
                          #{p.numero} <small style={{ fontSize: 10, fontWeight: 600, opacity: 0.8 }}>({p.tipo})</small>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span style={{ fontSize: 13, color: 'var(--accent-yellow)', fontWeight: 700 }}>
                      Asignación general
                    </span>
                  )}
                </div>
              </div>

              {/* Placas y Vehículo */}
              <div>
                <span style={{ fontSize: 10, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Car size={11} color="var(--accent-green)" /> Matrícula / Placa
                </span>
                <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {user?.placa_carro && (
                    <div
                      style={{
                        background: '#FDD835',
                        color: '#000',
                        fontWeight: 900,
                        fontSize: 12,
                        padding: '2px 7px',
                        borderRadius: 4,
                        fontFamily: 'monospace',
                        border: '1px solid #C0CA33',
                        letterSpacing: 1
                      }}
                    >
                      {user.placa_carro}
                    </div>
                  )}
                  {user?.placa_moto && (
                    <div
                      style={{
                        background: '#FDD835',
                        color: '#000',
                        fontWeight: 900,
                        fontSize: 12,
                        padding: '2px 7px',
                        borderRadius: 4,
                        fontFamily: 'monospace',
                        border: '1px solid #C0CA33',
                        letterSpacing: 1
                      }}
                    >
                      {user.placa_moto}
                    </div>
                  )}
                  {!user?.placa_carro && !user?.placa_moto && user?.placa && (
                    <div
                      style={{
                        background: '#FDD835',
                        color: '#000',
                        fontWeight: 900,
                        fontSize: 12,
                        padding: '2px 7px',
                        borderRadius: 4,
                        fontFamily: 'monospace',
                        border: '1px solid #C0CA33',
                        letterSpacing: 1
                      }}
                    >
                      {user.placa}
                    </div>
                  )}
                  {!user?.placa_carro && !user?.placa_moto && !user?.placa && (
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Sin placa registrada</span>
                  )}
                </div>
              </div>
            </div>

            {/* SECCIÓN ESTADO Y QR DE CONTROL */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 14,
                padding: '12px 14px',
                borderRadius: 12,
                background: isAlDia
                  ? 'linear-gradient(135deg, rgba(22, 199, 83, 0.12) 0%, rgba(0, 0, 0, 0.3) 100%)'
                  : 'linear-gradient(135deg, rgba(239, 68, 68, 0.12) 0%, rgba(0, 0, 0, 0.3) 100%)',
                border: isAlDia ? '1px solid rgba(22, 199, 83, 0.35)' : '1px solid rgba(239, 68, 68, 0.35)'
              }}
            >
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 10, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700 }}>
                  Estado de Membresía
                </span>

                <div style={{ marginTop: 3 }}>
                  {isAlDia && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        color: 'var(--accent-green)',
                        fontWeight: 900,
                        fontSize: 14
                      }}
                    >
                      <CheckCircle size={16} /> ACTIVO Y AL DÍA
                    </span>
                  )}
                  {isEnRevision && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        color: 'var(--accent-cyan)',
                        fontWeight: 900,
                        fontSize: 14
                      }}
                    >
                      <Clock size={16} /> EN REVISIÓN
                    </span>
                  )}
                  {(isVencido || billingInfo.status === 'pendiente') && !isAlDia && !isEnRevision && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        color: isVencido ? 'var(--accent-red)' : 'var(--accent-yellow)',
                        fontWeight: 900,
                        fontSize: 14
                      }}
                    >
                      <AlertCircle size={16} /> {isVencido ? 'PAGO PENDIENTE' : 'CORTE PRÓXIMO'}
                    </span>
                  )}
                </div>

                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', margin: '4px 0 0 0' }}>
                  {isAlDia
                    ? `Próximo corte: ${formatDateLabel(billingInfo.cutoffDate)}`
                    : `Corte mensual: Día ${billingInfo.billingDay} de cada mes`}
                </p>
                <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                  Tarifa: {user?.tipo_tarifa || 'Mensualidad'}
                </p>
              </div>

              {/* QR interactivo */}
              <div
                style={{
                  textAlign: 'center',
                  background: '#fff',
                  padding: 6,
                  borderRadius: 10,
                  boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
                  cursor: 'pointer',
                  flexShrink: 0
                }}
                onClick={() => setZoomQr(true)}
                title="Toca para ampliar código QR"
              >
                <img
                  src={qrImageUrl}
                  alt="QR Identificador"
                  style={{ width: 72, height: 72, display: 'block', borderRadius: 4 }}
                />
                <span style={{ fontSize: 8, color: '#333', fontWeight: 800, display: 'block', marginTop: 2 }}>
                  GARITA ID
                </span>
              </div>
            </div>
          </div>

          {/* Pie del Carnet */}
          <div
            style={{
              padding: '10px 22px',
              background: 'rgba(0, 0, 0, 0.4)',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              Parqueadero GoParking · Control de Acceso
            </span>
            <span style={{ fontSize: 10, color: 'var(--accent-green)', fontWeight: 700 }}>
              VERIFICACIÓN DIGITAL
            </span>
          </div>
        </div>

        {/* TARJETAS INFORMATIVAS COMPLEMENTARIAS (no se imprimen) */}
        {!fullscreenMode && (
          <div className="no-print" style={{ width: '100%', maxWidth: 480, marginTop: 20 }}>
            {/* Si está vencido o pendiente, botón para subir recibo */}
            {!isAlDia && (
              <div
                className="card"
                style={{
                  marginBottom: 16,
                  borderColor: 'rgba(239, 68, 68, 0.35)',
                  background: 'rgba(239, 68, 68, 0.08)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 12
                }}
              >
                <div>
                  <h4 style={{ margin: 0, fontSize: 14, color: 'var(--accent-red)' }}>
                    Membresía con cobro pendiente
                  </h4>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                    Sube tu comprobante de pago para mantener tu carnet al día.
                  </p>
                </div>
                <Link to="/usuario/subir-recibo" className="btn btn-primary btn-sm">
                  <Upload size={14} /> Subir Pago
                </Link>
              </div>
            )}

            {/* Ficha explicativa de uso de la credencial */}
            <div className="card" style={{ padding: 16, background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <ShieldCheck size={18} color="var(--accent-green)" />
                <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                  ¿Para qué sirve tu Credencial Digital?
                </h4>
              </div>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                <li>Identifica tu vehículo y puesto autorizado al ingresar o salir.</li>
                <li>Presenta el código QR o el carnet en garita/portería ante cualquier verificación.</li>
                <li>Demuestra que tu mensualidad se encuentra al día y activa.</li>
                <li>Es personal e intransferible para los vehículos registrados.</li>
              </ul>
            </div>
          </div>
        )}

        {/* Modal para ampliar el QR */}
        {zoomQr && (
          <div className="modal-overlay no-print" onClick={() => setZoomQr(false)}>
            <div className="modal-box" style={{ maxWidth: 340, textAlign: 'center', padding: 24 }} onClick={e => e.stopPropagation()}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: 16, color: 'var(--text-primary)' }}>
                Código QR de Validación
              </h3>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 16px 0' }}>
                Presenta este código al personal de garita o administración para escanear y validar tu membresía.
              </p>
              <div style={{ background: '#fff', padding: 16, borderRadius: 12, display: 'inline-block', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
                <img
                  src={qrImageUrl}
                  alt="QR Ampliado"
                  style={{ width: 220, height: 220, display: 'block' }}
                />
              </div>
              <p style={{ fontSize: 12, color: 'var(--accent-green)', fontWeight: 700, marginTop: 14 }}>
                {memberCode} · {user?.nombre}
              </p>
              <button
                type="button"
                className="btn btn-ghost btn-full btn-sm"
                style={{ marginTop: 14 }}
                onClick={() => setZoomQr(false)}
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
