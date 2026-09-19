// ============================================================
// API — Conexión con Google Apps Script
// ============================================================

const GAS_URL =
  'https://script.google.com/macros/s/AKfycbzmLzNwfJuD4p6sSkE82xhxCGV7-M_CMVKbrXosv6hua2qsYvRWGvMmSl0RO4oiDDY2-A/exec';

const READ_CACHE_TTL = 10000;
const API_TIMEOUT_MS = 15000;
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
  'getParkingMapUrl'
]);

function clearExpiredReadCache() {
  const now = Date.now();

  for (const [key, entry] of readCache.entries()) {
    if (now - entry.timestamp >= READ_CACHE_TTL) {
      readCache.delete(key);
    }
  }
}

if (typeof window !== 'undefined') {
  window.setInterval(clearExpiredReadCache, READ_CACHE_TTL);
}

// ============================================================
// UTILIDAD BASE
// ============================================================

async function callAPI(action, payload = {}) {
  clearExpiredReadCache();

  const cacheKey = JSON.stringify([action, payload]);
  const isRead = READ_ACTIONS.has(action);
  const cached = readCache.get(cacheKey);

  if (isRead && cached && Date.now() - cached.timestamp < READ_CACHE_TTL) {
    return cached.value;
  }

  if (isRead && pendingReads.has(cacheKey)) {
    return pendingReads.get(cacheKey);
  }

  const request = (async () => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), API_TIMEOUT_MS);
    const requestUrl = GAS_URL;
    const requestOptions = {
      method: 'POST',
      cache: 'no-store',
      signal: controller.signal
    };

    requestOptions.body = JSON.stringify({
      action,
      ...payload
    });

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
      window.clearTimeout(timeoutId);
    }
  })();

  if (isRead) {
    pendingReads.set(cacheKey, request);
    request.finally(() => pendingReads.delete(cacheKey));
  }

  return request;
}

function invalidateReads() {
  readCache.clear();
}

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

export const apiGetUsuarios = () =>
  callAPI('getUsuarios');

export const apiGetAdminResumen = () =>
  callAPI('getAdminResumen').then(result => {
    if (result.success || !String(result.error || '').includes('Acción no reconocida')) {
      return result;
    }

    return Promise.all([
      callAPI('getUsuarios'),
      callAPI('getRecibos', { userId: 'all' }),
      callAPI('getPuestos'),
      callAPI('getSolicitudes', { userId: 'all' })
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
  callAPI('crearUsuario', data).then(result => { invalidateReads(); return result; });

export const apiActualizarUsuario = data =>
  callAPI('actualizarUsuario', data).then(result => { invalidateReads(); return result; });

export const apiEliminarUsuario = id =>
  callAPI('eliminarUsuario', { id }).then(result => { invalidateReads(); return result; });

// ============================================================
// RECIBOS
// ============================================================

export const apiGetRecibos = (userId = 'all') =>
  callAPI('getRecibos', { userId });

export const apiAprobarRecibo = (id, nota = '') =>
  callAPI('aprobarRecibo', {
    id,
    nota
  }).then(result => { invalidateReads(); return result; });

export const apiRechazarRecibo = (id, nota = '') =>
  callAPI('rechazarRecibo', {
    id,
    nota
  }).then(result => { invalidateReads(); return result; });

export const apiSubirRecibo = (
  userId,
  userName,
  userEmail,
  fechaInicio,
  fechaFin,
  mes,
  anio,
  file
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
        base64Data,
        fileName: file.name,
        mimeType: file.type
      });

      invalidateReads();

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

export const apiGetPuestos = () =>
  callAPI('getPuestos');

export const apiGetPuestosUsuario = userId =>
  callAPI('getPuestosUsuario', {
    userId
  });

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
  });

export const apiUpdatePuesto = data =>
  callAPI('updatePuesto', data).then(result => { invalidateReads(); return result; });

export const apiUpdateConfigPuestos = data =>
  callAPI('updateConfigPuestos', data).then(result => { invalidateReads(); return result; });

// ============================================================
// SOLICITUDES
// ============================================================

export const apiGetSolicitudes = (userId = 'all') =>
  callAPI('getSolicitudes', {
    userId
  });

export const apiCrearSolicitud = data =>
  callAPI('crearSolicitud', data).then(result => { invalidateReads(); return result; });

export const apiResponderSolicitud = (id, respuesta) =>
  callAPI('responderSolicitud', {
    id,
    respuesta
  }).then(result => { invalidateReads(); return result; });

// ============================================================
// CIERRE DE MES Y GASTOS
// ============================================================

export const apiGetCierreMes = (startDate, endDate) =>
  callAPI('getCierreMes', {
    startDate,
    endDate
  });

export const apiAgregarGasto = data =>
  callAPI('agregarGasto', data).then(result => { invalidateReads(); return result; });

export const apiEliminarGasto = id =>
  callAPI('eliminarGasto', { id }).then(result => { invalidateReads(); return result; });

export const apiCerrarMes = (startDate, endDate) =>
  callAPI('cerrarMes', { startDate, endDate }).then(result => {
    invalidateReads();
    return result;
  });

export const apiGetGastos = (startDate, endDate) =>
  callAPI('getGastos', {
    startDate,
    endDate
  });

// ============================================================
// MAPA DEL PARQUEADERO
// ============================================================

export const apiGetParkingMapUrl = () =>
  callAPI('getParkingMapUrl');