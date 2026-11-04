import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Camera,
  Search,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Car,
  Bike,
  User,
  Phone,
  MessageSquare,
  MapPin,
  Calendar,
  CreditCard,
  RotateCw,
  RefreshCw,
  Maximize2,
  Minimize2,
  FileText,
  Upload,
  X,
  Plus,
  Clock,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { apiGetUsuarios, apiGetPuestos, apiGetRecibos } from '../../api.js';
import { getUserBillingInfo, formatDateLabel } from '../../utils/periodo.js';
import ModalRegistrarPago from '../../components/ModalRegistrarPago.jsx';
import { Link } from 'react-router-dom';

// Función para normalizar texto de placa (quita espacios, guiones y convierte a mayúsculas)
function cleanPlate(text) {
  return String(text || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

// Extractor de patrones de placas colombianas (Carro y Moto)
function extractPlateFromText(rawText) {
  if (!rawText) return '';
  const clean = String(rawText).toUpperCase().replace(/[^A-Z0-9\s-]/g, ' ');

  // 1. Carro: 3 letras y 3 números (ej. ABC 123 o ABC-123)
  const carMatch = clean.match(/\b([A-Z]{3})\s*[-]?\s*([0-9]{3})\b/);
  if (carMatch) {
    return `${carMatch[1]}${carMatch[2]}`;
  }

  // 2. Moto moderna: 3 letras, 2 números y 1 letra (ej. ABC 12D)
  const motoMatch = clean.match(/\b([A-Z]{3})\s*[-]?\s*([0-9]{2}[A-Z])\b/);
  if (motoMatch) {
    return `${motoMatch[1]}${motoMatch[2]}`;
  }

  // 3. Moto clásica: 3 letras y 2 números (ej. ABC 12)
  const motoOld = clean.match(/\b([A-Z]{3})\s*[-]?\s*([0-9]{2})\b/);
  if (motoOld) {
    return `${motoOld[1]}${motoOld[2]}`;
  }

  // 4. Token genérico de 5 a 6 caracteres alfanumérico
  const words = clean.split(/\s+/);
  for (const w of words) {
    if (w.length >= 5 && w.length <= 7 && /[A-Z]/.test(w) && /[0-9]/.test(w)) {
      return w;
    }
  }

  return '';
}

// Cargador asíncrono dinámico de Tesseract OCR desde CDN
function loadTesseractLibrary() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  return new Promise((resolve, reject) => {
    const existing = document.getElementById('tesseract-cdn-script');
    if (existing) {
      existing.onload = () => resolve(window.Tesseract);
      existing.onerror = () => reject(new Error('Error al cargar OCR'));
      return;
    }

    const script = document.createElement('script');
    script.id = 'tesseract-cdn-script';
    script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
    script.onload = () => resolve(window.Tesseract);
    script.onerror = () => reject(new Error('No fue posible cargar el motor OCR en el navegador.'));
    document.head.appendChild(script);
  });
}

export default function ControlPlacas() {
  const [activeTab, setActiveTab] = useState('manual'); // 'manual' | 'camara' | 'archivo'
  const [searchTerm, setSearchTerm] = useState('');
  const [usuarios, setUsuarios] = useState([]);
  const [puestos, setPuestos] = useState([]);
  const [recibos, setRecibos] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  // Cámara y OCR
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [ocrScanning, setOcrScanning] = useState(false);
  const [ocrProgress, setOcrProgress] = useState('');
  const [facingMode, setFacingMode] = useState('environment'); // 'environment' (trasera) o 'user' (frontal)

  // Modal para registrar pago
  const [modalPagoOpen, setModalPagoOpen] = useState(false);
  const [usuarioParaPago, setUsuarioParaPago] = useState(null);

  // Historial de escaneos de la sesión
  const [historialConsultas, setHistorialConsultas] = useState([]);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadAllData();
    return () => {
      stopCamera();
    };
  }, []);

  async function loadAllData() {
    setLoadingData(true);
    try {
      const [uRes, pRes, rRes] = await Promise.all([
        apiGetUsuarios(),
        apiGetPuestos(),
        apiGetRecibos('all')
      ]);

      if (uRes.success) setUsuarios(uRes.data || []);
      if (pRes.success) setPuestos(pRes.data || []);
      if (rRes.success) setRecibos(rRes.data || []);
    } catch (e) {
      console.error('Error cargando datos de control de placas:', e);
    } finally {
      setLoadingData(false);
    }
  }

  // Mapeo completo de vehículos registrados
  const vehiculosRegistrados = useMemo(() => {
    const list = [];
    usuarios.forEach(u => {
      if (u.rol === 'admin') return;

      const userPuestos = puestos.filter(p => String(p.usuario_id) === String(u.id));
      const userReceipts = recibos.filter(r => String(r.usuario_id) === String(u.id));
      const billing = getUserBillingInfo(u.fecha_inicio, new Date(), userReceipts);

      // Placa carro
      if (u.placa_carro) {
        list.push({
          placaOriginal: u.placa_carro,
          placaLimpia: cleanPlate(u.placa_carro),
          tipoVehiculo: 'Carro',
          usuario: u,
          puestos: userPuestos,
          billing,
          activo: u.activo !== 0
        });
      }

      // Placa moto
      if (u.placa_moto) {
        list.push({
          placaOriginal: u.placa_moto,
          placaLimpia: cleanPlate(u.placa_moto),
          tipoVehiculo: 'Moto',
          usuario: u,
          puestos: userPuestos,
          billing,
          activo: u.activo !== 0
        });
      }

      // Placa genérica (si no tenía placa_carro ni placa_moto)
      if (u.placa && !u.placa_carro && !u.placa_moto) {
        list.push({
          placaOriginal: u.placa,
          placaLimpia: cleanPlate(u.placa),
          tipoVehiculo: u.tipo_vehiculo || 'Vehículo',
          usuario: u,
          puestos: userPuestos,
          billing,
          activo: u.activo !== 0
        });
      }
    });

    return list;
  }, [usuarios, puestos, recibos]);

  // Búsqueda del término actual
  const queryLimpia = cleanPlate(searchTerm);

  const resultadoBusqueda = useMemo(() => {
    if (!queryLimpia) return null;

    // 1. Coincidencia exacta
    const exacto = vehiculosRegistrados.find(v => v.placaLimpia === queryLimpia);
    if (exacto) {
      return {
        encontrado: true,
        exacto: true,
        vehiculo: exacto,
        similares: []
      };
    }

    // 2. Coincidencias parciales (mientras escribe o si tiene letras parecidas)
    const parciales = vehiculosRegistrados.filter(v =>
      v.placaLimpia.includes(queryLimpia) || queryLimpia.includes(v.placaLimpia)
    );

    if (parciales.length > 0) {
      return {
        encontrado: true,
        exacto: false,
        vehiculo: parciales[0],
        similares: parciales
      };
    }

    // 3. No encontrado
    return {
      encontrado: false,
      exacto: false,
      vehiculo: null,
      similares: []
    };
  }, [queryLimpia, vehiculosRegistrados]);

  // Registrar en historial de consultas
  function registrarEnHistorial(placa, encontrado, nombreUsuario = null) {
    if (!placa) return;
    setHistorialConsultas(prev => {
      const filtered = prev.filter(item => cleanPlate(item.placa) !== cleanPlate(placa));
      return [
        {
          placa: placa.toUpperCase(),
          encontrado,
          nombreUsuario,
          hora: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        },
        ...filtered
      ].slice(0, 10);
    });
  }

  // Iniciar la cámara del dispositivo
  async function startCamera() {
    setCameraError('');
    setCameraLoading(true);
    stopCamera();

    try {
      const constraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play().catch(e => console.error('Error al reproducir video:', e));
          setCameraActive(true);
          setCameraLoading(false);
        };
      }
    } catch (err) {
      console.error('Error accediendo a la cámara:', err);
      setCameraError('No se pudo acceder a la cámara. Revisa los permisos del navegador o selecciona otra cámara.');
      setCameraLoading(false);
      setCameraActive(false);
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }

  function toggleFacingMode() {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
    setTimeout(() => {
      startCamera();
    }, 100);
  }

  // Capturar frame de la cámara y procesarlo con OCR
  async function handleCaptureAndScan() {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current || document.createElement('canvas');

    const videoWidth = video.videoWidth || 1280;
    const videoHeight = video.videoHeight || 720;

    // Recortar la zona central (área del marco visor)
    const cropWidth = Math.round(videoWidth * 0.7);
    const cropHeight = Math.round(cropWidth * 0.45);
    const cropX = Math.round((videoWidth - cropWidth) / 2);
    const cropY = Math.round((videoHeight - cropHeight) / 2);

    canvas.width = cropWidth;
    canvas.height = cropHeight;
    const ctx = canvas.getContext('2d');

    // Dibujar el frame recortado
    ctx.drawImage(video, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

    // Pre-procesar imagen en canvas: aumentar contraste y escala de grises para máxima precisión
    const imgData = ctx.getImageData(0, 0, cropWidth, cropHeight);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      const avg = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114);
      // Umbralizado / contraste alto
      const val = avg > 115 ? 255 : 0;
      d[i] = val;
      d[i + 1] = val;
      d[i + 2] = val;
    }
    ctx.putImageData(imgData, 0, 0);

    // Ejecutar reconocimiento OCR
    await processImageWithOCR(canvas.toDataURL('image/png'));
  }

  // Procesar archivo de imagen cargado
  async function handleFileSelected(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      await processImageWithOCR(event.target.result);
    };
    reader.readAsDataURL(file);
  }

  // Motor OCR Tesseract
  async function processImageWithOCR(imageDataUrl) {
    setOcrScanning(true);
    setOcrProgress('Cargando motor de reconocimiento OCR...');

    try {
      const Tesseract = await loadTesseractLibrary();

      setOcrProgress('Analizando caracteres y letras de la placa...');
      const worker = await Tesseract.createWorker('eng');
      await worker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789- '
      });

      const { data: { text } } = await worker.recognize(imageDataUrl);
      await worker.terminate();

      const placaExtraida = extractPlateFromText(text);

      if (placaExtraida) {
        setSearchTerm(placaExtraida);
        setOcrProgress(`¡Placa detectada: ${placaExtraida}!`);
        // Pausar cámara para mostrar resultado
        stopCamera();
        setActiveTab('manual');

        // Buscar resultado
        const clean = cleanPlate(placaExtraida);
        const match = vehiculosRegistrados.find(v => v.placaLimpia === clean);
        registrarEnHistorial(placaExtraida, Boolean(match), match?.usuario?.nombre);
      } else {
        setOcrProgress('No se pudo identificar un patrón de placa nítido. Intenta enfocar más de cerca o escribe manualmente.');
      }
    } catch (err) {
      console.error('Error en OCR:', err);
      setOcrProgress('Error al procesar la imagen: ' + err.message);
    } finally {
      setTimeout(() => setOcrScanning(false), 800);
    }
  }

  function handleManualSubmit(e) {
    e.preventDefault();
    if (!queryLimpia) return;
    const match = vehiculosRegistrados.find(v => v.placaLimpia === queryLimpia);
    registrarEnHistorial(searchTerm, Boolean(match), match?.usuario?.nombre);
  }

  return (
    <div className="page-enter">
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1>Control y Verificación de Placas</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
            Verifica al instante si un vehículo está registrado y autorizado en GoParking mediante búsqueda manual o escaneo por cámara.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={loadAllData}
          disabled={loadingData}
          title="Recargar base de datos de usuarios y puestos"
        >
          <RotateCw size={14} style={{ animation: loadingData ? 'spin 1s linear infinite' : 'none' }} />
          Actualizar Registros
        </button>
      </div>

      <div className="page-body">
        {/* Selector de Modos (Pestañas) */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
          <button
            type="button"
            className={`btn ${activeTab === 'manual' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => {
              setActiveTab('manual');
              stopCamera();
            }}
          >
            <Search size={16} /> Búsqueda Manual de Placa
          </button>

          <button
            type="button"
            className={`btn ${activeTab === 'camara' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => {
              setActiveTab('camara');
              startCamera();
            }}
          >
            <Camera size={16} /> Reconocer por Cámara
          </button>

          <button
            type="button"
            className={`btn ${activeTab === 'archivo' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => {
              setActiveTab('archivo');
              stopCamera();
            }}
          >
            <Upload size={16} /> Subir Foto de Placa
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24, alignItems: 'start' }}>
          
          {/* PANEL IZQUIERDO: CONTROLES DE BÚSQUEDA Y CÁMARA */}
          <div>
            {/* PESTAÑA: BÚSQUEDA MANUAL */}
            {activeTab === 'manual' && (
              <div className="card" style={{ marginBottom: 20 }}>
                <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <Search size={18} color="var(--accent-green)" />
                  Ingresar Placa Manualmente
                </h3>

                <form onSubmit={handleManualSubmit}>
                  <div style={{ position: 'relative', marginBottom: 12 }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Escribe la placa (Ej: ABC123, WXYZ45...)"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value.toUpperCase())}
                      style={{
                        fontSize: 20,
                        fontWeight: 900,
                        letterSpacing: 2,
                        textTransform: 'uppercase',
                        padding: '14px 44px 14px 16px',
                        background: 'rgba(0, 0, 0, 0.25)',
                        border: '2px solid rgba(22, 199, 83, 0.4)'
                      }}
                      autoFocus
                    />
                    {searchTerm && (
                      <button
                        type="button"
                        onClick={() => setSearchTerm('')}
                        style={{
                          position: 'absolute',
                          right: 12,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer'
                        }}
                      >
                        <X size={18} />
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button type="submit" className="btn btn-primary btn-full" style={{ padding: '12px' }}>
                      <Search size={16} /> Verificar Placa
                    </button>
                  </div>
                </form>

                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 12, marginBottom: 0 }}>
                  💡 Puedes escribir la placa con o sin guión (ejemplo: <code>ABC-123</code> o <code>ABC123</code>). El sistema lo detectará automáticamente.
                </p>
              </div>
            )}

            {/* PESTAÑA: ESCÁNER DE CÁMARA */}
            {activeTab === 'camara' && (
              <div className="card" style={{ marginBottom: 20, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h3 className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Camera size={18} color="var(--accent-cyan)" />
                    Reconocimiento Óptico (OCR)
                  </h3>

                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={toggleFacingMode}
                    title="Alternar entre cámara trasera y delantera"
                  >
                    <RefreshCw size={13} /> Cambiar Cámara
                  </button>
                </div>

                {/* Contenedor del Visor de Cámara */}
                <div
                  style={{
                    position: 'relative',
                    width: '100%',
                    height: 280,
                    borderRadius: 14,
                    overflow: 'hidden',
                    background: '#000',
                    border: '2px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <video
                    ref={videoRef}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: cameraActive ? 'block' : 'none'
                    }}
                    autoPlay
                    playsInline
                    muted
                  />

                  {/* Marco guía para la placa (Silueta amarilla reflectiva) */}
                  {cameraActive && (
                    <div
                      style={{
                        position: 'absolute',
                        width: '74%',
                        height: 90,
                        border: '3px solid #FDD835',
                        borderRadius: 10,
                        boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.55), 0 0 20px rgba(253, 216, 53, 0.5)',
                        pointerEvents: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <span
                        style={{
                          background: 'rgba(0, 0, 0, 0.75)',
                          color: '#FDD835',
                          fontSize: 10,
                          fontWeight: 800,
                          padding: '3px 8px',
                          borderRadius: 4,
                          letterSpacing: 0.8
                        }}
                      >
                        ENFOCA LA PLACA AQUÍ
                      </span>
                    </div>
                  )}

                  {/* Estado si la cámara está apagada o cargando */}
                  {(!cameraActive || cameraLoading) && (
                    <div style={{ textAlign: 'center', padding: 20 }}>
                      {cameraLoading ? (
                        <>
                          <div className="spinner" style={{ margin: '0 auto 10px' }} />
                          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Iniciando cámara...</p>
                        </>
                      ) : (
                        <>
                          <Camera size={44} color="var(--text-muted)" style={{ margin: '0 auto 10px' }} />
                          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
                            {cameraError || 'La cámara se encuentra detenida.'}
                          </p>
                          <button type="button" className="btn btn-primary btn-sm" onClick={startCamera}>
                            <Camera size={14} /> Activar Cámara
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Botones de acción de la cámara */}
                {cameraActive && (
                  <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
                    <button
                      type="button"
                      className="btn btn-primary btn-full"
                      onClick={handleCaptureAndScan}
                      disabled={ocrScanning}
                      style={{ padding: '12px', background: 'var(--accent-green)', borderColor: 'var(--accent-green)', color: '#fff' }}
                    >
                      {ocrScanning ? (
                        <>
                          <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                          Escaneando placa...
                        </>
                      ) : (
                        <>
                          <Sparkles size={16} /> Capturar y Escanear Placa
                        </>
                      )}
                    </button>

                    <button type="button" className="btn btn-ghost" onClick={stopCamera}>
                      Detener
                    </button>
                  </div>
                )}

                {ocrProgress && (
                  <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(56, 189, 248, 0.1)', borderRadius: 8, fontSize: 12, color: 'var(--accent-cyan)' }}>
                    {ocrProgress}
                  </div>
                )}
              </div>
            )}

            {/* PESTAÑA: SUBIR FOTO */}
            {activeTab === 'archivo' && (
              <div className="card" style={{ marginBottom: 20, textAlign: 'center', padding: 24 }}>
                <Upload size={38} color="var(--accent-cyan)" style={{ margin: '0 auto 10px' }} />
                <h3 className="card-title">Cargar Foto de Placa</h3>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                  Sube una foto o captura tomada desde tu dispositivo móvil para extraer la placa automáticamente con OCR.
                </p>

                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  onChange={handleFileSelected}
                />

                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={ocrScanning}
                >
                  {ocrScanning ? 'Analizando imagen...' : 'Seleccionar Imagen'}
                </button>

                {ocrProgress && (
                  <div style={{ marginTop: 16, padding: '8px 12px', background: 'rgba(56, 189, 248, 0.1)', borderRadius: 8, fontSize: 12, color: 'var(--accent-cyan)', textAlign: 'left' }}>
                    {ocrProgress}
                  </div>
                )}
              </div>
            )}

            {/* HISTORIAL RECIENTE DE LA SESIÓN */}
            {historialConsultas.length > 0 && (
              <div className="card">
                <h4 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 10px 0', color: 'var(--text-secondary)' }}>
                  🕒 Consultas Recientes de esta Sesión
                </h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {historialConsultas.map((item, idx) => (
                    <div
                      key={idx}
                      onClick={() => setSearchTerm(item.placa)}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 12px',
                        background: 'var(--bg-secondary)',
                        borderRadius: 8,
                        cursor: 'pointer',
                        border: '1px solid var(--border)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                          style={{
                            background: '#FDD835',
                            color: '#000',
                            fontFamily: 'monospace',
                            fontWeight: 900,
                            padding: '2px 6px',
                            borderRadius: 4,
                            fontSize: 12
                          }}
                        >
                          {item.placa}
                        </span>
                        {item.nombreUsuario && (
                          <span style={{ fontSize: 12, fontWeight: 600 }}>{item.nombreUsuario}</span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.hora}</span>
                        {item.encontrado ? (
                          <CheckCircle size={15} color="var(--accent-green)" />
                        ) : (
                          <XCircle size={15} color="var(--accent-red)" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* PANEL DERECHO: TARJETA DE RESULTADO DE VERIFICACIÓN */}
          <div>
            {searchTerm.trim() ? (
              resultadoBusqueda?.encontrado ? (
                /* VEHÍCULO REGISTRADO Y AUTORIZADO */
                <div
                  className="card"
                  style={{
                    border: '2px solid rgba(22, 199, 83, 0.5)',
                    background: 'linear-gradient(145deg, rgba(22, 199, 83, 0.1) 0%, rgba(6, 20, 15, 0.5) 100%)',
                    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.4)'
                  }}
                >
                  {/* Banner de Estado */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      background: 'rgba(22, 199, 83, 0.2)',
                      borderRadius: 10,
                      marginBottom: 16,
                      border: '1px solid rgba(22, 199, 83, 0.35)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <CheckCircle size={22} color="var(--accent-green)" />
                      <strong style={{ fontSize: 15, color: 'var(--accent-green)', letterSpacing: 0.5 }}>
                        VEHÍCULO AUTORIZADO
                      </strong>
                    </div>

                    <span
                      className={`badge ${
                        resultadoBusqueda.vehiculo.billing.status === 'al_dia'
                          ? 'badge-approved'
                          : resultadoBusqueda.vehiculo.billing.status === 'en_revision'
                          ? 'badge-review'
                          : 'badge-rejected'
                      }`}
                      style={{ fontSize: 12, fontWeight: 800 }}
                    >
                      {resultadoBusqueda.vehiculo.billing.status === 'al_dia'
                        ? '🟢 AL DÍA'
                        : resultadoBusqueda.vehiculo.billing.status === 'en_revision'
                        ? '🔵 EN REVISIÓN'
                        : '🔴 COBRO PENDIENTE'}
                    </span>
                  </div>

                  {/* Visualización de la Placa Colombiana */}
                  <div style={{ textAlign: 'center', marginBottom: 18 }}>
                    <div
                      style={{
                        display: 'inline-block',
                        background: '#FDD835',
                        color: '#000',
                        padding: '8px 24px',
                        borderRadius: 8,
                        border: '3px solid #C0CA33',
                        boxShadow: '0 4px 15px rgba(0,0,0,0.5)'
                      }}
                    >
                      <span style={{ fontSize: 10, fontWeight: 900, display: 'block', letterSpacing: 2, opacity: 0.7 }}>
                        COLOMBIA
                      </span>
                      <span style={{ fontSize: 28, fontWeight: 900, fontFamily: 'monospace', letterSpacing: 4 }}>
                        {resultadoBusqueda.vehiculo.placaOriginal}
                      </span>
                    </div>
                  </div>

                  {/* Datos del Propietario */}
                  <div
                    style={{
                      background: 'var(--bg-secondary)',
                      borderRadius: 10,
                      padding: '14px 16px',
                      marginBottom: 14,
                      border: '1px solid var(--border)'
                    }}
                  >
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                      Titular Registrado
                    </span>
                    <h3 style={{ fontSize: 18, fontWeight: 800, margin: '4px 0 2px 0', color: 'var(--text-primary)' }}>
                      {resultadoBusqueda.vehiculo.usuario.nombre}
                    </h3>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
                      Cédula: <strong>{resultadoBusqueda.vehiculo.usuario.cedula || 'No registrada'}</strong>
                    </p>

                    {(resultadoBusqueda.vehiculo.usuario.celular || resultadoBusqueda.vehiculo.usuario.telefono) && (
                      <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
                        <a
                          href={`tel:${resultadoBusqueda.vehiculo.usuario.celular || resultadoBusqueda.vehiculo.usuario.telefono}`}
                          className="btn btn-ghost btn-sm"
                          style={{ fontSize: 12 }}
                        >
                          <Phone size={13} /> Llamar ({resultadoBusqueda.vehiculo.usuario.celular || resultadoBusqueda.vehiculo.usuario.telefono})
                        </a>
                        <a
                          href={`https://wa.me/57${String(resultadoBusqueda.vehiculo.usuario.celular || resultadoBusqueda.vehiculo.usuario.telefono).replace(/\D/g, '').slice(-10)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-sm"
                          style={{
                            background: 'rgba(37, 211, 102, 0.15)',
                            color: '#25D366',
                            border: '1px solid rgba(37, 211, 102, 0.35)',
                            fontSize: 12
                          }}
                        >
                          <MessageSquare size={13} /> WhatsApp
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Bahía y Puesto Asignado */}
                  <div
                    style={{
                      background: 'var(--bg-secondary)',
                      borderRadius: 10,
                      padding: '14px 16px',
                      marginBottom: 14,
                      border: '1px solid var(--border)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <MapPin size={12} color="var(--accent-cyan)" /> Puesto / Bahía Asignada
                      </span>
                      <div style={{ marginTop: 4 }}>
                        {resultadoBusqueda.vehiculo.puestos.length > 0 ? (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {resultadoBusqueda.vehiculo.puestos.map(p => (
                              <span
                                key={p.id}
                                style={{
                                  fontSize: 18,
                                  fontWeight: 900,
                                  color: 'var(--accent-cyan)',
                                  background: 'rgba(56, 189, 248, 0.15)',
                                  padding: '2px 10px',
                                  borderRadius: 6
                                }}
                              >
                                Bahía #{p.numero} ({p.tipo})
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ fontSize: 14, color: 'var(--accent-yellow)', fontWeight: 700 }}>
                            Sin puesto asignado fijo
                          </span>
                        )}
                      </div>
                    </div>

                    <Link to="/admin/puestos" className="btn btn-ghost btn-sm" title="Ver en el mapa de puestos">
                      Ver mapa <ChevronRight size={14} />
                    </Link>
                  </div>

                  {/* Estado Financiero y Próximo Corte */}
                  <div
                    style={{
                      background: 'var(--bg-secondary)',
                      borderRadius: 10,
                      padding: '14px 16px',
                      marginBottom: 16,
                      border: '1px solid var(--border)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        📅 Corte mensual: Día {resultadoBusqueda.vehiculo.billing.billingDay} de cada mes
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>
                        ${Number(resultadoBusqueda.vehiculo.usuario.valor_tarifa || 0).toLocaleString('es-CO')} COP
                      </span>
                    </div>

                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
                      {resultadoBusqueda.vehiculo.billing.message}
                    </p>
                  </div>

                  {/* Botón rápido para marcar como pagado */}
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      type="button"
                      className="btn btn-primary btn-full"
                      style={{ background: 'var(--accent-green)', borderColor: 'var(--accent-green)', color: '#fff' }}
                      onClick={() => {
                        setUsuarioParaPago(resultadoBusqueda.vehiculo.usuario);
                        setModalPagoOpen(true);
                      }}
                    >
                      <CreditCard size={15} /> Registrar Pago de Mensualidad
                    </button>
                  </div>
                </div>
              ) : (
                /* VEHÍCULO NO REGISTRADO */
                <div
                  className="card"
                  style={{
                    border: '2px solid rgba(239, 68, 68, 0.5)',
                    background: 'linear-gradient(145deg, rgba(239, 68, 68, 0.1) 0%, rgba(20, 6, 6, 0.5) 100%)',
                    textAlign: 'center',
                    padding: 28
                  }}
                >
                  <XCircle size={56} color="var(--accent-red)" style={{ margin: '0 auto 14px' }} />
                  <h3 style={{ fontSize: 20, fontWeight: 900, color: 'var(--accent-red)', margin: '0 0 8px 0' }}>
                    VEHÍCULO NO REGISTRADO
                  </h3>

                  <div style={{ margin: '14px 0' }}>
                    <span
                      style={{
                        background: '#334155',
                        color: '#f8fafc',
                        fontFamily: 'monospace',
                        fontWeight: 900,
                        fontSize: 22,
                        padding: '6px 16px',
                        borderRadius: 6,
                        letterSpacing: 2
                      }}
                    >
                      {searchTerm.toUpperCase()}
                    </span>
                  </div>

                  <p style={{ fontSize: 14, color: 'var(--text-secondary)', maxWidth: 380, margin: '0 auto 20px', lineHeight: 1.5 }}>
                    Esta placa no corresponde a ningún cliente activo ni tiene autorización de ingreso registrada en el sistema de GoParking.
                  </p>

                  <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <Link
                      to="/admin/usuarios"
                      className="btn btn-primary"
                      style={{ background: 'var(--accent-cyan)', borderColor: 'var(--accent-cyan)', color: '#000', fontWeight: 700 }}
                    >
                      <Plus size={16} /> Registrar Nuevo Cliente
                    </Link>
                  </div>
                </div>
              )
            ) : (
              /* ESTADO INICIAL / EN ESPERA */
              <div
                className="card"
                style={{
                  textAlign: 'center',
                  padding: 40,
                  border: '1px dashed var(--border)'
                }}
              >
                <Car size={48} color="var(--text-muted)" style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 6px 0', color: 'var(--text-primary)' }}>
                  En espera de placa
                </h3>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 320, margin: '0 auto' }}>
                  Escribe una placa en el buscador o activa la cámara para escanear y comprobar si el vehículo está autorizado en el parqueadero.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Registrar Pago si el cliente paga al momento del ingreso */}
      <ModalRegistrarPago
        isOpen={modalPagoOpen}
        onClose={() => setModalPagoOpen(false)}
        onSuccess={(data, user) => {
          loadAllData();
        }}
        usuarioInicial={usuarioParaPago}
        usuariosDisponibles={usuarios}
      />
    </div>
  );
}
