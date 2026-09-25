import React, { useState, useRef } from 'react';
import { Upload, Camera, Image, X, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { apiSubirRecibo } from '../../api.js';
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
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const fileInputRef = useRef();
  const cameraInputRef = useRef();

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
      // Comprime la imagen para reducir el envío de 4MB a ~180KB
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
        fileToUpload
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
        <div style={{ maxWidth: 560, margin: '0 auto' }}>

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
                    {result.success ? 'Tu recibo está en revisión. El admin lo revisará pronto.' : result.error}
                  </p>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="card">
              <h3 className="card-title">Período de pago</h3>
              <p className="card-subtitle">Selecciona la fecha de inicio y el sistema calculará el fin del periodo.</p>

              <div className="form-group">
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
              <h3 className="card-title">Imagen del recibo</h3>
              <p className="card-subtitle">Toma una foto o sube desde tu dispositivo (máx. 5MB)</p>

              {!preview ? (
                <div
                  className={`file-drop-zone ${dragOver ? 'drag-over' : ''}`}
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onDrop}
                  onClick={() => fileInputRef.current.click()}
                >
                  <Upload size={40} style={{ marginBottom: 12, display: 'block', margin: '0 auto 12px' }} />
                  <p>Arrastra tu imagen aquí o <span>haz clic para seleccionar</span></p>
                  <small style={{ display: 'block', marginTop: 4 }}>JPG, PNG, WEBP · Máx. 5MB</small>
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
                <><Upload size={18} /> Enviar Recibo</>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
