// ============================================================
// API — Conexión con Google Apps Script
// ============================================================

const GAS_URL =
  'https://script.google.com/macros/s/AKfycbwjGgQoZkrz9MAvU4m9Yg-ylFfiXoybwlNbF5Z2l57KajSJzQfR31iCOIXARoJdCCpr4g/exec';

// ============================================================
// UTILIDAD BASE
// ============================================================

async function callAPI(action, payload = {}) {
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
      return JSON.parse(text);
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
  callAPI('crearUsuario', data);

export const apiActualizarUsuario = data =>
  callAPI('actualizarUsuario', data);

export const apiEliminarUsuario = id =>
  callAPI('eliminarUsuario', { id });

// ============================================================
// RECIBOS
// ============================================================

export const apiGetRecibos = (userId = 'all') =>
  callAPI('getRecibos', { userId });

export const apiAprobarRecibo = (id, nota = '') =>
  callAPI('aprobarRecibo', {
    id,
    nota
  });

export const apiRechazarRecibo = (id, nota = '') =>
  callAPI('rechazarRecibo', {
    id,
    nota
  });

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
  callAPI('updatePuesto', data);

export const apiUpdateConfigPuestos = data =>
  callAPI('updateConfigPuestos', data);

// ============================================================
// SOLICITUDES
// ============================================================

export const apiGetSolicitudes = (userId = 'all') =>
  callAPI('getSolicitudes', {
    userId
  });

export const apiCrearSolicitud = data =>
  callAPI('crearSolicitud', data);

export const apiResponderSolicitud = (id, respuesta) =>
  callAPI('responderSolicitud', {
    id,
    respuesta
  });

// ============================================================
// CIERRE DE MES Y GASTOS
// ============================================================

export const apiGetCierreMes = (startDate, endDate) =>
  callAPI('getCierreMes', {
    startDate,
    endDate
  });

export const apiAgregarGasto = data =>
  callAPI('agregarGasto', data);

export const apiEliminarGasto = id =>
  callAPI('eliminarGasto', { id });

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