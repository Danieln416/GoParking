import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, 
  Camera, 
  Image, 
  X, 
  CheckCircle, 
  AlertCircle, 
  CreditCard, 
  QrCode, 
  Copy, 
  Check, 
  Building2, 
  Smartphone, 
  Wallet,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { apiSubirRecibo, apiGetCuentasPago } from '../../api.js';
import { calcularFinPeriodoUsuario, calcularInicioPeriodoUsuario, formatPeriodoLabel } from '../../utils/periodo.js';

const TODAY = new Date().toISOString().slice(0, 10);

export default function SubirRecibo() {
  const { user } = useAuth();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [fechaInicio, setFechaInicio] = useState(calcularInicioPeriodoUsuario(TODAY, user?.fecha_inicio));
  const [fechaFin, setFechaFin] = useState(calcularFinPeriodoUsuario(TODAY, user?.fecha_inicio));
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [metodoPago, setMetodoPago] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [cuentas, setCuentas] = useState([]);
  const [copiedId, setCopiedId] = useState(null);
  const [zoomQr, setZoomQr] = useState(null);
  const [showAllCuentas, setShowAllCuentas] = useState(false);

  const fileInputRef = useRef();
  const cameraInputRef = useRef();

  useEffect(() => {
    async function loadCuentas() {
      try {
        const res = await apiGetCuentasPago();
        if (res.success && Array.isArray(res.data)) {
          const activas = res.data.filter(c => c.activo !== false);
          setCuentas(activas);
          if (activas.length > 0) {
            setMetodoPago(prev => prev || activas[0].nombre);
          }
        }
      } catch (err) {
        console.error('Error al cargar cuentas de pago:', err);
      }
    }
    loadCuentas();
  }, []);

  function handleCopy(text, id) {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function getEntityIcon(entidad) {
    const e = (entidad || '').toLowerCase();
    if (e.includes('nequi') || e.includes('daviplata') || e.includes('dale') || e.includes('movii')) {
      return <Smartphone size={18} color="var(--accent-cyan)" />;
    }
    if (e.includes('efectivo') || e.includes('presencial')) {
      return <Wallet size={18} color="var(--accent-green)" />;
    }
    return <Building2 size={18} color="var(--accent-yellow)" />;
  }

  function compressImage(inputFile, maxDimension = 1200, quality = 0.82) {
    return new Promise((resolve) => {
      if (!inputFile || !inputFile.type.startsWith('image/') || inputFile.type.includes('svg') || inputFile.type.includes('gif')) {
        return resolve(inputFile);
      }

      const img = document.createElement('img');
      const url = URL.createObjectURL(inputFile);

      img.onload = () => {
        URL.revokeObjectURL(url);
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(inputFile);
              return;
            }
            const cleanName = inputFile.name.replace(/\.[^.]+$/, '.jpg');
            const compressedFile = new File([blob], cleanName, {
              type: 'image/jpeg',
              lastModified: Date.now()
            });
            resolve(compressedFile);
          },
          'image/jpeg',
          quality
        );
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(inputFile);
      };

      img.src = url;
    });
  }

  function handleFile(f) {
    if (!f) return;
    if (!f.type.startsWith('image/')) { alert('Solo se aceptan imágenes'); return; }
    if (f.size > 15 * 1024 * 1024) { alert('La imagen no puede superar 15MB'); return; }
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setResult(null);
  }

  function onDrop(e) {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) { alert('Selecciona una imagen del recibo'); return; }
    setLoading(true);
    setCompressing(true);

    try {
      const fileToUpload = await compressImage(file);
      setCompressing(false);

      const res = await apiSubirRecibo(
        user.id,
        user.nombre,
        user.correo,
        fechaInicio,
        fechaFin,
        mes,
        anio,
        fileToUpload,
        metodoPago || 'No especificado'
      );
      setResult(res);
      if (res.success) {
        setFile(null);
        setPreview(null);
      }
    } catch (err) {
      setResult({ success: false, error: 'Error al procesar la imagen: ' + err.message });
    } finally {
      setCompressing(false);
      setLoading(false);
    }
  }

  return (
    <div className="page-enter">
      <div className="page-header">
        <h1>Subir Recibo de Pago</h1>
      </div>

      <div className="page-body">
        <div style={{ maxWidth: 620, margin: '0 auto' }}>

          {/* Cuentas y Códigos QR Disponibles */}
          {cuentas.length > 0 && (
            <div className="card" style={{ marginBottom: 20, border: '1px solid rgba(22, 199, 83, 0.35)', background: 'linear-gradient(180deg, rgba(22, 199, 83, 0.08) 0%, rgba(6, 16, 30, 0.6) 100%)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CreditCard size={20} color="var(--accent-green)" />
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                    Cuentas y Métodos de Pago
                  </h3>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: 12, padding: '4px 8px' }}
                  onClick={() => setShowAllCuentas(!showAllCuentas)}
                >
                  {showAllCuentas ? <><ChevronUp size={14} /> Contraer</> : <><ChevronDown size={14} /> Ver todas ({cuentas.length})</>}
                </button>
              </div>

              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>
                Realiza tu transferencia o pago a cualquiera de las siguientes opciones oficiales:
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: showAllCuentas ? '1fr' : 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
                {(showAllCuentas ? cuentas : cuentas.slice(0, 2)).map(c => (
                  <div
                    key={c.id}
                    style={{
                      background: 'rgba(0, 0, 0, 0.35)',
                      border: '1px solid var(--border)',
                      borderRadius: 10,
                      padding: 12,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: 8
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {getEntityIcon(c.entidad)}
                          <strong style={{ fontSize: 14, color: 'var(--text-primary)' }}>{c.nombre}</strong>
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.tipo_cuenta}</span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.04)', padding: '6px 10px', borderRadius: 6, margin: '6px 0' }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 14, color: 'var(--accent-green)' }}>
                          {c.numero}
                        </span>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          style={{ padding: '3px 8px', height: 'auto', fontSize: 11 }}
                          onClick={() => handleCopy(c.numero, c.id)}
                        >
                          {copiedId === c.id ? <Check size={13} color="var(--accent-green)" /> : <Copy size={13} />}
                          <span style={{ marginLeft: 4 }}>{copiedId === c.id ? 'Copiado' : 'Copiar'}</span>
                        </button>
                      </div>

                      {c.titular && (
                        <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '2px 0' }}>
                          Titular: <strong>{c.titular}</strong>
                        </p>
                      )}

                      {c.instrucciones && (
                        <p style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', margin: '4px 0 0' }}>
                          {c.instrucciones}
                        </p>
                      )}
                    </div>

                    {c.qr_url && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ marginTop: 4, width: '100%', justifyContent: 'center', gap: 6, borderColor: 'rgba(22,199,83,0.3)', color: 'var(--accent-green)' }}
                        onClick={() => setZoomQr({ url: c.qr_url, nombre: c.nombre })}
                      >
                        <QrCode size={14} /> Ver Código QR para Escanear
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {result && (
            <div className={`card`} style={{ marginBottom: 20, borderColor: result.success ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)', background: result.success ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {result.success
                  ? <CheckCircle size={22} color="var(--accent-green)" />
                  : <AlertCircle size={22} color="var(--accent-red)" />}
                <div>
                  <p style={{ fontWeight: 600, color: result.success ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                    {result.success ? '¡Recibo enviado exitosamente!' : 'Error al enviar'}
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {result.success ? 'Tu recibo está en revisión. El administrador lo verificará pronto.' : result.error}
                  </p>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="card">
              <h3 className="card-title">Datos del Pago y Período</h3>
              <p className="card-subtitle">Selecciona el método de pago utilizado y la fecha de inicio del período.</p>

              {/* Selector de Método de Pago */}
              <div className="form-group">
                <label>Método / Cuenta de pago utilizado <span style={{ color: 'var(--accent-red)' }}>*</span></label>
                <select
                  className="form-input"
                  value={metodoPago}
                  onChange={e => setMetodoPago(e.target.value)}
                  required
                >
                  {cuentas.map(c => (
                    <option key={c.id} value={c.nombre}>
                      {c.nombre} ({c.entidad} - {c.numero})
                    </option>
                  ))}
                  <option value="Transferencia Bancaria">Otra Transferencia Bancaria</option>
                  <option value="Pago en Efectivo">Pago en Efectivo</option>
                  <option value="Otro">Otro Método</option>
                </select>
              </div>

              <div className="form-group" style={{ marginTop: 14 }}>
                <label>Fecha de inicio del periodo</label>
                <input
                  type="date"
                  className="form-input"
                  value={fechaInicio}
                  onChange={e => {
                    const value = e.target.value;
                    const periodoInicio = calcularInicioPeriodoUsuario(value, user?.fecha_inicio);
                    const [year, month] = periodoInicio.split('-').map(Number);
                    setFechaInicio(periodoInicio);
                    setFechaFin(calcularFinPeriodoUsuario(periodoInicio, user?.fecha_inicio));
                    setAnio(year || new Date().getFullYear());
                    setMes(month || new Date().getMonth() + 1);
                  }}
                />
              </div>

              <div className="card" style={{ background: 'var(--bg-secondary)', padding: 14, marginTop: 8 }}>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Periodo calculado</p>
                <p style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{formatPeriodoLabel({ fecha_inicio: fechaInicio, fecha_fin: fechaFin })}</p>
              </div>
            </div>

            <div className="card" style={{ marginTop: 16 }}>
              <h3 className="card-title">Comprobante de Pago</h3>
              <p className="card-subtitle">Sube una foto clara o captura del comprobante bancario (máx. 15MB)</p>

              {!preview ? (
                <div
                  className={`file-drop-zone ${dragOver ? 'drag-over' : ''}`}
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onDrop}
                  onClick={() => fileInputRef.current.click()}
                >
                  <Upload size={40} style={{ marginBottom: 12, display: 'block', margin: '0 auto 12px' }} />
                  <p>Arrastra tu comprobante aquí o <span>haz clic para seleccionarlo</span></p>
                  <small style={{ display: 'block', marginTop: 4 }}>JPG, PNG, WEBP · Optimización automática</small>
                </div>
              ) : (
                <div className="file-preview">
                  <img src={preview} alt="preview" />
                  <button
                    type="button"
                    onClick={() => { setFile(null); setPreview(null); }}
                    style={{
                      position: 'absolute', top: 8, right: 8,
                      background: 'rgba(0,0,0,0.6)', border: 'none',
                      borderRadius: 8, padding: 6, cursor: 'pointer',
                      color: '#fff', display: 'flex', alignItems: 'center',
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
              )}

              {/* Botones de acción */}
              <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-full"
                  onClick={() => fileInputRef.current.click()}
                >
                  <Image size={16} /> Galería / Archivo
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-full"
                  onClick={() => cameraInputRef.current.click()}
                >
                  <Camera size={16} /> Tomar foto
                </button>
              </div>

              {/* Inputs ocultos */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={e => handleFile(e.target.files[0])}
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: 'none' }}
                onChange={e => handleFile(e.target.files[0])}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-full btn-lg"
              style={{ marginTop: 16 }}
              disabled={loading || !file}
            >
              {loading ? (
                compressing ? (
                  <><span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> Optimizando imagen...</>
                ) : (
                  <><span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> Subiendo al servidor...</>
                )
              ) : (
                <><Upload size={18} /> Enviar Comprobante de Pago</>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Modal Zoom QR */}
      {zoomQr && (
        <div className="modal-overlay" onClick={() => setZoomQr(null)}>
          <div className="modal-box" style={{ maxWidth: 360, textAlign: 'center', padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>Código QR — {zoomQr.nombre}</h3>
              <button className="modal-close" onClick={() => setZoomQr(null)}>
                <X size={16} />
              </button>
            </div>
            <div style={{ background: '#fff', padding: 14, borderRadius: 12, display: 'inline-block', boxShadow: '0 8px 30px rgba(0,0,0,0.5)' }}>
              <img 
                src={zoomQr.url} 
                alt="QR Ampliado" 
                style={{ width: '100%', maxWidth: 260, height: 'auto', display: 'block' }} 
              />
            </div>
            <p style={{ marginTop: 12, fontSize: 12, color: 'var(--text-secondary)' }}>
              Abre la app de tu billetera o banco y escanea para pagar directamente.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
