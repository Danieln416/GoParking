# Parche de Optimización y Compatibilidad para Google Apps Script

Este documento contiene los cambios que deben aplicarse en el proyecto de **Google Apps Script** para:
1. **Solucionar el problema de imágenes de recibos que no cargaban** (bloqueadas por `Cross-Origin-Resource-Policy: same-site`).
2. **Reducir el tiempo de respuesta del backend** de ~5.5s a ~1s usando `CacheService` y un Singleton de `SpreadsheetApp`.
3. **Optimizar las lecturas** eliminando chequeos redundantes de columnas en cada GET.

El código fuente completo y actualizado se encuentra en [`docs/Code.gs`](file:///c:/Users/Daniel/OneDrive/Documentos/prigma/GoParking/docs/Code.gs). A continuación se detallan los bloques clave modificados:

---

## 1. Singleton de Spreadsheet y Manejo de Caché

Reemplaza la función `getSheet(name)` en Apps Script por este bloque:

```javascript
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
```

---

## 2. Invalidar Caché en Escrituras (`doPost`)

En la función `doPost(e)`, justo antes del `return buildResponse(result);`:

```javascript
    if (result && result.success && data.action !== 'login') {
      invalidateAppsScriptCache();
    }

    return buildResponse(result);
```

---

## 3. Optimizar `getUsuarios` (Lectura rápida)

Elimina la llamada a `asegurarColumnasUsuarios()` dentro de `getUsuarios()`, ya que esa función solo debe correrse al inicializar la base de datos:

```javascript
function getUsuarios() {
  const usuarios = sheetToObjects(getSheet('usuarios'))
    .filter(usuario => isActivo(usuario.activo))
    .map(userPublicData);

  return {
    success: true,
    data: usuarios
  };
}
```

---

## 4. Caché de Puestos (`getPuestos`)

Agrega lectura desde `CacheService` para servir el estado de los puestos en milisegundos:

```javascript
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

  const usuariosMap = {};
  sheetToObjects(getSheet('usuarios')).forEach(u => {
    usuariosMap[String(u.id)] = u;
  });

  const enrichedPuestos = puestos.map(p => {
    const u = p.usuario_id ? usuariosMap[String(p.usuario_id)] : null;
    let placa = '';
    if (u) {
      const tipoLower = String(p.tipo || '').toLowerCase();
      if (tipoLower === 'carro') placa = u.placa_carro || u.placa || '';
      else if (tipoLower === 'moto') placa = u.placa_moto || u.placa || '';
      else placa = u.placa || '';
    }
    return {
      ...p,
      usuario_placa: placa
    };
  });

  const res = {
    success: true,
    data: enrichedPuestos,
    config
  };

  try {
    cache.put('puestos_data', JSON.stringify(res), 180); // 3 minutos en RAM
  } catch (e) {}

  return res;
}
```

---

## 5. Caché de Métricas de Administración (`getAdminResumen`)

Evita abrir y procesar las 4 hojas de cálculo en cada visita al panel de administración:

```javascript
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
    cache.put('admin_resumen', JSON.stringify(res), 120); // 2 minutos
  } catch (e) {}

  return res;
}
```

---

## 6. Corrección de URLs de Imágenes de Recibos (`subirRecibo`)

En `subirRecibo`, cambia la URL almacenada para usar el CDN abierto de Google (`lh3.googleusercontent.com/d/`):

```javascript
  const fileId = file.getId();
  const url = 'https://lh3.googleusercontent.com/d/' + fileId;
```

---

## 7. Lógica de Cierre de Mes (Ventana 12 al 11 y Cortes Individuales)

En `reciboPertenecePeriodo`, se contabilizan los recibos aprobados recaudados durante la ventana contable del administrador (del 12 al 11), permitiendo que cada usuario conserve su corte individual:

```javascript
function reciboPertenecePeriodo(recibo, startDate, endDate) {
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T23:59:59');

  // 1. Momento de recaudo real en caja del parqueadero
  if (recibo.fecha_subida) {
    const upload = new Date(recibo.fecha_subida);
    if (!isNaN(upload.getTime()) && upload >= start && upload <= end) {
      return true;
    }
  }

  // 2. Si su fecha_inicio cae dentro del rango contable
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
```

---

## 8. Pasos para Implementar en Google Apps Script

1. Abre tu proyecto de **Google Apps Script** asociado al parqueadero.
2. Copia el contenido completo de [`docs/Code.gs`](file:///c:/Users/Daniel/OneDrive/Documentos/prigma/GoParking/docs/Code.gs) y pégalo en el editor de Apps Script reemplazando el código anterior.
3. Haz clic en **Guardar** (ícono de disco).
4. Haz clic en el botón azul superior **Implementar (Deploy)** > **Administrar implementaciones (Manage deployments)**.
5. Selecciona la implementación activa del Web App, haz clic en el ícono de **Editar (Lápiz)**.
6. En la opción **Versión**, selecciona **Nueva versión (New version)**.
7. Haz clic en **Implementar (Deploy)**.