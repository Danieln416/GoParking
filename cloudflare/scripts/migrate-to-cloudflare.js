// ============================================================
// Script de Migración de Google Apps Script a Cloudflare D1 + R2
// Opción B: Copia completa de base de datos + Descarga de imágenes
// ============================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GAS_URL = 'https://script.google.com/macros/s/AKfycbzmLzNwfJuD4p6sSkE82xhxCGV7-M_CMVKbrXosv6hua2qsYvRWGvMmSl0RO4oiDDY2-A/exec';

const OUTPUT_DIR = path.resolve(__dirname, '../migrated_data');
const IMAGES_RECIBOS_DIR = path.join(OUTPUT_DIR, 'images', 'recibos');
const IMAGES_QR_DIR = path.join(OUTPUT_DIR, 'images', 'qr');
const SQL_OUTPUT_FILE = path.join(OUTPUT_DIR, 'seed_data.sql');

// Crear carpetas si no existen
[OUTPUT_DIR, IMAGES_RECIBOS_DIR, IMAGES_QR_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

function escapeSql(str) {
  if (str === null || str === undefined) return 'NULL';
  return `'${String(str).replace(/'/g, "''")}'`;
}

async function callGas(action, params = {}) {
  const query = new URLSearchParams({ action, ...params, _t: Date.now() });
  const res = await fetch(`${GAS_URL}?${query}`);
  return await res.json();
}

async function downloadImage(url, destPath) {
  try {
    if (!url || !url.startsWith('http')) return false;
    const res = await fetch(url);
    if (!res.ok) return false;
    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(destPath, buffer);
    return true;
  } catch (err) {
    console.warn(`No se pudo descargar imagen desde ${url}:`, err.message);
    return false;
  }
}

async function runMigration() {
  console.log('========================================================');
  console.log('🚀 Iniciando extracción de datos desde Google Sheets...');
  console.log('========================================================\n');

  // 1. Obtener datos desde Google Apps Script
  console.log('⏳ Consultando Usuarios...');
  const usuariosRes = await callGas('getUsuarios');
  const usuarios = usuariosRes.success ? (usuariosRes.data || []) : [];
  console.log(`✓ ${usuarios.length} usuarios obtenidos.`);

  console.log('⏳ Consultando Puestos...');
  const puestosRes = await callGas('getPuestos');
  const puestos = puestosRes.success ? (puestosRes.data || []) : [];
  console.log(`✓ ${puestos.length} puestos obtenidos.`);

  console.log('⏳ Consultando Recibos...');
  const recibosRes = await callGas('getRecibos', { userId: 'all' });
  const recibos = recibosRes.success ? (recibosRes.data || []) : [];
  console.log(`✓ ${recibos.length} recibos obtenidos.`);

  console.log('⏳ Consultando Cuentas de Pago...');
  const cuentasRes = await callGas('getCuentasPago');
  const cuentas = cuentasRes.success ? (cuentasRes.data || []) : [];
  console.log(`✓ ${cuentas.length} cuentas de pago obtenidas.`);

  // 2. Descargar imágenes de Recibos y Códigos QR (Opción B)
  console.log('\n========================================================');
  console.log('🖼️ Descargando imágenes de Google Drive a local para R2...');
  console.log('========================================================');

  let recibosConImagen = 0;
  for (const r of recibos) {
    if (r.url_imagen) {
      const imgPath = path.join(IMAGES_RECIBOS_DIR, `${r.id}.jpg`);
      const ok = await downloadImage(r.url_imagen, imgPath);
      if (ok) {
        recibosConImagen++;
        r.r2_key = `recibos/${r.id}.jpg`;
        r.url_imagen_nueva = `/media/recibos/${r.id}.jpg`;
      }
    }
  }
  console.log(`✓ ${recibosConImagen} imágenes de recibos descargadas exitosamente.`);

  let qrConImagen = 0;
  for (const c of cuentas) {
    if (c.qr_url) {
      const imgPath = path.join(IMAGES_QR_DIR, `${c.id}.jpg`);
      const ok = await downloadImage(c.qr_url, imgPath);
      if (ok) {
        qrConImagen++;
        c.r2_key = `qr/${c.id}.jpg`;
        c.qr_url_nueva = `/media/qr/${c.id}.jpg`;
      }
    }
  }
  console.log(`✓ ${qrConImagen} códigos QR descargados exitosamente.`);

  // 3. Generar archivo SQL para Cloudflare D1
  console.log('\n========================================================');
  console.log('📝 Generando archivo SQL (seed_data.sql) para D1...');
  console.log('========================================================');

  let sqlStatements = [];
  sqlStatements.push('-- Archivo de migración generado automáticamente');
  sqlStatements.push('BEGIN TRANSACTION;\n');

  // Insertar Usuarios
  for (const u of usuarios) {
    sqlStatements.push(`INSERT OR REPLACE INTO usuarios (id, nombre, cedula, correo, telefono, celular, direccion, placa, placa_carro, placa_moto, tipo_vehiculo, tipo_tarifa, valor_tarifa, fecha_inicio, contrasena, rol, activo) VALUES (${escapeSql(u.id)}, ${escapeSql(u.nombre)}, ${escapeSql(u.cedula)}, ${escapeSql(u.correo)}, ${escapeSql(u.telefono)}, ${escapeSql(u.celular)}, ${escapeSql(u.direccion)}, ${escapeSql(u.placa)}, ${escapeSql(u.placa_carro)}, ${escapeSql(u.placa_moto)}, ${escapeSql(u.tipo_vehiculo)}, ${escapeSql(u.tipo_tarifa)}, ${Number(u.valor_tarifa || 0)}, ${escapeSql(u.fecha_inicio)}, ${escapeSql(u.contrasena || '123456')}, ${escapeSql(u.rol || 'usuario')}, 1);`);
  }

  // Insertar Puestos
  for (const p of puestos) {
    sqlStatements.push(`INSERT OR REPLACE INTO puestos (id, numero, tipo, estado, usuario_id, usuario_nombre) VALUES (${escapeSql(p.id)}, ${Number(p.numero)}, ${escapeSql(p.tipo)}, ${escapeSql(p.estado)}, ${escapeSql(p.usuario_id)}, ${escapeSql(p.usuario_nombre)});`);
  }

  // Insertar Recibos
  for (const r of recibos) {
    const finalUrl = r.url_imagen_nueva || r.url_imagen || '';
    const r2Key = r.r2_key || '';
    sqlStatements.push(`INSERT OR REPLACE INTO recibos (id, usuario_id, usuario_nombre, usuario_correo, fecha_subida, fecha_inicio, fecha_fin, mes, anio, metodo_pago, url_imagen, r2_key, estado, fecha_revision, admin_nota) VALUES (${escapeSql(r.id)}, ${escapeSql(r.usuario_id)}, ${escapeSql(r.usuario_nombre)}, ${escapeSql(r.usuario_correo)}, ${escapeSql(r.fecha_subida || new Date().toISOString())}, ${escapeSql(r.fecha_inicio)}, ${escapeSql(r.fecha_fin)}, ${Number(r.mes || 1)}, ${Number(r.anio || 2026)}, ${escapeSql(r.metodo_pago || 'No especificado')}, ${escapeSql(finalUrl)}, ${escapeSql(r2Key)}, ${escapeSql(r.estado || 'en_revision')}, ${escapeSql(r.fecha_revision)}, ${escapeSql(r.admin_nota)});`);
  }

  // Insertar Cuentas de Pago
  for (const c of cuentas) {
    const finalQr = c.qr_url_nueva || c.qr_url || '';
    const r2Key = c.r2_key || '';
    sqlStatements.push(`INSERT OR REPLACE INTO cuentas_pago (id, nombre, entidad, tipo_cuenta, numero, titular, qr_url, r2_key, instrucciones, activo) VALUES (${escapeSql(c.id)}, ${escapeSql(c.nombre)}, ${escapeSql(c.entidad)}, ${escapeSql(c.tipo_cuenta)}, ${escapeSql(c.numero)}, ${escapeSql(c.titular)}, ${escapeSql(finalQr)}, ${escapeSql(r2Key)}, ${escapeSql(c.instrucciones)}, 1);`);
  }

  sqlStatements.push('\nCOMMIT;');

  fs.writeFileSync(SQL_OUTPUT_FILE, sqlStatements.join('\n'), 'utf8');

  // 4. Generar Script de Carga de Imágenes a R2
  const r2UploadScriptPath = path.join(OUTPUT_DIR, 'subir-imagenes-a-r2.bat');
  let batCommands = [
    '@echo off',
    'echo Subiendo recibos y codigos QR a Cloudflare R2...',
    'REM Requiere tener wrangler instalado y configurado',
  ];

  for (const r of recibos) {
    if (r.r2_key) {
      batCommands.push(`npx wrangler r2 object put goparking-media/${r.r2_key} --file="images/recibos/${r.id}.jpg"`);
    }
  }

  for (const c of cuentas) {
    if (c.r2_key) {
      batCommands.push(`npx wrangler r2 object put goparking-media/${c.r2_key} --file="images/qr/${c.id}.jpg"`);
    }
  }

  batCommands.push('echo Todas las imagenes fueron subidas a Cloudflare R2 con exito!');
  fs.writeFileSync(r2UploadScriptPath, batCommands.join('\r\n'), 'utf8');

  console.log('\n========================================================');
  console.log('🎉 ¡MIGRACIÓN PREPARADA CON ÉXITO!');
  console.log('========================================================');
  console.log(`📁 Archivo SQL generado: ${SQL_OUTPUT_FILE}`);
  console.log(`📁 Script de carga R2:   ${r2UploadScriptPath}`);
  console.log(`📊 Resumen:`);
  console.log(`   • ${usuarios.length} usuarios`);
  console.log(`   • ${puestos.length} puestos`);
  console.log(`   • ${recibos.length} recibos (${recibosConImagen} imágenes listas)`);
  console.log(`   • ${cuentas.length} cuentas de pago (${qrConImagen} QR listos)`);
  console.log('========================================================\n');
}

runMigration().catch(err => {
  console.error('Error fatal durante la migración:', err);
});
