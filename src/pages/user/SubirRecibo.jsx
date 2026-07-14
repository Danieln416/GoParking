import React, { useState, useRef } from 'react';
import { Upload, Camera, Image, X, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { apiSubirRecibo } from '../../api.js';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export default function SubirRecibo() {
  const { user } = useAuth();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef();
  const cameraInputRef = useRef();

  function handleFile(f) {
    if (!f) return;
    if (!f.type.startsWith('image/')) { alert('Solo se aceptan imágenes'); return; }
    if (f.size > 5 * 1024 * 1024) { alert('La imagen no puede superar 5MB'); return; }
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
    const res = await apiSubirRecibo(user.id, user.nombre, user.correo, mes, anio, file);
    setResult(res);
    if (res.success) {
      setFile(null);
      setPreview(null);
    }
    setLoading(false);
  }

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

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
              <p className="card-subtitle">Selecciona el mes y año del pago</p>

              <div className="form-row" style={{ marginBottom: 0 }}>
                <div className="form-group">
                  <label>Mes</label>
                  <select className="form-select" value={mes} onChange={e => setMes(Number(e.target.value))}>
                    {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Año</label>
                  <select className="form-select" value={anio} onChange={e => setAnio(Number(e.target.value))}>
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
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
                <><span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> Subiendo...</>
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
