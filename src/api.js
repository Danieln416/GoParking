// ============================================================
// API — Conexión con Google Apps Script
// ============================================================

const GAS_URL =
  'https://script.google.com/macros/s/AKfycbwjGgQoZkrz9MAvU4m9Yg-ylFfiXoybwlNbF5Z2l57KajSJzQfR31iCOIXARoJdCCpr4g/exec';

const READ_CACHE_TTL = 30000;
const readCache = new Map();
const pendingReads = new Map();

const READ_ACTIONS = new Set([
  'getUsuarios',
  'getRecibos',
  'getPuestos',
  'getPuestosUsuario',
  'getSolicitudes',
  'getCierreMes',
  'getGastos',
  'getParkingMapUrl'
]);

// ============================================================
// UTILIDAD BASE
// ============================================================

async function callAPI(action, payload = {}) {
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
  try {
    const response = await fetch(GAS_URL, {
      method: 'POST',
      body: JSON.stringify({
        action,
        ...payload
      })
    });

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
    return {
      success: false,
      error: 'Error de red: ' + error.message
    };
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