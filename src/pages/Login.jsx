import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Car, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { apiLogin } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    if (!correo || !contrasena) { setError('Completa todos los campos'); return; }
    setLoading(true); setError('');
    try {
      const res = await apiLogin(correo, contrasena);
      if (res.success) {
        login(res.user, res.token);
        navigate(res.user.rol === 'admin' ? '/admin' : '/usuario', { replace: true });
      } else {
        setError(res.error || 'Error de autenticación');
      }
    } catch {
      setError('Error de conexión. Verifica tu internet.');
    }
    setLoading(false);
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="login-icon-wrapper">
            <Car size={36} color="#fff" />
          </div>
          <h1>Parqueadero</h1>
          <p>Sistema de Gestión</p>
        </div>

        {error && (
          <div className="login-error">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Correo electrónico</label>
            <input
              id="login-email"
              type="email"
              className="form-input"
              placeholder="tucorreo@ejemplo.com"
              value={correo}
              onChange={e => setCorreo(e.target.value)}
              autoComplete="email"
            />
          </div>

          <div className="form-group" style={{ position: 'relative' }}>
            <label>Contraseña</label>
            <input
              id="login-password"
              type={showPwd ? 'text' : 'password'}
              className="form-input"
              placeholder="••••••••"
              value={contrasena}
              onChange={e => setContrasena(e.target.value)}
              autoComplete="current-password"
              style={{ paddingRight: 44 }}
            />
            <button
              type="button"
              onClick={() => setShowPwd(!showPwd)}
              style={{
                position: 'absolute', right: 12, bottom: 11,
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', padding: 4,
              }}
            >
              {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <button
            id="login-submit"
            type="submit"
            className="btn btn-primary btn-full btn-lg"
            disabled={loading}
          >
            {loading ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : 'Ingresar'}
          </button>
        </form>

        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, marginTop: 24 }}>
          ¿Olvidaste tu contraseña? Contacta al administrador
        </p>
      </div>
    </div>
  );
}
