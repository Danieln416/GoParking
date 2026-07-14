import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';

// Pages
import Login from './pages/Login.jsx';
import UserLayout from './pages/user/UserLayout.jsx';
import AdminLayout from './pages/admin/AdminLayout.jsx';

// User Pages
import UserDashboard from './pages/user/UserDashboard.jsx';
import Historial from './pages/user/Historial.jsx';
import SubirRecibo from './pages/user/SubirRecibo.jsx';
import Solicitudes from './pages/user/Solicitudes.jsx';

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard.jsx';
import GestionUsuarios from './pages/admin/GestionUsuarios.jsx';
import RecibosAdmin from './pages/admin/RecibosAdmin.jsx';
import GestionPuestos from './pages/admin/GestionPuestos.jsx';
import CierreMes from './pages/admin/CierreMes.jsx';
import SolicitudesAdmin from './pages/admin/SolicitudesAdmin.jsx';

function ProtectedRoute({ children, allowedRole }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRole && user.rol !== allowedRole) {
    return <Navigate to={user.rol === 'admin' ? '/admin' : '/usuario'} replace />;
  }
  return children;
}

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={user ? <Navigate to={user.rol === 'admin' ? '/admin' : '/usuario'} replace /> : <Login />} />

        {/* Usuario */}
        <Route path="/usuario" element={<ProtectedRoute allowedRole="usuario"><UserLayout /></ProtectedRoute>}>
          <Route index element={<UserDashboard />} />
          <Route path="historial" element={<Historial />} />
          <Route path="subir-recibo" element={<SubirRecibo />} />
          <Route path="solicitudes" element={<Solicitudes />} />
        </Route>

        {/* Admin */}
        <Route path="/admin" element={<ProtectedRoute allowedRole="admin"><AdminLayout /></ProtectedRoute>}>
          <Route index element={<AdminDashboard />} />
          <Route path="usuarios" element={<GestionUsuarios />} />
          <Route path="recibos" element={<RecibosAdmin />} />
          <Route path="puestos" element={<GestionPuestos />} />
          <Route path="cierre-mes" element={<CierreMes />} />
          <Route path="solicitudes" element={<SolicitudesAdmin />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
