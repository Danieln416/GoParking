// ============================================================
// PARKING APP — Google Apps Script Backend
// ============================================================

const CONFIG = {
  SPREADSHEET_ID: '1cnRWOd9LCBP7YwTa1htz2hj7q-zcRZvy',
  DRIVE_FOLDER_ID: '1OP2CmFbYzfpijR4Py5GGIbZ2zyYpkPN2',
  PARKING_MAP_FILE_ID: '1jK_g0EgFTTA8nabuLKiKXBU-zpmRLBbw',
  ADMIN_EMAIL: 'Daniram01031@gmail.com',
  ADMIN_PASSWORD: 'Admin2024',
  SECRET_KEY: 'parking_secret_key_2024'
};

// ============================================================
// ROUTER PRINCIPAL
// ============================================================

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents || '{}');
    let result;

    switch (data.action) {
      case 'login':
        result = login(data);
        break;

      case 'getUsuarios':
        result = getUsuarios();
        break;

      case 'getAdminResumen':
        result = getAdminResumen();
        break;

      case 'crearUsuario':
        result = crearUsuario(data);
        break;

      case 'actualizarUsuario':
        result = actualizarUsuario(data);
        break;

      case 'eliminarUsuario':
        result = eliminarUsuario(data);
        break;

      case 'getRecibos':
        result = getRecibos(data);
        break;

      case 'subirRecibo':
        result = subirRecibo(data);
        break;

      case 'aprobarRecibo':
        result = aprobarRecibo(data);
        break;

      case 'rechazarRecibo':
        result = rechazarRecibo(data);
        break;

      case 'getPuestos':
        result = getPuestos();
        break;

      case 'getPuestosUsuario':
        result = getPuestosUsuario(data);
        break;

      case 'asignarPuestosUsuario':
        result = asignarPuestosUsuario(data);
        break;

      case 'updatePuesto':
        result = updatePuesto(data);
        break;

      case 'updateConfigPuestos':
        result = updateConfigPuestos(data);
        break;

      case 'getSolicitudes':
        result = getSolicitudes(data);
        break;

      case 'crearSolicitud':
        result = crearSolicitud(data);
        break;

      case 'responderSolicitud':
        result = responderSolicitud(data);
        break;

      case 'getCierreMes':
        result = getCierreMes(data);
        break;

      case 'cerrarMes':
        result = cerrarMes(data);
        break;

      case 'agregarGasto':
        result = agregarGasto(data);
        break;

      case 'eliminarGasto':
        result = eliminarGasto(data);
        break;

      case 'getGastos':
        result = getGastos(data);
        break;

      case 'getParkingMapUrl':
        result = getParkingMapUrl();
        break;

      default:
        result = {
          success: false,
          error: 'Acción no reconocida: ' + data.action
        };
    }

    if (result && result.success && data.action !== 'login') {
      invalidateAppsScriptCache();
    }

    return buildResponse(result);
  } catch (error) {
    return buildResponse({
      success: false,
      error: error.message
    });
  }
}

function doGet(e) {
  const data = (e && e.parameter) || {};
  const action = data.action || '';

  if (action === 'initSheets') {
    initSheets();

    return ContentService.createTextOutput(
      'Hojas inicializadas correctamente.'
    );
  }

  if (action === 'migrateReceipts') {
    migrarColumnasRecibos();
    return ContentService.createTextOutput('Recibos migrados correctamente.');
  }

  if (action === 'ping') {
    return buildResponse({
      success: true,
      message: 'API Parqueadero OK'
    });
  }

  if (action === 'getAdminResumen') {
    return buildResponse(getAdminResumen());
  }

  if (action === 'login') {
    return buildResponse(login(data));
  }

  if (action === 'getUsuarios') {
    return buildResponse(getUsuarios());
  }

  if (action === 'getRecibos') {
    return buildResponse(getRecibos(data));
  }

  if (action === 'getPuestos') {
    return buildResponse(getPuestos());
  }

  if (action === 'getPuestosUsuario') {
    return buildResponse(getPuestosUsuario(data));
  }

  if (action === 'getSolicitudes') {
    return buildResponse(getSolicitudes(data));
  }

  if (action === 'getCierreMes') {
    return buildResponse(getCierreMes(data));
  }

  if (action === 'getGastos') {
    return buildResponse(getGastos(data));
  }

  return ContentService.createTextOutput('Parking App API v1.0');
}

function buildResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// INICIALIZACION DE HOJAS
// ============================================================

function initSheets() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);

  const sheetsConfig = {
    usuarios: [
      'id',
      'nombre',
      'cedula',
      'correo',
      'telefono',
      'celular',
      'direccion',
      'placa',
      'placa_carro',
      'placa_moto',
      'tipo_vehiculo',
      'tipo_tarifa',
      'valor_tarifa',
      'fecha_inicio',
      'fecha_fin',
      'contrasena',
      'rol',
      'fecha_creacion',
      'activo'
    ],

    recibos: [
      'id',
      'usuario_id',
      'usuario_nombre',
      'usuario_correo',
      'fecha_subida',
      'mes',
      'anio',
      'url_imagen',
      'file_id',
      'estado',
      'fecha_revision',
      'admin_nota'
    ],

    puestos: [
      'id',
      'numero',
      'tipo',
      'estado',
      'usuario_id',
      'usuario_nombre'
    ],

    solicitudes: [
      'id',
      'usuario_id',
      'usuario_nombre',
      'tipo',
      'asunto',
      'descripcion',
      'fecha',
      'estado',
      'respuesta'
    ],

    gastos: [
      'id',
      'mes',
      'anio',
      'descripcion',
      'valor',
      'fecha_registro'
    ],

    config: [
      'clave',
      'valor'
    ],

    cierres: [
      'id',
      'fecha_inicio',
      'fecha_fin',
      'fecha_cierre',
      'estado'
    ]
  };

  Object.keys(sheetsConfig).forEach(name => {
    let sheet = ss.getSheetByName(name);

    if (!sheet) {
      sheet = ss.insertSheet(name);
    }

    if (sheet.getLastRow() === 0) {
      sheet.appendRow(sheetsConfig[name]);
    }
  });

  asegurarColumnasUsuarios();
  asegurarColumnasRecibos();

  const configSheet = ss.getSheetByName('config');
  const existingKeys = sheetToObjects(configSheet).map(row => row.clave);

  const defaults = [
    ['total_puestos_carro', '20'],
    ['total_puestos_moto', '15'],
    ['total_puestos_bici', '10'],
    ['nombre_parqueadero', 'Parqueadero Central']
  ];

  defaults.forEach(([clave, valor]) => {
    if (!existingKeys.includes(clave)) {
      configSheet.appendRow([clave, valor]);
    }
  });

  const usuariosSheet = ss.getSheetByName('usuarios');
  const usuarios = sheetToObjects(usuariosSheet);

  if (!usuarios.some(usuario => usuario.rol === 'admin')) {
    appendUsuario(usuariosSheet, {
      id: generateId(),
      nombre: 'Administrador',
      cedula: '',
      correo: CONFIG.ADMIN_EMAIL,
      telefono: '',
      celular: '',
      direccion: '',
      placa: '',
      placa_carro: '',
      placa_moto: '',
      tipo_vehiculo: '',
      tipo_tarifa: '',
      valor_tarifa: 0,
      contrasena: hashPassword(CONFIG.ADMIN_PASSWORD),
      rol: 'admin',
      fecha_creacion: new Date().toISOString(),
      activo: 'TRUE'
    });
  }

  const puestosSheet = ss.getSheetByName('puestos');

  if (puestosSheet.getLastRow() <= 1) {
    const config = {};

    sheetToObjects(configSheet).forEach(item => {
      config[item.clave] = item.valor;
    });

    buildPuestos(puestosSheet, config);
  }
}

function asegurarColumnasUsuarios() {
  const sheet = getSheet('usuarios');
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  const columnasRequeridas = [
    'id',
    'nombre',
    'cedula',
    'correo',
    'telefono',
    'celular',
    'direccion',
    'placa',
    'placa_carro',
    'placa_moto',
    'tipo_vehiculo',
    'tipo_tarifa',
    'valor_tarifa',
    'fecha_inicio',
    'fecha_fin',
    'contrasena',
    'rol',
    'fecha_creacion',
    'activo'
  ];

  columnasRequeridas.forEach(columna => {
    if (!headers.includes(columna)) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(columna);
      headers.push(columna);
    }
  });
}

function appendUsuario(sheet, usuario) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  const row = headers.map(header =>
    usuario[header] !== undefined ? usuario[header] : ''
  );

  sheet.appendRow(row);
}

function buildPuestos(sheet, config) {
  const tipos = [
    {
      tipo: 'carro',
      total: parseInt(config.total_puestos_carro || 20, 10)
    },
    {
      tipo: 'moto',
      total: parseInt(config.total_puestos_moto || 15, 10)
    },
    {
      tipo: 'bici',
      total: parseInt(config.total_puestos_bici || 10, 10)
    }
  ];

  let numero = 1;

  tipos.forEach(({ tipo, total }) => {
    for (let i = 0; i < total; i++) {
      sheet.appendRow([
        generateId(),
        numero++,
        tipo,
        'libre',
        '',
        ''
      ]);
    }
  });
}

// ============================================================
// UTILIDADES
// ============================================================

function generateId() {
  return Utilities.getUuid();
}

function hashPassword(password) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(password) + CONFIG.SECRET_KEY
  );

  return bytes
    .map(byte => ('0' + (byte & 0xff).toString(16)).slice(-2))
    .join('');
}

let _ssInstance = null;

function getSS() {
  if (!_ssInstance) {
    _ssInstance = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  }
  return _ssInstance;
}

function getSheet(name) {
  return getSS().getSheetByName(name);
}

function invalidateAppsScriptCache(keys = ['admin_resumen', 'puestos_data']) {
  try {
    const cache = CacheService.getScriptCache();
    cache.removeAll(keys);
  } catch (e) {}
}

function sheetToObjects(sheet) {
  const data = sheet.getDataRange().getValues();

  if (data.length <= 1) {
    return [];
  }

  const headers = data[0];

  return data.slice(1).map(row => {
    const obj = {};

    headers.forEach((header, index) => {
      obj[header] = row[index];
    });

    return obj;
  });
}

function findRowById(sheet, id) {
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      return i + 1;
    }
  }

  return -1;
}

function updateFieldsInRow(sheet, rowNum, headers, updates) {
  Object.keys(updates).forEach(field => {
    const columnIndex = headers.indexOf(field);

    if (columnIndex !== -1) {
      sheet
        .getRange(rowNum, columnIndex + 1)
        .setValue(updates[field]);
    }
  });
}

function isActivo(value) {
  return (
    value === true ||
    value === 'TRUE' ||
    value === 'true'
  );
}

function normalizarCedula(value) {
  return String(value || '').replace(/\D/g, '');
}

function normalizarPlaca(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/\s+/g, '')
    .trim();
}

function esTipoCarro(tipo) {
  return tipo === 'Carro' || tipo === 'Carro y moto';
}

function esTipoMoto(tipo) {
  return tipo === 'Moto' || tipo === 'Carro y moto';
}

function obtenerPlacaPrincipal(placaCarro, placaMoto, tipoVehiculo) {
  if (esTipoCarro(tipoVehiculo) && placaCarro) {
    return placaCarro;
  }

  if (esTipoMoto(tipoVehiculo) && placaMoto) {
    return placaMoto;
  }

  return placaCarro || placaMoto || '';
}

function validarDatosVehiculo(data) {
  const nombre = String(data.nombre || '').trim();
  const tipoVehiculo = String(data.tipo_vehiculo || '').trim();
  const placaCarro = normalizarPlaca(data.placa_carro);
  const placaMoto = normalizarPlaca(data.placa_moto);

  if (!nombre) {
    return {
      valido: false,
      error: 'El nombre es obligatorio'
    };
  }

  if (tipoVehiculo === 'Carro' && !placaCarro) {
    return {
      valido: false,
      error: 'La placa del carro es obligatoria'
    };
  }

  if (tipoVehiculo === 'Moto' && !placaMoto) {
    return {
      valido: false,
      error: 'La placa de la moto es obligatoria'
    };
  }

  if (tipoVehiculo === 'Carro y moto') {
    if (!placaCarro || !placaMoto) {
      return {
        valido: false,
        error: 'Para carro y moto debes registrar ambas placas'
      };
    }
  }

  return {
    valido: true,
    nombre,
    tipoVehiculo,
    placaCarro,
    placaMoto
  };
}

function userPublicData(usuario) {
  const placaCarro = usuario.placa_carro || '';
  const placaMoto = usuario.placa_moto || '';

  return {
    id: usuario.id,
    nombre: usuario.nombre || '',
    cedula: usuario.cedula || '',
    correo: usuario.correo || '',
    telefono: usuario.telefono || '',
    celular: usuario.celular || '',
    direccion: usuario.direccion || '',
    placa: usuario.placa || obtenerPlacaPrincipal(
      placaCarro,
      placaMoto,
      usuario.tipo_vehiculo
    ),
    placa_carro: placaCarro,
    placa_moto: placaMoto,
    tipo_vehiculo: usuario.tipo_vehiculo || '',
    tipo_tarifa: usuario.tipo_tarifa || '',
    valor_tarifa: usuario.valor_tarifa || 0,
    fecha_inicio: usuario.fecha_inicio || '',
    fecha_fin: usuario.fecha_fin || '',
    rol: usuario.rol || '',
    fecha_creacion: usuario.fecha_creacion || ''
  };
}

// ============================================================
// AUTENTICACION
// ============================================================

function login(data) {
  if (!data.correo || !data.contrasena) {
    return {
      success: false,
      error: 'Correo y contraseña requeridos'
    };
  }

  const correo = String(data.correo).trim().toLowerCase();
  const hashed = hashPassword(data.contrasena);

  const usuario = sheetToObjects(getSheet('usuarios'))
    .find(item =>
      String(item.correo || '').trim().toLowerCase() === correo &&
      item.contrasena === hashed &&
      isActivo(item.activo)
    );

  if (!usuario) {
    return {
      success: false,
      error: 'Correo o contraseña incorrectos'
    };
  }

  return {
    success: true,
    token: Utilities.base64Encode(usuario.id + ':' + Date.now()),
    user: userPublicData(usuario)
  };
}

// ============================================================
// USUARIOS
// ============================================================

function getUsuarios() {
  const usuarios = sheetToObjects(getSheet('usuarios'))
    .filter(usuario => isActivo(usuario.activo))
    .map(userPublicData);

  return {
    success: true,
    data: usuarios
  };
}

function crearUsuario(data) {
  asegurarColumnasUsuarios();

  const validacion = validarDatosVehiculo(data);

  if (!validacion.valido) {
    return {
      success: false,
      error: validacion.error
    };
  }

  const sheet = getSheet('usuarios');
  const usuarios = sheetToObjects(sheet);

  const cedula = normalizarCedula(data.cedula);
  const correo = String(data.correo || '').trim().toLowerCase();

  if (
    cedula &&
    usuarios.some(usuario =>
      normalizarCedula(usuario.cedula) === cedula
    )
  ) {
    return {
      success: false,
      error: 'Ya existe un usuario con esa cédula'
    };
  }

  if (
    correo &&
    usuarios.some(usuario =>
      String(usuario.correo || '').trim().toLowerCase() === correo
    )
  ) {
    return {
      success: false,
      error: 'Ya existe un usuario con ese correo'
    };
  }

  const id = generateId();
  const password = data.contrasena || '123456';

  const placaPrincipal = obtenerPlacaPrincipal(
    validacion.placaCarro,
    validacion.placaMoto,
    validacion.tipoVehiculo
  );

  appendUsuario(sheet, {
    id,
    nombre: validacion.nombre,
    cedula,
    correo,
    telefono: String(data.telefono || '').trim(),
    celular: String(data.celular || '').trim(),
    direccion: String(data.direccion || '').trim(),
    placa: placaPrincipal,
    placa_carro: validacion.placaCarro,
    placa_moto: validacion.placaMoto,
    tipo_vehiculo: validacion.tipoVehiculo,
    tipo_tarifa: String(data.tipo_tarifa || '').trim(),
    valor_tarifa: data.valor_tarifa || 0,
    fecha_inicio: data.fecha_inicio || '',
    fecha_fin: data.fecha_fin || '',
    contrasena: hashPassword(password),
    rol: 'usuario',
    fecha_creacion: new Date().toISOString(),
    activo: 'TRUE'
  });

  return {
    success: true,
    data: {
      id,
      nombre: validacion.nombre,
      cedula,
      correo,
      placa_carro: validacion.placaCarro,
      placa_moto: validacion.placaMoto,
      passwordInicial: password
    }
  };
}

function actualizarUsuario(data) {
  asegurarColumnasUsuarios();

  if (!data.id) {
    return {
      success: false,
      error: 'ID de usuario requerido'
    };
  }

  const sheet = getSheet('usuarios');
  const headers = sheet.getDataRange().getValues()[0];
  const rowNum = findRowById(sheet, data.id);

  if (rowNum === -1) {
    return {
      success: false,
      error: 'Usuario no encontrado'
    };
  }

  const usuarios = sheetToObjects(sheet);
  const usuarioActual = usuarios.find(
    usuario => String(usuario.id) === String(data.id)
  );

  const datosFinales = {
    ...usuarioActual,
    ...data,
    nombre: data.nombre !== undefined
      ? data.nombre
      : usuarioActual.nombre,
    tipo_vehiculo: data.tipo_vehiculo !== undefined
      ? data.tipo_vehiculo
      : usuarioActual.tipo_vehiculo,
    placa_carro: data.placa_carro !== undefined
      ? data.placa_carro
      : usuarioActual.placa_carro,
    placa_moto: data.placa_moto !== undefined
      ? data.placa_moto
      : usuarioActual.placa_moto
  };

  const validacion = validarDatosVehiculo(datosFinales);

  if (!validacion.valido) {
    return {
      success: false,
      error: validacion.error
    };
  }

  const cedula = normalizarCedula(
    data.cedula !== undefined ? data.cedula : usuarioActual.cedula
  );

  const correo = String(
    data.correo !== undefined ? data.correo : usuarioActual.correo
  )
    .trim()
    .toLowerCase();

  if (
    cedula &&
    usuarios.some(usuario =>
      String(usuario.id) !== String(data.id) &&
      normalizarCedula(usuario.cedula) === cedula
    )
  ) {
    return {
      success: false,
      error: 'Ya existe un usuario con esa cédula'
    };
  }

  if (
    correo &&
    usuarios.some(usuario =>
      String(usuario.id) !== String(data.id) &&
      String(usuario.correo || '').trim().toLowerCase() === correo
    )
  ) {
    return {
      success: false,
      error: 'Ya existe un usuario con ese correo'
    };
  }

  const placaPrincipal = obtenerPlacaPrincipal(
    validacion.placaCarro,
    validacion.placaMoto,
    validacion.tipoVehiculo
  );

  const updates = {
    nombre: validacion.nombre,
    cedula,
    correo,
    telefono: String(
      data.telefono !== undefined
        ? data.telefono
        : usuarioActual.telefono || ''
    ).trim(),
    celular: String(
      data.celular !== undefined
        ? data.celular
        : usuarioActual.celular || ''
    ).trim(),
    direccion: String(
      data.direccion !== undefined
        ? data.direccion
        : usuarioActual.direccion || ''
    ).trim(),
    placa: placaPrincipal,
    placa_carro: validacion.placaCarro,
    placa_moto: validacion.placaMoto,
    tipo_vehiculo: validacion.tipoVehiculo,
    tipo_tarifa: String(
      data.tipo_tarifa !== undefined
        ? data.tipo_tarifa
        : usuarioActual.tipo_tarifa || ''
    ).trim(),
    valor_tarifa: data.valor_tarifa !== undefined
      ? data.valor_tarifa
      : usuarioActual.valor_tarifa || 0,
    fecha_inicio: data.fecha_inicio !== undefined
      ? data.fecha_inicio
      : usuarioActual.fecha_inicio || '',
    fecha_fin: data.fecha_fin !== undefined
      ? data.fecha_fin
      : usuarioActual.fecha_fin || ''
  };

  if (data.contrasena) {
    updates.contrasena = hashPassword(data.contrasena);
  }

  updateFieldsInRow(sheet, rowNum, headers, updates);

  return {
    success: true
  };
}

function eliminarUsuario(data) {
  const usuariosSheet = getSheet('usuarios');
  const headers = usuariosSheet.getDataRange().getValues()[0];
  const rowNum = findRowById(usuariosSheet, data.id);

  if (rowNum === -1) {
    return {
      success: false,
      error: 'Usuario no encontrado'
    };
  }

  updateFieldsInRow(usuariosSheet, rowNum, headers, {
    activo: 'FALSE'
  });

  liberarPuestosUsuario(data.id);

  return {
    success: true
  };
}

// ============================================================
// PUESTOS
// ============================================================

function getPuestos() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('puestos_data');
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) {}
  }

  const puestos = sheetToObjects(getSheet('puestos'));
  const config = {};

  sheetToObjects(getSheet('config')).forEach(item => {
    config[item.clave] = item.valor;
  });

  const res = {
    success: true,
    data: puestos,
    config
  };

  try {
    cache.put('puestos_data', JSON.stringify(res), 180);
  } catch (e) {}

  return res;
}

function getPuestosUsuario(data) {
  if (!data.userId) {
    return {
      success: false,
      error: 'El ID del usuario es requerido'
    };
  }

  const puestos = sheetToObjects(getSheet('puestos'))
    .filter(puesto =>
      String(puesto.usuario_id) === String(data.userId)
    );

  return {
    success: true,
    data: puestos
  };
}

function asignarPuestosUsuario(data) {
  const userId = data.userId;
  const userName = String(data.userName || '').trim();

  const puestoCarroId = data.puestoCarroId
    ? String(data.puestoCarroId)
    : '';

  const puestoMotoId = data.puestoMotoId
    ? String(data.puestoMotoId)
    : '';

  if (!userId || !userName) {
    return {
      success: false,
      error: 'El ID y nombre del usuario son requeridos'
    };
  }

  if (
    puestoCarroId &&
    puestoMotoId &&
    puestoCarroId === puestoMotoId
  ) {
    return {
      success: false,
      error: 'No se puede asignar el mismo puesto dos veces'
    };
  }

  const sheet = getSheet('puestos');
  const headers = sheet.getDataRange().getValues()[0];
  const puestos = sheetToObjects(sheet);
  const puestosMap = {};

  puestos.forEach(puesto => {
    puestosMap[String(puesto.id)] = puesto;
  });

  function validarPuesto(puestoId, tipoEsperado) {
    if (!puestoId) {
      return null;
    }

    const puesto = puestosMap[puestoId];

    if (!puesto) {
      return 'El puesto seleccionado no existe';
    }

    if (String(puesto.tipo).toLowerCase() !== tipoEsperado) {
      return (
        'El puesto ' +
        puesto.numero +
        ' no corresponde a un vehículo tipo ' +
        tipoEsperado
      );
    }

    const ocupadoPorOtro =
      puesto.estado !== 'libre' &&
      String(puesto.usuario_id) !== String(userId);

    if (ocupadoPorOtro) {
      return 'El puesto ' + puesto.numero + ' ya está ocupado';
    }

    return null;
  }

  const errorCarro = validarPuesto(puestoCarroId, 'carro');

  if (errorCarro) {
    return {
      success: false,
      error: errorCarro
    };
  }

  const errorMoto = validarPuesto(puestoMotoId, 'moto');

  if (errorMoto) {
    return {
      success: false,
      error: errorMoto
    };
  }

  const puestosSeleccionados = [
    puestoCarroId,
    puestoMotoId
  ].filter(Boolean);

  puestos
    .filter(puesto =>
      String(puesto.usuario_id) === String(userId) &&
      !puestosSeleccionados.includes(String(puesto.id))
    )
    .forEach(puesto => {
      const rowNum = findRowById(sheet, puesto.id);

      updateFieldsInRow(sheet, rowNum, headers, {
        estado: 'libre',
        usuario_id: '',
        usuario_nombre: ''
      });
    });

  puestosSeleccionados.forEach(puestoId => {
    const rowNum = findRowById(sheet, puestoId);

    updateFieldsInRow(sheet, rowNum, headers, {
      estado: 'ocupado',
      usuario_id: userId,
      usuario_nombre: userName
    });
  });

  return {
    success: true,
    data: sheetToObjects(sheet).filter(puesto =>
      String(puesto.usuario_id) === String(userId)
    )
  };
}

function liberarPuestosUsuario(userId) {
  const sheet = getSheet('puestos');
  const headers = sheet.getDataRange().getValues()[0];

  sheetToObjects(sheet)
    .filter(puesto =>
      String(puesto.usuario_id) === String(userId)
    )
    .forEach(puesto => {
      const rowNum = findRowById(sheet, puesto.id);

      updateFieldsInRow(sheet, rowNum, headers, {
        estado: 'libre',
        usuario_id: '',
        usuario_nombre: ''
      });
    });
}

function updatePuesto(data) {
  const sheet = getSheet('puestos');
  const headers = sheet.getDataRange().getValues()[0];
  const rowNum = findRowById(sheet, data.id);

  if (rowNum === -1) {
    return {
      success: false,
      error: 'Puesto no encontrado'
    };
  }

  const updates = {};

  ['estado', 'usuario_id', 'usuario_nombre'].forEach(field => {
    if (data[field] !== undefined) {
      updates[field] = data[field];
    }
  });

  if (updates.estado === 'libre') {
    updates.usuario_id = '';
    updates.usuario_nombre = '';
  }

  updateFieldsInRow(sheet, rowNum, headers, updates);

  return {
    success: true
  };
}

function updateConfigPuestos(data) {
  const configSheet = getSheet('config');
  const allData = configSheet.getDataRange().getValues();

  const keysToUpdate = [
    'total_puestos_carro',
    'total_puestos_moto',
    'total_puestos_bici',
    'nombre_parqueadero'
  ];

  for (let i = 1; i < allData.length; i++) {
    const key = allData[i][0];

    if (
      keysToUpdate.includes(key) &&
      data[key] !== undefined
    ) {
      configSheet.getRange(i + 1, 2).setValue(data[key]);
    }
  }

  if (data.rebuild === true) {
    const puestosSheet = getSheet('puestos');
    const lastRow = puestosSheet.getLastRow();

    if (lastRow > 1) {
      puestosSheet.deleteRows(2, lastRow - 1);
    }

    buildPuestos(puestosSheet, data);
  }

  return {
    success: true
  };
}

// ============================================================
// RECIBOS
// ============================================================

function subirRecibo(data) {
  const folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
  const decoded = Utilities.base64Decode(data.base64Data);

  const blob = Utilities.newBlob(
    decoded,
    data.mimeType || 'image/jpeg',
    data.fileName || 'recibo.jpg'
  );

  const file = folder.createFile(blob);

  file.setSharing(
    DriveApp.Access.ANYONE_WITH_LINK,
    DriveApp.Permission.VIEW
  );

  const fileId = file.getId();
  const url = 'https://lh3.googleusercontent.com/d/' + fileId;

  const id = generateId();
  const fechaInicio = data.fechaInicio || data.fecha_inicio || '';
  let fechaFin = data.fechaFin || data.fecha_fin || '';
  const inicio = fechaInicio
    ? new Date(fechaInicio + 'T00:00:00')
    : new Date();

  if (!fechaFin && fechaInicio) {
    const finDate = new Date(inicio.getFullYear(), inicio.getMonth() + 1, inicio.getDate() - 1);
    fechaFin = Utilities.formatDate(finDate, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }

  asegurarColumnasRecibos();
  const sheet = getSheet('recibos');
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const values = {
    id,
    usuario_id: data.userId,
    usuario_nombre: data.userName,
    usuario_correo: data.userEmail || '',
    fecha_subida: new Date().toISOString(),
    fecha_inicio: fechaInicio,
    fecha_fin: fechaFin,
    mes: inicio.getMonth() + 1,
    anio: inicio.getFullYear(),
    url_imagen: url,
    file_id: fileId,
    estado: 'en_revision',
    fecha_revision: '',
    admin_nota: ''
  };

  sheet.appendRow(headers.map(header => values[header] !== undefined ? values[header] : ''));

  return {
    success: true,
    data: {
      id,
      url,
      file_id: fileId,
      estado: 'en_revision'
    }
  };
}

function getRecibos(data) {
  let recibos = sheetToObjects(getSheet('recibos'));

  if (data.userId && data.userId !== 'all') {
    recibos = recibos.filter(recibo =>
      String(recibo.usuario_id) === String(data.userId)
    );
  }

  return {
    success: true,
    data: recibos
  };
}

function aprobarRecibo(data) {
  return revisarRecibo(
    data,
    'aprobado',
    data.nota || 'Aprobado'
  );
}

function rechazarRecibo(data) {
  return revisarRecibo(
    data,
    'rechazado',
    data.nota || 'Rechazado'
  );
}

function revisarRecibo(data, estado, nota) {
  const sheet = getSheet('recibos');
  const headers = sheet.getDataRange().getValues()[0];
  const rowNum = findRowById(sheet, data.id);

  if (rowNum === -1) {
    return {
      success: false,
      error: 'Recibo no encontrado'
    };
  }

  updateFieldsInRow(sheet, rowNum, headers, {
    estado,
    fecha_revision: new Date().toISOString(),
    admin_nota: nota
  });

  return {
    success: true
  };
}

// ============================================================
// SOLICITUDES
// ============================================================

function getSolicitudes(data) {
  let solicitudes = sheetToObjects(getSheet('solicitudes'));

  if (data.userId && data.userId !== 'all') {
    solicitudes = solicitudes.filter(solicitud =>
      String(solicitud.usuario_id) === String(data.userId)
    );
  }

  return {
    success: true,
    data: solicitudes
  };
}

function crearSolicitud(data) {
  const id = generateId();

  getSheet('solicitudes').appendRow([
    id,
    data.userId,
    data.userName,
    data.tipo,
    data.asunto,
    data.descripcion,
    new Date().toISOString(),
    'pendiente',
    ''
  ]);

  return {
    success: true,
    data: { id }
  };
}

function responderSolicitud(data) {
  const sheet = getSheet('solicitudes');
  const headers = sheet.getDataRange().getValues()[0];
  const rowNum = findRowById(sheet, data.id);

  if (rowNum === -1) {
    return {
      success: false,
      error: 'Solicitud no encontrada'
    };
  }

  updateFieldsInRow(sheet, rowNum, headers, {
    estado: 'respondida',
    respuesta: data.respuesta || ''
  });

  return {
    success: true
  };
}

// ============================================================
// CIERRE DE MES
// ============================================================

function getCierreMes(data) {
  const startDate = String(data.startDate || '');
  const endDate = String(data.endDate || '');
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T23:59:59');

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return { success: false, error: 'Rango de fechas inválido' };
  }

  const recibos = sheetToObjects(getSheet('recibos'))
    .filter(recibo => {
      if (recibo.estado !== 'aprobado') {
        return false;
      }

      return reciboPertenecePeriodo(recibo, startDate, endDate);
    });

  const usuariosMap = {};

  sheetToObjects(getSheet('usuarios')).forEach(usuario => {
    usuariosMap[usuario.id] = usuario;
  });

  let totalIngresos = 0;

  const detalleIngresos = recibos.map(recibo => {
    const usuario = usuariosMap[recibo.usuario_id];

    const valor = usuario
      ? parseFloat(usuario.valor_tarifa || 0)
      : 0;

    totalIngresos += valor;

    return {
      recibo_id: recibo.id,
      usuario: recibo.usuario_nombre,
      correo: recibo.usuario_correo,
      placa: usuario
        ? obtenerPlacaPrincipal(
            usuario.placa_carro,
            usuario.placa_moto,
            usuario.tipo_vehiculo
          )
        : '',
      placa_carro: usuario ? usuario.placa_carro || '' : '',
      placa_moto: usuario ? usuario.placa_moto || '' : '',
      tipo_vehiculo: usuario ? usuario.tipo_vehiculo : '',
      tipo_tarifa: usuario ? usuario.tipo_tarifa : '',
      valor,
      fecha: recibo.fecha_subida
    };
  });

  const gastos = sheetToObjects(getSheet('gastos'))
    .filter(gasto => {
      if (!gasto.fecha_registro) {
        return false;
      }

      const fecha = new Date(gasto.fecha_registro);

      return fecha >= start && fecha <= end;
    });

  const totalGastos = gastos.reduce(
    (suma, gasto) => suma + parseFloat(gasto.valor || 0),
    0
  );

  return {
    success: true,
    data: {
      startDate,
      endDate,
      totalIngresos,
      totalGastos,
      balance: totalIngresos - totalGastos,
      cantidadRecibos: recibos.length,
      detalleIngresos,
      gastos,
      cerrado: periodoEstaCerrado(startDate, endDate)
    }
  };
}

function normalizarFechaTexto(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(value).slice(0, 10);
}

function reciboPertenecePeriodo(recibo, startDate, endDate) {
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T23:59:59');

  // 1. Si tiene fecha_subida (momento del pago/recaudo real en la caja del parqueadero)
  if (recibo.fecha_subida) {
    const upload = new Date(recibo.fecha_subida);
    if (!isNaN(upload.getTime()) && upload >= start && upload <= end) {
      return true;
    }
  }

  // 2. Si su fecha_inicio registrada cae dentro del rango del cierre contable
  if (recibo.fecha_inicio) {
    const inicioStr = normalizarFechaTexto(recibo.fecha_inicio);
    if (inicioStr >= startDate && inicioStr <= endDate) {
      return true;
    }
  }

  // 3. Compatibilidad con mes/año heredado
  if (recibo.mes && recibo.anio) {
    const inicio = new Date(startDate + 'T00:00:00');
    return Number(recibo.mes) === (inicio.getMonth() + 1) &&
      Number(recibo.anio) === inicio.getFullYear();
  }

  return false;
}

function periodoEstaCerrado(startDate, endDate) {
  const sheet = asegurarHojaCierres();
  return sheetToObjects(sheet).some(cierre =>
    normalizarFechaTexto(cierre.fecha_inicio) === startDate &&
    normalizarFechaTexto(cierre.fecha_fin) === endDate &&
    cierre.estado === 'cerrado'
  );
}

function cerrarMes(data) {
  const startDate = String(data.startDate || '');
  const endDate = String(data.endDate || '');

  if (!startDate || !endDate) {
    return { success: false, error: 'El periodo requiere fecha inicial y final' };
  }

  const sheet = asegurarHojaCierres();
  const existe = sheetToObjects(sheet).some(cierre =>
    normalizarFechaTexto(cierre.fecha_inicio) === startDate &&
    normalizarFechaTexto(cierre.fecha_fin) === endDate
  );

  if (!existe) {
    sheet.appendRow([
      generateId(),
      startDate,
      endDate,
      new Date().toISOString(),
      'cerrado'
    ]);
  }

  return { success: true };
}

// ============================================================
// GASTOS
// ============================================================

function agregarGasto(data) {
  const fecha = data.fecha
    ? new Date(data.fecha).toISOString()
    : new Date().toISOString();

  const date = new Date(fecha);
  const id = generateId();

  getSheet('gastos').appendRow([
    id,
    date.getMonth() + 1,
    date.getFullYear(),
    data.descripcion || '',
    parseFloat(data.valor || 0),
    fecha
  ]);

  return {
    success: true,
    data: { id }
  };
}

function eliminarGasto(data) {
  const sheet = getSheet('gastos');
  const rowNum = findRowById(sheet, data.id);

  if (rowNum === -1) {
    return {
      success: false,
      error: 'Gasto no encontrado'
    };
  }

  sheet.deleteRow(rowNum);

  return {
    success: true
  };
}

function getGastos(data) {
  let gastos = sheetToObjects(getSheet('gastos'));

  if (data.startDate && data.endDate) {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);

    end.setHours(23, 59, 59, 999);

    gastos = gastos.filter(gasto => {
      if (!gasto.fecha_registro) {
        return false;
      }

      const fecha = new Date(gasto.fecha_registro);

      return fecha >= start && fecha <= end;
    });
  }

  return {
    success: true,
    data: gastos
  };
}

function migrarColumnasRecibos() {
  asegurarColumnasRecibos();

  const sheet = getSheet('recibos');
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const rows = sheet.getDataRange().getValues();
  const inicioCol = headers.indexOf('fecha_inicio');
  const finCol = headers.indexOf('fecha_fin');
  const mesCol = headers.indexOf('mes');
  const anioCol = headers.indexOf('anio');

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][inicioCol] || !rows[i][mesCol] || !rows[i][anioCol]) continue;

    const mes = Number(rows[i][mesCol]);
    const anio = Number(rows[i][anioCol]);
    const inicio = new Date(anio, mes - 1, 12);
    const fin = new Date(anio, mes, 11);

    sheet.getRange(i + 1, inicioCol + 1).setValue(formatearFechaLocal(inicio));
    sheet.getRange(i + 1, finCol + 1).setValue(formatearFechaLocal(fin));
  }
}

function formatearFechaLocal(date) {
  return Utilities.formatDate(
    date,
    Session.getScriptTimeZone(),
    'yyyy-MM-dd'
  );
}

// ============================================================
// MAPA DEL PARQUEADERO
// ============================================================

function getParkingMapUrl() {
  try {
    const file = DriveApp.getFileById(CONFIG.PARKING_MAP_FILE_ID);

    file.setSharing(
      DriveApp.Access.ANYONE_WITH_LINK,
      DriveApp.Permission.VIEW
    );

    return {
      success: true,
      url:
        'https://drive.usercontent.google.com/download?id=' +
        file.getId() +
        '&export=view'
    };
  } catch (error) {
    return {
      success: false,
      error: 'No fue posible obtener el mapa: ' + error.message,
      url: null
    };
  }
}

function asegurarColumnasRecibos() {
  const sheet = getSheet('recibos');
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const columnasRequeridas = [
    'id',
    'usuario_id',
    'usuario_nombre',
    'usuario_correo',
    'fecha_subida',
    'fecha_inicio',
    'fecha_fin',
    'mes',
    'anio',
    'url_imagen',
    'file_id',
    'estado',
    'fecha_revision',
    'admin_nota'
  ];

  columnasRequeridas.forEach(columna => {
    if (!headers.includes(columna)) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(columna);
      headers.push(columna);
    }
  });
}

function asegurarHojaCierres() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  let sheet = ss.getSheetByName('cierres');

  if (!sheet) {
    sheet = ss.insertSheet('cierres');
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['id', 'fecha_inicio', 'fecha_fin', 'fecha_cierre', 'estado']);
  }

  return sheet;
}

function getAdminResumen() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('admin_resumen');
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) {}
  }

  const usuarios = sheetToObjects(getSheet('usuarios'))
    .filter(usuario => isActivo(usuario.activo));
  const recibos = sheetToObjects(getSheet('recibos'));
  const puestos = sheetToObjects(getSheet('puestos'));
  const solicitudes = sheetToObjects(getSheet('solicitudes'));

  const recientesRecibos = recibos
    .sort((a, b) => new Date(b.fecha_subida) - new Date(a.fecha_subida))
    .slice(0, 5)
    .map(recibo => ({
      id: recibo.id,
      usuario_nombre: recibo.usuario_nombre,
      fecha_subida: recibo.fecha_subida,
      estado: recibo.estado
    }));

  const res = {
    success: true,
    data: {
      usuarios: usuarios.length,
      recibosTotal: recibos.length,
      enRevision: recibos.filter(recibo => recibo.estado === 'en_revision').length,
      aprobados: recibos.filter(recibo => recibo.estado === 'aprobado').length,
      puestosLibres: puestos.filter(puesto => puesto.estado === 'libre').length,
      puestosOcupados: puestos.filter(puesto => puesto.estado === 'ocupado').length,
      solicitudesPendientes: solicitudes.filter(solicitud => solicitud.estado === 'pendiente').length,
      recientesRecibos
    }
  };

  try {
    cache.put('admin_resumen', JSON.stringify(res), 120);
  } catch (e) {}

  return res;
}