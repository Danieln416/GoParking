import React, { useEffect, useMemo, useState } from 'react';
import {
  Receipt,
  Check,
  X,
  ExternalLink,
  Filter,
  CheckCircle,
  AlertCircle,
  MessageSquare,
  Send,
  Users,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Search,
  Plus,
  AlertTriangle,
  Edit2,
  Trash2,
  DollarSign,
  Tag,
  Clock,
  FileText
} from 'lucide-react';
import {
  apiGetRecibos,
  apiGetUsuarios,
  apiAprobarRecibo,
  apiRechazarRecibo,
  apiActualizarFechasRecibo,
  apiDispararWhatsAppMora,
  apiGetCierreMes,
  apiGetCobrosAdicionales,
  apiCrearCobroAdicional,
  apiActualizarEstadoCobroAdicional,
  apiEliminarCobroAdicional
} from '../../api.js';
import {
  formatPeriodoLabel,
  getAdminClosingPeriod,
  getPreviousAdminClosingPeriod,
  getNextAdminClosingPeriod,
  formatDateLabel,
  parseDate
} from '../../utils/periodo.js';
import { getReceiptMediaUrl, getReceiptViewerUrl } from '../../utils/media.js';
import ModalRegistrarPago from '../../components/ModalRegistrarPago.jsx';

const ADMIN_CYCLE = getAdminClosingPeriod(new Date());

export default function RecibosAdmin() {
  const [activeTab, setActiveTab] = useState('recibos'); // 'recibos' | 'cobros'
  const [recibos, setRecibos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cierreLoading, setCierreLoading] = useState(false);
  const [cierreData, setCierreData] = useState(null);
  const [filter, setFilter] = useState('en_revision');
  const [searchMoroso, setSearchMoroso] = useState('');
  const [selectedRecibo, setSelectedRecibo] = useState(null);
  const [nota, setNota] = useState('');
  const [processing, setProcessing] = useState(false);
  const [toast, setToast] = useState(null);
  const [startDate, setStartDate] = useState(ADMIN_CYCLE.startDate);
  const [endDate, setEndDate] = useState(ADMIN_CYCLE.endDate);
  const [brokenImages, setBrokenImages] = useState({});
  const [imageRetries, setImageRetries] = useState({});
  const [runningSweep, setRunningSweep] = useState(false);

  // Cobros adicionales y multas
  const [cobrosAdicionales, setCobrosAdicionales] = useState([]);
  const [loadingCobros, setLoadingCobros] = useState(false);
  const [filtroCobros, setFiltroCobros] = useState('todos');
  const [usuariosList, setUsuariosList] = useState([]);

  // Modal para editar fechas de facturación de recibo
  const [editingReciboFechas, setEditingReciboFechas] = useState(null);
  const [nuevaFechaInicio, setNuevaFechaInicio] = useState('');
  const [nuevaFechaFin, setNuevaFechaFin] = useState('');
  const [justificacionFechas, setJustificacionFechas] = useState('');
  const [guardandoFechas, setGuardandoFechas] = useState(false);

  // Modal para agregar cobro adicional / multa
  const [modalCobroOpen, setModalCobroOpen] = useState(false);
  const [tipoCobro, setTipoCobro] = useState('multa'); // 'multa' | 'extra'
  const [cobroUsuarioId, setCobroUsuarioId] = useState('');
  const [cobroConcepto, setCobroConcepto] = useState('Multa por mora');
  const [cobroValor, setCobroValor] = useState(20000);
  const [cobroJustificacion, setCobroJustificacion] = useState('');
  const [cobroFecha, setCobroFecha] = useState(new Date().toISOString().slice(0, 10));
  const [guardandoCobro, setGuardandoCobro] = useState(false);

  // Modal para registrar pago / marcar período pagado
  const [modalPagoOpen, setModalPagoOpen] = useState(false);
  const [usuarioParaPago, setUsuarioParaPago] = useState(null);
  const [periodoParaPago, setPeriodoParaPago] = useState(null);

  function handleAbrirModalPago(user = null, periodo = null) {
    setUsuarioParaPago(user);
    setPeriodoParaPago(periodo);
    setModalPagoOpen(true);
  }

  function handlePagoRegistradoExitoso(data, user) {
    showToast('success', `Período marcado como pagado exitosamente para ${user?.nombre || 'el usuario'}`);
    loadRecibos();
    if (startDate && endDate) {
      loadCierre(startDate, endDate);
    }
  }

  useEffect(() => {
    loadRecibos();
    loadCobros();
    loadUsuarios();
  }, []);

  useEffect(() => {
    if (startDate && endDate) {
      loadCierre(startDate, endDate);
    } else {
      setCierreData(null);
    }
  }, [startDate, endDate]);

  async function loadRecibos() {
    const res = await apiGetRecibos('all');
    if (res.success) {
      setRecibos([...res.data].sort((a, b) => new Date(b.fecha_subida) - new Date(a.fecha_subida)));
    }
    setLoading(false);
  }

  async function loadCobros() {
    setLoadingCobros(true);
    try {
      const res = await apiGetCobrosAdicionales('all');
      if (res.success) {
        setCobrosAdicionales(res.data || []);
      }
    } catch (e) {
      console.error('Error al cargar cobros adicionales:', e);
    } finally {
      setLoadingCobros(false);
    }
  }

  async function loadUsuarios() {
    try {
      const res = await apiGetUsuarios();
      if (res.success) {
        const activos = (res.data || []).filter(u => u.rol !== 'admin' && u.activo !== 0);
        setUsuariosList(activos);
        if (activos.length > 0 && !cobroUsuarioId) {
          setCobroUsuarioId(activos[0].id);
        }
      }
    } catch (e) {
      console.error('Error al cargar usuarios:', e);
    }
  }

  function handleOpenEditarFechas(recibo) {
    setEditingReciboFechas(recibo);
    setNuevaFechaInicio(recibo.fecha_inicio || '');
    setNuevaFechaFin(recibo.fecha_fin || '');
    setJustificacionFechas(recibo.justificacion_fechas || '');
  }

  async function handleGuardarFechas(e) {
    e.preventDefault();
    if (!justificacionFechas.trim()) {
      showToast('error', 'Debes ingresar una justificación obligatoria para cambiar las fechas');
      return;
    }
    if (!nuevaFechaInicio) {
      showToast('error', 'Selecciona la nueva fecha de inicio');
      return;
    }

    setGuardandoFechas(true);
    try {
      const res = await apiActualizarFechasRecibo({
        reciboId: editingReciboFechas.id,
        fechaInicio: nuevaFechaInicio,
        fechaFin: nuevaFechaFin,
        justificacion: justificacionFechas.trim()
      });

      if (res.success) {
        showToast('success', 'Período de facturación actualizado correctamente');
        // Actualizar en el estado local
        setRecibos(prev => prev.map(r => r.id === editingReciboFechas.id ? {
          ...r,
          fecha_inicio: nuevaFechaInicio,
          fecha_fin: nuevaFechaFin,
          admin_nota: res.data?.admin_nota || r.admin_nota,
          justificacion_fechas: justificacionFechas.trim()
        } : r));

        if (selectedRecibo?.id === editingReciboFechas.id) {
          setSelectedRecibo(prev => ({
            ...prev,
            fecha_inicio: nuevaFechaInicio,
            fecha_fin: nuevaFechaFin,
            admin_nota: res.data?.admin_nota || prev.admin_nota,
            justificacion_fechas: justificacionFechas.trim()
          }));
        }

        setEditingReciboFechas(null);
        if (startDate && endDate) loadCierre(startDate, endDate);
      } else {
        showToast('error', res.error || 'Error al actualizar las fechas');
      }
    } catch (err) {
      showToast('error', 'Error inesperado: ' + err.message);
    } finally {
      setGuardandoFechas(false);
    }
  }

  function handleOpenCrearCobro(tipo = 'multa') {
    setTipoCobro(tipo);
    if (tipo === 'multa') {
      setCobroConcepto('Multa por mora');
      setCobroValor(20000);
    } else {
      setCobroConcepto('');
      setCobroValor('');
    }
    setCobroJustificacion('');
    setCobroFecha(new Date().toISOString().slice(0, 10));
    if (usuariosList.length > 0 && !cobroUsuarioId) {
      setCobroUsuarioId(usuariosList[0].id);
    }
    setModalCobroOpen(true);
  }

  async function handleGuardarCobro(e) {
    e.preventDefault();
    if (!cobroUsuarioId) {
      showToast('error', 'Selecciona un usuario');
      return;
    }
    if (!cobroConcepto.trim()) {
      showToast('error', 'Ingresa el concepto del cobro');
      return;
    }
    const val = Number(cobroValor);
    if (isNaN(val) || val <= 0) {
      showToast('error', 'Ingresa un valor válido mayor a 0');
      return;
    }
    if (!cobroJustificacion.trim()) {
      showToast('error', 'Ingresa la justificación del cobro para que el usuario la vea');
      return;
    }

    setGuardandoCobro(true);
    try {
      const res = await apiCrearCobroAdicional({
        usuarioId: cobroUsuarioId,
        tipo: tipoCobro,
        concepto: cobroConcepto.trim(),
        justificacion: cobroJustificacion.trim(),
        valor: val,
        fecha: cobroFecha
      });

      if (res.success) {
        showToast('success', `${tipoCobro === 'multa' ? 'Multa' : 'Cobro extra'} registrado correctamente`);
        setModalCobroOpen(false);
        loadCobros();
      } else {
        showToast('error', res.error || 'Error al guardar cobro');
      }
    } catch (err) {
      showToast('error', 'Error inesperado: ' + err.message);
    } finally {
      setGuardandoCobro(false);
    }
  }

  async function handleToggleEstadoCobro(cobro) {
    const nuevoEstado = cobro.estado === 'pendiente' ? 'pagado' : 'pendiente';
    const res = await apiActualizarEstadoCobroAdicional(cobro.id, nuevoEstado);
    if (res.success) {
      setCobrosAdicionales(prev => prev.map(c => c.id === cobro.id ? { ...c, estado: nuevoEstado } : c));
      showToast('success', `Cobro marcado como ${nuevoEstado}`);
    } else {
      showToast('error', 'No se pudo actualizar el estado del cobro');
    }
  }

  async function handleEliminarCobro(id) {
    if (!window.confirm('¿Seguro que deseas eliminar este cobro adicional?')) return;
    const res = await apiEliminarCobroAdicional(id);
    if (res.success) {
      setCobrosAdicionales(prev => prev.filter(c => c.id !== id));
      showToast('success', 'Cobro eliminado');
    } else {
      showToast('error', 'Error al eliminar');
    }
  }

  async function loadCierre(s, e) {
    if (!s || !e) return;
    setCierreLoading(true);
    try {
      const res = await apiGetCierreMes(s, e);
      if (res.success) {
        setCierreData(res.data);
      }
    } catch (err) {
      console.error('Error al cargar datos de cierre:', err);
    } finally {
      setCierreLoading(false);
    }
  }

  function handleSelectCycle(period) {
    setStartDate(period.startDate);
    setEndDate(period.endDate);
  }

  function handleVerTodos() {
    setStartDate('');
    setEndDate('');
  }

  function handleImageError(id) {
    setImageRetries(prev => {
      if (!prev[id]) {
        return { ...prev, [id]: true };
      }
      setBrokenImages(curr => ({ ...curr, [id]: true }));
      return prev;
    });
  }

  async function handleAprobar(recibo) {
    setProcessing(true);
    const notaFinal = nota || 'Aprobado por el administrador';

    // Actualización optimista
    setRecibos(prev => prev.map(item => item.id === recibo.id ? { ...item, estado: 'aprobado', admin_nota: notaFinal } : item));
    setSelectedRecibo(null);
    setNota('');
    showToast('success', 'Recibo aprobado correctamente');

    const res = await apiAprobarRecibo(recibo.id, notaFinal);
    if (!res.success) {
      showToast('error', res.error || 'Error al guardar la aprobación en el servidor');
      loadRecibos();
    } else {
      if (startDate && endDate) loadCierre(startDate, endDate);
    }
    setProcessing(false);
  }

  async function handleRechazar(recibo) {
    if (!nota) { showToast('error', 'Indica el motivo del rechazo'); return; }
    setProcessing(true);

    // Actualización optimista
    setRecibos(prev => prev.map(item => item.id === recibo.id ? { ...item, estado: 'rechazado', admin_nota: nota } : item));
    setSelectedRecibo(null);
    setNota('');
    showToast('success', 'Recibo rechazado');

    const res = await apiRechazarRecibo(recibo.id, nota);
    if (!res.success) {
      showToast('error', res.error || 'Error al guardar el rechazo en el servidor');
      loadRecibos();
    } else {
      if (startDate && endDate) loadCierre(startDate, endDate);
    }
    setProcessing(false);
  }

  function showToast(type, msg) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  }

  async function handleDispararBarrido() {
    setRunningSweep(true);
    try {
      const res = await apiDispararWhatsAppMora();
      if (res.success) {
        showToast('success', `Barrido finalizado: ${res.enviados || 0} enviados, ${res.omitidos || 0} ya notificados hoy`);
      } else {
        showToast('error', res.error || 'Error al ejecutar barrido de WhatsApp');
      }
    } catch (err) {
      showToast('error', 'Error al conectar: ' + err.message);
    } finally {
      setRunningSweep(false);
    }
  }

  function getUserMoraInfo(user) {
    if (user.badgeText !== undefined && user.diffDays !== undefined) {
      return {
        billingDay: user.billingDay,
        dueDate: user.dueDate,
        diffDays: user.diffDays,
        diasMora: user.diasMora,
        isOverdue: user.isOverdue,
        isToday: user.isToday,
        text: user.badgeText
      };
    }

    const sDate = parseDate(startDate) || new Date();
    const eDate = parseDate(endDate) || new Date();
    const uDate = parseDate(user.fecha_inicio) || sDate;
    const billingDay = uDate.getDate();
    const cycleStartDay = sDate.getDate();

    let dueDate;
    if (billingDay >= cycleStartDay) {
      dueDate = new Date(sDate.getFullYear(), sDate.getMonth(), billingDay);
    } else {
      dueDate = new Date(eDate.getFullYear(), eDate.getMonth(), billingDay);
    }

    const today = new Date();
    const todayZero = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const diffDays = Math.round((todayZero - dueDate) / 86400000);
    const isOverdue = diffDays > 0;
    const isToday = diffDays === 0;

    let text = '';
    if (isToday) {
      text = `Corte hoy (día ${billingDay})`;
    } else if (isOverdue) {
      text = `Vencido hace ${diffDays}d (día ${billingDay})`;
    } else {
      text = `Vence en ${Math.abs(diffDays)}d (día ${billingDay})`;
    }

    return {
      billingDay,
      dueDate: formatDateLabel(dueDate),
      diffDays,
      diasMora: Math.max(0, diffDays),
      isOverdue,
      isToday,
      text
    };
  }

  function buildWhatsAppLink(user) {
    let num = String(user.celular || user.telefono || '').replace(/\D/g, '');
    if (num.length === 10 && num.startsWith('3')) num = '57' + num;
    const primerNombre = (user.nombre || '').split(' ')[0];
    const valorFmt = `$${Number(user.valor_tarifa || 0).toLocaleString('es-CO')}`;
    const moraInfo = getUserMoraInfo(user);
    const corteTxt = moraInfo.dueDate ? formatDateLabel(moraInfo.dueDate) : `día ${moraInfo.billingDay}`;

    let msg = '';
    if (moraInfo.isToday) {
      msg = `Hola ${primerNombre} 👋, te saludamos del Parqueadero GoParking 🚗.\n\n` +
        `Te recordamos amablemente que *hoy vence tu mensualidad* (Fecha de corte: ${corteTxt}).\n\n` +
        `💰 *Valor a cancelar:* ${valorFmt}\n\n` +
        `📌 Por favor sube tu comprobante en la aplicación web una vez realizado el pago para mantener tu registro al día.\n\n` +
        `¡Muchas gracias por tu puntualidad!`;
    } else if (moraInfo.isOverdue) {
      msg = `Hola ${primerNombre} 👋, te saludamos del Parqueadero GoParking 🚗.\n\n` +
        `Te recordamos amablemente que tu mensualidad presenta *${moraInfo.diasMora} día(s) de vencimiento* (Fecha de corte: ${corteTxt}).\n\n` +
        `💰 *Valor a cancelar:* ${valorFmt}\n\n` +
        `📌 Por favor sube tu comprobante en la aplicación web una vez realizado el pago para mantener tu registro al día.\n\n` +
        `¡Muchas gracias por tu puntualidad!`;
    } else {
      msg = `Hola ${primerNombre} 👋, te saludamos del Parqueadero GoParking 🚗.\n\n` +
        `Te recordamos amablemente tu mensualidad correspondiente al ciclo del ${startDate} al ${endDate} (Fecha límite de pago: ${corteTxt}).\n\n` +
        `💰 *Valor a cancelar:* ${valorFmt}\n\n` +
        `📌 Por favor sube tu comprobante en la aplicación web una vez realizado el pago para mantener tu registro al día.\n\n` +
        `¡Muchas gracias por tu puntualidad!`;
    }

    return `https://wa.me/${num}?text=${encodeURIComponent(msg)}`;
  }

  // Recibos filtrados por el rango de fechas seleccionado
  const dateRangeRecibos = useMemo(() => {
    if (!startDate && !endDate) return recibos;
    return recibos.filter(r => {
      const uploadDate = r.fecha_subida ? r.fecha_subida.slice(0, 10) : (r.fecha_inicio ? r.fecha_inicio.slice(0, 10) : '');
      const fromMatches = !startDate || (uploadDate ? uploadDate >= startDate : true);
      const toMatches = !endDate || (uploadDate ? uploadDate <= endDate : true);
      return fromMatches && toMatches;
    });
  }, [recibos, startDate, endDate]);

  const filtered = useMemo(() => {
    if (filter === 'todos') return dateRangeRecibos;
    return dateRangeRecibos.filter(r => r.estado === filter);
  }, [dateRangeRecibos, filter]);

  const counts = useMemo(() => ({
    en_revision: dateRangeRecibos.filter(r => r.estado === 'en_revision').length,
    aprobado: dateRangeRecibos.filter(r => r.estado === 'aprobado').length,
    rechazado: dateRangeRecibos.filter(r => r.estado === 'rechazado').length,
    todos: dateRangeRecibos.length
  }), [dateRangeRecibos]);

  // Lista de usuarios pendientes del ciclo sincronizada con el backend (Cierre de Mes)
  const unpaidUsers = useMemo(() => {
    const list = cierreData?.usuariosPendientes || [];
    if (!searchMoroso.trim()) return list;
    const q = searchMoroso.toLowerCase();
    return list.filter(u =>
      (u.nombre || '').toLowerCase().includes(q) ||
      (u.placa || '').toLowerCase().includes(q) ||
      (u.correo || '').toLowerCase().includes(q) ||
      (u.celular || '').includes(q)
    );
  }, [cierreData?.usuariosPendientes, searchMoroso]);

  const totalPorCobrarUnpaid = cierreData?.totalPorCobrar || 0;

  const cobrosFiltrados = useMemo(() => {
    return cobrosAdicionales.filter(c => {
      if (filtroCobros === 'pendiente') return c.estado === 'pendiente';
      if (filtroCobros === 'pagado') return c.estado === 'pagado';
      if (filtroCobros === 'multa') return c.tipo === 'multa';
      if (filtroCobros === 'extra') return c.tipo === 'extra';
      return true;
    });
  }, [cobrosAdicionales, filtroCobros]);

  const pendientesCobrosCount = useMemo(() => {
    return cobrosAdicionales.filter(c => c.estado === 'pendiente').length;
  }, [cobrosAdicionales]);

  return (
    <div className="page-enter">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1>Gestión de Recibos y Cobros</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
            Control de mensualidades, verificación de pagos, multas y cobros adicionales.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-primary"
            style={{ background: 'var(--accent-green)', borderColor: 'var(--accent-green)', color: '#fff' }}
            onClick={() => handleAbrirModalPago(null)}
          >
            <CheckCircle size={16} /> Marcar Período Pagado
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => handleOpenCrearCobro('multa')}
          >
            <Plus size={16} /> Agregar Cobro / Multa
          </button>
        </div>
      </div>

      {/* Pestañas Principales: Recibos vs Cobros Extras */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
        <button
          type="button"
          className={`btn btn-sm ${activeTab === 'recibos' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('recibos')}
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <Receipt size={15} />
          Recibos de Pago ({counts.todos})
        </button>
        <button
          type="button"
          className={`btn btn-sm ${activeTab === 'cobros' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('cobros')}
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <DollarSign size={15} />
          Multas y Cobros Extras
          {pendientesCobrosCount > 0 && (
            <span style={{ 
              background: 'var(--accent-red)', 
              color: '#fff', 
              borderRadius: 10, 
              padding: '1px 7px', 
              fontSize: 11, 
              fontWeight: 700 
            }}>
              {pendientesCobrosCount}
            </span>
          )}
        </button>
      </div>

      <div className="page-body">
        {activeTab === 'recibos' ? (
          <>
            {/* Selector de Ciclo Contable y Rango de Fechas */}
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
                <div>
                  <h3 className="card-title" style={{ margin: 0 }}>Período Contable de Recibos</h3>
                  <p className="card-subtitle" style={{ margin: '4px 0 0' }}>
                    Ciclo mensual del 12 al 11 · Sincronizado con el balance y cierre de caja
                  </p>
                </div>

                {/* Accesos rápidos de ciclos contables */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: 12, padding: '4px 10px' }}
                    onClick={() => handleSelectCycle(getPreviousAdminClosingPeriod(startDate || new Date()))}
                    title="Ver ciclo contable anterior (12 al 11)"
                  >
                    <ChevronLeft size={14} /> Ciclo anterior
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: 12, padding: '4px 10px', borderColor: 'rgba(22,199,83,0.4)', color: 'var(--accent-green)' }}
                    onClick={() => handleSelectCycle(ADMIN_CYCLE)}
                    title="Volver al ciclo actual"
                  >
                    <Calendar size={14} /> Ciclo actual (12 al 11)
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: 12, padding: '4px 10px' }}
                    onClick={() => handleSelectCycle(getNextAdminClosingPeriod(startDate || new Date()))}
                    title="Ver siguiente ciclo"
                  >
                    Ciclo siguiente <ChevronRight size={14} />
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: 12, padding: '4px 10px' }}
                    onClick={handleVerTodos}
                    title="Ver todos los recibos sin límite de fecha"
                  >
                    Ver todos
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div className="form-group" style={{ marginBottom: 0, minWidth: 150 }}>
                  <label>Desde</label>
                  <input type="date" className="form-input" value={startDate} onChange={e => setStartDate(e.target.value)} />
                </div>
                <div className="form-group" style={{ marginBottom: 0, minWidth: 150 }}>
                  <label>Hasta</label>
                  <input type="date" className="form-input" value={endDate} onChange={e => setEndDate(e.target.value)} />
                </div>
                {startDate && endDate && (
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', paddingBottom: 10 }}>
                    Mostrando recibos y clientes del <strong>{startDate}</strong> al <strong>{endDate}</strong>
                  </span>
                )}
              </div>
            </div>

            {/* Botones de filtro de recibos */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
              {[
                { key: 'en_revision', label: '⏳ En revisión', count: counts.en_revision },
                { key: 'aprobado', label: '✓ Aprobados', count: counts.aprobado },
                { key: 'rechazado', label: '✗ Rechazados', count: counts.rechazado },
                { key: 'todos', label: 'Todos', count: counts.todos },
              ].map(f => (
                <button key={f.key} className={`btn btn-sm ${filter === f.key ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFilter(f.key)}>
                  {f.label} ({f.count})
                </button>
              ))}
            </div>

            {/* Tarjeta de Clientes con Pago Pendiente en este ciclo */}
            {startDate && endDate && (
              <div className="card" style={{ marginBottom: 20, borderColor: (cierreData?.usuariosPendientes?.length || 0) > 0 ? 'rgba(239, 68, 68, 0.4)' : undefined }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <h3 className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Users size={18} color="var(--accent-red)" />
                      Estado de Cobros del Ciclo ({cierreData?.usuariosPendientes?.length || 0} clientes con cobro pendiente)
                    </h3>
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                      Clientes activos sin comprobante registrado entre {startDate} y {endDate} · Cartera por recaudar: <strong style={{ color: 'var(--accent-yellow)' }}>${totalPorCobrarUnpaid.toLocaleString('es-CO')}</strong>
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative', width: 180 }}>
                      <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: 10, top: 10 }} />
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Buscar cliente..."
                        value={searchMoroso}
                        onChange={e => setSearchMoroso(e.target.value)}
                        style={{ paddingLeft: 30, fontSize: 12, height: 32 }}
                      />
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: 12, color: '#25D366', borderColor: 'rgba(37, 211, 102, 0.4)', padding: '5px 12px' }}
                      onClick={handleDispararBarrido}
                      disabled={runningSweep}
                      title="Ejecutar barrido automático de Cloudflare para notificar morosos"
                    >
                      {runningSweep ? <span className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} /> : <Send size={13} />}
                      Barrido WhatsApp
                    </button>
                  </div>
                </div>

                {cierreLoading ? (
                  <div style={{ textAlign: 'center', padding: 20 }}><div className="spinner" style={{ margin: '0 auto', width: 20, height: 20 }} /></div>
                ) : unpaidUsers.length ? (
                  <div style={{ display: 'grid', gap: 8, maxHeight: 350, overflowY: 'auto', marginTop: 10 }}>
                    {unpaidUsers.map(user => {
                      const moraInfo = getUserMoraInfo(user);
                      return (
                        <div
                          key={user.id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '8px 12px',
                            borderRadius: 8,
                            background: 'var(--bg-secondary)',
                            border: (moraInfo.isOverdue || moraInfo.isToday) ? '1px solid rgba(239, 68, 68, 0.45)' : '1px solid var(--border)'
                          }}
                        >
                          <div>
                            <span style={{ fontWeight: 600, fontSize: 13 }}>{user.nombre}</span>
                            <span style={{ color: 'var(--text-muted)', marginLeft: 8, fontSize: 12 }}>
                              {user.placa ? `${user.placa} · ` : ''}{user.tipo_vehiculo || 'Mensualidad'}
                            </span>
                            <span style={{ color: 'var(--accent-yellow)', marginLeft: 8, fontSize: 12, fontWeight: 700 }}>
                              ${Number(user.valor_tarifa || 0).toLocaleString('es-CO')}
                            </span>
                            <span style={{ color: 'var(--text-secondary)', marginLeft: 8, fontSize: 11 }}>
                              · Corte día {moraInfo.billingDay} de cada mes
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span
                              className={`badge ${moraInfo.isOverdue || moraInfo.isToday ? 'badge-rejected' : 'badge-review'}`}
                              style={{ fontSize: 11 }}
                            >
                              {moraInfo.text}
                            </span>
                            <button
                              type="button"
                              className="btn btn-sm btn-primary"
                              style={{
                                background: 'rgba(22, 199, 83, 0.2)',
                                color: 'var(--accent-green)',
                                border: '1px solid rgba(22, 199, 83, 0.4)',
                                padding: '4px 9px',
                                fontSize: 11,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4
                              }}
                              onClick={() => handleAbrirModalPago(user, { fechaInicio: startDate, fechaFin: endDate })}
                              title={`Marcar el ciclo actual como pagado para ${user.nombre}`}
                            >
                              <CheckCircle size={12} /> Marcar Pagado
                            </button>
                            {(user.celular || user.telefono) && (
                              <a
                                href={buildWhatsAppLink(user)}
                                target="_blank"
                                rel="noreferrer"
                                className="btn btn-sm"
                                style={{
                                  background: 'rgba(37, 211, 102, 0.15)',
                                  color: '#25D366',
                                  border: '1px solid rgba(37, 211, 102, 0.35)',
                                  padding: '3px 8px',
                                  fontSize: 11,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  textDecoration: 'none'
                                }}
                                title={`Abrir WhatsApp para recordar pago a ${user.nombre}`}
                              >
                                <MessageSquare size={12} /> WhatsApp
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p style={{ fontSize: 13, color: 'var(--accent-green)', margin: '10px 0 0' }}>
                    ✓ Todos los clientes se encuentran al día con sus pagos en este ciclo ({startDate} al {endDate}).
                  </p>
                )}
              </div>
            )}

            {/* Cuadrícula de Recibos */}
            {loading ? (
              <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
            ) : filtered.length === 0 ? (
              <div className="empty-state">
                <Receipt size={48} />
                <h3>Sin recibos</h3>
                <p>No hay recibos en esta categoría para el rango seleccionado</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 16 }}>
                {filtered.map(r => (
                  <div key={r.id} className="card" style={{ cursor: 'pointer' }} onClick={() => { setSelectedRecibo(r); setNota(''); }}>
                    {/* Imagen del recibo */}
                    {getReceiptMediaUrl(r) && !brokenImages[r.id] ? (
                      <div style={{ borderRadius: 10, overflow: 'hidden', marginBottom: 14, border: '1px solid var(--border)' }}>
                        <img
                          src={getReceiptMediaUrl(r, Boolean(imageRetries[r.id]))}
                          alt="recibo"
                          loading="lazy"
                          onError={() => handleImageError(r.id)}
                          style={{ width: '100%', height: 160, objectFit: 'cover' }}
                        />
                      </div>
                    ) : (
                      <div style={{ height: 120, background: 'var(--bg-secondary)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                        <Receipt size={36} color="var(--text-muted)" />
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <p style={{ fontWeight: 700, fontSize: 14 }}>{r.usuario_nombre}</p>
                        <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{r.usuario_correo}</p>
                        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                          {formatPeriodoLabel(r)}
                        </p>
                      </div>
                      <EstadoBadge estado={r.estado} />
                    </div>

                    {/* Aviso si tiene fechas ajustadas por admin */}
                    {r.justificacion_fechas && (
                      <div style={{ 
                        marginTop: 10, 
                        background: 'rgba(56, 189, 248, 0.08)', 
                        border: '1px solid rgba(56, 189, 248, 0.3)', 
                        borderRadius: 6, 
                        padding: '6px 10px', 
                        fontSize: 11.5, 
                        color: 'var(--accent-cyan)' 
                      }}>
                        <strong>📅 Período corregido:</strong> {r.justificacion_fechas}
                      </div>
                    )}

                    <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                      Subido: {new Date(r.fecha_subida).toLocaleDateString('es-CO')}
                    </p>

                    <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
                      {getReceiptViewerUrl(r) && (
                        <a href={getReceiptViewerUrl(r)} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
                          <ExternalLink size={14} /> Ver
                        </a>
                      )}
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--accent-cyan)', borderColor: 'rgba(56, 189, 248, 0.3)' }}
                        onClick={() => handleOpenEditarFechas(r)}
                        title="Cambiar las fechas de facturación de este recibo con justificación"
                      >
                        <Calendar size={13} /> Cambiar Período
                      </button>
                    </div>

                    {r.estado === 'en_revision' && (
                      <div style={{ display: 'flex', gap: 8, marginTop: 10 }} onClick={e => e.stopPropagation()}>
                        <button className="btn btn-success btn-sm btn-full" onClick={() => { setSelectedRecibo(r); setNota(''); }}>
                          <Check size={14} /> Revisar
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          /* SECCIÓN DE MULTAS Y COBROS EXTRAS */
          <div>
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h3 className="card-title" style={{ margin: 0 }}>Multas y Cobros Adicionales</h3>
                  <p className="card-subtitle" style={{ margin: '4px 0 0' }}>
                    Agrega multas por mora o cobros extras personalizados. Los cobros y sus justificaciones aparecerán automáticamente en el panel de cada usuario.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => handleOpenCrearCobro('multa')}
                  >
                    <Plus size={14} /> Agregar Multa ($20.000)
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => handleOpenCrearCobro('extra')}
                  >
                    <Plus size={14} /> Agregar Cobro Extra
                  </button>
                </div>
              </div>

              {/* Filtros de cobros */}
              <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
                {[
                  { key: 'todos', label: 'Todos', count: cobrosAdicionales.length },
                  { key: 'pendiente', label: 'Pendientes por cobrar', count: cobrosAdicionales.filter(c => c.estado === 'pendiente').length },
                  { key: 'pagado', label: 'Pagados', count: cobrosAdicionales.filter(c => c.estado === 'pagado').length },
                  { key: 'multa', label: 'Solo Multas', count: cobrosAdicionales.filter(c => c.tipo === 'multa').length },
                  { key: 'extra', label: 'Solo Cobros Extras', count: cobrosAdicionales.filter(c => c.tipo === 'extra').length },
                ].map(f => (
                  <button
                    key={f.key}
                    type="button"
                    className={`btn btn-sm ${filtroCobros === f.key ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setFiltroCobros(f.key)}
                  >
                    {f.label} ({f.count})
                  </button>
                ))}
              </div>
            </div>

            {loadingCobros ? (
              <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
            ) : cobrosFiltrados.length === 0 ? (
              <div className="empty-state card" style={{ padding: 40, textAlign: 'center' }}>
                <DollarSign size={40} color="var(--text-muted)" style={{ margin: '0 auto 12px' }} />
                <h3>No hay cobros registrados</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: 13, maxWidth: 400, margin: '0 auto 16px' }}>
                  Puedes agregar una multa o un cobro adicional para asignárselo a cualquier cliente.
                </p>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => handleOpenCrearCobro('multa')}
                >
                  <Plus size={14} /> Agregar primer cobro
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
                {cobrosFiltrados.map(cobro => {
                  const isMulta = cobro.tipo === 'multa';
                  const isPagado = cobro.estado === 'pagado';
                  return (
                    <div
                      key={cobro.id}
                      className="card"
                      style={{
                        borderLeft: isMulta ? '4px solid var(--accent-red)' : '4px solid var(--accent-cyan)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                          <span
                            className="badge"
                            style={{
                              background: isMulta ? 'rgba(239, 68, 68, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                              color: isMulta ? 'var(--accent-red)' : 'var(--accent-cyan)',
                              border: isMulta ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(56, 189, 248, 0.3)',
                              fontSize: 11,
                              fontWeight: 700
                            }}
                          >
                            {isMulta ? '🛑 MULTA' : '➕ COBRO EXTRA'}
                          </span>

                          <button
                            type="button"
                            className={`badge ${isPagado ? 'badge-approved' : 'badge-pending'}`}
                            style={{ cursor: 'pointer', border: 'none' }}
                            onClick={() => handleToggleEstadoCobro(cobro)}
                            title="Click para cambiar estado"
                          >
                            {isPagado ? '✓ Pagado' : '⏳ Pendiente'}
                          </button>
                        </div>

                        <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px', color: 'var(--text-primary)' }}>
                          {cobro.concepto}
                        </h3>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '8px 0', padding: '6px 10px', background: 'var(--bg-secondary)', borderRadius: 8 }}>
                          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Valor a cobrar:</span>
                          <strong style={{ fontSize: 16, color: 'var(--accent-green)', fontFamily: 'monospace' }}>
                            ${Number(cobro.valor || 0).toLocaleString('es-CO')} COP
                          </strong>
                        </div>

                        <div style={{ fontSize: 12, marginBottom: 8 }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Cliente: </span>
                          <strong style={{ color: 'var(--text-primary)' }}>{cobro.usuario_nombre}</strong>
                        </div>

                        {/* Justificación obligatoria */}
                        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px', fontSize: 12, marginBottom: 8 }}>
                          <strong style={{ color: 'var(--text-muted)', fontSize: 11, display: 'block', textTransform: 'uppercase' }}>
                            Justificación para el usuario:
                          </strong>
                          <p style={{ margin: '4px 0 0', color: 'var(--text-primary)', fontStyle: 'italic' }}>
                            "{cobro.justificacion}"
                          </p>
                        </div>

                        <small style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                          Fecha asignada: {cobro.fecha}
                        </small>
                      </div>

                      <div style={{ display: 'flex', gap: 8, marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          style={{ flex: 1, fontSize: 11.5 }}
                          onClick={() => handleToggleEstadoCobro(cobro)}
                        >
                          {isPagado ? 'Marcar Pendiente' : 'Marcar Pagado'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          style={{ padding: '0 10px' }}
                          onClick={() => handleEliminarCobro(cobro.id)}
                          title="Eliminar este cobro"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL PARA EDITAR FECHAS DE FACTURACIÓN CON JUSTIFICACIÓN */}
      {editingReciboFechas && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setEditingReciboFechas(null)}>
          <div className="modal-box" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 17, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Calendar size={18} color="var(--accent-cyan)" />
                Cambiar Período de Facturación
              </h2>
              <button className="modal-close" onClick={() => setEditingReciboFechas(null)}><X size={16} /></button>
            </div>

            <form onSubmit={handleGuardarFechas}>
              <div className="modal-body">
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>
                  Usuario: <strong>{editingReciboFechas.usuario_nombre}</strong>
                  <br />
                  <span style={{ fontSize: 12 }}>Período actual: {editingReciboFechas.fecha_inicio} al {editingReciboFechas.fecha_fin}</span>
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Nueva Fecha Inicio</label>
                    <input
                      type="date"
                      className="form-input"
                      value={nuevaFechaInicio}
                      onChange={e => setNuevaFechaInicio(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Nueva Fecha Fin</label>
                    <input
                      type="date"
                      className="form-input"
                      value={nuevaFechaFin}
                      onChange={e => setNuevaFechaFin(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Justificación del Cambio (Aparecerá al usuario)</label>
                  <textarea
                    className="form-textarea"
                    rows={3}
                    placeholder="Ej: El cliente cargó el recibo en el mes equivocado. Corregido al período correspondiente del 12 al 11."
                    value={justificacionFechas}
                    onChange={e => setJustificacionFechas(e.target.value)}
                    required
                  />
                  <small style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 4, display: 'block' }}>
                    Esta justificación quedará registrada y el usuario la podrá ver en su historial de pagos.
                  </small>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setEditingReciboFechas(null)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={guardandoFechas}>
                  {guardandoFechas ? 'Guardando...' : 'Guardar y Actualizar Facturación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PARA AGREGAR COBRO ADICIONAL / MULTA */}
      {modalCobroOpen && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalCobroOpen(false)}>
          <div className="modal-box" style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 17, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Plus size={18} color="var(--accent-green)" />
                {tipoCobro === 'multa' ? 'Agregar Multa a Usuario' : 'Agregar Cobro Extra'}
              </h2>
              <button className="modal-close" onClick={() => setModalCobroOpen(false)}><X size={16} /></button>
            </div>

            <form onSubmit={handleGuardarCobro}>
              <div className="modal-body">
                {/* Selector de Tipo */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                  <button
                    type="button"
                    className={`btn ${tipoCobro === 'multa' ? 'btn-danger' : 'btn-ghost'}`}
                    style={{ fontSize: 13, padding: '10px 14px' }}
                    onClick={() => {
                      setTipoCobro('multa');
                      setCobroConcepto('Multa por mora');
                      setCobroValor(20000);
                    }}
                  >
                    🛑 Multa ($20.000)
                  </button>
                  <button
                    type="button"
                    className={`btn ${tipoCobro === 'extra' ? 'btn-primary' : 'btn-ghost'}`}
                    style={{ fontSize: 13, padding: '10px 14px' }}
                    onClick={() => {
                      setTipoCobro('extra');
                      setCobroConcepto('');
                      setCobroValor('');
                    }}
                  >
                    ➕ Cobro Extra Libre
                  </button>
                </div>

                {/* Selección de Usuario */}
                <div className="form-group">
                  <label>Seleccionar Usuario / Cliente</label>
                  <select
                    className="form-input"
                    value={cobroUsuarioId}
                    onChange={e => setCobroUsuarioId(e.target.value)}
                    required
                  >
                    {usuariosList.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.nombre} ({u.placa_carro || u.placa_moto || u.placa || 'Sin placa'} · {u.correo || u.telefono})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Concepto y Valor */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label>Concepto del Cobro</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Ej: Invasión de puesto"
                      value={cobroConcepto}
                      onChange={e => setCobroConcepto(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Valor ($ COP)</label>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="20000"
                      value={cobroValor}
                      onChange={e => setCobroValor(e.target.value)}
                      required
                      min={100}
                    />
                    {tipoCobro === 'multa' && (
                      <small style={{ color: 'var(--text-secondary)', fontSize: 11, display: 'block', marginTop: 2 }}>
                        Editable (Valor estándar: $20.000)
                      </small>
                    )}
                  </div>
                </div>

                {/* Fecha */}
                <div className="form-group">
                  <label>Fecha del Cobro</label>
                  <input
                    type="date"
                    className="form-input"
                    value={cobroFecha}
                    onChange={e => setCobroFecha(e.target.value)}
                    required
                  />
                </div>

                {/* Justificación obligatoria */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Justificación / Motivo (Aparecerá al usuario)</label>
                  <textarea
                    className="form-textarea"
                    rows={3}
                    placeholder="Ej: Se aplica multa por retraso en el pago del ciclo anterior sin previo aviso."
                    value={cobroJustificacion}
                    onChange={e => setCobroJustificacion(e.target.value)}
                    required
                  />
                  <small style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 4, display: 'block' }}>
                    Esta justificación se mostrará claramente en la aplicación del cliente.
                  </small>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setModalCobroOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={guardandoCobro}>
                  {guardandoCobro ? 'Guardando...' : `Guardar ${tipoCobro === 'multa' ? 'Multa' : 'Cobro'}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de revisión de recibo */}
      {selectedRecibo && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setSelectedRecibo(null)}>
          <div className="modal-box modal-lg">
            <div className="modal-header">
              <h2>Revisar Recibo — {selectedRecibo.usuario_nombre}</h2>
              <button className="modal-close" onClick={() => setSelectedRecibo(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', gap: 8, marginBottom: 12, fontSize: 13, color: 'var(--text-secondary)', flexWrap: 'wrap', alignItems: 'center' }}>
                <span>📅 {formatPeriodoLabel(selectedRecibo)}</span>
                <span>·</span>
                <span>📧 {selectedRecibo.usuario_correo}</span>
                <span>·</span>
                <EstadoBadge estado={selectedRecibo.estado} />
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ color: 'var(--accent-cyan)', borderColor: 'rgba(56,189,248,0.3)', padding: '2px 8px', fontSize: 11 }}
                  onClick={() => handleOpenEditarFechas(selectedRecibo)}
                >
                  <Calendar size={12} /> Editar Período
                </button>
              </div>

              {selectedRecibo.justificacion_fechas && (
                <div style={{ 
                  marginBottom: 14, 
                  background: 'rgba(56, 189, 248, 0.08)', 
                  border: '1px solid rgba(56, 189, 248, 0.3)', 
                  borderRadius: 8, 
                  padding: '8px 12px', 
                  fontSize: 12, 
                  color: 'var(--accent-cyan)' 
                }}>
                  <strong>ℹ️ Período corregido por admin:</strong> {selectedRecibo.justificacion_fechas}
                </div>
              )}

              {getReceiptMediaUrl(selectedRecibo) && !brokenImages[selectedRecibo.id] && (
                <div style={{ marginBottom: 16, position: 'relative' }}>
                  <img
                    src={getReceiptMediaUrl(selectedRecibo, Boolean(imageRetries[selectedRecibo.id]))}
                    alt="recibo"
                    onError={() => handleImageError(selectedRecibo.id)}
                    style={{ width: '100%', maxHeight: 340, objectFit: 'contain', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}
                  />
                </div>
              )}

              {getReceiptViewerUrl(selectedRecibo) && (
                <a href={getReceiptViewerUrl(selectedRecibo)} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" style={{ marginBottom: 16 }}>
                  <ExternalLink size={14} /> Ver recibo original
                </a>
              )}

              {selectedRecibo.estado === 'en_revision' && (
                <div className="form-group">
                  <label>Nota / Comentario (requerido para rechazo)</label>
                  <textarea
                    className="form-textarea"
                    value={nota}
                    onChange={e => setNota(e.target.value)}
                    placeholder="Ej: Pago aprobado. / El monto no coincide, por favor resubir."
                    rows={3}
                  />
                </div>
              )}

              {selectedRecibo.admin_nota && selectedRecibo.estado !== 'en_revision' && (
                <div style={{ background: 'var(--bg-secondary)', padding: '12px 14px', borderRadius: 8, fontSize: 13 }}>
                  <strong>Nota registrada:</strong> {selectedRecibo.admin_nota}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setSelectedRecibo(null)}>Cerrar</button>
              {selectedRecibo.estado === 'en_revision' && (
                <>
                  <button className="btn btn-danger" onClick={() => handleRechazar(selectedRecibo)} disabled={processing}>
                    {processing ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : <X size={15} />}
                    Rechazar
                  </button>
                  <button className="btn btn-success" onClick={() => handleAprobar(selectedRecibo)} disabled={processing}>
                    {processing ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : <Check size={15} />}
                    Aprobar
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Registrar Pago / Marcar Período Pagado */}
      <ModalRegistrarPago
        isOpen={modalPagoOpen}
        onClose={() => setModalPagoOpen(false)}
        onSuccess={handlePagoRegistradoExitoso}
        usuarioInicial={usuarioParaPago}
        periodoInicial={periodoParaPago}
        usuariosDisponibles={usuariosList}
      />

      {toast && (
        <div className="toast-container">
          <div className={`toast ${toast.type === 'success' ? 'toast-success' : 'toast-error'}`}>
            {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
            {toast.msg}
          </div>
        </div>
      )}
    </div>
  );
}

function EstadoBadge({ estado }) {
  if (estado === 'aprobado') return <span className="badge badge-approved">Aprobado</span>;
  if (estado === 'rechazado') return <span className="badge badge-rejected">Rechazado</span>;
  return <span className="badge badge-review">En revisión</span>;
}
