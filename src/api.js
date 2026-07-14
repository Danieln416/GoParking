// ============================================================
// API — Conexión con Google Apps Script
// Reemplaza GAS_URL con la URL de tu Web App desplegada
// ============================================================

const GAS_URL = 'https://script.google.com/macros/s/AKfycbxTxeJFuJ72aGkPxsoXm-eppdAazifObwDX69oBbEr5jnSuS0Hi21daqW0Xut-ckI1zZw/exec';

async function callAPI(action, payload = {}) {
  try {
    const res = await fetch(GAS_URL, {
      method: 'POST',
      body: JSON.stringify({ action, ...payload }),
    });
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      return { success: false, error: 'Respuesta inválida del servidor: ' + text };
    }
  } catch (err) {
    return { success: false, error: 'Error de red: ' + err.message };
  }
}

// Auth
export const apiLogin = (correo, contrasena) =>
  callAPI('login', { correo, contrasena });

// Usuarios
export const apiGetUsuarios = () => callAPI('getUsuarios');
export const apiCrearUsuario = (data) => callAPI('crearUsuario', data);
export const apiActualizarUsuario = (data) => callAPI('actualizarUsuario', data);
export const apiEliminarUsuario = (id) => callAPI('eliminarUsuario', { id });

// Recibos
export const apiGetRecibos = (userId = 'all') => callAPI('getRecibos', { userId });
export const apiAprobarRecibo = (id, nota = '') => callAPI('aprobarRecibo', { id, nota });
export const apiRechazarRecibo = (id, nota = '') => callAPI('rechazarRecibo', { id, nota });

export const apiSubirRecibo = async (userId, userName, userEmail, mes, anio, file) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64Data = e.target.result.split(',')[1];
      const result = await callAPI('subirRecibo', {
        userId, userName, userEmail, mes, anio,
        base64Data,
        fileName: file.name,
        mimeType: file.type,
      });
      resolve(result);
    };
    reader.readAsDataURL(file);
  });
};

// Puestos
export const apiGetPuestos = () => callAPI('getPuestos');
export const apiUpdatePuesto = (data) => callAPI('updatePuesto', data);
export const apiUpdateConfigPuestos = (data) => callAPI('updateConfigPuestos', data);

// Solicitudes
export const apiGetSolicitudes = (userId = 'all') => callAPI('getSolicitudes', { userId });
export const apiCrearSolicitud = (data) => callAPI('crearSolicitud', data);
export const apiResponderSolicitud = (id, respuesta) => callAPI('responderSolicitud', { id, respuesta });

// Cierre de mes
export const apiGetCierreMes = (mes, anio) => callAPI('getCierreMes', { mes, anio });
export const apiAgregarGasto = (data) => callAPI('agregarGasto', data);
export const apiEliminarGasto = (id) => callAPI('eliminarGasto', { id });

// Mapa
export const apiGetParkingMapUrl = () => callAPI('getParkingMapUrl');
