import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, 
  QrCode, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle, 
  Settings, 
  Send, 
  Power, 
  HelpCircle, 
  Clock, 
  ShieldCheck, 
  Smartphone,
  ExternalLink,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { 
  apiGetWhatsAppConfig, 
  apiGuardarWhatsAppConfig, 
  apiGetWhatsAppQR, 
  apiDesconectarWhatsApp, 
  apiEnviarWhatsAppTest,
  apiDispararWhatsAppMora 
} from '../../api.js';

export default function WhatsAppAdmin() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrData, setQrData] = useState(null);
  const [toast, setToast] = useState(null);
  const [showConfig, setShowConfig] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  // Formulario de configuración
  const [evolutionUrl, setEvolutionUrl] = useState('');
  const [evolutionApiKey, setEvolutionApiKey] = useState('');
  const [evolutionInstance, setEvolutionInstance] = useState('goparking');
  const [savingConfig, setSavingConfig] = useState(false);

  // Formulario de mensaje de prueba
  const [testNumber, setTestNumber] = useState('');
  const [testMessage, setTestMessage] = useState('¡Hola! Este es un mensaje de prueba desde GoParking con WhatsApp conectado vía Código QR 🚗✅');
  const [sendingTest, setSendingTest] = useState(false);
  const [runningSweep, setRunningSweep] = useState(false);

  const pollIntervalRef = useRef(null);

  function showToast(type, msg) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  }

  async function loadConfig(silent = false) {
    if (!silent) setLoading(true);
    try {
      const res = await apiGetWhatsAppConfig();
      if (res.success && res.data) {
        setConfig(res.data);
        if (!silent) {
          setEvolutionUrl(res.data.evolutionUrl || '');
          setEvolutionApiKey(res.data.evolutionApiKey || '');
          setEvolutionInstance(res.data.evolutionInstance || 'goparking');
        }
        // Si ya está conectado y estábamos esperando QR, limpiar QR
        if (res.data.connectionState === 'conectado') {
          setQrData(null);
        }
      }
    } catch (err) {
      if (!silent) showToast('error', 'Error al consultar estado de WhatsApp: ' + err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    loadConfig();
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  // Polling si se está mostrando un QR para detectar cuando se conecte
  useEffect(() => {
    if (qrData) {
      pollIntervalRef.current = setInterval(() => {
        loadConfig(true);
      }, 4000);
    } else {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    }
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [qrData]);

  async function handleGetQR() {
    setQrLoading(true);
    setQrData(null);
    try {
      const res = await apiGetWhatsAppQR();
      if (res.success && res.data?.base64) {
        setQrData(res.data);
        showToast('success', 'Código QR generado. Escanéalo desde tu WhatsApp.');
      } else {
        showToast('error', res.error || 'No se pudo generar el código QR. Verifica la URL y clave del servidor.');
      }
    } catch (err) {
      showToast('error', 'Error al solicitar QR: ' + err.message);
    } finally {
      setQrLoading(false);
    }
  }

  async function handleDesconectar() {
    if (!window.confirm('¿Seguro que deseas desvincular la sesión de WhatsApp? Dejarán de enviarse mensajes hasta que vuelvas a escanear el QR.')) {
      return;
    }
    setLoading(true);
    try {
      const res = await apiDesconectarWhatsApp();
      if (res.success) {
        showToast('success', 'Sesión de WhatsApp desvinculada');
        setQrData(null);
        await loadConfig();
      } else {
        showToast('error', res.error || 'No se pudo desvincular');
      }
    } catch (err) {
      showToast('error', 'Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveConfig(e) {
    e.preventDefault();
    if (!evolutionUrl.trim()) {
      showToast('error', 'Ingresa la URL del servidor Evolution API');
      return;
    }
    setSavingConfig(true);
    try {
      const res = await apiGuardarWhatsAppConfig({
        evolutionUrl: evolutionUrl.trim(),
        evolutionApiKey: evolutionApiKey.trim(),
        evolutionInstance: evolutionInstance.trim() || 'goparking'
      });
      if (res.success) {
        showToast('success', 'Configuración guardada exitosamente');
        setShowConfig(false);
        await loadConfig();
      } else {
        showToast('error', res.error || 'Error al guardar configuración');
      }
    } catch (err) {
      showToast('error', 'Error: ' + err.message);
    } finally {
      setSavingConfig(false);
    }
  }

  async function handleSendTest(e) {
    e.preventDefault();
    if (!testNumber.trim()) {
      showToast('error', 'Escribe un número de celular de prueba');
      return;
    }
    setSendingTest(true);
    try {
      const res = await apiEnviarWhatsAppTest(testNumber.trim(), testMessage.trim());
      if (res.success) {
        showToast('success', '¡Mensaje de prueba enviado exitosamente!');
      } else {
        showToast('error', res.error || 'Error al enviar el mensaje');
      }
    } catch (err) {
      showToast('error', 'Error: ' + err.message);
    } finally {
      setSendingTest(false);
    }
  }

  async function handleDispararBarrido() {
    if (!window.confirm('¿Deseas ejecutar ahora el barrido de morosos? Se enviará un recordatorio por WhatsApp a todos los usuarios con fecha de corte vencida que no hayan subido recibo.')) {
      return;
    }
    setRunningSweep(true);
    try {
      const res = await apiDispararWhatsAppMora();
      if (res.success) {
        showToast('success', `Barrido finalizado: ${res.enviados || 0} enviados, ${res.omitidos || 0} omitidos (ya notificados hoy)`);
      } else {
        showToast('error', res.error || 'Error al ejecutar barrido');
      }
    } catch (err) {
      showToast('error', 'Error: ' + err.message);
    } finally {
      setRunningSweep(false);
    }
  }

  const isConnected = config?.connectionState === 'conectado';
  const isConfigured = config?.isConfigured;

  return (
    <div className="page-enter">
      {/* Toast Notificación */}
      {toast && (
        <div 
          className="toast toast-enter" 
          style={{ 
            position: 'fixed', 
            top: 24, 
            right: 24, 
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: toast.type === 'success' ? 'rgba(22, 199, 83, 0.95)' : 'rgba(239, 68, 68, 0.95)',
            color: '#fff',
            padding: '12px 18px',
            borderRadius: 10,
            boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
            fontWeight: 500
          }}
        >
          {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1>WhatsApp Automático (Código QR)</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: 4, fontSize: 14 }}>
            Vincula tu propio WhatsApp escaneando un código QR para enviar recordatorios de cobro 100% automáticos.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button 
            type="button" 
            className="btn btn-ghost btn-sm"
            onClick={() => loadConfig()}
            disabled={loading}
          >
            <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            Refrescar Estado
          </button>
          <button 
            type="button" 
            className={`btn ${showConfig ? 'btn-primary' : 'btn-ghost'} btn-sm`}
            onClick={() => setShowConfig(!showConfig)}
          >
            <Settings size={14} />
            {showConfig ? 'Ocultar Configuración' : 'Configuración Servidor'}
          </button>
        </div>
      </div>

      <div className="page-body">
        <div style={{ maxWidth: 840, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* TARJETA 1: ESTADO DE VINCULACIÓN POR CÓDIGO QR */}
          <div className="card" style={{ border: isConnected ? '1px solid rgba(22, 199, 83, 0.4)' : '1px solid rgba(234, 179, 8, 0.4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ 
                  width: 44, 
                  height: 44, 
                  borderRadius: 12, 
                  background: isConnected ? 'rgba(22, 199, 83, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  color: isConnected ? 'var(--accent-green)' : 'var(--accent-yellow)'
                }}>
                  <Smartphone size={24} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>Estado de WhatsApp</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <span 
                      className={`badge ${isConnected ? 'badge-approved' : 'badge-pending'}`}
                      style={{ textTransform: 'uppercase', fontSize: 11, letterSpacing: 0.5 }}
                    >
                      {isConnected ? '● Conectado (Listo)' : '○ Desconectado'}
                    </span>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                      Instancia: <strong>{config?.evolutionInstance || 'goparking'}</strong>
                    </span>
                  </div>
                </div>
              </div>

              {isConnected ? (
                <button 
                  type="button" 
                  className="btn btn-ghost btn-sm"
                  style={{ color: 'var(--accent-red)', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                  onClick={handleDesconectar}
                >
                  <Power size={14} /> Desvincular WhatsApp
                </button>
              ) : (
                <button 
                  type="button" 
                  className="btn btn-primary"
                  onClick={handleGetQR}
                  disabled={qrLoading || !isConfigured}
                  title={!isConfigured ? 'Configura la URL de Evolution API primero' : ''}
                >
                  <QrCode size={16} />
                  {qrLoading ? 'Generando QR...' : 'Vincular por Código QR'}
                </button>
              )}
            </div>

            {/* Aviso si no está configurada la URL de Evolution API */}
            {!isConfigured && (
              <div style={{ 
                background: 'rgba(234, 179, 8, 0.1)', 
                border: '1px solid rgba(234, 179, 8, 0.3)', 
                borderRadius: 10, 
                padding: '14px 18px', 
                marginTop: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 12
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <AlertCircle size={20} color="var(--accent-yellow)" />
                  <span style={{ fontSize: 13.5, color: '#fef08a' }}>
                    Aún no has configurado la URL del servidor de Evolution API para generar el código QR.
                  </span>
                </div>
                <button 
                  type="button" 
                  className="btn btn-primary btn-sm"
                  onClick={() => setShowConfig(true)}
                >
                  <Settings size={14} /> Configurar Ahora
                </button>
              </div>
            )}

            {/* SECCIÓN DEL CÓDIGO QR GENERADO */}
            {qrData && (
              <div style={{ 
                marginTop: 20, 
                padding: 24, 
                background: 'rgba(10, 20, 36, 0.8)', 
                borderRadius: 14, 
                border: '1px solid rgba(34, 197, 94, 0.3)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center'
              }}>
                <h4 style={{ margin: 0, fontSize: 16, color: 'var(--accent-green)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <QrCode size={20} /> Escanea este Código QR con tu WhatsApp
                </h4>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 480, margin: '8px 0 16px' }}>
                  Abre <strong>WhatsApp</strong> en tu teléfono &gt; toca los 3 puntos o Ajustes &gt; <strong>Dispositivos vinculados</strong> &gt; <strong>Vincular un dispositivo</strong> y apunta tu cámara hacia este recuadro.
                </p>

                <div style={{ 
                  background: '#fff', 
                  padding: 14, 
                  borderRadius: 12, 
                  boxShadow: '0 8px 30px rgba(0,0,0,0.6)',
                  marginBottom: 16 
                }}>
                  {qrData.base64 ? (
                    <img 
                      src={qrData.base64.startsWith('data:') ? qrData.base64 : `data:image/png;base64,${qrData.base64}`} 
                      alt="Código QR WhatsApp" 
                      style={{ width: 250, height: 250, display: 'block' }}
                    />
                  ) : (
                    <div style={{ width: 250, height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000' }}>
                      Cargando QR...
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <button 
                    type="button" 
                    className="btn btn-ghost btn-sm"
                    onClick={handleGetQR}
                    disabled={qrLoading}
                  >
                    <RefreshCw size={14} style={{ animation: qrLoading ? 'spin 1s linear infinite' : 'none' }} />
                    Regenerar Código QR
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-ghost btn-sm"
                    onClick={() => setQrData(null)}
                  >
                    Cerrar QR
                  </button>
                </div>
                <small style={{ marginTop: 10, color: 'var(--text-secondary)', fontSize: 12 }}>
                  ⏳ La pantalla detectará automáticamente cuando lo hayas escaneado.
                </small>
              </div>
            )}
          </div>

          {/* TARJETA 2: BARRIDO Y PRUEBA DE ENVÍO */}
          {isConnected && (
            <div className="card">
              <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16 }}>
                <Send size={18} color="var(--accent-green)" /> Enviar Mensaje de Prueba
              </h3>
              <p className="card-subtitle">Verifica que tu WhatsApp vinculado envíe mensajes correctamente</p>

              <form onSubmit={handleSendTest} style={{ marginTop: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12, alignItems: 'flex-start' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Número Celular (Colombia):</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Ej: 3123456789"
                      value={testNumber}
                      onChange={e => setTestNumber(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Mensaje:</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={testMessage}
                      onChange={e => setTestMessage(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    disabled={sendingTest}
                  >
                    <Send size={15} />
                    {sendingTest ? 'Enviando...' : 'Enviar Prueba Ahora'}
                  </button>
                </div>
              </form>

              {/* Botón de Barrido Manual */}
              <div style={{ 
                marginTop: 20, 
                paddingTop: 16, 
                borderTop: '1px solid var(--border-color)', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 12 
              }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: 14 }}>Barrido Automático Programado</h4>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                    Se ejecuta todos los días a las 8:00 AM notificando a quienes tengan mensualidad vencida sin comprobante.
                  </p>
                </div>
                <button 
                  type="button" 
                  className="btn btn-ghost"
                  onClick={handleDispararBarrido}
                  disabled={runningSweep}
                >
                  <Clock size={15} />
                  {runningSweep ? 'Ejecutando Barrido...' : 'Ejecutar Barrido Manual'}
                </button>
              </div>
            </div>
          )}

          {/* TARJETA 3: CONFIGURACIÓN DEL SERVIDOR EVOLUTION API */}
          {showConfig && (
            <div className="card" style={{ border: '1px solid rgba(79, 70, 229, 0.4)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <h3 className="card-title" style={{ margin: 0, fontSize: 16 }}>Configuración del Servidor (Evolution API)</h3>
                  <p className="card-subtitle">Datos de conexión con el gateway de WhatsApp</p>
                </div>
                <button 
                  type="button" 
                  className="btn btn-ghost btn-sm"
                  onClick={() => setShowGuide(!showGuide)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <HelpCircle size={14} /> ¿No tienes servidor?
                  {showGuide ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              </div>

              {/* Mini Guía si no tiene servidor */}
              {showGuide && (
                <div style={{ 
                  background: 'rgba(79, 70, 229, 0.1)', 
                  border: '1px solid rgba(79, 70, 229, 0.3)', 
                  borderRadius: 10, 
                  padding: 16, 
                  marginBottom: 16,
                  fontSize: 13,
                  lineHeight: 1.6
                }}>
                  <h4 style={{ margin: '0 0 8px', color: 'var(--accent-purple)', fontSize: 14 }}>
                    ¿Cómo desplegar Evolution API en 2 minutos?
                  </h4>
                  <p style={{ margin: '0 0 8px' }}>
                    Evolution API es un servidor de código abierto que se encarga de conectar WhatsApp Web mediante código QR:
                  </p>
                  <ol style={{ paddingLeft: 18, margin: 0 }}>
                    <li>
                      <strong>Opción Gratuita / Económica (Railway / Render):</strong> Puedes crear un servicio web con la imagen Docker oficial <code>atendai/evolution-api:v2.1.0</code>.
                    </li>
                    <li>
                      Establece la variable de entorno <code>AUTHENTICATION_API_KEY</code> con una clave secreta que elijas.
                    </li>
                    <li>
                      Copia la URL pública generada (ej: <code>https://mi-evolution-api.up.railway.app</code>) y la clave API en el formulario de abajo.
                    </li>
                  </ol>
                </div>
              )}

              <form onSubmit={handleSaveConfig}>
                <div className="form-group">
                  <label className="form-label">URL Base de Evolution API:</label>
                  <input 
                    type="url" 
                    className="form-input" 
                    placeholder="https://tu-evolution-api.up.railway.app"
                    value={evolutionUrl}
                    onChange={e => setEvolutionUrl(e.target.value)}
                    required
                  />
                  <small style={{ color: 'var(--text-secondary)', display: 'block', marginTop: 4 }}>
                    URL donde está alojado tu contenedor o instancia de Evolution API (sin barra al final).
                  </small>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group">
                    <label className="form-label">API Key (Clave Secreta):</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="AUTHENTICATION_API_KEY"
                      value={evolutionApiKey}
                      onChange={e => setEvolutionApiKey(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Nombre de Instancia:</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="goparking"
                      value={evolutionInstance}
                      onChange={e => setEvolutionInstance(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                  <button 
                    type="button" 
                    className="btn btn-ghost" 
                    onClick={() => setShowConfig(false)}
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    disabled={savingConfig}
                  >
                    <ShieldCheck size={16} />
                    {savingConfig ? 'Guardando...' : 'Guardar y Aplicar'}
                  </button>
                </div>
              </form>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
