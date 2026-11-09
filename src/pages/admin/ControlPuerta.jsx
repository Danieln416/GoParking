import React, { useState, useEffect, useRef } from 'react';
import {
  KeyRound,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  Power,
  Clock,
  Smartphone,
  Globe,
  Car,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Copy,
  Check,
  Sliders,
  Code,
  Lock,
  Eye,
  EyeOff,
  Search,
  Filter,
  Radio,
  Cpu
} from 'lucide-react';
import {
  apiAbrirPuerta,
  apiGetEstadoPuerta,
  apiGetHistorialPuerta,
  apiGetPuertaConfig,
  apiGuardarPuertaConfig
} from '../../api.js';
import { useAuth } from '../../context/AuthContext.jsx';

export default function ControlPuerta() {
  const { user } = useAuth();

  // Estados principales
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [abriendo, setAbriendo] = useState(false);
  const [toast, setToast] = useState(null);

  // Datos del backend
  const [estadoPuerta, setEstadoPuerta] = useState('EN_ESPERA');
  const [ultimaAct, setUltimaAct] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [config, setConfig] = useState({
    token: 'goparking_esp32_sec_2026',
    tiempo_pulso_ms: 5000
  });

  // UI helpers
  const [showToken, setShowToken] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [activeTab, setActiveTab] = useState('historial'); // 'historial' | 'config' | 'codigo'
  const [filtroTexto, setFiltroTexto] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('TODOS');

  // Guardado de configuración
  const [formToken, setFormToken] = useState('');
  const [formPulso, setFormPulso] = useState(5);
  const [guardandoConfig, setGuardandoConfig] = useState(false);

  // Polling automático mientras está abriendo
  const pollIntervalRef = useRef(null);

  useEffect(() => {
    cargarDatos(true);
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  function mostrarToast(tipo, mensaje) {
    setToast({ tipo, mensaje });
    setTimeout(() => setToast(null), 4500);
  }

  async function cargarDatos(esInicial = false) {
    if (esInicial) setLoading(true);
    else setRefreshing(true);

    try {
      const [resConfig, resHist, resEst] = await Promise.all([
        apiGetPuertaConfig().catch(() => ({ success: false })),
        apiGetHistorialPuerta(100).catch(() => ({ success: false, data: [] })),
        apiGetEstadoPuerta().catch(() => ({ estado: 'EN_ESPERA' }))
      ]);

      if (resConfig?.success && resConfig.data) {
        setConfig(resConfig.data);
        setFormToken(resConfig.data.token || 'goparking_esp32_sec_2026');
        setFormPulso(Math.round((resConfig.data.tiempo_pulso_ms || 5000) / 1000));
        setEstadoPuerta(resConfig.data.estado || 'EN_ESPERA');
        setUltimaAct(resConfig.data.ultima_actualizacion || null);
      } else if (resEst?.estado) {
        setEstadoPuerta(resEst.estado);
      }

      if (resHist?.data) {
        setHistorial(resHist.data);
      }
    } catch (err) {
      console.error('Error al cargar datos de puerta:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  // Apertura manual desde panel de Administrador
  async function handleAbrirPuertaManual() {
    if (abriendo) return;
    setAbriendo(true);

    try {
      const res = await apiAbrirPuerta({
        rol: 'admin',
        usuarioId: user?.id || 'admin',
        nombre: user?.nombre || 'Administrador',
        placa: 'ADMIN_MANUAL',
        dispositivo: 'Panel Web Admin (Apertura Manual)'
      });

      if (res.success) {
        setEstadoPuerta('PENDIENTE_ABRIR');
        mostrarToast('success', '¡Orden enviada! La ESP32 abrirá la barrera.');

        // Iniciar polling temporal de 10 segundos para ver confirmación en vivo
        let checks = 0;
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = setInterval(async () => {
          checks++;
          const est = await apiGetEstadoPuerta().catch(() => null);
          if (est) {
            setEstadoPuerta(est.estado);
            if (est.estado === 'EN_ESPERA') {
              clearInterval(pollIntervalRef.current);
              setAbriendo(false);
              cargarDatos(false);
            }
          }
          if (checks >= 12) {
            clearInterval(pollIntervalRef.current);
            setAbriendo(false);
            cargarDatos(false);
          }
        }, 1000);
      } else {
        mostrarToast('error', res.error || 'No se pudo enviar la orden');
        setAbriendo(false);
      }
    } catch (err) {
      mostrarToast('error', 'Error al comunicar con la API: ' + err.message);
      setAbriendo(false);
    }
  }

  // Guardar configuración del token o duración de pulso
  async function handleGuardarConfig(e) {
    e.preventDefault();
    setGuardandoConfig(true);

    try {
      const pulsoMs = Math.max(1, Math.min(15, Number(formPulso) || 5)) * 1000;
      const res = await apiGuardarPuertaConfig({
        token: formToken.trim(),
        tiempo_pulso_ms: pulsoMs
      });

      if (res.success) {
        mostrarToast('success', 'Configuración de seguridad guardada exitosamente.');
        await cargarDatos(false);
      } else {
        mostrarToast('error', res.error || 'No se pudo guardar la configuración.');
      }
    } catch (err) {
      mostrarToast('error', 'Error: ' + err.message);
    } finally {
      setGuardandoConfig(false);
    }
  }

  function handleCopiarToken() {
    navigator.clipboard.writeText(formToken || config.token);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  }

  function formatearFecha(fechaStr) {
    if (!fechaStr) return '—';
    try {
      const d = new Date(fechaStr);
      if (isNaN(d.getTime())) return fechaStr;
      return d.toLocaleString('es-CO', {
        dateStyle: 'short',
        timeStyle: 'medium',
        hour12: true
      });
    } catch {
      return fechaStr;
    }
  }

  // Filtro de auditoría
  const historialFiltrado = historial.filter(item => {
    if (filtroEstado !== 'TODOS' && item.estado !== filtroEstado) {
      return false;
    }
    if (!filtroTexto.trim()) return true;

    const term = filtroTexto.toLowerCase();
    const nombre = (item.solicitado_nombre || '').toLowerCase();
    const placa = (item.placa || '').toLowerCase();
    const cedula = (item.solicitado_cedula || '').toLowerCase();
    const ip = (item.ip_solicitante || '').toLowerCase();
    const disp = (item.dispositivo_usuario || '').toLowerCase();
    const motivo = (item.motivo || '').toLowerCase();

    return (
      nombre.includes(term) ||
      placa.includes(term) ||
      cedula.includes(term) ||
      ip.includes(term) ||
      disp.includes(term) ||
      motivo.includes(term)
    );
  });

  const arduinoSnippet = `// GoParking — ESP32 Sketch para Barrera
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>

const char* WIFI_SSID     = "TU_WIFI_AQUI";
const char* WIFI_PASSWORD = "TU_PASSWORD_AQUI";
const char* API_BASE_URL  = "https://goparking-api.daniram-parking.workers.dev";
const char* DEVICE_TOKEN  = "${formToken || config.token || 'goparking_esp32_sec_2026'}";

const int PIN_RELE = 23; // Pin de activacion del rele
const int RELAY_ACTIVE = LOW; // LOW para reles tipicos Arduino
const int RELAY_INACTIVE = HIGH;

void setup() {
  Serial.begin(115200);
  pinMode(PIN_RELE, OUTPUT);
  digitalWrite(PIN_RELE, RELAY_INACTIVE);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  Serial.println("\\nWiFi Conectado!");
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    WiFiClientSecure client; client.setInsecure();
    HTTPClient http;
    http.begin(client, String(API_BASE_URL) + "/api/puerta/estado");
    http.addHeader("x-door-token", DEVICE_TOKEN);
    if (http.GET() == 200) {
      StaticJsonDocument<512> doc;
      deserializeJson(doc, http.getString());
      if (String((const char*)doc["estado"]) == "PENDIENTE_ABRIR") {
        const char* cmdId = doc["comando_id"];
        int pulso = doc["tiempo_pulso_ms"] | 5000;
        
        // Pulso al rele
        digitalWrite(PIN_RELE, RELAY_ACTIVE);
        delay(pulso);
        digitalWrite(PIN_RELE, RELAY_INACTIVE);
        
        // Confirmar fin de apertura
        HTTPClient httpConf;
        httpConf.begin(client, String(API_BASE_URL) + "/api/puerta/confirmar");
        httpConf.addHeader("Content-Type", "application/json");
        httpConf.addHeader("x-door-token", DEVICE_TOKEN);
        httpConf.POST(String("{\\"comando_id\\":\\"") + cmdId + "\\"}");
        httpConf.end();
      }
    }
    http.end();
  }
  delay(1000);
}`;

  return (
    <div className="page-container">
      {/* Toast de notificaciones */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: 20,
            right: 20,
            zIndex: 9999,
            padding: '12px 20px',
            borderRadius: 8,
            color: '#fff',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            backgroundColor: toast.tipo === 'success' ? '#10b981' : '#ef4444'
          }}
        >
          {toast.tipo === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          <span>{toast.mensaje}</span>
        </div>
      )}

      {/* Cabecera */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <KeyRound size={26} color="var(--accent-primary)" />
            Control de Barrera & Accesos (ESP32)
          </h1>
          <p className="page-subtitle">
            Monitoreo en tiempo real, auditoría forense de ingresos y configuración de seguridad IoT.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => cargarDatos(false)}
            disabled={refreshing}
          >
            <RefreshCw size={15} className={refreshing ? 'spin-icon' : ''} />
            {refreshing ? 'Sincronizando...' : 'Actualizar'}
          </button>
        </div>
      </div>

      {/* Widget Superior: Estado en Vivo y Apertura Inmediata */}
      <div
        className="card"
        style={{
          marginBottom: 24,
          padding: 24,
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.85) 100%)',
          border: estadoPuerta === 'PENDIENTE_ABRIR' ? '2px solid #10b981' : '1px solid var(--border)',
          borderRadius: 14,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 20
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: estadoPuerta === 'PENDIENTE_ABRIR' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(59, 130, 246, 0.15)',
              color: estadoPuerta === 'PENDIENTE_ABRIR' ? '#10b981' : 'var(--accent-primary)',
              border: `1px solid ${estadoPuerta === 'PENDIENTE_ABRIR' ? '#10b981' : 'rgba(59, 130, 246, 0.3)'}`
            }}
          >
            <Radio size={28} className={estadoPuerta === 'PENDIENTE_ABRIR' ? 'spin-icon' : ''} />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h3 style={{ margin: 0, fontSize: 18, color: 'var(--text-primary)' }}>
                Barrera Principal
              </h3>
              <span
                style={{
                  padding: '4px 10px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 700,
                  backgroundColor: estadoPuerta === 'PENDIENTE_ABRIR' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(100, 116, 139, 0.2)',
                  color: estadoPuerta === 'PENDIENTE_ABRIR' ? '#10b981' : 'var(--text-secondary)',
                  border: `1px solid ${estadoPuerta === 'PENDIENTE_ABRIR' ? '#10b981' : 'transparent'}`
                }}
              >
                {estadoPuerta === 'PENDIENTE_ABRIR' ? 'ABRIENDO (ORDEN EN CURSO)' : 'EN REPOSO / CERRADA'}
              </span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
              Protocolo REST Polling (1s) · Token Cifrado · TTL de seguridad 30s
            </p>
          </div>
        </div>

        {/* Botón de apertura manual */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleAbrirPuertaManual}
            disabled={abriendo || estadoPuerta === 'PENDIENTE_ABRIR'}
            style={{
              padding: '12px 24px',
              fontSize: 15,
              fontWeight: 700,
              backgroundColor: '#10b981',
              borderColor: '#10b981',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)'
            }}
          >
            <Power size={18} />
            {abriendo || estadoPuerta === 'PENDIENTE_ABRIR' ? 'Enviando Orden...' : 'Abrir Barrera Ahora'}
          </button>
        </div>
      </div>

      {/* Pestañas de navegación */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
        <button
          type="button"
          className={`btn btn-sm ${activeTab === 'historial' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('historial')}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <Clock size={15} />
          Auditoría de Ingresos ({historial.length})
        </button>

        <button
          type="button"
          className={`btn btn-sm ${activeTab === 'config' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('config')}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <Sliders size={15} />
          Seguridad & Configuración ESP32
        </button>

        <button
          type="button"
          className={`btn btn-sm ${activeTab === 'codigo' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('codigo')}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <Code size={15} />
          Código Firmware C++ / Arduino
        </button>
      </div>

      {/* PESTAÑA 1: HISTORIAL FORENSE Y AUDITORÍA */}
      {activeTab === 'historial' && (
        <div>
          {/* Filtros de auditoría */}
          <div className="card" style={{ padding: 16, marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 260 }}>
              <Search size={16} color="var(--text-secondary)" />
              <input
                type="text"
                placeholder="Buscar por placa, nombre, cédula, IP, dispositivo..."
                value={filtroTexto}
                onChange={e => setFiltroTexto(e.target.value)}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-primary)',
                  fontSize: 14,
                  outline: 'none'
                }}
              />
              {filtroTexto && (
                <button
                  type="button"
                  onClick={() => setFiltroTexto('')}
                  style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13 }}
                >
                  ✕
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Filter size={14} color="var(--text-secondary)" />
              <select
                value={filtroEstado}
                onChange={e => setFiltroEstado(e.target.value)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: 13
                }}
              >
                <option value="TODOS">Todos los Estados</option>
                <option value="COMPLETADO">Completados (Abiertos)</option>
                <option value="SOLICITADO">Solicitados</option>
                <option value="DENEGADO">Denegados (Mora/No aut)</option>
                <option value="EXPIRADO">Expirados (Timeout 30s)</option>
              </select>
            </div>
          </div>

          {/* Tabla de auditoría */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                    <th style={{ padding: '12px 16px' }}>Fecha & Hora</th>
                    <th style={{ padding: '12px 16px' }}>Usuario / Solicitante</th>
                    <th style={{ padding: '12px 16px' }}>Placa</th>
                    <th style={{ padding: '12px 16px' }}>Estado</th>
                    <th style={{ padding: '12px 16px' }}>Dispositivo & SO</th>
                    <th style={{ padding: '12px 16px' }}>IP Pública & Ubicación</th>
                    <th style={{ padding: '12px 16px' }}>Detalles / Confirmación</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7} style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)' }}>
                        <RefreshCw size={24} className="spin-icon" style={{ margin: '0 auto 8px' }} />
                        <p>Cargando registros de auditoría...</p>
                      </td>
                    </tr>
                  ) : historialFiltrado.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)' }}>
                        No se encontraron registros de aperturas con los filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    historialFiltrado.map(reg => {
                      let badgeBg = 'rgba(100, 116, 139, 0.15)';
                      let badgeColor = 'var(--text-secondary)';
                      let iconEstado = <Clock size={12} />;

                      if (reg.estado === 'COMPLETADO') {
                        badgeBg = 'rgba(16, 185, 129, 0.15)';
                        badgeColor = '#10b981';
                        iconEstado = <CheckCircle size={12} />;
                      } else if (reg.estado === 'DENEGADO') {
                        badgeBg = 'rgba(239, 68, 68, 0.15)';
                        badgeColor = '#ef4444';
                        iconEstado = <XCircle size={12} />;
                      } else if (reg.estado === 'SOLICITADO') {
                        badgeBg = 'rgba(245, 158, 11, 0.15)';
                        badgeColor = '#f59e0b';
                        iconEstado = <Radio size={12} />;
                      }

                      return (
                        <tr key={reg.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          {/* Fecha & Hora */}
                          <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                              {formatearFecha(reg.fecha_hora)}
                            </div>
                            <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                              {reg.comando_id ? reg.comando_id.slice(-8) : ''}
                            </span>
                          </td>

                          {/* Usuario */}
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                              {reg.solicitado_nombre || 'Desconocido'}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                              {reg.solicitado_cedula ? `C.C. ${reg.solicitado_cedula}` : reg.solicitado_correo || reg.rol}
                            </div>
                          </td>

                          {/* Placa */}
                          <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                            {reg.placa ? (
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '2px 8px',
                                  borderRadius: 4,
                                  background: '#fef08a',
                                  color: '#000',
                                  fontWeight: 800,
                                  fontFamily: 'monospace',
                                  fontSize: 12,
                                  border: '1px solid #eab308'
                                }}
                              >
                                {reg.placa}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>—</span>
                            )}
                          </td>

                          {/* Estado */}
                          <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '3px 8px',
                                borderRadius: 6,
                                fontSize: 11,
                                fontWeight: 700,
                                background: badgeBg,
                                color: badgeColor
                              }}
                            >
                              {iconEstado}
                              {reg.estado}
                            </span>
                          </td>

                          {/* Dispositivo */}
                          <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-secondary)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-primary)' }}>
                              <Smartphone size={13} color="var(--accent-primary)" />
                              {reg.dispositivo_usuario || 'Web'}
                            </div>
                          </td>

                          {/* IP & Ubicación */}
                          <td style={{ padding: '12px 16px', fontSize: 12 }}>
                            <div style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                              {reg.ip_solicitante || '—'}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Globe size={11} />
                              {reg.ubicacion_ip || 'Colombia'}
                            </div>
                          </td>

                          {/* Detalles / Confirmación ESP32 */}
                          <td style={{ padding: '12px 16px', fontSize: 11, color: 'var(--text-secondary)' }}>
                            <div style={{ color: reg.estado === 'DENEGADO' ? '#ef4444' : 'var(--text-primary)' }}>
                              {reg.motivo || '—'}
                            </div>
                            {reg.fecha_confirmacion_esp32 && (
                              <div style={{ marginTop: 2, color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Cpu size={11} />
                                ESP32 ({formatearFecha(reg.fecha_confirmacion_esp32)})
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* PESTAÑA 2: CONFIGURACIÓN Y SEGURIDAD */}
      {activeTab === 'config' && (
        <div style={{ maxWidth: 700 }}>
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <Lock size={20} color="var(--accent-primary)" />
              <h3 style={{ margin: 0, fontSize: 16 }}>Credenciales y Seguridad de la ESP32</h3>
            </div>

            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
              La ESP32 debe autenticarse en cada petición HTTP mediante la cabecera <code>x-door-token</code>.
              Cualquier solicitud externa sin este token o con token incorrecto es rechazada con código HTTP 401.
            </p>

            <form onSubmit={handleGuardarConfig}>
              {/* Token Secreto */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  Token Secreto de Acceso (Device API Key)
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <input
                      type={showToken ? 'text' : 'password'}
                      className="form-input"
                      value={formToken}
                      onChange={e => setFormToken(e.target.value)}
                      placeholder="goparking_esp32_sec_2026"
                      required
                      style={{ paddingRight: 40, fontFamily: 'monospace' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      style={{
                        position: 'absolute',
                        right: 10,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer'
                      }}
                    >
                      {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleCopiarToken}
                    title="Copiar Token"
                  >
                    {copiedToken ? <Check size={16} color="#10b981" /> : <Copy size={16} />}
                  </button>
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                  Usa este mismo valor en la variable <code>DEVICE_TOKEN</code> de tu sketch ESP32.
                </p>
              </div>

              {/* Tiempo de pulso del relé */}
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  Duración del Pulso de Apertura (Segundos)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <input
                    type="number"
                    min="1"
                    max="15"
                    step="1"
                    className="form-input"
                    value={formPulso}
                    onChange={e => setFormPulso(e.target.value)}
                    style={{ width: 120 }}
                    required
                  />
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    segundos (recomendado: 5s para contacto seco de barrera)
                  </span>
                </div>
              </div>

              {/* Endpoints de la API */}
              <div style={{ padding: 16, borderRadius: 8, background: 'var(--bg-secondary)', marginBottom: 24 }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: 13, color: 'var(--text-primary)' }}>
                  Endpoints REST Disponibles
                </h4>
                <div style={{ fontSize: 12, fontFamily: 'monospace', lineHeight: 1.8 }}>
                  <div>
                    <span style={{ color: '#10b981', fontWeight: 700 }}>GET</span>{' '}
                    https://goparking-api.daniram-parking.workers.dev/api/puerta/estado
                  </div>
                  <div>
                    <span style={{ color: '#3b82f6', fontWeight: 700 }}>POST</span>{' '}
                    https://goparking-api.daniram-parking.workers.dev/api/puerta/confirmar
                  </div>
                  <div>
                    <span style={{ color: '#f59e0b', fontWeight: 700 }}>POST</span>{' '}
                    https://goparking-api.daniram-parking.workers.dev/api/puerta/abrir
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={guardandoConfig}
                style={{ display: 'flex', alignItems: 'center', gap: 8 }}
              >
                {guardandoConfig ? <RefreshCw size={15} className="spin-icon" /> : <CheckCircle size={15} />}
                {guardandoConfig ? 'Guardando...' : 'Guardar Configuración'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* PESTAÑA 3: CÓDIGO FIRMWARE ARDUINO */}
      {activeTab === 'codigo' && (
        <div>
          <div className="card" style={{ padding: 24, marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Cpu size={18} color="var(--accent-primary)" />
                  Firmware Arduino C++ para ESP32
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                  Copia y pega este código en Arduino IDE o PlatformIO. Ya incluye tu token y endpoints configurados.
                </p>
              </div>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  navigator.clipboard.writeText(arduinoSnippet);
                  setCopiedCode(true);
                  setTimeout(() => setCopiedCode(false), 2000);
                }}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                {copiedCode ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                {copiedCode ? '¡Copiado!' : 'Copiar Código C++'}
              </button>
            </div>

            <pre
              style={{
                background: '#0f172a',
                color: '#e2e8f0',
                padding: 18,
                borderRadius: 8,
                fontSize: 12,
                lineHeight: 1.5,
                overflowX: 'auto',
                border: '1px solid #334155'
              }}
            >
              <code>{arduinoSnippet}</code>
            </pre>
          </div>

          {/* Diagrama de conexión */}
          <div className="card" style={{ padding: 20, background: 'var(--bg-secondary)' }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: 14 }}>
              📌 Conexión de Pines Físicos
            </h4>
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              <li><strong>GPIO 23:</strong> Conectar a la entrada <code>IN</code> del módulo Relé.</li>
              <li><strong>VCC (Relé):</strong> Conectar a <code>VIN</code> (5V de la ESP32) o fuente externa de 5V.</li>
              <li><strong>GND:</strong> Conectar a <code>GND</code> de la ESP32.</li>
              <li><strong>Salida Relé (COM y NO):</strong> Conectar en paralelo a los terminales de pulsador o contacto seco de la tarjeta de la barrera vehicular.</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
