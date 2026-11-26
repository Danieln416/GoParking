import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Camera,
  Search,
  CheckCircle,
  XCircle,
  Car,
  Bike,
  Phone,
  MessageSquare,
  MapPin,
  CreditCard,
  RotateCw,
  RefreshCw,
  Upload,
  X,
  Plus,
  Sparkles,
  ChevronRight,
  Flashlight,
  FlashlightOff,
  Pause,
  Play,
  ShieldCheck
} from 'lucide-react';
import { apiGetUsuarios, apiGetPuestos, apiGetRecibos } from '../../api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { getUserBillingInfo } from '../../utils/periodo.js';
import {
  cleanPlate,
  extractPlateFromText,
  preprocessImageForOCR,
  isNightTime
} from '../../utils/placas.js';
import ModalRegistrarPago from '../../components/ModalRegistrarPago.jsx';
import { Link } from 'react-router-dom';

const LOW_LIGHT_LUMA_THRESHOLD = 80;
const BRIGHT_LIGHT_LUMA_THRESHOLD = 145;
const AUTO_SCAN_INTERVAL_MS = 650;
const SAME_PLATE_COOLDOWN_MS = 4000;

function loadTesseractLibrary() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  return new Promise((resolve, reject) => {
    const existing = document.getElementById('tesseract-cdn-script');
    if (existing) {
      if (window.Tesseract) {
        resolve(window.Tesseract);
        return;
      }
      existing.addEventListener('load', () => resolve(window.Tesseract), { once: true });
      existing.addEventListener('error', () => reject(new Error('Error al cargar OCR')), { once: true });
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
  const { user } = useAuth();
  const isAdmin = user?.rol === 'admin';

  const [activeTab, setActiveTab] = useState('manual'); // 'manual' | 'camara' | 'archivo'
  const [searchTerm, setSearchTerm] = useState('');
  const [usuarios, setUsuarios] = useState([]);
  const [puestos, setPuestos] = useState([]);
  const [recibos, setRecibos] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  // Cámara, Flash y OCR automático
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [ocrScanning, setOcrScanning] = useState(false);
  const [ocrProgress, setOcrProgress] = useState('');
  const [facingMode, setFacingMode] = useState('environment');
  const [autoScan, setAutoScan] = useState(true);
  const [flashMode, setFlashMode] = useState('auto'); // 'auto' | 'on' | 'off'
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchActive, setTorchActive] = useState(false);
  const [flashNote, setFlashNote] = useState('');
  const [lastAutoDetection, setLastAutoDetection] = useState(null);

  // Modal para registrar pago (solo admin)
  const [modalPagoOpen, setModalPagoOpen] = useState(false);
  const [usuarioParaPago, setUsuarioParaPago] = useState(null);

  // Historial de escaneos de la sesión
  const [historialConsultas, setHistorialConsultas] = useState([]);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const ocrWorkerRef = useRef(null);
  const ocrWorkerPromiseRef = useRef(null);
  const scanBusyRef = useRef(false);
  const torchActiveRef = useRef(false);
  const brightFramesRef = useRef(0);
  const lastDetectedRef = useRef({ plate: '', timestamp: 0 });

  const vehiculosRegistrados = useMemo(() => {
    const list = [];
    usuarios.forEach(u => {
      if (u.rol === 'admin') return;
      const estaActivo = Number(u.activo) !== 0 && String(u.activo) !== 'false';
      if (!isAdmin && !estaActivo) return;

      const userPuestos = isAdmin ? puestos.filter(p => String(p.usuario_id) === String(u.id)) : [];
      const userReceipts = isAdmin ? recibos.filter(r => String(r.usuario_id) === String(u.id)) : [];
      const billing = isAdmin ? getUserBillingInfo(u.fecha_inicio, new Date(), userReceipts) : null;
      const safeUsuario = isAdmin ? u : null;

      if (u.placa_carro) {
        list.push({
          placaOriginal: u.placa_carro,
          placaLimpia: cleanPlate(u.placa_carro),
          tipoVehiculo: 'Carro',
          usuario: safeUsuario,
          puestos: userPuestos,
          billing,
          activo: estaActivo
        });
      }

      if (u.placa_moto) {
        list.push({
          placaOriginal: u.placa_moto,
          placaLimpia: cleanPlate(u.placa_moto),
          tipoVehiculo: 'Moto',
          usuario: safeUsuario,
          puestos: userPuestos,
          billing,
          activo: estaActivo
        });
      }

      if (u.placa && !u.placa_carro && !u.placa_moto) {
        const esMoto = String(u.tipo_vehiculo || '').toLowerCase().includes('moto');
        list.push({
          placaOriginal: u.placa,
          placaLimpia: cleanPlate(u.placa),
          tipoVehiculo: esMoto ? 'Moto' : (u.tipo_vehiculo || 'Vehículo'),
          usuario: safeUsuario,
          puestos: userPuestos,
          billing,
          activo: estaActivo
        });
      }
    });

    return list;
  }, [usuarios, puestos, recibos, isAdmin]);

  const registeredPlatesList = useMemo(
    () => vehiculosRegistrados.map(v => v.placaLimpia).filter(Boolean),
    [vehiculosRegistrados]
  );

  const vehiculosRef = useRef(vehiculosRegistrados);
  const registeredPlatesRef = useRef(registeredPlatesList);
  useEffect(() => {
    vehiculosRef.current = vehiculosRegistrados;
    registeredPlatesRef.current = registeredPlatesList;
  }, [vehiculosRegistrados, registeredPlatesList]);

  const ensureOcrWorker = useCallback(async () => {
    if (ocrWorkerRef.current) return ocrWorkerRef.current;
    if (ocrWorkerPromiseRef.current) return ocrWorkerPromiseRef.current;

    ocrWorkerPromiseRef.current = (async () => {
      const Tesseract = await loadTesseractLibrary();
      const worker = await Tesseract.createWorker('eng');
      await worker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789- ',
        tessedit_pageseg_mode: '11'
      });
      ocrWorkerRef.current = worker;
      return worker;
    })();

    try {
      return await ocrWorkerPromiseRef.current;
    } catch (err) {
      ocrWorkerPromiseRef.current = null;
      throw err;
    }
  }, []);

  const applyTorch = useCallback(async (track, enable, reasonText = '') => {
    if (!track || typeof track.applyConstraints !== 'function') return false;
    const caps = typeof track.getCapabilities === 'function' ? track.getCapabilities() : null;
    if (!caps?.torch) return false;
    if (torchActiveRef.current === enable) return true;

    try {
      await track.applyConstraints({ advanced: [{ torch: enable }] });
      torchActiveRef.current = enable;
      setTorchActive(enable);
      setFlashNote(enable && reasonText ? reasonText : '');
      return true;
    } catch {
      return false;
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      const tracks = streamRef.current.getTracks();
      tracks.forEach(track => {
        if (torchActiveRef.current && typeof track.applyConstraints === 'function') {
          track.applyConstraints({ advanced: [{ torch: false }] }).catch(() => {});
        }
        track.stop();
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    torchActiveRef.current = false;
    brightFramesRef.current = 0;
    setTorchActive(false);
    setTorchSupported(false);
    setFlashNote('');
    setCameraActive(false);
    setCameraLoading(false);
  }, []);

  const loadAllData = useCallback(async () => {
    setLoadingData(true);
    try {
      if (isAdmin) {
        const [uRes, pRes, rRes] = await Promise.all([
          apiGetUsuarios(),
          apiGetPuestos(),
          apiGetRecibos('all')
        ]);

        if (uRes.success) setUsuarios(uRes.data || []);
        if (pRes.success) setPuestos(pRes.data || []);
        if (rRes.success) setRecibos(rRes.data || []);
      } else {
        const uRes = await apiGetUsuarios();
        if (uRes.success) setUsuarios(uRes.data || []);
      }
    } catch (e) {
      console.error('Error cargando datos de control de placas:', e);
    } finally {
      setLoadingData(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadAllData();
    return () => {
      stopCamera();
      if (ocrWorkerRef.current) {
        ocrWorkerRef.current.terminate().catch(() => {});
        ocrWorkerRef.current = null;
      }
    };
  }, [loadAllData, stopCamera]);

  const queryLimpia = cleanPlate(searchTerm);

  const resultadoBusqueda = useMemo(() => {
    if (!queryLimpia) return null;

    const exacto = vehiculosRegistrados.find(v => v.placaLimpia === queryLimpia);
    if (exacto) {
      return {
        encontrado: true,
        exacto: true,
        vehiculo: exacto,
        similares: []
      };
    }

    // Para usuarios estándar solo se valida coincidencia exacta de placa completa
    if (!isAdmin) {
      return {
        encontrado: false,
        incompleto: queryLimpia.length < 5,
        exacto: false,
        vehiculo: null,
        similares: []
      };
    }

    const parciales = vehiculosRegistrados.filter(
      v => v.placaLimpia.includes(queryLimpia) || queryLimpia.includes(v.placaLimpia)
    );

    if (parciales.length > 0) {
      return {
        encontrado: true,
        exacto: false,
        vehiculo: parciales[0],
        similares: parciales
      };
    }

    return {
      encontrado: false,
      exacto: false,
      vehiculo: null,
      similares: []
    };
  }, [queryLimpia, vehiculosRegistrados, isAdmin]);

  const registrarEnHistorial = useCallback((placa, encontrado, nombreUsuario = null, tipoVehiculo = null) => {
    if (!placa) return;
    setHistorialConsultas(prev => {
      const filtered = prev.filter(item => cleanPlate(item.placa) !== cleanPlate(placa));
      return [
        {
          placa: placa.toUpperCase(),
          encontrado,
          nombreUsuario,
          tipoVehiculo,
          hora: new Date().toLocaleTimeString('es-CO', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          })
        },
        ...filtered
      ].slice(0, 10);
    });
  }, []);

  const handleRecognizedPlate = useCallback((placaExtraida, fromAutoLoop = false) => {
    const clean = cleanPlate(placaExtraida);
    if (!clean) return;

    const now = Date.now();
    if (
      fromAutoLoop &&
      lastDetectedRef.current.plate === clean &&
      now - lastDetectedRef.current.timestamp < SAME_PLATE_COOLDOWN_MS
    ) {
      return;
    }

    lastDetectedRef.current = { plate: clean, timestamp: now };
    const match = vehiculosRef.current.find(v => v.placaLimpia === clean) || null;

    setSearchTerm(clean);
    setOcrProgress(`¡Placa detectada automáticamente: ${clean}!`);
    setLastAutoDetection({
      placa: clean,
      encontrado: Boolean(match),
      vehiculo: isAdmin ? match : null,
      hora: new Date().toLocaleTimeString('es-CO', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    });
    registrarEnHistorial(
      clean,
      Boolean(match),
      isAdmin ? match?.usuario?.nombre : null,
      isAdmin ? match?.tipoVehiculo : null
    );
  }, [isAdmin, registrarEnHistorial]);

  async function startCamera(nextFacingMode = facingMode) {
    stopCamera();
    setCameraError('');
    setCameraLoading(true);
    setLastAutoDetection(null);

    try {
      const constraints = {
        video: {
          facingMode: { ideal: nextFacingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
          focusMode: { ideal: 'continuous' }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      const videoTrack = stream.getVideoTracks()[0];
      const caps = typeof videoTrack?.getCapabilities === 'function' ? videoTrack.getCapabilities() : null;
      const canTorch = Boolean(caps?.torch);
      setTorchSupported(canTorch);

      if (canTorch && (flashMode === 'on' || (flashMode === 'auto' && isNightTime()))) {
        await applyTorch(
          videoTrack,
          true,
          flashMode === 'auto' ? 'Flash encendido automáticamente (horario nocturno)' : 'Flash encendido manualmente'
        );
      } else if (!canTorch && isNightTime()) {
        setFlashNote('Este dispositivo/navegador no permite controlar el flash desde la web.');
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current
            ?.play()
            .then(() => {
              setCameraActive(true);
              setCameraLoading(false);
              setOcrProgress(
                autoScan
                  ? 'Cámara completa activa: apunta hacia la placa (carro o moto), la detectará automáticamente.'
                  : 'Cámara activa. Presiona "Escanear Ahora" o activa el escaneo automático.'
              );
            })
            .catch(e => {
              console.error('Error al reproducir video:', e);
              setCameraLoading(false);
            });
        };
      } else {
        setCameraLoading(false);
      }
    } catch (err) {
      console.error('Error accediendo a la cámara:', err);
      setCameraError('No se pudo acceder a la cámara. Revisa los permisos del navegador o selecciona otra cámara.');
      setCameraLoading(false);
      setCameraActive(false);
    }
  }

  function toggleFacingMode() {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
    startCamera(next);
  }

  async function cycleFlashMode() {
    const order = ['auto', 'on', 'off'];
    const nextMode = order[(order.indexOf(flashMode) + 1) % order.length];
    setFlashMode(nextMode);

    const track = streamRef.current?.getVideoTracks?.()[0];
    if (!track) return;

    const caps = typeof track.getCapabilities === 'function' ? track.getCapabilities() : null;
    if (!caps?.torch) {
      setFlashNote('Flash no disponible en esta cámara/navegador.');
      return;
    }

    if (nextMode === 'on') {
      await applyTorch(track, true, 'Flash encendido manualmente');
    } else if (nextMode === 'off') {
      await applyTorch(track, false);
      setFlashNote('Flash apagado manualmente');
    } else {
      const night = isNightTime();
      await applyTorch(track, night, night ? 'Flash automático (noche)' : '');
    }
  }

  const runOcrPassOnSource = useCallback(async (source, options = { allowAdaptiveFallback: true }) => {
    const canvas = canvasRef.current || document.createElement('canvas');
    canvasRef.current = canvas;

    const worker = await ensureOcrWorker();
    const { meanLuma } = preprocessImageForOCR(source, canvas, 'contrast');

    // Control automático de flash según horario nocturno o baja iluminación detectada
    const track = streamRef.current?.getVideoTracks?.()[0];
    if (track && flashMode === 'auto' && torchSupported) {
      const night = isNightTime();
      if (night || meanLuma < LOW_LIGHT_LUMA_THRESHOLD) {
        brightFramesRef.current = 0;
        await applyTorch(
          track,
          true,
          night ? 'Flash activo (modo noche)' : 'Flash activo (poca luz detectada)'
        );
      } else if (!night && meanLuma > BRIGHT_LIGHT_LUMA_THRESHOLD && torchActiveRef.current) {
        brightFramesRef.current += 1;
        if (brightFramesRef.current >= 3) {
          brightFramesRef.current = 0;
          await applyTorch(track, false);
        }
      } else {
        brightFramesRef.current = 0;
      }
    }

    const pass1 = await worker.recognize(canvas);
    let placa = extractPlateFromText(pass1?.data?.text || '', registeredPlatesRef.current);

    if (!placa && options.allowAdaptiveFallback) {
      preprocessImageForOCR(source, canvas, 'adaptive');
      const pass2 = await worker.recognize(canvas);
      placa = extractPlateFromText(pass2?.data?.text || '', registeredPlatesRef.current);
    }

    return placa;
  }, [applyTorch, ensureOcrWorker, flashMode, torchSupported]);

  // Bucle automático continuo mientras la cámara está abierta
  useEffect(() => {
    if (activeTab !== 'camara' || !cameraActive || !autoScan) return;

    let cancelled = false;
    let timerId = null;

    async function tick() {
      if (cancelled) return;
      const video = videoRef.current;

      if (video && video.readyState >= 2 && video.videoWidth > 0 && !scanBusyRef.current) {
        scanBusyRef.current = true;
        try {
          const placa = await runOcrPassOnSource(video, { allowAdaptiveFallback: true });
          if (!cancelled && placa) {
            handleRecognizedPlate(placa, true);
          }
        } catch (err) {
          if (!cancelled) {
            console.warn('Error en escaneo automático:', err);
          }
        } finally {
          scanBusyRef.current = false;
        }
      }

      if (!cancelled) {
        timerId = setTimeout(tick, AUTO_SCAN_INTERVAL_MS);
      }
    }

    timerId = setTimeout(tick, 350);
    return () => {
      cancelled = true;
      if (timerId) clearTimeout(timerId);
    };
  }, [activeTab, cameraActive, autoScan, runOcrPassOnSource, handleRecognizedPlate]);

  async function handleCaptureAndScan() {
    if (!videoRef.current || scanBusyRef.current) return;
    scanBusyRef.current = true;
    setOcrScanning(true);
    setOcrProgress('Analizando cuadro completo de la cámara...');

    try {
      const placa = await runOcrPassOnSource(videoRef.current, { allowAdaptiveFallback: true });
      if (placa) {
        handleRecognizedPlate(placa, false);
      } else {
        setOcrProgress('No se identificó una placa nítida aún. Acerca un poco o verifica la iluminación.');
      }
    } catch (err) {
      console.error('Error en OCR:', err);
      setOcrProgress('Error al procesar la imagen: ' + err.message);
    } finally {
      scanBusyRef.current = false;
      setOcrScanning(false);
    }
  }

  async function handleFileSelected(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setOcrScanning(true);
    setOcrProgress('Cargando foto y ejecutando OCR (carros y motos)...');

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = async () => {
      try {
        const placa = await runOcrPassOnSource(img, { allowAdaptiveFallback: true });
        if (placa) {
          handleRecognizedPlate(placa, false);
        } else {
          setOcrProgress('No se pudo identificar un patrón de placa en la foto. Intenta con una toma más nítida o escríbela manualmente.');
        }
      } catch (err) {
        console.error('Error en OCR de archivo:', err);
        setOcrProgress('Error al procesar la imagen: ' + err.message);
      } finally {
        URL.revokeObjectURL(objectUrl);
        setOcrScanning(false);
        if (e.target) e.target.value = '';
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setOcrScanning(false);
      setOcrProgress('No fue posible leer el archivo de imagen seleccionado.');
    };
    img.src = objectUrl;
  }

  function handleManualSubmit(e) {
    e.preventDefault();
    if (!queryLimpia) return;
    const match = vehiculosRegistrados.find(v => v.placaLimpia === queryLimpia);
    registrarEnHistorial(
      searchTerm,
      Boolean(match),
      isAdmin ? match?.usuario?.nombre : null,
      isAdmin ? match?.tipoVehiculo : null
    );
  }

  const flashLabel =
    flashMode === 'auto'
      ? (torchActive ? 'Flash: Auto (ON)' : 'Flash: Auto')
      : flashMode === 'on'
      ? 'Flash: ON'
      : 'Flash: OFF';

  return (
    <div className="page-enter">
      {/* Header */}
      <div
        className="page-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          height: 'auto',
          minHeight: 'var(--header-h)',
          paddingTop: 12,
          paddingBottom: 12
        }}
      >
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 8, textWrap: 'balance' }}>
            <ShieldCheck size={22} color="var(--accent-green)" aria-hidden="true" />
            {isAdmin ? 'Control y Verificación de Placas' : 'Verificar Usuario del Parqueadero'}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
            {isAdmin
              ? 'Verifica al instante si un carro o moto está registrado en GoParking mediante búsqueda manual o cámara automática.'
              : 'Consulta si un carro o moto pertenece al parqueadero escribiendo la placa, usando la cámara automática o subiendo una foto.'}
          </p>
        </div>

        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={loadAllData}
          disabled={loadingData}
          style={{ minHeight: 44 }}
          title="Recargar base de datos de usuarios y puestos"
        >
          <RotateCw size={14} style={{ animation: loadingData ? 'spin 1s linear infinite' : 'none' }} aria-hidden="true" />
          Actualizar Registros
        </button>
      </div>

      <div className="page-body">
        {/* Selector de Modos (Pestañas) */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 10,
            marginBottom: 20,
            borderBottom: '1px solid var(--border)',
            paddingBottom: 12
          }}
        >
          <button
            type="button"
            className={`btn ${activeTab === 'manual' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ minHeight: 44 }}
            onClick={() => {
              setActiveTab('manual');
              stopCamera();
            }}
          >
            <Search size={16} aria-hidden="true" /> Búsqueda Manual
          </button>

          <button
            type="button"
            className={`btn ${activeTab === 'camara' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ minHeight: 44 }}
            onClick={() => {
              setActiveTab('camara');
              startCamera();
            }}
          >
            <Camera size={16} aria-hidden="true" /> Cámara Automática
          </button>

          <button
            type="button"
            className={`btn ${activeTab === 'archivo' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ minHeight: 44 }}
            onClick={() => {
              setActiveTab('archivo');
              stopCamera();
            }}
          >
            <Upload size={16} aria-hidden="true" /> Subir Foto de Placa
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24, alignItems: 'start' }}>
          {/* PANEL IZQUIERDO: CONTROLES DE BÚSQUEDA Y CÁMARA */}
          <div>
            {/* PESTAÑA: BÚSQUEDA MANUAL */}
            {activeTab === 'manual' && (
              <div className="card" style={{ marginBottom: 20 }}>
                <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <Search size={18} color="var(--accent-green)" aria-hidden="true" />
                  Ingresar Placa (Carro o Moto)
                </h2>

                <form onSubmit={handleManualSubmit}>
                  <label htmlFor="placa-search-input" style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
                    Número de placa
                  </label>
                  <div style={{ position: 'relative', marginBottom: 12 }}>
                    <input
                      id="placa-search-input"
                      type="text"
                      className="form-input"
                      placeholder="Ej: ABC123 o QHH36G..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value.toUpperCase())}
                      style={{
                        fontSize: 20,
                        fontWeight: 900,
                        letterSpacing: 2,
                        textTransform: 'uppercase',
                        padding: '14px 48px 14px 16px',
                        background: 'rgba(0, 0, 0, 0.25)',
                        border: '2px solid rgba(22, 199, 83, 0.4)'
                      }}
                      autoFocus
                    />
                    {searchTerm && (
                      <button
                        type="button"
                        aria-label="Limpiar placa buscada"
                        onClick={() => setSearchTerm('')}
                        style={{
                          position: 'absolute',
                          right: 8,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          minWidth: 36,
                          minHeight: 36,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <X size={18} aria-hidden="true" />
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button type="submit" className="btn btn-primary btn-full" style={{ padding: '12px', minHeight: 44 }}>
                      <Search size={16} aria-hidden="true" /> Verificar Placa
                    </button>
                  </div>
                </form>

                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 12, marginBottom: 0 }}>
                  Soporta placas de carro (<code>ABC123</code>) y moto (<code>ABC12D</code>, <code>ABC12</code>), con o sin guión.
                </p>
              </div>
            )}

            {/* PESTAÑA: ESCÁNER DE CÁMARA COMPLETA Y AUTOMÁTICO */}
            {activeTab === 'camara' && (
              <div className="card" style={{ marginBottom: 20, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                  <h2 className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Camera size={18} color="var(--accent-cyan)" aria-hidden="true" />
                    Cámara Completa Automática
                  </h2>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className={`btn btn-sm ${torchActive ? 'btn-warning' : 'btn-ghost'}`}
                      style={{ minHeight: 38 }}
                      onClick={cycleFlashMode}
                      title="Alternar flash: Automático de noche / Encendido / Apagado"
                    >
                      {torchActive ? <Flashlight size={14} aria-hidden="true" /> : <FlashlightOff size={14} aria-hidden="true" />}
                      {flashLabel}
                    </button>

                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ minHeight: 38 }}
                      onClick={toggleFacingMode}
                      title="Alternar entre cámara trasera y delantera"
                    >
                      <RefreshCw size={13} aria-hidden="true" /> Cámara
                    </button>
                  </div>
                </div>

                {/* Contenedor de toda la cámara (sin recorte de cuadrito oscuro) */}
                <div
                  style={{
                    position: 'relative',
                    width: '100%',
                    minHeight: 280,
                    maxHeight: '62vh',
                    borderRadius: 14,
                    overflow: 'hidden',
                    background: '#000',
                    border: lastAutoDetection
                      ? `2px solid ${lastAutoDetection.encontrado ? '#16c753' : '#ef4444'}`
                      : '2px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <video
                    ref={videoRef}
                    style={{
                      width: '100%',
                      height: 'auto',
                      maxHeight: '62vh',
                      objectFit: 'contain',
                      display: cameraActive ? 'block' : 'none'
                    }}
                    autoPlay
                    playsInline
                    muted
                  />

                  {/* Indicadores sutiles en las esquinas exteriores (dejan toda la cámara visible) */}
                  {cameraActive && (
                    <>
                      <div
                        style={{
                          position: 'absolute',
                          inset: 10,
                          border: '1px dashed rgba(253, 216, 53, 0.35)',
                          borderRadius: 10,
                          pointerEvents: 'none'
                        }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          top: 14,
                          left: 14,
                          right: 14,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 8,
                          flexWrap: 'wrap',
                          pointerEvents: 'none'
                        }}
                      >
                        <span
                          style={{
                            background: 'rgba(6, 16, 30, 0.8)',
                            color: autoScan ? '#16c753' : '#f59e0b',
                            fontSize: 11,
                            fontWeight: 800,
                            padding: '4px 10px',
                            borderRadius: 999,
                            border: '1px solid rgba(255,255,255,0.12)'
                          }}
                        >
                          {autoScan ? '● AUTO-ESCANEO ACTIVO (CARROS Y MOTOS)' : '❚❚ AUTO-ESCANEO EN PAUSA'}
                        </span>

                        {torchActive && (
                          <span
                            style={{
                              background: 'rgba(245, 158, 11, 0.9)',
                              color: '#000',
                              fontSize: 11,
                              fontWeight: 800,
                              padding: '4px 10px',
                              borderRadius: 999
                            }}
                          >
                            ⚡ FLASH ACTIVO
                          </span>
                        )}
                      </div>
                    </>
                  )}

                  {/* Estado si la cámara está apagada o cargando */}
                  {(!cameraActive || cameraLoading) && (
                    <div style={{ textAlign: 'center', padding: 24 }}>
                      {cameraLoading ? (
                        <>
                          <div className="spinner" style={{ margin: '0 auto 10px' }} />
                          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Iniciando cámara y modo nocturno...</p>
                        </>
                      ) : (
                        <>
                          <Camera size={44} color="var(--text-muted)" style={{ margin: '0 auto 10px' }} aria-hidden="true" />
                          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
                            {cameraError || 'La cámara se encuentra detenida.'}
                          </p>
                          <button type="button" className="btn btn-primary btn-sm" style={{ minHeight: 44 }} onClick={() => startCamera()}>
                            <Camera size={14} aria-hidden="true" /> Activar Cámara
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Banner instantáneo cuando se detecta una placa automáticamente */}
                {lastAutoDetection && (
                  <div
                    role="status"
                    aria-live="polite"
                    style={{
                      marginTop: 12,
                      padding: '10px 14px',
                      borderRadius: 10,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 10,
                      background: lastAutoDetection.encontrado ? 'rgba(22, 199, 83, 0.16)' : 'rgba(239, 68, 68, 0.16)',
                      border: `1px solid ${lastAutoDetection.encontrado ? 'rgba(22, 199, 83, 0.45)' : 'rgba(239, 68, 68, 0.45)'}`
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span
                        style={{
                          background: '#FDD835',
                          color: '#000',
                          fontFamily: 'monospace',
                          fontWeight: 900,
                          fontSize: 15,
                          padding: '3px 9px',
                          borderRadius: 5,
                          letterSpacing: 1
                        }}
                      >
                        {lastAutoDetection.placa}
                      </span>
                      <div style={{ fontSize: 13 }}>
                        <strong style={{ color: lastAutoDetection.encontrado ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                          {lastAutoDetection.encontrado
                            ? (isAdmin ? 'AUTORIZADO' : 'ES USUARIO DEL PARQUEADERO')
                            : 'NO REGISTRADO'}
                        </strong>
                        {isAdmin && lastAutoDetection.vehiculo?.usuario && (
                          <span style={{ color: 'var(--text-primary)', marginLeft: 8 }}>
                            · {lastAutoDetection.vehiculo.usuario.nombre}
                            {lastAutoDetection.vehiculo.puestos?.[0]
                              ? ` (Bahía #${lastAutoDetection.vehiculo.puestos[0].numero})`
                              : ''}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ minHeight: 36 }}
                      onClick={() => {
                        setLastAutoDetection(null);
                        setSearchTerm('');
                        lastDetectedRef.current = { plate: '', timestamp: 0 };
                      }}
                    >
                      Limpiar
                    </button>
                  </div>
                )}

                {/* Botones de acción de la cámara */}
                {cameraActive && (
                  <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className={`btn ${autoScan ? 'btn-ghost' : 'btn-primary'}`}
                      style={{ minHeight: 44, flex: '1 1 160px' }}
                      onClick={() => setAutoScan(prev => !prev)}
                    >
                      {autoScan ? <Pause size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}
                      {autoScan ? 'Pausar Auto-Escaneo' : 'Reanudar Auto-Escaneo'}
                    </button>

                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleCaptureAndScan}
                      disabled={ocrScanning}
                      style={{ minHeight: 44, flex: '1 1 160px' }}
                    >
                      <Sparkles size={16} aria-hidden="true" />
                      {ocrScanning ? 'Escaneando...' : 'Escanear Ahora'}
                    </button>

                    <button type="button" className="btn btn-ghost" style={{ minHeight: 44 }} onClick={stopCamera}>
                      Detener
                    </button>
                  </div>
                )}

                {(ocrProgress || flashNote) && (
                  <div
                    aria-live="polite"
                    style={{
                      marginTop: 10,
                      padding: '8px 12px',
                      background: 'rgba(56, 189, 248, 0.1)',
                      borderRadius: 8,
                      fontSize: 12,
                      color: 'var(--accent-cyan)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4
                    }}
                  >
                    {ocrProgress && <span>{ocrProgress}</span>}
                    {flashNote && <span style={{ color: 'var(--accent-yellow)' }}>⚡ {flashNote}</span>}
                  </div>
                )}
              </div>
            )}

            {/* PESTAÑA: SUBIR FOTO */}
            {activeTab === 'archivo' && (
              <div className="card" style={{ marginBottom: 20, textAlign: 'center', padding: 24 }}>
                <Upload size={38} color="var(--accent-cyan)" style={{ margin: '0 auto 10px' }} aria-hidden="true" />
                <h2 className="card-title">Cargar Foto de Placa</h2>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                  Sube una foto de carro o moto para detectar la placa automáticamente con OCR.
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
                  style={{ minHeight: 44 }}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={ocrScanning}
                >
                  {ocrScanning ? 'Analizando imagen...' : 'Seleccionar Imagen'}
                </button>

                {ocrProgress && (
                  <div
                    aria-live="polite"
                    style={{
                      marginTop: 16,
                      padding: '8px 12px',
                      background: 'rgba(56, 189, 248, 0.1)',
                      borderRadius: 8,
                      fontSize: 12,
                      color: 'var(--accent-cyan)',
                      textAlign: 'left'
                    }}
                  >
                    {ocrProgress}
                  </div>
                )}
              </div>
            )}

            {/* HISTORIAL RECIENTE DE LA SESIÓN */}
            {historialConsultas.length > 0 && (
              <div className="card">
                <h3 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 10px 0', color: 'var(--text-secondary)' }}>
                  Consultas Recientes de esta Sesión
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {historialConsultas.map((item, idx) => (
                    <button
                      type="button"
                      key={idx}
                      onClick={() => setSearchTerm(item.placa)}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px 12px',
                        minHeight: 44,
                        background: 'var(--bg-secondary)',
                        borderRadius: 8,
                        cursor: 'pointer',
                        border: '1px solid var(--border)',
                        width: '100%',
                        color: 'inherit',
                        textAlign: 'left'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
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
                        {isAdmin && item.nombreUsuario && (
                          <span style={{ fontSize: 12, fontWeight: 600 }}>{item.nombreUsuario}</span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.hora}</span>
                        {item.encontrado ? (
                          <CheckCircle size={15} color="var(--accent-green)" aria-hidden="true" />
                        ) : (
                          <XCircle size={15} color="var(--accent-red)" aria-hidden="true" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* PANEL DERECHO: TARJETA DE RESULTADO DE VERIFICACIÓN */}
          <div>
            {searchTerm.trim() ? (
              resultadoBusqueda?.encontrado ? (
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
                      flexWrap: 'wrap',
                      gap: 8,
                      padding: '10px 14px',
                      background: 'rgba(22, 199, 83, 0.2)',
                      borderRadius: 10,
                      marginBottom: 16,
                      border: '1px solid rgba(22, 199, 83, 0.35)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <CheckCircle size={22} color="var(--accent-green)" aria-hidden="true" />
                      <strong style={{ fontSize: 15, color: 'var(--accent-green)', letterSpacing: 0.5 }}>
                        {isAdmin ? 'VEHÍCULO AUTORIZADO' : 'ES USUARIO DEL PARQUEADERO'}
                      </strong>
                    </div>

                    {isAdmin && resultadoBusqueda.vehiculo.billing && (
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
                          ? 'AL DÍA'
                          : resultadoBusqueda.vehiculo.billing.status === 'en_revision'
                          ? 'EN REVISIÓN'
                          : 'COBRO PENDIENTE'}
                      </span>
                    )}
                  </div>

                  {/* Visualización de la Placa Colombiana */}
                  <div style={{ textAlign: 'center', marginBottom: isAdmin ? 18 : 12 }}>
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
                        {isAdmin
                          ? `COLOMBIA · ${resultadoBusqueda.vehiculo.tipoVehiculo.toUpperCase()}`
                          : 'COLOMBIA'}
                      </span>
                      <span style={{ fontSize: 28, fontWeight: 900, fontFamily: 'monospace', letterSpacing: 4 }}>
                        {resultadoBusqueda.vehiculo.placaOriginal}
                      </span>
                    </div>
                    {isAdmin && (
                      <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6, marginLeft: 10, fontSize: 12, color: 'var(--text-secondary)' }}>
                        {resultadoBusqueda.vehiculo.tipoVehiculo === 'Moto'
                          ? <Bike size={15} color="var(--accent-purple)" aria-hidden="true" />
                          : <Car size={15} color="var(--accent-green)" aria-hidden="true" />}
                        <span>{resultadoBusqueda.vehiculo.tipoVehiculo}</span>
                      </div>
                    )}
                  </div>

                  {!isAdmin && (
                    <p style={{ fontSize: 14, color: 'var(--text-secondary)', textAlign: 'center', margin: '8px 0 0 0', lineHeight: 1.5 }}>
                      Esta placa se encuentra registrada en la base de datos de GoParking.
                    </p>
                  )}

                  {/* Datos del Propietario y Detalles (solo administrador) */}
                  {isAdmin && resultadoBusqueda.vehiculo.usuario && (
                    <>
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
                              style={{ fontSize: 12, minHeight: 38 }}
                            >
                              <Phone size={13} aria-hidden="true" /> Llamar ({resultadoBusqueda.vehiculo.usuario.celular || resultadoBusqueda.vehiculo.usuario.telefono})
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
                                fontSize: 12,
                                minHeight: 38
                              }}
                            >
                              <MessageSquare size={13} aria-hidden="true" /> WhatsApp
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
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: 10
                        }}
                      >
                        <div>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <MapPin size={12} color="var(--accent-cyan)" aria-hidden="true" /> Puesto / Bahía Asignada
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
                          Ver mapa <ChevronRight size={14} aria-hidden="true" />
                        </Link>
                      </div>

                      {/* Estado Financiero */}
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
                            Corte mensual: Día {resultadoBusqueda.vehiculo.billing.billingDay} de cada mes
                          </span>
                          <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>
                            ${Number(resultadoBusqueda.vehiculo.usuario.valor_tarifa || 0).toLocaleString('es-CO')} COP
                          </span>
                        </div>

                        <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
                          {resultadoBusqueda.vehiculo.billing.message}
                        </p>
                      </div>

                      <div style={{ display: 'flex', gap: 10 }}>
                        <button
                          type="button"
                          className="btn btn-primary btn-full"
                          style={{ background: 'var(--accent-green)', borderColor: 'var(--accent-green)', color: '#fff', minHeight: 44 }}
                          onClick={() => {
                            setUsuarioParaPago(resultadoBusqueda.vehiculo.usuario);
                            setModalPagoOpen(true);
                          }}
                        >
                          <CreditCard size={15} aria-hidden="true" /> Registrar Pago de Mensualidad
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : resultadoBusqueda?.incompleto ? (
                <div
                  className="card"
                  style={{
                    textAlign: 'center',
                    padding: 36,
                    border: '1px dashed var(--border)'
                  }}
                >
                  <Search size={42} color="var(--text-muted)" style={{ margin: '0 auto 12px', opacity: 0.6 }} aria-hidden="true" />
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 6px 0', color: 'var(--text-primary)' }}>
                    Ingresa la placa completa
                  </h3>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 320, margin: '0 auto' }}>
                    Escribe al menos 5 caracteres (por ejemplo <code>ABC123</code> o <code>QHH36G</code>) para comprobar si está registrada.
                  </p>
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
                  <XCircle size={56} color="var(--accent-red)" style={{ margin: '0 auto 14px' }} aria-hidden="true" />
                  <h3 style={{ fontSize: 20, fontWeight: 900, color: 'var(--accent-red)', margin: '0 0 8px 0' }}>
                    {isAdmin ? 'VEHÍCULO NO REGISTRADO' : 'NO ES USUARIO DEL PARQUEADERO'}
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
                    {isAdmin
                      ? 'Esta placa no corresponde a ningún usuario activo registrado en el sistema de GoParking.'
                      : 'Esta placa no se encuentra registrada en la base de datos de GoParking.'}
                  </p>

                  {isAdmin && (
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <Link
                        to="/admin/usuarios"
                        className="btn btn-primary"
                        style={{ background: 'var(--accent-cyan)', borderColor: 'var(--accent-cyan)', color: '#000', fontWeight: 700, minHeight: 44 }}
                      >
                        <Plus size={16} aria-hidden="true" /> Registrar Nuevo Cliente
                      </Link>
                    </div>
                  )}
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
                <Car size={48} color="var(--text-muted)" style={{ margin: '0 auto 12px', opacity: 0.5 }} aria-hidden="true" />
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 6px 0', color: 'var(--text-primary)' }}>
                  En espera de placa
                </h3>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 320, margin: '0 auto' }}>
                  Escribe una placa (carro o moto) o activa la cámara completa para que reconozca automáticamente al usuario del parqueadero.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Registrar Pago (solo administradores) */}
      {isAdmin && (
        <ModalRegistrarPago
          isOpen={modalPagoOpen}
          onClose={() => setModalPagoOpen(false)}
          onSuccess={() => {
            loadAllData();
          }}
          usuarioInicial={usuarioParaPago}
          usuariosDisponibles={usuarios}
        />
      )}
    </div>
  );
}
