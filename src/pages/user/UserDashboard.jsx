import React, { useEffect, useState } from 'react';
import {
  Receipt,
  Clock,
  CheckCircle,
  Upload,
  MessageSquare,
  Car,
  Bike,
  MapPin,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  apiGetRecibos,
  apiGetSolicitudes,
  apiGetPuestosUsuario,
  apiGetPuestos
} from '../../api.js';
import { Link } from 'react-router-dom';
import { formatPeriodoLabel, formatDateLabel, getUserBillingInfo } from '../../utils/periodo.js';
import { getReceiptMediaUrl, getReceiptViewerUrl } from '../../utils/media.js';

const LOCAL_PARKING_MAP_URL = '/parqueadero.png';

function vehicleIcon(tipo) {
  const tipoNormalizado = String(tipo || '').toLowerCase();

  if (tipoNormalizado.includes('moto')) {
    return <Bike size={20} />;
  }

  return <Car size={20} />;
}

function normalizePuestoTipo(tipo) {
  return String(tipo || '').toLowerCase().trim();
}

function getVecinosPuesto(miPuesto, puestos) {
  if (!miPuesto || !puestos?.length) return null;
  const tipoTarget = normalizePuestoTipo(miPuesto.tipo);
  const spotsSameType = puestos
    .filter(p => normalizePuestoTipo(p.tipo) === tipoTarget)
    .sort((a, b) => Number(a.numero) - Number(b.numero));

  const myIndex = spotsSameType.findIndex(
    p => String(p.id) === String(miPuesto.id) || Number(p.numero) === Number(miPuesto.numero)
  );

  if (myIndex === -1) return null;

  const izquierdo = myIndex > 0
    ? spotsSameType[myIndex - 1]
    : { isLimit: true, label: 'Límite de fila / Pared' };

  const derecho = myIndex < spotsSameType.length - 1
    ? spotsSameType[myIndex + 1]
    : { isLimit: true, label: 'Límite de fila / Pared' };

  return { izquierdo, derecho };
}

function VecinosBahia({ miPuesto, vecinos, tipoLabel, user, accentColor, icon }) {
  if (!miPuesto || !vecinos) return null;

  return (
    <div
      style={{
        marginTop: 16,
        padding: 16,
        background: 'var(--bg-secondary)',
        borderRadius: 12,
        border: '1px solid var(--border)'
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8,
          marginBottom: 14
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {icon}
          <strong style={{ fontSize: 14, color: 'var(--text-primary)' }}>
            Vecinos de tu {tipoLabel} (Puesto #{miPuesto.numero})
          </strong>
        </div>

        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          Distribución de puestos contiguos
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 12,
          alignItems: 'stretch'
        }}
      >
        {/* Lado Izquierdo */}
        <div
          style={{
            padding: 14,
            borderRadius: 10,
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <span
              style={{
                fontSize: 11,
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                fontWeight: 700,
                display: 'block',
                marginBottom: 6
              }}
            >
              ⬅️ Lado Izquierdo
            </span>

            {vecinos.izquierdo?.isLimit ? (
              <div style={{ padding: '8px 0' }}>
                <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-muted)' }}>
                  🧱 Límite / Pared
                </p>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  Inicio de fila (sin puesto al lado)
                </p>
              </div>
            ) : vecinos.izquierdo ? (
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 6
                  }}
                >
                  <strong style={{ fontSize: 16 }}>
                    Puesto #{vecinos.izquierdo.numero}
                  </strong>

                  <span
                    className={`badge ${
                      vecinos.izquierdo.estado === 'ocupado'
                        ? 'badge-review'
                        : 'badge-approved'
                    }`}
                    style={{ fontSize: 10 }}
                  >
                    {vecinos.izquierdo.estado === 'ocupado' ? 'Ocupado' : 'Libre'}
                  </span>
                </div>

                {vecinos.izquierdo.estado === 'ocupado' ? (
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                      👤 {vecinos.izquierdo.usuario_nombre || 'Usuario asignado'}
                    </p>

                    {vecinos.izquierdo.usuario_placa ? (
                      <p
                        style={{
                          fontSize: 12,
                          color: accentColor,
                          fontWeight: 700,
                          marginTop: 4,
                          fontFamily: 'monospace'
                        }}
                      >
                        Placa: {vecinos.izquierdo.usuario_placa}
                      </p>
                    ) : (
                      <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                        Vehículo ocupando espacio
                      </p>
                    )}
                  </div>
                ) : (
                  <p style={{ fontSize: 12, color: 'var(--accent-green)', fontWeight: 600 }}>
                    🟢 Espacio disponible
                  </p>
                )}
              </div>
            ) : null}
          </div>
        </div>

        {/* Tu Puesto (Centro) */}
        <div
          style={{
            padding: 14,
            borderRadius: 10,
            background:
              tipoLabel === 'carro'
                ? 'rgba(22, 199, 83, 0.1)'
                : 'rgba(168, 85, 247, 0.1)',
            border: `2px solid ${accentColor}`,
            boxShadow: `0 0 16px ${
              tipoLabel === 'carro'
                ? 'rgba(22, 199, 83, 0.18)'
                : 'rgba(168, 85, 247, 0.18)'
            }`,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <span
              style={{
                fontSize: 11,
                color: accentColor,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                fontWeight: 800,
                display: 'block',
                marginBottom: 6
              }}
            >
              ⭐ Tu Puesto (Centro)
            </span>

            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 6
                }}
              >
                <strong style={{ fontSize: 17, color: accentColor }}>
                  Puesto #{miPuesto.numero}
                </strong>

                <span className="badge badge-approved" style={{ fontSize: 10 }}>
                  Asignado a ti
                </span>
              </div>

              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                {user?.nombre}
              </p>

              <p
                style={{
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  marginTop: 4,
                  fontFamily: 'monospace',
                  fontWeight: 600
                }}
              >
                Placa:{' '}
                {tipoLabel === 'carro'
                  ? user?.placa_carro || user?.placa || '—'
                  : user?.placa_moto || '—'}
              </p>
            </div>
          </div>
        </div>

        {/* Lado Derecho */}
        <div
          style={{
            padding: 14,
            borderRadius: 10,
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <span
              style={{
                fontSize: 11,
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                fontWeight: 700,
                display: 'block',
                marginBottom: 6
              }}
            >
              ➡️ Lado Derecho
            </span>

            {vecinos.derecho?.isLimit ? (
              <div style={{ padding: '8px 0' }}>
                <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-muted)' }}>
                  🧱 Límite / Pared
                </p>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  Fin de fila (sin puesto al lado)
                </p>
              </div>
            ) : vecinos.derecho ? (
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 6
                  }}
                >
                  <strong style={{ fontSize: 16 }}>
                    Puesto #{vecinos.derecho.numero}
                  </strong>

                  <span
                    className={`badge ${
                      vecinos.derecho.estado === 'ocupado'
                        ? 'badge-review'
                        : 'badge-approved'
                    }`}
                    style={{ fontSize: 10 }}
                  >
                    {vecinos.derecho.estado === 'ocupado' ? 'Ocupado' : 'Libre'}
                  </span>
                </div>

                {vecinos.derecho.estado === 'ocupado' ? (
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                      👤 {vecinos.derecho.usuario_nombre || 'Usuario asignado'}
                    </p>

                    {vecinos.derecho.usuario_placa ? (
                      <p
                        style={{
                          fontSize: 12,
                          color: accentColor,
                          fontWeight: 700,
                          marginTop: 4,
                          fontFamily: 'monospace'
                        }}
                      >
                        Placa: {vecinos.derecho.usuario_placa}
                      </p>
                    ) : (
                      <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                        Vehículo ocupando espacio
                      </p>
                    )}
                  </div>
                ) : (
                  <p style={{ fontSize: 12, color: 'var(--accent-green)', fontWeight: 600 }}>
                    🟢 Espacio disponible
                  </p>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function UserDashboard() {
  const { user } = useAuth();

  const [recibos, setRecibos] = useState([]);
  const [solicitudes, setSolicitudes] = useState([]);
  const [puestosAsignados, setPuestosAsignados] = useState([]);
  const [todosLosPuestos, setTodosLosPuestos] = useState([]);
  const [mapUrl, setMapUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMapa, setLoadingMapa] = useState(true);
  const [mapError, setMapError] = useState(false);
  const [receiptImageError, setReceiptImageError] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setLoadingMapa(true);

      try {
        setMapUrl(LOCAL_PARKING_MAP_URL);
        setMapError(false);
        setLoadingMapa(false);

        const [r, s, p, allP] = await Promise.all([
          apiGetRecibos(user.id),
          apiGetSolicitudes(user.id),
          apiGetPuestosUsuario(user.id),
          apiGetPuestos()
        ]);

        if (r.success) {
          setRecibos(r.data || []);
        }

        if (s.success) {
          setSolicitudes(s.data || []);
        }

        if (p.success) {
          setPuestosAsignados(p.data || []);
        }

        if (allP && allP.success) {
          setTodosLosPuestos(allP.data || []);
        }

      } catch (error) {
        console.error('Error al cargar el panel del usuario:', error);
        setMapUrl(LOCAL_PARKING_MAP_URL);
        setMapError(false);
      } finally {
        setLoading(false);
        setLoadingMapa(false);
      }
    }

    if (user?.id) {
      load();
    }
  }, [user?.id]);

  const aprobados = recibos.filter(
    recibo => recibo.estado === 'aprobado'
  ).length;

  const enRevision = recibos.filter(
    recibo => recibo.estado === 'en_revision'
  ).length;

  const pendientesSol = solicitudes.filter(
    solicitud => solicitud.estado === 'pendiente'
  ).length;

  const ultimoRecibo = [...recibos].sort(
    (a, b) =>
      new Date(b.fecha_subida) - new Date(a.fecha_subida)
  )[0];

  const billingInfo = getUserBillingInfo(user?.fecha_inicio, new Date(), recibos);

  const puestoCarro = puestosAsignados.find(
    puesto => normalizePuestoTipo(puesto.tipo) === 'carro'
  );

  const puestoMoto = puestosAsignados.find(
    puesto => normalizePuestoTipo(puesto.tipo) === 'moto'
  );

  const tienePuesto = Boolean(puestoCarro || puestoMoto);
  const vecinosCarro = puestoCarro ? getVecinosPuesto(puestoCarro, todosLosPuestos) : null;
  const vecinosMoto = puestoMoto ? getVecinosPuesto(puestoMoto, todosLosPuestos) : null;

  const placas = [
    user?.placa_carro
      ? `Carro: ${user.placa_carro}`
      : null,
    user?.placa_moto
      ? `Moto: ${user.placa_moto}`
      : null
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="page-enter">
      <div className="page-header">
        <div>
          <h1>Bienvenido, {user?.nombre?.split(' ')[0]} 👋</h1>
        </div>

        <Link to="/usuario/subir-recibo" className="btn btn-primary">
          <Upload size={16} />
          Subir Recibo
        </Link>
      </div>

      <div className="page-body">
        {!loading && (
          <div
            className="card"
            style={{
              marginBottom: 24,
              borderColor:
                billingInfo.status === 'vencido'
                  ? 'rgba(239,68,68,0.5)'
                  : billingInfo.status === 'pendiente'
                  ? 'rgba(245,158,11,0.45)'
                  : billingInfo.status === 'en_revision'
                  ? 'rgba(59,130,246,0.45)'
                  : 'rgba(22,199,83,0.35)',
              background:
                billingInfo.status === 'vencido'
                  ? 'rgba(239,68,68,0.08)'
                  : billingInfo.status === 'pendiente'
                  ? 'rgba(245,158,11,0.08)'
                  : billingInfo.status === 'en_revision'
                  ? 'rgba(59,130,246,0.08)'
                  : 'rgba(22,199,83,0.06)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              {billingInfo.status === 'vencido' && <AlertCircle size={26} color="var(--accent-red)" style={{ flexShrink: 0, marginTop: 2 }} />}
              {billingInfo.status === 'pendiente' && <Clock size={26} color="var(--accent-yellow)" style={{ flexShrink: 0, marginTop: 2 }} />}
              {billingInfo.status === 'en_revision' && <Clock size={26} color="var(--accent-blue)" style={{ flexShrink: 0, marginTop: 2 }} />}
              {billingInfo.status === 'al_dia' && <CheckCircle size={26} color="var(--accent-green)" style={{ flexShrink: 0, marginTop: 2 }} />}

              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
                    {billingInfo.status === 'vencido' && 'Pago de Mensualidad Vencido'}
                    {billingInfo.status === 'pendiente' && 'Próxima Fecha de Corte'}
                    {billingInfo.status === 'en_revision' && 'Comprobante en Revisión'}
                    {billingInfo.status === 'al_dia' && 'Mensualidad al Día'}
                  </h3>
                  <span
                    className="badge"
                    style={{
                      background:
                        billingInfo.status === 'vencido'
                          ? 'rgba(239,68,68,0.2)'
                          : billingInfo.status === 'pendiente'
                          ? 'rgba(245,158,11,0.2)'
                          : billingInfo.status === 'en_revision'
                          ? 'rgba(59,130,246,0.2)'
                          : 'rgba(22,199,83,0.2)',
                      color:
                        billingInfo.status === 'vencido'
                          ? 'var(--accent-red)'
                          : billingInfo.status === 'pendiente'
                          ? 'var(--accent-yellow)'
                          : billingInfo.status === 'en_revision'
                          ? 'var(--accent-blue)'
                          : 'var(--accent-green)',
                      fontWeight: 700
                    }}
                  >
                    {billingInfo.badge}
                  </span>
                </div>

                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
                  {billingInfo.message}
                </p>

                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-muted)', marginBottom: (billingInfo.status === 'vencido' || billingInfo.status === 'pendiente') ? 12 : 0 }}>
                  <span>📅 Período: <strong>{formatDateLabel(billingInfo.periodStart)}</strong> al <strong>{formatDateLabel(billingInfo.periodEnd)}</strong></span>
                  <span>⏰ Día de corte: <strong>Día {billingInfo.billingDay} de cada mes</strong></span>
                  <span>🗓️ Próximo vencimiento: <strong>{formatDateLabel(billingInfo.cutoffDate)}</strong></span>
                </div>

                {(billingInfo.status === 'vencido' || billingInfo.status === 'pendiente') && (
                  <Link to="/usuario/subir-recibo" className="btn btn-primary btn-sm">
                    <Upload size={14} /> Subir comprobante de pago
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
        <div
          className="card"
          style={{
            marginBottom: 24,
            background:
              'linear-gradient(135deg,rgba(22,199,83,0.08),rgba(14,165,233,0.05))',
            borderColor: 'rgba(22,199,83,0.25)'
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              flexWrap: 'wrap'
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                background: 'rgba(22,199,83,0.15)',
                borderRadius: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-green)'
              }}
            >
              {vehicleIcon(user?.tipo_vehiculo)}
            </div>

            <div style={{ flex: 1, minWidth: 200 }}>
              <p
                style={{
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  marginBottom: 2
                }}
              >
                Mis vehículos
              </p>

              <h3
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  letterSpacing: 0.5
                }}
              >
                {placas || user?.placa || 'Sin vehículo registrado'}
              </h3>

              <p
                style={{
                  fontSize: 12,
                  color: 'var(--text-secondary)'
                }}
              >
                {user?.tipo_vehiculo || 'Sin vehículo'} ·{' '}
                {user?.tipo_tarifa || 'Sin tarifa'} · ⏰ Corte: Día {billingInfo.billingDay} de cada mes
              </p>
            </div>

            <div style={{ textAlign: 'right' }}>
              <p
                style={{
                  fontSize: 11,
                  color: 'var(--text-secondary)'
                }}
              >
                Valor de tarifa
              </p>

              <p
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  color: 'var(--accent-cyan)'
                }}
              >
                ${Number(user?.valor_tarifa || 0).toLocaleString('es-CO')}
              </p>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 24 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 12,
              marginBottom: 16,
              flexWrap: 'wrap'
            }}
          >
            <div>
              <h3 className="card-title">
                <MapPin
                  size={18}
                  style={{
                    verticalAlign: 'middle',
                    marginRight: 7,
                    color: 'var(--accent-cyan)'
                  }}
                />
                Mi puesto en el parqueadero
              </h3>

              <p className="card-subtitle">
                Consulta el mapa general y tus puestos asignados.
              </p>
            </div>

            {tienePuesto ? (
              <span className="badge badge-approved">
                ✓ Puesto asignado
              </span>
            ) : (
              <span className="badge badge-review">
                Sin puesto asignado
              </span>
            )}
          </div>

          {tienePuesto ? (
            <>
              <div
                style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(auto-fit, minmax(190px, 1fr))',
                gap: 12,
                marginBottom: 18
              }}
            >
              {puestoCarro && (
                <div
                  style={{
                    border: '1px solid rgba(22,199,83,0.35)',
                    background: 'rgba(22,199,83,0.08)',
                    borderRadius: 10,
                    padding: 14
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      color: 'var(--accent-green)',
                      marginBottom: 6
                    }}
                  >
                    <Car size={19} />
                    <strong>Puesto de carro</strong>
                  </div>

                  <p
                    style={{
                      fontSize: 24,
                      fontWeight: 800,
                      color: 'var(--text-primary)'
                    }}
                  >
                    Puesto {puestoCarro.numero}
                  </p>

                  <p
                    style={{
                      fontSize: 12,
                      color: 'var(--text-secondary)'
                    }}
                  >
                    Placa: {user?.placa_carro || user?.placa || '—'}
                  </p>
                </div>
              )}

              {puestoMoto && (
                <div
                  style={{
                    border: '1px solid rgba(168,85,247,0.35)',
                    background: 'rgba(168,85,247,0.08)',
                    borderRadius: 10,
                    padding: 14
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      color: 'var(--accent-purple)',
                      marginBottom: 6
                    }}
                  >
                    <Bike size={19} />
                    <strong>Puesto de moto</strong>
                  </div>

                  <p
                    style={{
                      fontSize: 24,
                      fontWeight: 800,
                      color: 'var(--text-primary)'
                    }}
                  >
                    Puesto {puestoMoto.numero}
                  </p>

                  <p
                    style={{
                      fontSize: 12,
                      color: 'var(--text-secondary)'
                    }}
                  >
                    Placa: {user?.placa_moto || '—'}
                  </p>
                </div>
              )}
            </div>

            {puestoCarro && vecinosCarro && (
              <VecinosBahia
                miPuesto={puestoCarro}
                vecinos={vecinosCarro}
                tipoLabel="carro"
                user={user}
                accentColor="var(--accent-green)"
                icon={<Car size={18} color="var(--accent-green)" />}
              />
            )}

            {puestoMoto && vecinosMoto && (
              <VecinosBahia
                miPuesto={puestoMoto}
                vecinos={vecinosMoto}
                tipoLabel="moto"
                user={user}
                accentColor="var(--accent-purple)"
                icon={<Bike size={18} color="var(--accent-purple)" />}
              />
            )}
          </>
          ) : (
            <div
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
                padding: 14,
                borderRadius: 8,
                background: 'rgba(245,158,11,0.08)',
                border: '1px solid rgba(245,158,11,0.25)',
                color: 'var(--text-secondary)',
                marginBottom: 18,
                fontSize: 13
              }}
            >
              <AlertCircle
                size={18}
                style={{
                  color: 'var(--accent-yellow)',
                  flexShrink: 0
                }}
              />
              <span>
                Actualmente no tienes un puesto asignado. Aun así puedes
                consultar la distribución general del parqueadero.
              </span>
            </div>
          )}

          {loadingMapa ? (
            <div
              style={{
                height: 240,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
              }}
            >
              <div className="spinner" />
            </div>
          ) : mapUrl && !mapError ? (
            <a
              href={mapUrl}
              target="_blank"
              rel="noreferrer"
              title="Abrir mapa en una nueva pestaña"
              style={{ display: 'block' }}
            >
              <img
                src={mapUrl}
                alt="Mapa del parqueadero"
                onError={() => setMapError(true)}
                style={{
                  width: '100%',
                  maxHeight: 520,
                  objectFit: 'contain',
                  display: 'block',
                  background: 'var(--bg-secondary)',
                  borderRadius: 10,
                  border: '1px solid var(--border-color)',
                  cursor: 'zoom-in'
                }}
              />
            </a>
          ) : (
            <div
              style={{
                minHeight: 150,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-secondary)',
                background: 'var(--bg-secondary)',
                borderRadius: 10,
                border: '1px dashed var(--border-color)',
                padding: 20,
                textAlign: 'center',
                fontSize: 13
              }}
            >
              El mapa del parqueadero no está disponible por ahora.
            </div>
          )}
        </div>

        <div className="stats-grid">
          <div className="stat-card cyan">
            <div className="stat-icon cyan">
              <Receipt size={22} />
            </div>

            <div className="stat-info">
              <h3>{recibos.length}</h3>
              <p>Total de recibos</p>
            </div>
          </div>

          <div className="stat-card green">
            <div className="stat-icon green">
              <CheckCircle size={22} />
            </div>

            <div className="stat-info">
              <h3>{aprobados}</h3>
              <p>Pagos aprobados</p>
            </div>
          </div>

          <div className="stat-card yellow">
            <div className="stat-icon yellow">
              <Clock size={22} />
            </div>

            <div className="stat-info">
              <h3>{enRevision}</h3>
              <p>En revisión</p>
            </div>
          </div>

          <div className="stat-card purple">
            <div className="stat-icon purple">
              <MessageSquare size={22} />
            </div>

            <div className="stat-info">
              <h3>{pendientesSol}</h3>
              <p>Solicitudes pendientes</p>
            </div>
          </div>
        </div>

        {ultimoRecibo && (
          <div className="card" style={{ marginBottom: 24 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: 16
              }}
            >
              <div>
                <h3 className="card-title">Último Recibo</h3>
                <p className="card-subtitle">
                  {formatPeriodoLabel(ultimoRecibo)} · Subido el{' '}
                  {new Date(
                    ultimoRecibo.fecha_subida
                  ).toLocaleDateString('es-CO')}
                </p>
              </div>

              <StatusBadge estado={ultimoRecibo.estado} />
            </div>

            {getReceiptMediaUrl(ultimoRecibo) && !receiptImageError && (
              <a
                href={getReceiptViewerUrl(ultimoRecibo)}
                target="_blank"
                rel="noreferrer"
              >
                <img
                  src={getReceiptMediaUrl(ultimoRecibo)}
                  alt="Recibo"
                  loading="lazy"
                  onError={() => setReceiptImageError(true)}
                  style={{
                    width: '100%',
                    maxHeight: 200,
                    objectFit: 'cover',
                    borderRadius: 8,
                    border: '1px solid var(--border)'
                  }}
                />
              </a>
            )}

            {getReceiptViewerUrl(ultimoRecibo) && (
              <a href={getReceiptViewerUrl(ultimoRecibo)} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" style={{ marginTop: 10 }}>
                <Receipt size={14} /> Ver recibo original
              </a>
            )}

            {ultimoRecibo.admin_nota && (
              <p
                style={{
                  marginTop: 12,
                  fontSize: 13,
                  color: 'var(--text-secondary)',
                  background: 'var(--bg-secondary)',
                  padding: '10px 14px',
                  borderRadius: 8
                }}
              >
                💬 <strong>Nota del administrador:</strong>{' '}
                {ultimoRecibo.admin_nota}
              </p>
            )}
          </div>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 12
          }}
        >
          <Link
            to="/usuario/subir-recibo"
            style={{ textDecoration: 'none' }}
          >
            <div
              className="card"
              style={{
                cursor: 'pointer',
                textAlign: 'center',
                padding: 28
              }}
            >
              <Upload
                size={28}
                color="var(--accent-cyan)"
                style={{ marginBottom: 8 }}
              />
              <p
                style={{
                  fontWeight: 600,
                  color: 'var(--text-primary)'
                }}
              >
                Subir Recibo
              </p>
              <p
                style={{
                  fontSize: 12,
                  color: 'var(--text-secondary)'
                }}
              >
                Carga tu pago mensual
              </p>
            </div>
          </Link>

          <Link
            to="/usuario/historial"
            style={{ textDecoration: 'none' }}
          >
            <div
              className="card"
              style={{
                cursor: 'pointer',
                textAlign: 'center',
                padding: 28
              }}
            >
              <Receipt
                size={28}
                color="var(--accent-green)"
                style={{ marginBottom: 8 }}
              />
              <p
                style={{
                  fontWeight: 600,
                  color: 'var(--text-primary)'
                }}
              >
                Mis Pagos
              </p>
              <p
                style={{
                  fontSize: 12,
                  color: 'var(--text-secondary)'
                }}
              >
                Ver historial completo
              </p>
            </div>
          </Link>

          <Link
            to="/usuario/solicitudes"
            style={{ textDecoration: 'none' }}
          >
            <div
              className="card"
              style={{
                cursor: 'pointer',
                textAlign: 'center',
                padding: 28
              }}
            >
              <MessageSquare
                size={28}
                color="var(--accent-purple)"
                style={{ marginBottom: 8 }}
              />
              <p
                style={{
                  fontWeight: 600,
                  color: 'var(--text-primary)'
                }}
              >
                Solicitudes
              </p>
              <p
                style={{
                  fontSize: 12,
                  color: 'var(--text-secondary)'
                }}
              >
                Sugerencias y reclamos
              </p>
            </div>
          </Link>
        </div>

        {loading && (
          <p
            style={{
              marginTop: 14,
              textAlign: 'center',
              fontSize: 12,
              color: 'var(--text-muted)'
            }}
          >
            Actualizando información...
          </p>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ estado }) {
  if (estado === 'aprobado') {
    return <span className="badge badge-approved">✓ Aprobado</span>;
  }

  if (estado === 'rechazado') {
    return <span className="badge badge-rejected">✗ Rechazado</span>;
  }

  return <span className="badge badge-review">⏳ En revisión</span>;
}