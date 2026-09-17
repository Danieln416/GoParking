# Parche para Google Apps Script

El frontend ya envía `fechaInicio` y `fechaFin`, pero el Apps Script actual los ignora. Tambien calcula el cierre con `fecha_subida`, por lo que un recibo subido el dia 16 cae en el periodo equivocado. Aplica estos cambios en el proyecto de Apps Script y vuelve a desplegar la implementacion como una nueva version.

## 1. Agregar columnas

En `initSheets`, cambia las columnas de `recibos` por:

```javascript
'recibos': [
  'id', 'usuario_id', 'usuario_nombre', 'usuario_correo',
  'fecha_subida', 'fecha_inicio', 'fecha_fin', 'mes', 'anio',
  'url_imagen', 'file_id', 'estado', 'fecha_revision', 'admin_nota'
],
```

Ejecuta `initSheets()` una vez. Si la hoja `recibos` ya existe, agrega manualmente `fecha_inicio` y `fecha_fin` como encabezados después de `fecha_subida`, o usa la funcion de migracion incluida abajo.

## 2. Agregar la accion al router

En `doPost`, antes de `getCierreMes`:

```javascript
case 'cerrarMes':
  result = cerrarMes(data);
  break;
```

## 3. Reemplazar `subirRecibo`

```javascript
function subirRecibo(data) {
  const folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
  const decoded = Utilities.base64Decode(data.base64Data);
  const blob = Utilities.newBlob(
    decoded,
    data.mimeType || 'image/jpeg',
    data.fileName || 'recibo.jpg'
  );
  const file = folder.createFile(blob);

  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  const fileId = file.getId();
  const url = 'https://drive.usercontent.google.com/download?id=' + fileId + '&export=view';
  const fechaInicio = data.fechaInicio || data.fecha_inicio || '';
  const fechaFin = data.fechaFin || data.fecha_fin || '';
  const inicio = fechaInicio ? new Date(fechaInicio + 'T00:00:00') : new Date();

  const sheet = getSheet('recibos');
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = headers.map(header => ({
    id: generateId(), usuario_id: data.userId, usuario_nombre: data.userName,
    usuario_correo: data.userEmail || '', fecha_subida: new Date().toISOString(),
    fecha_inicio: fechaInicio, fecha_fin: fechaFin,
    mes: inicio.getMonth() + 1, anio: inicio.getFullYear(),
    url_imagen: url, file_id: fileId, estado: 'en_revision',
    fecha_revision: '', admin_nota: ''
  }[header] || ''));
  sheet.appendRow(row);

  return {
    success: true,
    data: { url, file_id: fileId, estado: 'en_revision' }
  };
}
```

## 4. Reemplazar `getCierreMes` y agregar cierre persistente

El cierre usa ahora el periodo pagado (`fecha_inicio`/`fecha_fin`), no `fecha_subida`. Agrega una hoja `cierres` con encabezados `id`, `fecha_inicio`, `fecha_fin`, `fecha_cierre` y `estado`.

```javascript
function periodoCoincide(recibo, startDate, endDate) {
  if (recibo.fecha_inicio) {
    return String(recibo.fecha_inicio).slice(0, 10) === startDate &&
      String(recibo.fecha_fin).slice(0, 10) === endDate;
  }

  // Compatibilidad con recibos antiguos que solo tienen mes/anio.
  const inicio = new Date(startDate + 'T00:00:00');
  return Number(recibo.mes) === inicio.getMonth() + 1 &&
    Number(recibo.anio) === inicio.getFullYear();
}

function getCierreMes(data) {
  const startDate = String(data.startDate || '');
  const endDate = String(data.endDate || '');
  const recibos = sheetToObjects(getSheet('recibos')).filter(recibo =>
    recibo.estado === 'aprobado' && periodoCoincide(recibo, startDate, endDate)
  );

  const usuariosMap = {};
  sheetToObjects(getSheet('usuarios')).forEach(usuario => {
    usuariosMap[usuario.id] = usuario;
  });

  let totalIngresos = 0;
  const detalleIngresos = recibos.map(recibo => {
    const usuario = usuariosMap[recibo.usuario_id];
    const valor = usuario ? parseFloat(usuario.valor_tarifa || 0) : 0;
    totalIngresos += valor;
    return {
      recibo_id: recibo.id,
      usuario: recibo.usuario_nombre,
      correo: recibo.usuario_correo,
      placa: usuario ? obtenerPlacaPrincipal(usuario.placa_carro, usuario.placa_moto, usuario.tipo_vehiculo) : '',
      placa_carro: usuario ? usuario.placa_carro || '' : '',
      placa_moto: usuario ? usuario.placa_moto || '' : '',
      tipo_vehiculo: usuario ? usuario.tipo_vehiculo : '',
      tipo_tarifa: usuario ? usuario.tipo_tarifa : '',
      valor,
      fecha: recibo.fecha_subida
    };
  });

  const gastos = sheetToObjects(getSheet('gastos')).filter(gasto => {
    if (!gasto.fecha_registro) return false;
    const fecha = new Date(gasto.fecha_registro);
    return fecha >= new Date(startDate + 'T00:00:00') && fecha <= new Date(endDate + 'T23:59:59');
  });
  const totalGastos = gastos.reduce((total, gasto) => total + parseFloat(gasto.valor || 0), 0);

  return {
    success: true,
    data: {
      startDate, endDate, totalIngresos, totalGastos,
      balance: totalIngresos - totalGastos,
      cantidadRecibos: recibos.length, detalleIngresos, gastos
    }
  };
}

function cerrarMes(data) {
  const startDate = String(data.startDate || '');
  const endDate = String(data.endDate || '');
  if (!startDate || !endDate) {
    return { success: false, error: 'El periodo requiere fecha inicial y final' };
  }

  let sheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheetByName('cierres');
  if (!sheet) {
    sheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).insertSheet('cierres');
    sheet.appendRow(['id', 'fecha_inicio', 'fecha_fin', 'fecha_cierre', 'estado']);
  }

  const cierres = sheetToObjects(sheet);
  const existe = cierres.some(cierre =>
    String(cierre.fecha_inicio) === startDate && String(cierre.fecha_fin) === endDate
  );
  if (!existe) {
    sheet.appendRow([generateId(), startDate, endDate, new Date().toISOString(), 'cerrado']);
  }
  return { success: true };
}
```

## 5. Migrar encabezados existentes

Si `recibos` ya tiene datos, ejecuta una vez. Esta versión agrega columnas al final y además completa el período 12-11 para recibos antiguos usando `mes` y `anio`:

```javascript
function migrarColumnasRecibos() {
  const sheet = getSheet('recibos');
  let headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  ['fecha_inicio', 'fecha_fin'].forEach(nombre => {
    if (!headers.includes(nombre)) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(nombre);
      headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    }
  });

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
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}
```

## 6. Mapa

El error actual se produce en `DriveApp.getFileById(CONFIG.PARKING_MAP_FILE_ID)`, antes de construir la URL. Verifica que `1jK_g0EgFTTA8nabuLKiKXBU-zpmRLBbw` sea el ID real del archivo, que el archivo no haya sido eliminado y que la cuenta propietaria del Apps Script tenga acceso. Después comparte el archivo como lector y vuelve a desplegar.

Puedes devolver directamente el mismo formato usado para recibos:

```javascript
function getParkingMapUrl() {
  try {
    const file = DriveApp.getFileById(CONFIG.PARKING_MAP_FILE_ID);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return {
      success: true,
      url: 'https://drive.usercontent.google.com/download?id=' + file.getId() + '&export=view'
    };
  } catch (error) {
    return { success: false, error: 'No fue posible obtener el mapa: ' + error.message, url: null };
  }
}
```

Finalmente, publica una nueva version del Web App y confirma que el acceso sea `Cualquiera`/`Anyone`.