import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Car, LayoutDashboard, Receipt, Upload, MessageSquare, LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';

export default function UserLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const initial = user?.nombre?.charAt(0)?.toUpperCase() || 'U';

  return (
    <div className="app-layout">
      <div className={`sidebar-overlay ${mobileMenuOpen ? 'active' : ''}`} onClick={() => setMobileMenuOpen(false)} />
      <aside className={`sidebar ${mobileMenuOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon"><Car size={22} color="#fff" /></div>
          <div className="sidebar-logo-text">
            <h2>Parqueadero</h2>
            <span>Portal de Usuario</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <p className="sidebar-section-label">Menú</p>

          <NavLink to="/usuario" end className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <LayoutDashboard className="nav-icon" />
            Inicio
          </NavLink>

          <NavLink to="/usuario/historial" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <Receipt className="nav-icon" />
            Mis Pagos
          </NavLink>

          <NavLink to="/usuario/subir-recibo" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <Upload className="nav-icon" />
            Subir Recibo
          </NavLink>

          <NavLink to="/usuario/solicitudes" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <MessageSquare className="nav-icon" />
            Solicitudes
          </NavLink>
        </nav>

        <div className="sidebar-user">
          <div className="sidebar-user-info">
            <div className="sidebar-avatar">{initial}</div>
            <div style={{ minWidth: 0 }}>
              <h4>{user?.nombre}</h4>
              <p>Usuario</p>
            </div>
          </div>
          <button className="btn btn-ghost btn-full btn-sm" onClick={handleLogout}>
            <LogOut size={14} /> Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="main-content">
        <div className="mobile-topbar">
          <button className="mobile-menu-toggle" onClick={() => setMobileMenuOpen((prev) => !prev)} aria-label="Abrir menú">
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="mobile-topbar-title">Portal de Usuario</div>
        </div>
        <Outlet />
      </div>
    </div>
  );
}
