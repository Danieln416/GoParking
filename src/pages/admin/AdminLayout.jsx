import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Car, LayoutDashboard, Users, Receipt, MapPin, Calculator, MessageSquare, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon"><Car size={22} color="#fff" /></div>
          <div className="sidebar-logo-text">
            <h2>Parqueadero</h2>
            <span>Panel Admin</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <p className="sidebar-section-label">Gestión</p>

          <NavLink to="/admin" end className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <LayoutDashboard className="nav-icon" />
            Dashboard
          </NavLink>

          <NavLink to="/admin/usuarios" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <Users className="nav-icon" />
            Usuarios
          </NavLink>

          <NavLink to="/admin/recibos" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <Receipt className="nav-icon" />
            Recibos de Pago
          </NavLink>

          <NavLink to="/admin/puestos" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <MapPin className="nav-icon" />
            Gestión de Puestos
          </NavLink>

          <NavLink to="/admin/cierre-mes" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <Calculator className="nav-icon" />
            Cierre de Mes
          </NavLink>

          <NavLink to="/admin/solicitudes" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <MessageSquare className="nav-icon" />
            Solicitudes
          </NavLink>
        </nav>

        <div className="sidebar-user">
          <div className="sidebar-user-info">
            <div className="sidebar-avatar" style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}>A</div>
            <div style={{ minWidth: 0 }}>
              <h4>{user?.nombre || 'Administrador'}</h4>
              <p>Admin</p>
            </div>
          </div>
          <button className="btn btn-ghost btn-full btn-sm" onClick={handleLogout}>
            <LogOut size={14} /> Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="main-content">
        <Outlet />
      </div>
    </div>
  );
}
