// ============================================================
// API — Conexión optimizada con Google Apps Script
// ============================================================

const GAS_URL =
  'https://script.google.com/macros/s/AKfycbzmLzNwfJuD4p6sSkE82xhxCGV7-M_CMVKbrXosv6hua2qsYvRWGvMmSl0RO4oiDDY2-A/exec';

// Configuración de caché
const READ_CACHE_TTL = 180000; // 3 minutos de frescura óptima
const STALE_CACHE_TTL = 600000; // Hasta 10 minutos para servir datos inmediatos (SWR)
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

// Helper para almacenamiento en sessionStorage
const STORAGE_PREFIX = 'goparking_cache_';

function getSessionCache(key) {
  if (typeof window === 'undefined' || !window.sessionStorage) return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setSessionCache(key, entry) {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    window.sessionStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(entry));
  } catch {
    // Si la cuota de sessionStorage se llena, no bloquea la ejecución
  }
}

function removeSessionCache(key) {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    window.sessionStorage.removeItem(STORAGE_PREFIX + key);
  } catch {}
}

function clearSessionCache(prefixes = []) {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    const keys = Object.keys(window.sessionStorage);
    for (const k of keys) {
      if (k.startsWith(STORAGE_PREFIX)) {
        if (!prefixes.length || prefixes.some(p => k.includes(p))) {
          window.sessionStorage.removeItem(k);
        }
      }
    }
  } catch {}
}

// Limpieza periódica en memoria
function clearExpiredReadCache() {
  const now = Date.now();
  for (const [key, entry] of readCache.entries()) {
    if (now - entry.timestamp >= STALE_CACHE_TTL) {
      readCache.delete(key);
      removeSessionCache(key);
    }
  }
}

if (typeof window !== 'undefined') {
  window.setInterval(clearExpiredReadCache, 60000);
}

// ============================================================
// UTILIDAD BASE CON SWR (Stale-While-Revalidate)
// ============================================================

async function callAPI(action, payload = {}, options = {}) {
  const { forceRefresh = false } = options;
  const cacheKey = JSON.stringify([action, payload]);
  const isRead = READ_ACTIONS.has(action);

  if (isRead && !forceRefresh) {
    let cached = readCache.get(cacheKey);
    if (!cached) {
      cached = getSessionCache(cacheKey);
      if (cached) {
        readCache.set(cacheKey, cached);
      }
    }

    const now = Date.now();
    if (cached) {
      const age = now - cached.timestamp;
      // 1. Si está fresco (< 3 mins), retornar de inmediato en 0 ms
      if (age < READ_CACHE_TTL) {
        return cached.value;
      }

      // 2. Si es stale pero aún válido (< 10 mins), retornar inmediatamente y revalidar en segundo plano
      if (age < STALE_CACHE_TTL) {
        // Lanzar revalidación en segundo plano sin esperar
        fetchFresh(action, payload, cacheKey).catch(() => {});
        return cached.value;
      }
    }

    // 3. Deduplicar peticiones idénticas en vuelo
    if (pendingReads.has(cacheKey)) {
      return pendingReads.get(cacheKey);
    }
  }

  const request = fetchFresh(action, payload, cacheKey);

  if (isRead) {
    pendingReads.set(cacheKey, request);
    request.finally(() => pendingReads.delete(cacheKey));
  }

  return request;
}

async function fetchFresh(action, payload, cacheKey) {
  const isRead = READ_ACTIONS.has(action);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  const useGet = isRead || action === 'login';
  const query = new URLSearchParams({
    action,
    ...payload
  });
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
        const entry = { timestamp: Date.now(), value };
        readCache.set(cacheKey, entry);
        setSessionCache(cacheKey, entry);
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
 * Invalida selectivamente la caché para ciertas acciones o completamente
 */
export function invalidateReads(prefixes = []) {
  if (!prefixes || prefixes.length === 0) {
    readCache.clear();
    clearSessionCache();
    return;
  }

  for (const key of readCache.keys()) {
    if (prefixes.some(p => key.includes(p))) {
      readCache.delete(key);
      removeSessionCache(key);
    }
  }
  clearSessionCache(prefixes);
}

export const apiClearCache = () => invalidateReads();

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