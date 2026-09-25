// ============================================================
// API — Conexión optimizada con Google Apps Script
// ============================================================

const GAS_URL =
  'https://script.google.com/macros/s/AKfycbzmLzNwfJuD4p6sSkE82xhxCGV7-M_CMVKbrXosv6hua2qsYvRWGvMmSl0RO4oiDDY2-A/exec';

// Configuración de caché
const READ_CACHE_TTL = 2000; // Solo 2 segundos para deduplicar componentes que se montan al mismo tiempo
const API_TIMEOUT_MS = 30000; // 30s de timeout para prevenir cortes en cold starts

const readCache = new Map();
const pendingReads = new Map();

const READ_ACTIONS = new Set([
  'getUsuarios',
  'getAdminResumen',
  'getRecibos',
  'getPuestos',
  'getPuestosUsuario',
  'getSolicitudes',
  'getCierreMes',
  'getGastos',
  'getParkingMapUrl',
  'getCuentasPago'
]);

// Limpieza retroactiva: eliminar cualquier residuo de sessionStorage de versiones anteriores
if (typeof window !== 'undefined' && window.sessionStorage) {
  try {
    const keys = Object.keys(window.sessionStorage);
    for (const k of keys) {
      if (k.startsWith('goparking_cache_')) {
        window.sessionStorage.removeItem(k);
      }
    }
  } catch {}
}

// ============================================================
// UTILIDAD BASE (Llamadas en tiempo real sin almacenamiento en disco)
// ============================================================

async function callAPI(action, payload = {}, options = {}) {
  const { forceRefresh = false } = options;
  const cacheKey = JSON.stringify([action, payload]);
  const isRead = READ_ACTIONS.has(action);

  if (isRead && !forceRefresh) {
    const cached = readCache.get(cacheKey);
    const now = Date.now();

    // Solo devolver de memoria si fue consultado en los últimos 2 segundos
    if (cached && (now - cached.timestamp < READ_CACHE_TTL)) {
      return cached.value;
    }

    // Deduplicar peticiones idénticas en vuelo (evita disparar 2 peticiones al mismo tiempo)
    if (pendingReads.has(cacheKey)) {
      return pendingReads.get(cacheKey);
    }
  }

  const request = fetchFresh(action, payload, cacheKey, forceRefresh);

  if (isRead) {
    pendingReads.set(cacheKey, request);
    request.finally(() => pendingReads.delete(cacheKey));
  }

  return request;
}

async function fetchFresh(action, payload, cacheKey, forceRefresh = false) {
  const isRead = READ_ACTIONS.has(action);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  const useGet = isRead || action === 'login';

  const queryParams = {
    action,
    ...payload,
    _t: Date.now() // Previene que el navegador o proxies intermedios sirvan respuestas 302 o GET cacheadas
  };

  if (forceRefresh) {
    queryParams.nocache = '1';
  }

  const query = new URLSearchParams(queryParams);
  const requestUrl = useGet ? `${GAS_URL}?${query}` : GAS_URL;
  const requestOptions = {
    method: useGet ? 'GET' : 'POST',
    cache: 'no-store',
    signal: controller.signal
  };

  if (!useGet) {
    requestOptions.body = JSON.stringify({ action, ...payload });
  }

  try {
    const response = await fetch(requestUrl, requestOptions);
    const text = await response.text();

    try {
      const value = JSON.parse(text);
      if (isRead && value.success) {
        readCache.set(cacheKey, { timestamp: Date.now(), value });
      }
      return value;
    } catch {
      return {
        success: false,
        error: 'Respuesta inválida del servidor: ' + text
      };
    }
  } catch (error) {
    const message = error.name === 'AbortError'
      ? 'El servidor tardó demasiado en responder'
      : 'Error de red: ' + error.message;

    return {
      success: false,
      error: message
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Invalida completamente la memoria caché para forzar lecturas frescas
 */
export function invalidateReads() {
  readCache.clear();
  pendingReads.clear();
}

export const apiClearCache = () => {
  invalidateReads();
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      const keys = Object.keys(window.sessionStorage);
      for (const k of keys) {
        if (k.startsWith('goparking_cache_')) {
          window.sessionStorage.removeItem(k);
        }
      }
    } catch {}
  }
};

// ============================================================
// AUTENTICACION
// ============================================================

export const apiLogin = (correo, contrasena) =>
  callAPI('login', {
    correo,
    contrasena
  });

// ============================================================
// USUARIOS
// ============================================================

export const apiGetUsuarios = (options = {}) =>
  callAPI('getUsuarios', {}, options);

export const apiGetAdminResumen = (options = {}) =>
  callAPI('getAdminResumen', {}, options).then(result => {
    if (result.success || !String(result.error || '').includes('Acción no reconocida')) {
      return result;
    }

    return Promise.all([
      callAPI('getUsuarios', {}, options),
      callAPI('getRecibos', { userId: 'all' }, options),
      callAPI('getPuestos', {}, options),
      callAPI('getSolicitudes', { userId: 'all' }, options)
    ]).then(([usuarios, recibos, puestos, solicitudes]) => {
      const listaRecibos = recibos.success ? recibos.data || [] : [];
      const listaPuestos = puestos.success ? puestos.data || [] : [];
      const listaSolicitudes = solicitudes.success ? solicitudes.data || [] : [];

      return {
        success: true,
        data: {
          usuarios: usuarios.success ? (usuarios.data || []).length : 0,
          recibosTotal: listaRecibos.length,
          enRevision: listaRecibos.filter(item => item.estado === 'en_revision').length,
          aprobados: listaRecibos.filter(item => item.estado === 'aprobado').length,
          puestosLibres: listaPuestos.filter(item => item.estado === 'libre').length,
          puestosOcupados: listaPuestos.filter(item => item.estado === 'ocupado').length,
          solicitudesPendientes: listaSolicitudes.filter(item => item.estado === 'pendiente').length,
          recientesRecibos: [...listaRecibos]
            .sort((a, b) => new Date(b.fecha_subida) - new Date(a.fecha_subida))
            .slice(0, 5)
        }
      };
    });
  });

export const apiCrearUsuario = data =>
  callAPI('crearUsuario', data).then(result => {
    if (result.success) invalidateReads(['getUsuarios', 'getAdminResumen', 'getPuestos']);
    return result;
  });

export const apiActualizarUsuario = data =>
  callAPI('actualizarUsuario', data).then(result => {
    if (result.success) invalidateReads(['getUsuarios', 'getAdminResumen', 'getPuestos']);
    return result;
  });

export const apiEliminarUsuario = id =>
  callAPI('eliminarUsuario', { id }).then(result => {
    if (result.success) invalidateReads(['getUsuarios', 'getAdminResumen', 'getPuestos']);
    return result;
  });

// ============================================================
// RECIBOS
// ============================================================

export const apiGetRecibos = (userId = 'all', options = {}) =>
  callAPI('getRecibos', { userId }, options);

export const apiAprobarRecibo = (id, nota = '') =>
  callAPI('aprobarRecibo', {
    id,
    nota
  }).then(result => {
    if (result.success) invalidateReads(['getRecibos', 'getAdminResumen', 'getCierreMes']);
    return result;
  });

export const apiRechazarRecibo = (id, nota = '') =>
  callAPI('rechazarRecibo', {
    id,
    nota
  }).then(result => {
    if (result.success) invalidateReads(['getRecibos', 'getAdminResumen', 'getCierreMes']);
    return result;
  });

export const apiSubirRecibo = (
  userId,
  userName,
  userEmail,
  fechaInicio,
  fechaFin,
  mes,
  anio,
  file,
  metodoPago = 'No especificado'
) => {
  return new Promise(resolve => {
    const reader = new FileReader();

    reader.onload = async event => {
      const base64Data = event.target.result.split(',')[1];

      const result = await callAPI('subirRecibo', {
        userId,
        userName,
        userEmail,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        fechaInicio,
        fechaFin,
        mes,
        anio,
        metodoPago,
        metodo_pago: metodoPago,
        base64Data,
        fileName: file.name,
        mimeType: file.type
      });

      if (result.success) {
        invalidateReads(['getRecibos', 'getAdminResumen', 'getCierreMes']);
      }

      resolve(result);
    };

    reader.onerror = () => {
      resolve({
        success: false,
        error: 'No fue posible leer el archivo seleccionado'
      });
    };

    reader.readAsDataURL(file);
  });
};

// ============================================================
// PUESTOS
// ============================================================

export const apiGetPuestos = (options = {}) =>
  callAPI('getPuestos', {}, options);

export const apiGetPuestosUsuario = (userId, options = {}) =>
  callAPI('getPuestosUsuario', { userId }, options);

export const apiAsignarPuestosUsuario = ({
  userId,
  userName,
  puestoCarroId = '',
  puestoMotoId = ''
}) =>
  callAPI('asignarPuestosUsuario', {
    userId,
    userName,
    puestoCarroId,
    puestoMotoId
  }).then(result => {
    if (result.success) invalidateReads(['getPuestos', 'getAdminResumen', 'getUsuarios']);
    return result;
  });

export const apiUpdatePuesto = data =>
  callAPI('updatePuesto', data).then(result => {
    if (result.success) invalidateReads(['getPuestos', 'getAdminResumen']);
    return result;
  });

export const apiUpdateConfigPuestos = data =>
  callAPI('updateConfigPuestos', data).then(result => {
    if (result.success) invalidateReads(['getPuestos', 'getAdminResumen']);
    return result;
  });

// ============================================================
// SOLICITUDES
// ============================================================

export const apiGetSolicitudes = (userId = 'all', options = {}) =>
  callAPI('getSolicitudes', { userId }, options);

export const apiCrearSolicitud = data =>
  callAPI('crearSolicitud', data).then(result => {
    if (result.success) invalidateReads(['getSolicitudes', 'getAdminResumen']);
    return result;
  });

export const apiResponderSolicitud = (id, respuesta) =>
  callAPI('responderSolicitud', {
    id,
    respuesta
  }).then(result => {
    if (result.success) invalidateReads(['getSolicitudes', 'getAdminResumen']);
    return result;
  });

// ============================================================
// CIERRE DE MES Y GASTOS
// ============================================================

export const apiGetCierreMes = (startDate, endDate, options = {}) =>
  callAPI('getCierreMes', {
    startDate,
    endDate
  }, options);

export const apiAgregarGasto = data =>
  callAPI('agregarGasto', data).then(result => {
    if (result.success) invalidateReads(['getGastos', 'getCierreMes']);
    return result;
  });

export const apiEliminarGasto = id =>
  callAPI('eliminarGasto', { id }).then(result => {
    if (result.success) invalidateReads(['getGastos', 'getCierreMes']);
    return result;
  });

export const apiCerrarMes = (startDate, endDate) =>
  callAPI('cerrarMes', { startDate, endDate }).then(result => {
    if (result.success) invalidateReads(['getCierreMes']);
    return result;
  });

export const apiGetGastos = (startDate, endDate, options = {}) =>
  callAPI('getGastos', {
    startDate,
    endDate
  }, options);

// ============================================================
// MAPA DEL PARQUEADERO
// ============================================================

export const apiGetParkingMapUrl = (options = {}) =>
  callAPI('getParkingMapUrl', {}, options);

// ============================================================
// CUENTAS Y OPCIONES DE PAGO
// ============================================================

const CUENTAS_STORAGE_KEY = 'goparking_cuentas_pago';

const DEFAULT_CUENTAS_PAGO = [
  {
    id: 'cuenta-nequi-1',
    nombre: 'Nequi Principal',
    entidad: 'Nequi',
    tipo_cuenta: 'Billetera Digital',
    numero: '3001234567',
    titular: 'Administración GoParking',
    qr_url: '',
    instrucciones: 'Enviar comprobante indicando tu nombre y número de bahía.',
    activo: true
  },
  {
    id: 'cuenta-bancolombia-1',
    nombre: 'Bancolombia Ahorros',
    entidad: 'Bancolombia',
    tipo_cuenta: 'Cuenta de Ahorros',
    numero: '123-456789-01',
    titular: 'Administración GoParking',
    qr_url: '',
    instrucciones: 'Transferencia directa o QR Bancolombia.',
    activo: true
  },
  {
    id: 'cuenta-daviplata-1',
    nombre: 'Daviplata',
    entidad: 'Daviplata',
    tipo_cuenta: 'Billetera Digital',
    numero: '3009876543',
    titular: 'Administración GoParking',
    qr_url: '',
    instrucciones: 'Acepta transferencias interbancarias inmediatas.',
    activo: true
  },
  {
    id: 'cuenta-efectivo-1',
    nombre: 'Pago en Efectivo',
    entidad: 'Efectivo',
    tipo_cuenta: 'Presencial',
    numero: 'Oficina / En mano',
    titular: 'Administrador / Vigilancia',
    qr_url: '',
    instrucciones: 'Pagar directamente en la oficina de administración.',
    activo: true
  }
];

function getLocalCuentasPago() {
  try {
    const raw = localStorage.getItem(CUENTAS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(CUENTAS_STORAGE_KEY, JSON.stringify(DEFAULT_CUENTAS_PAGO));
      return DEFAULT_CUENTAS_PAGO;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_CUENTAS_PAGO;
  } catch {
    return DEFAULT_CUENTAS_PAGO;
  }
}

function setLocalCuentasPago(cuentas) {
  try {
    localStorage.setItem(CUENTAS_STORAGE_KEY, JSON.stringify(cuentas));
  } catch (e) {
    console.error('Error guardando cuentas en localStorage:', e);
  }
}

export const apiGetCuentasPago = (options = {}) =>
  callAPI('getCuentasPago', {}, options).then(result => {
    if (result.success && Array.isArray(result.data) && result.data.length > 0) {
      setLocalCuentasPago(result.data);
      return result;
    }
    return { success: true, data: getLocalCuentasPago(), isLocal: true };
  }).catch(() => {
    return { success: true, data: getLocalCuentasPago(), isLocal: true };
  });

export const apiGuardarCuentaPago = (data) => {
  const current = getLocalCuentasPago();
  const id = data.id || `cuenta-${Date.now()}`;
  const nuevaCuenta = { ...data, id, activo: data.activo !== undefined ? data.activo : true };
  const exists = current.some(c => String(c.id) === String(id));
  const updated = exists 
    ? current.map(c => String(c.id) === String(id) ? nuevaCuenta : c)
    : [...current, nuevaCuenta];
  setLocalCuentasPago(updated);

  return callAPI('guardarCuentaPago', nuevaCuenta).then(result => {
    if (result.success) invalidateReads(['getCuentasPago']);
    return { success: true, data: result.data || nuevaCuenta };
  }).catch(() => {
    invalidateReads(['getCuentasPago']);
    return { success: true, data: nuevaCuenta, isLocal: true };
  });
};

export const apiEliminarCuentaPago = (id) => {
  const current = getLocalCuentasPago();
  const updated = current.filter(c => String(c.id) !== String(id));
  setLocalCuentasPago(updated);

  return callAPI('eliminarCuentaPago', { id }).then(result => {
    if (result.success) invalidateReads(['getCuentasPago']);
    return { success: true };
  }).catch(() => {
    invalidateReads(['getCuentasPago']);
    return { success: true, isLocal: true };
  });
};