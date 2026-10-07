// ============================================================
// GoParking — Cloudflare Worker API & Automated Cron
// Base de Datos: Cloudflare D1 (SQL)
// Almacenamiento: Cloudflare R2 (Imágenes)
// Notificaciones: WhatsApp API Desatendido (Cron diario)
// ============================================================

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
  'Access-Control-Max-Age': '86400',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS
    }
  });
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

async function hashPassword(str) {
  const enc = new TextEncoder().encode(String(str || ''));
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// ============================================================
// UTILIDADES DE FECHA Y PERÍODOS (Lógica contable GoParking)
// ============================================================

function normalizarFecha(val) {
  if (!val) return '';
  return String(val).slice(0, 10);
}

function parseDate(value) {
  if (!value) return null;
  const str = String(value).trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(value);
}

function formatDate(date) {
  if (!date) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addMonthsKeepingDay(date, months, targetDay) {
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return new Date(target.getFullYear(), target.getMonth(), Math.min(targetDay, lastDay));
}

// Cierre contable del administrador (12 al 11)
function getAdminClosingPeriod(refDate = new Date()) {
  const d = parseDate(refDate) || new Date();
  let year = d.getFullYear();
  let month = d.getMonth();
  if (d.getDate() < 12) {
    month -= 1;
    if (month < 0) { month = 11; year -= 1; }
  }
  const start = new Date(year, month, 12);
  const end = new Date(year, month + 1, 11);
  return { startDate: formatDate(start), endDate: formatDate(end) };
}

// Determinar mora individual de un usuario
function calcularEstadoMoraUsuario(usuario, userReceipts = [], refDate = new Date()) {
  const today = parseDate(refDate) || new Date();
  const start = parseDate(usuario.fecha_inicio) || new Date();
  const billingDay = start.getDate();

  const msPerDay = 86400000;
  const todayZero = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  let candidateCutoff = addMonthsKeepingDay(todayZero, 0, billingDay);
  if (todayZero < candidateCutoff) {
    candidateCutoff = addMonthsKeepingDay(todayZero, -1, billingDay);
  }

  const startZero = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const prevPeriodStart = addMonthsKeepingDay(candidateCutoff, -1, billingDay);
  const hadPrevCycle = startZero <= prevPeriodStart;

  if (hadPrevCycle) {
    const prevStartStr = formatDate(prevPeriodStart);
    const prevCutoffStr = formatDate(candidateCutoff);

    const prevReceipt = userReceipts.find(r => {
      if (r.fecha_inicio && r.fecha_inicio.slice(0, 10) === prevStartStr) return true;
      if (r.fecha_subida) {
        const u = r.fecha_subida.slice(0, 10);
        return u >= prevStartStr && u <= prevCutoffStr;
      }
      return false;
    });

    const isPaid = prevReceipt && (prevReceipt.estado === 'aprobado' || prevReceipt.estado === 'en_revision');
    if (!isPaid) {
      const diffDays = Math.round((candidateCutoff - todayZero) / msPerDay);
      return {
        enMora: true,
        diasMora: Math.abs(diffDays),
        fechaCorte: prevCutoffStr,
        periodoTexto: `${prevStartStr} al ${formatDate(new Date(candidateCutoff.getTime() - 86400000))}`
      };
    }
  }

  // Período actual
  let currentStart = candidateCutoff;
  if (currentStart < startZero) currentStart = startZero;
  const nextCutoff = addMonthsKeepingDay(currentStart, 1, billingDay);
  const nextCutoffStr = formatDate(nextCutoff);

  const currentReceipt = userReceipts.find(r => {
    if (r.fecha_inicio && r.fecha_inicio.slice(0, 10) === formatDate(currentStart)) return true;
    if (r.fecha_subida) return r.fecha_subida.slice(0, 10) >= formatDate(currentStart);
    return false;
  });

  const isPaid = currentReceipt && (currentReceipt.estado === 'aprobado' || currentReceipt.estado === 'en_revision');
  const diffDays = Math.round((nextCutoff - todayZero) / msPerDay);

  if (!isPaid && diffDays <= 0) {
    return {
      enMora: true,
      diasMora: Math.abs(diffDays),
      fechaCorte: nextCutoffStr,
      periodoTexto: `${formatDate(currentStart)} al ${formatDate(new Date(nextCutoff.getTime() - 86400000))}`
    };
  }

  return { enMora: false, diasMora: 0, fechaCorte: nextCutoffStr };
}

// ============================================================
// SERVICIO DE WHATSAPP (Meta Cloud API o Evolution API)
// ============================================================

async function enviarMensajeWhatsApp(env, celular, mensajeTexto, variablesPlantilla = []) {
  if (!celular) return { success: false, error: 'Sin número celular' };

  // Limpiar y formatear a E.164 (ej. 573001234567 para Colombia)
  let cleanNumber = String(celular).replace(/\D/g, '');
  if (cleanNumber.length === 10 && cleanNumber.startsWith('3')) {
    cleanNumber = '57' + cleanNumber; // Añadir código país Colombia si falta
  }

  if (env.WHATSAPP_PROVIDER === 'meta') {
    if (!env.WHATSAPP_PHONE_NUMBER_ID || !env.WHATSAPP_ACCESS_TOKEN) {
      console.warn('Meta WhatsApp no configurado (falta PHONE_NUMBER_ID o ACCESS_TOKEN)');
      return { success: false, error: 'Credenciales Meta WhatsApp pendientes' };
    }

    const url = `https://graph.facebook.com/v20.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
    
    // Si hay plantilla configurada, enviar con plantilla oficial
    let bodyPayload = {};
    if (env.WHATSAPP_TEMPLATE_NAME && variablesPlantilla.length > 0) {
      bodyPayload = {
        messaging_product: 'whatsapp',
        to: cleanNumber,
        type: 'template',
        template: {
          name: env.WHATSAPP_TEMPLATE_NAME,
          language: { code: 'es' },
          components: [
            {
              type: 'body',
              parameters: variablesPlantilla.map(v => ({ type: 'text', text: String(v) }))
            }
          ]
        }
      };
    } else {
      // Mensaje de texto libre directo
      bodyPayload = {
        messaging_product: 'whatsapp',
        to: cleanNumber,
        type: 'text',
        text: { body: mensajeTexto }
      };
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(bodyPayload)
    });

    const resData = await res.json();
    return { success: res.ok, data: resData, error: res.ok ? null : JSON.stringify(resData) };
  }

  if (env.WHATSAPP_PROVIDER === 'evolution') {
    if (!env.WHATSAPP_EVOLUTION_URL) {
      return { success: false, error: 'URL Evolution API pendiente' };
    }

    const url = `${env.WHATSAPP_EVOLUTION_URL.replace(/\/$/, '')}/message/sendText/${env.WHATSAPP_EVOLUTION_INSTANCE || 'goparking'}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': env.WHATSAPP_EVOLUTION_APIKEY || '',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        number: cleanNumber,
        options: { delay: 1200, presence: 'composing' },
        textMessage: { text: mensajeTexto }
      })
    });

    const resData = await res.json();
    return { success: res.ok, data: resData, error: res.ok ? null : JSON.stringify(resData) };
  }

  return { success: false, error: 'Proveedor de WhatsApp no soportado' };
}

// Ejecución del barrido automático de morosos
async function ejecutarBarridoMorosos(env) {
  console.log('Iniciando barrido automático de moras para WhatsApp...');
  const { results: usuarios } = await env.DB.prepare(
    "SELECT * FROM usuarios WHERE rol = 'usuario' AND activo = 1"
  ).all();

  const { results: recibos } = await env.DB.prepare("SELECT * FROM recibos").all();
  const { results: cuentas } = await env.DB.prepare("SELECT * FROM cuentas_pago WHERE activo = 1").all();

  const cuentasTexto = cuentas.length > 0
    ? cuentas.map(c => `• ${c.nombre} (${c.entidad}): ${c.numero}`).join('\n')
    : 'Cuentas oficiales de GoParking';

  let enviados = 0;
  let omitidos = 0;

  for (const user of usuarios) {
    const userRecibos = recibos.filter(r => r.usuario_id === user.id);
    const estado = calcularEstadoMoraUsuario(user, userRecibos);

    if (estado.enMora) {
      // Verificar si ya fue notificado en las últimas 24 horas para evitar spam
      const hoyStr = new Date().toISOString().slice(0, 10);
      const { results: yaNotificado } = await env.DB.prepare(
        "SELECT id FROM notificaciones_whatsapp WHERE usuario_id = ? AND date(fecha_envio) = ?"
      ).bind(user.id, hoyStr).all();

      if (yaNotificado && yaNotificado.length > 0) {
        omitidos++;
        continue;
      }

      const valorFmt = `$${Number(user.valor_tarifa || 0).toLocaleString('es-CO')}`;
      const primerNombre = (user.nombre || '').split(' ')[0];

      const mensaje = `Hola ${primerNombre} 👋, te saludamos del Parqueadero GoParking 🚗.\n\n` +
        `Te recordamos amablemente que tu mensualidad presenta *${estado.diasMora} día(s) de vencimiento* (Fecha de corte: ${estado.fechaCorte}).\n\n` +
        `💰 *Valor a cancelar:* ${valorFmt}\n\n` +
        `📌 *Cuentas disponibles para pago:*\n${cuentasTexto}\n\n` +
        `Una vez realizado el pago, por favor sube tu comprobante en la aplicación web para registrar tu mensualidad al día.\n\n` +
        `¡Muchas gracias por tu puntualidad!`;

      const celular = user.celular || user.telefono;
      const resEnvio = await enviarMensajeWhatsApp(env, celular, mensaje, [primerNombre, estado.diasMora, valorFmt]);

      // Guardar registro de la notificación
      const notifId = generateId();
      await env.DB.prepare(
        "INSERT INTO notificaciones_whatsapp (id, usuario_id, celular, tipo_notificacion, mensaje, estado_envio, proveedor_id) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).bind(
        notifId,
        user.id,
        celular || '',
        'mora',
        mensaje,
        resEnvio.success ? 'enviado' : 'fallido',
        resEnvio.data?.messages?.[0]?.id || ''
      ).run();

      if (resEnvio.success) enviados++;
    }
  }

  console.log(`Barrido finalizado. Notificaciones enviadas: ${enviados}, Omitidas por aviso previo: ${omitidos}`);
  return { success: true, enviados, omitidos };
}

// ============================================================
// HANDLER PRINCIPAL DE PETICIONES HTTP
// ============================================================

export default {
  // Manejador del Cron Trigger (8:00 AM diario)
  async scheduled(event, env, ctx) {
    ctx.waitUntil(ejecutarBarridoMorosos(env));
  },

  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // Servir imágenes directamente desde Cloudflare R2
    if (path.startsWith('/media/')) {
      const key = path.replace('/media/', '');
      const object = await env.MEDIA_BUCKET.get(key);
      if (!object) {
        return new Response('Imagen no encontrada', { status: 404, headers: CORS_HEADERS });
      }
      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set('etag', object.httpEtag);
      headers.set('Cache-Control', 'public, max-age=31536000, immutable');
      headers.set('Access-Control-Allow-Origin', '*');
      return new Response(object.body, { headers });
    }

    try {
      // Extraer parámetros (soporta GET query params o POST JSON)
      let data = {};
      let action = '';

      if (request.method === 'POST') {
        try {
          data = await request.json();
          action = data.action || '';
        } catch {
          data = {};
        }
      } else {
        url.searchParams.forEach((v, k) => { data[k] = v; });
        action = data.action || '';
      }

      // ----------------------------------------------------
      // PING / ESTADO
      // ----------------------------------------------------
      if (action === 'ping' || path === '/api/ping') {
        return json({ success: true, message: 'API GoParking Cloudflare D1 OK', version: '2.0.0' });
      }

      // ----------------------------------------------------
      // AUTENTICACIÓN
      // ----------------------------------------------------
      if (action === 'login' || path === '/api/login') {
        const correo = String(data.correo || '').trim().toLowerCase();
        const rawPassword = String(data.contrasena || '');
        const cleanHash = await hashPassword(rawPassword);
        const legacyHash = await hashPassword(rawPassword + 'parking_secret_key_2024');

        let usuario = await env.DB.prepare(
          "SELECT * FROM usuarios WHERE lower(correo) = ?"
        ).bind(correo).first();

        if (!usuario) {
          return json({ success: false, error: 'Correo o contraseña incorrectos' });
        }

        if (usuario.activo === 0 || usuario.activo === '0') {
          return json({ success: false, error: 'Este usuario se encuentra retirado del sistema.' });
        }

        if (!usuario.contrasena || usuario.contrasena.trim() === '') {
          return json({ success: false, error: 'Usuario precargado sin credenciales configuradas. Contacte al administrador.' });
        }

        const match = (usuario.contrasena === cleanHash) ||
                      (usuario.contrasena === legacyHash) ||
                      (usuario.contrasena === rawPassword);

        if (!match) {
          return json({ success: false, error: 'Correo o contraseña incorrectos' });
        }

        // Si la contraseña estaba en formato legacy (Apps Script con salt) o en texto plano,
        // actualizarla automáticamente y de forma transparente al hash estándar seguro
        if (usuario.contrasena !== cleanHash) {
          await env.DB.prepare("UPDATE usuarios SET contrasena = ? WHERE id = ?").bind(cleanHash, usuario.id).run();
        }

        const { contrasena, ...publicData } = usuario;
        return json({
          success: true,
          token: btoa(`${usuario.id}:${Date.now()}`),
          user: publicData
        });
      }

      // ----------------------------------------------------
      // RESUMEN ADMINISTRATIVO
      // ----------------------------------------------------
      if (action === 'getAdminResumen' || path === '/api/admin/resumen') {
        const [usersRes, usersRetiradosRes, recibosRes, puestosRes, solicitudesRes] = await Promise.all([
          env.DB.prepare("SELECT COUNT(*) as count FROM usuarios WHERE (activo = 1 OR activo = '1' OR activo IS NULL)").first(),
          env.DB.prepare("SELECT COUNT(*) as count FROM usuarios WHERE activo = 0").first().catch(() => ({ count: 0 })),
          env.DB.prepare("SELECT * FROM recibos ORDER BY fecha_subida DESC").all(),
          env.DB.prepare("SELECT estado, COUNT(*) as count FROM puestos GROUP BY estado").all(),
          env.DB.prepare("SELECT COUNT(*) as count FROM solicitudes WHERE estado = 'pendiente'").first().catch(() => ({ count: 0 }))
        ]);

        const recibos = recibosRes.results || [];
        const puestosCounts = puestosRes.results || [];
        const libres = puestosCounts.find(p => p.estado === 'libre')?.count || 0;
        const ocupados = puestosCounts.find(p => p.estado === 'ocupado')?.count || 0;

        const baseOrigin = env.MEDIA_BASE_URL || url.origin;
        const recientesRecibos = recibos.slice(0, 10).map(r => ({
          ...r,
          url_imagen: r.url_imagen ? (r.url_imagen.startsWith('http') ? r.url_imagen : `${baseOrigin}${r.url_imagen.startsWith('/') ? '' : '/'}${r.url_imagen}`) : ''
        }));

        return json({
          success: true,
          data: {
            usuarios: usersRes?.count || 0,
            usuariosRetirados: usersRetiradosRes?.count || 0,
            recibosTotal: recibos.length,
            enRevision: recibos.filter(r => r.estado === 'en_revision').length,
            aprobados: recibos.filter(r => r.estado === 'aprobado').length,
            puestosLibres: libres,
            puestosOcupados: ocupados,
            solicitudesPendientes: solicitudesRes?.count || 0,
            recientesRecibos
          }
        });
      }

      // ----------------------------------------------------
      // USUARIOS
      // ----------------------------------------------------
      if (action === 'getUsuarios' || path === '/api/usuarios') {
        const { results } = await env.DB.prepare(
          "SELECT id, nombre, cedula, correo, telefono, celular, direccion, placa, placa_carro, placa_moto, tipo_vehiculo, tipo_tarifa, valor_tarifa, fecha_inicio, rol, activo, fecha_creacion, (CASE WHEN contrasena IS NOT NULL AND trim(contrasena) != '' THEN 1 ELSE 0 END) as has_password FROM usuarios ORDER BY activo DESC, nombre ASC"
        ).all();
        return json({ success: true, data: results });
      }

      if (action === 'crearUsuario') {
        const id = generateId();
        const rawPassword = data.contrasena ? String(data.contrasena).trim() : '';
        const pwd = rawPassword ? await hashPassword(rawPassword) : '';
        const cedula = String(data.cedula || '').replace(/\D/g, '');
        const correo = String(data.correo || '').trim().toLowerCase();

        // Verificar duplicados si cedula o correo vienen informados
        if (cedula || correo) {
          const conditions = [];
          const binds = [];
          if (cedula) {
            conditions.push("(cedula = ? AND cedula != '')");
            binds.push(cedula);
          }
          if (correo) {
            conditions.push("(lower(correo) = ? AND correo != '')");
            binds.push(correo);
          }
          const existe = await env.DB.prepare(
            `SELECT id FROM usuarios WHERE ${conditions.join(' OR ')}`
          ).bind(...binds).first();

          if (existe) {
            return json({ success: false, error: 'Ya existe un usuario con esa cédula o correo' });
          }
        }

        await env.DB.prepare(`
          INSERT INTO usuarios (id, nombre, cedula, correo, telefono, celular, direccion, placa, placa_carro, placa_moto, tipo_vehiculo, tipo_tarifa, valor_tarifa, fecha_inicio, contrasena, rol, activo)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'usuario', 1)
        `).bind(
          id,
          String(data.nombre || '').trim(),
          cedula || null,
          correo || null,
          String(data.telefono || '').trim(),
          String(data.celular || '').trim(),
          String(data.direccion || '').trim(),
          data.placa_carro || data.placa_moto || data.placa || '',
          data.placa_carro || data.placa || '',
          data.placa_moto || '',
          data.tipo_vehiculo || 'Carro',
          data.tipo_tarifa || 'Mensual',
          Number(data.valor_tarifa || 0),
          normalizarFecha(data.fecha_inicio) || new Date().toISOString().slice(0, 10),
          pwd
        ).run();

        return json({ success: true, data: { id, nombre: data.nombre, passwordInicial: rawPassword || null } });
      }

      if (action === 'actualizarUsuario') {
        const id = data.id;
        if (!id) return json({ success: false, error: 'ID de usuario requerido' });

        const campos = ['nombre', 'cedula', 'correo', 'telefono', 'celular', 'direccion', 'placa_carro', 'placa_moto', 'tipo_vehiculo', 'tipo_tarifa', 'valor_tarifa', 'fecha_inicio'];
        let updates = [];
        let params = [];

        campos.forEach(campo => {
          if (data[campo] !== undefined) {
            updates.push(`${campo} = ?`);
            let val = data[campo];
            if (campo === 'fecha_inicio') {
              val = normalizarFecha(val);
            } else if (campo === 'correo') {
              val = val ? String(val).trim().toLowerCase() : null;
            } else if (campo === 'cedula') {
              val = val ? String(val).replace(/\D/g, '') : null;
            }
            params.push(val);
          }
        });

        if (data.placa_carro !== undefined || data.placa_moto !== undefined || data.placa !== undefined) {
          updates.push('placa = ?');
          params.push(data.placa_carro || data.placa_moto || data.placa || '');
        }

        if (data.activo !== undefined) {
          updates.push('activo = ?');
          params.push(Number(data.activo));
        }

        if (data.contrasena !== undefined && String(data.contrasena).trim() !== '') {
          updates.push('contrasena = ?');
          params.push(await hashPassword(String(data.contrasena).trim()));
        }

        if (updates.length > 0) {
          params.push(id);
          await env.DB.prepare(`UPDATE usuarios SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();
        }

        return json({ success: true });
      }

      if (action === 'retirarUsuario') {
        const id = data.id;
        await env.DB.prepare("UPDATE usuarios SET activo = 0 WHERE id = ?").bind(id).run();
        await env.DB.prepare("UPDATE puestos SET estado = 'libre', usuario_id = NULL, usuario_nombre = NULL WHERE usuario_id = ?").bind(id).run();
        return json({ success: true });
      }

      if (action === 'reactivarUsuario') {
        const id = data.id;
        await env.DB.prepare("UPDATE usuarios SET activo = 1 WHERE id = ?").bind(id).run();
        return json({ success: true });
      }

      if (action === 'eliminarUsuario' || action === 'eliminarUsuarioPermanente') {
        const id = data.id;
        if (data.permanente || action === 'eliminarUsuarioPermanente') {
          await env.DB.prepare("DELETE FROM recibos WHERE usuario_id = ?").bind(id).run();
          await env.DB.prepare("UPDATE puestos SET estado = 'libre', usuario_id = NULL, usuario_nombre = NULL WHERE usuario_id = ?").bind(id).run();
          await env.DB.prepare("DELETE FROM solicitudes WHERE usuario_id = ?").bind(id).run();
          await env.DB.prepare("DELETE FROM notificaciones_whatsapp WHERE usuario_id = ?").bind(id).run();
          await env.DB.prepare("DELETE FROM usuarios WHERE id = ?").bind(id).run();
        } else {
          await env.DB.prepare("UPDATE usuarios SET activo = 0 WHERE id = ?").bind(id).run();
          await env.DB.prepare("UPDATE puestos SET estado = 'libre', usuario_id = NULL, usuario_nombre = NULL WHERE usuario_id = ?").bind(id).run();
        }
        return json({ success: true });
      }


      // ----------------------------------------------------
      // RECIBOS (Con subida directa a R2)
      // ----------------------------------------------------
      if (action === 'getRecibos' || path === '/api/recibos') {
        let query = "SELECT * FROM recibos";
        let params = [];
        if (data.userId && data.userId !== 'all') {
          query += " WHERE usuario_id = ?";
          params.push(data.userId);
        }
        query += " ORDER BY fecha_subida DESC";
        const { results } = await env.DB.prepare(query).bind(...params).all();
        const baseOrigin = env.MEDIA_BASE_URL || url.origin;
        const formatted = results.map(r => ({
          ...r,
          url_imagen: r.url_imagen ? (r.url_imagen.startsWith('http') ? r.url_imagen : `${baseOrigin}${r.url_imagen.startsWith('/') ? '' : '/'}${r.url_imagen}`) : ''
        }));
        return json({ success: true, data: formatted });
      }

      if (action === 'subirRecibo') {
        const id = generateId();
        let url = '';
        let r2Key = '';

        // Si se envió imagen en base64, guardarla en R2
        if (data.base64Data) {
          r2Key = `recibos/${id}.jpg`;
          const binaryString = atob(data.base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }

          await env.MEDIA_BUCKET.put(r2Key, bytes, {
            httpMetadata: { contentType: data.mimeType || 'image/jpeg' }
          });

          const baseOrigin = env.MEDIA_BASE_URL || url.origin;
          url = `${baseOrigin}/media/${r2Key}`;
        }

        const fechaInicio = normalizarFecha(data.fecha_inicio || data.fechaInicio);
        let fechaFin = normalizarFecha(data.fecha_fin || data.fechaFin);
        if (!fechaFin && fechaInicio) {
          const d = parseDate(fechaInicio);
          fechaFin = formatDate(new Date(d.getFullYear(), d.getMonth() + 1, d.getDate() - 1));
        }

        const nowIso = new Date().toISOString();
        await env.DB.prepare(`
          INSERT INTO recibos (id, usuario_id, usuario_nombre, usuario_correo, fecha_subida, fecha_inicio, fecha_fin, mes, anio, metodo_pago, url_imagen, r2_key, estado)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'en_revision')
        `).bind(
          id,
          data.userId,
          data.userName,
          data.userEmail || '',
          nowIso,
          fechaInicio,
          fechaFin,
          data.mes || (new Date().getMonth() + 1),
          data.anio || new Date().getFullYear(),
          data.metodoPago || data.metodo_pago || 'No especificado',
          url,
          r2Key
        ).run();

        return json({ success: true, data: { id, url, estado: 'en_revision' } });
      }

      if (action === 'aprobarRecibo') {
        await env.DB.prepare(
          "UPDATE recibos SET estado = 'aprobado', admin_nota = ?, fecha_revision = ? WHERE id = ?"
        ).bind(data.nota || 'Aprobado', new Date().toISOString(), data.id).run();
        return json({ success: true });
      }

      if (action === 'rechazarRecibo') {
        await env.DB.prepare(
          "UPDATE recibos SET estado = 'rechazado', admin_nota = ?, fecha_revision = ? WHERE id = ?"
        ).bind(data.nota || 'Rechazado', new Date().toISOString(), data.id).run();
        return json({ success: true });
      }

      // ----------------------------------------------------
      // PUESTOS
      // ----------------------------------------------------
      if (action === 'getPuestos' || path === '/api/puestos') {
        const { results: puestos } = await env.DB.prepare("SELECT * FROM puestos ORDER BY numero ASC").all();
        const { results: usuarios } = await env.DB.prepare("SELECT id, placa_carro, placa_moto, tipo_vehiculo FROM usuarios").all();
        const { results: configRows } = await env.DB.prepare("SELECT clave, valor FROM config").all();

        const config = {};
        configRows.forEach(c => { config[c.clave] = c.valor; });

        const uMap = {};
        usuarios.forEach(u => { uMap[u.id] = u; });

        const enriched = puestos.map(p => {
          const u = p.usuario_id ? uMap[p.usuario_id] : null;
          let placa = '';
          if (u) {
            placa = p.tipo === 'carro' ? (u.placa_carro || u.placa_moto || '') : (u.placa_moto || u.placa_carro || '');
          }
          return { ...p, usuario_placa: placa };
        });

        return json({ success: true, data: enriched, config });
      }

      if (action === 'asignarPuestosUsuario') {
        const { userId, userName, puestoCarroId, puestoMotoId } = data;
        // Liberar puestos anteriores
        await env.DB.prepare("UPDATE puestos SET estado = 'libre', usuario_id = NULL, usuario_nombre = NULL WHERE usuario_id = ?").bind(userId).run();

        // Asignar nuevos puestos
        if (puestoCarroId) {
          await env.DB.prepare("UPDATE puestos SET estado = 'ocupado', usuario_id = ?, usuario_nombre = ? WHERE id = ?").bind(userId, userName, puestoCarroId).run();
        }
        if (puestoMotoId) {
          await env.DB.prepare("UPDATE puestos SET estado = 'ocupado', usuario_id = ?, usuario_nombre = ? WHERE id = ?").bind(userId, userName, puestoMotoId).run();
        }

        const { results } = await env.DB.prepare("SELECT * FROM puestos WHERE usuario_id = ?").bind(userId).all();
        return json({ success: true, data: results });
      }

      // ----------------------------------------------------
      // CIERRE DE MES Y GASTOS (Ciclo contable 12 al 11)
      // ----------------------------------------------------
      if (action === 'getCierreMes') {
        const startDate = normalizarFecha(data.startDate);
        const endDate = normalizarFecha(data.endDate);

        if (!startDate || !endDate) {
          return json({ success: false, error: 'Rango de fechas requerido' });
        }

        const startIso = startDate + 'T00:00:00';
        const endIso = endDate + 'T23:59:59';
        const baseOrigin = env.MEDIA_BASE_URL || url.origin;

        // Un recibo pertenece al ciclo si fue subido/recaudado durante este ciclo contable (fecha_subida entre startIso y endIso)
        const { results: rawRecibos } = await env.DB.prepare(`
          SELECT r.*, u.valor_tarifa, u.placa_carro, u.placa_moto, u.tipo_vehiculo
          FROM recibos r
          LEFT JOIN usuarios u ON r.usuario_id = u.id
          WHERE r.fecha_subida >= ? AND r.fecha_subida <= ?
          ORDER BY r.fecha_subida DESC
        `).bind(startIso, endIso).all();

        const { results: gastos } = await env.DB.prepare(`
          SELECT * FROM gastos WHERE fecha >= ? AND fecha <= ? ORDER BY fecha DESC
        `).bind(startDate, endDate).all();

        // Obtener clientes activos (excluyendo admin y usuario de prueba) para balance de cartera
        const { results: usuariosActivos } = await env.DB.prepare(`
          SELECT id, nombre, cedula, correo, telefono, celular, placa_carro, placa_moto, tipo_vehiculo, valor_tarifa, fecha_inicio
          FROM usuarios
          WHERE rol != 'admin' AND activo = 1 AND lower(nombre) != 'prueba'
          ORDER BY nombre ASC
        `).all();

        // Deduplicar recibos por id
        const uniqueMap = new Map();
        rawRecibos.forEach(r => {
          if (!uniqueMap.has(r.id)) {
            uniqueMap.set(r.id, r);
          }
        });
        const recibos = Array.from(uniqueMap.values());

        const formatearRecibo = (r) => {
          const valor = Number(r.valor_tarifa || 0);
          const fullImg = r.url_imagen ? (r.url_imagen.startsWith('http') ? r.url_imagen : `${baseOrigin}${r.url_imagen.startsWith('/') ? '' : '/'}${r.url_imagen}`) : '';
          return {
            recibo_id: r.id,
            id: r.id,
            usuario_id: r.usuario_id,
            usuario: r.usuario_nombre,
            correo: r.usuario_correo,
            placa: r.tipo_vehiculo === 'Carro' ? (r.placa_carro || '') : (r.placa_moto || r.placa_carro || ''),
            tipo_vehiculo: r.tipo_vehiculo,
            metodo_pago: r.metodo_pago || 'No especificado',
            valor,
            fecha: r.fecha_subida,
            fecha_inicio: r.fecha_inicio,
            fecha_fin: r.fecha_fin,
            estado: r.estado,
            url_imagen: fullImg,
            admin_nota: r.admin_nota || ''
          };
        };

        const aprobados = recibos.filter(r => r.estado === 'aprobado');
        const enRevision = recibos.filter(r => r.estado === 'en_revision');

        const detalleIngresos = aprobados.map(formatearRecibo);
        const recibosPendientes = enRevision.map(formatearRecibo);

        const totalIngresos = detalleIngresos.reduce((sum, d) => sum + d.valor, 0);
        const totalPendientes = recibosPendientes.reduce((sum, d) => sum + d.valor, 0);
        const totalGastos = gastos.reduce((sum, g) => sum + Number(g.valor || 0), 0);

        // Identificar qué usuarios activos ya pagaron en este período
        const idsPagados = new Set(recibos.map(r => r.usuario_id).filter(Boolean));
        const correosPagados = new Set(recibos.map(r => String(r.usuario_correo || '').toLowerCase()).filter(Boolean));

        const usuariosPendientes = (usuariosActivos || []).filter(u => {
          if (idsPagados.has(u.id)) return false;
          if (u.correo && correosPagados.has(String(u.correo).toLowerCase())) return false;
          return true;
        }).map(u => ({
          id: u.id,
          nombre: u.nombre,
          correo: u.correo,
          celular: u.celular,
          telefono: u.telefono,
          placa: u.tipo_vehiculo === 'Carro' ? (u.placa_carro || '') : (u.placa_moto || u.placa_carro || ''),
          tipo_vehiculo: u.tipo_vehiculo,
          valor_tarifa: Number(u.valor_tarifa || 0),
          fecha_inicio: u.fecha_inicio
        }));

        const totalEsperado = (usuariosActivos || []).reduce((sum, u) => sum + Number(u.valor_tarifa || 0), 0);
        const totalPorCobrar = usuariosPendientes.reduce((sum, u) => sum + u.valor_tarifa, 0);

        const { results: cierres } = await env.DB.prepare(
          "SELECT id FROM cierres WHERE fecha_inicio = ? AND fecha_fin = ?"
        ).bind(startDate, endDate).all();

        return json({
          success: true,
          data: {
            startDate,
            endDate,
            totalIngresos,
            totalPendientes,
            totalRecaudado: totalIngresos + totalPendientes,
            totalEsperado,
            totalPorCobrar,
            totalPotencial: totalIngresos + totalPendientes,
            totalGastos,
            balance: totalIngresos - totalGastos,
            cantidadRecibos: detalleIngresos.length,
            cantidadPendientes: recibosPendientes.length,
            cantidadUsuariosPendientes: usuariosPendientes.length,
            detalleIngresos,
            recibosPendientes,
            usuariosPendientes,
            gastos,
            cerrado: cierres.length > 0
          }
        });
      }

      if (action === 'agregarGasto') {
        const id = generateId();
        await env.DB.prepare("INSERT INTO gastos (id, descripcion, valor, fecha) VALUES (?, ?, ?, ?)").bind(
          id, data.descripcion, Number(data.valor || 0), normalizarFecha(data.fecha) || new Date().toISOString().slice(0, 10)
        ).run();
        return json({ success: true });
      }

      if (action === 'eliminarGasto') {
        await env.DB.prepare("DELETE FROM gastos WHERE id = ?").bind(data.id).run();
        return json({ success: true });
      }

      if (action === 'cerrarMes') {
        const startDate = normalizarFecha(data.startDate);
        const endDate = normalizarFecha(data.endDate);
        await env.DB.prepare("INSERT OR REPLACE INTO cierres (id, fecha_inicio, fecha_fin, fecha_cierre, estado) VALUES (?, ?, ?, ?, 'cerrado')").bind(
          generateId(), startDate, endDate, new Date().toISOString()
        ).run();
        return json({ success: true });
      }

      // ----------------------------------------------------
      // CUENTAS DE PAGO Y QR
      // ----------------------------------------------------
      if (action === 'getCuentasPago' || path === '/api/cuentas-pago') {
        const { results } = await env.DB.prepare("SELECT * FROM cuentas_pago WHERE activo = 1 ORDER BY nombre ASC").all();
        const baseOrigin = env.MEDIA_BASE_URL || url.origin;
        const formatted = results.map(c => ({
          ...c,
          qr_url: c.qr_url ? (c.qr_url.startsWith('http') ? c.qr_url : `${baseOrigin}${c.qr_url.startsWith('/') ? '' : '/'}${c.qr_url}`) : ''
        }));
        return json({ success: true, data: formatted });
      }

      if (action === 'guardarCuentaPago') {
        const id = data.id || generateId();
        let qrUrl = data.qr_url || '';
        let r2Key = '';

        if (data.qrBase64) {
          r2Key = `qr/${id}.jpg`;
          const binaryString = atob(data.qrBase64);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          await env.MEDIA_BUCKET.put(r2Key, bytes, { httpMetadata: { contentType: 'image/jpeg' } });
          const baseOrigin = env.MEDIA_BASE_URL || url.origin;
          qrUrl = `${baseOrigin}/media/${r2Key}`;
        }

        await env.DB.prepare(`
          INSERT INTO cuentas_pago (id, nombre, entidad, tipo_cuenta, numero, titular, qr_url, r2_key, instrucciones, activo)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
          ON CONFLICT(id) DO UPDATE SET
            nombre = excluded.nombre,
            entidad = excluded.entidad,
            tipo_cuenta = excluded.tipo_cuenta,
            numero = excluded.numero,
            titular = excluded.titular,
            qr_url = coalesce(nullif(excluded.qr_url, ''), cuentas_pago.qr_url),
            instrucciones = excluded.instrucciones
        `).bind(id, data.nombre, data.entidad, data.tipo_cuenta || '', data.numero, data.titular || '', qrUrl, r2Key, data.instrucciones || '').run();

        return json({ success: true, data: { id, qr_url: qrUrl } });
      }

      if (action === 'eliminarCuentaPago') {
        await env.DB.prepare("UPDATE cuentas_pago SET activo = 0 WHERE id = ?").bind(data.id).run();
        return json({ success: true });
      }

      // ----------------------------------------------------
      // DISPARO MANUAL O DE PRUEBA DE WHATSAPP MOROSOS
      // ----------------------------------------------------
      if (action === 'ejecutarNotificacionesMora' || path === '/api/whatsapp/enviar-mora') {
        const resultado = await ejecutarBarridoMorosos(env);
        return json(resultado);
      }

      return json({ success: false, error: `Acción '${action}' no reconocida` }, 404);

    } catch (err) {
      console.error('Error en Cloudflare Worker:', err);
      return json({ success: false, error: 'Error interno del servidor: ' + err.message }, 500);
    }
  }
};
