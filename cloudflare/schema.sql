-- ============================================================
-- GoParking — Esquema Relacional Cloudflare D1 (SQLite)
-- Modelo 100% Gratuito y Optimizado
-- ============================================================

-- 1. USUARIOS
CREATE TABLE IF NOT EXISTS usuarios (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  cedula TEXT UNIQUE,
  correo TEXT UNIQUE,
  telefono TEXT,
  celular TEXT,
  direccion TEXT,
  placa TEXT,
  placa_carro TEXT,
  placa_moto TEXT,
  tipo_vehiculo TEXT, -- 'Carro' | 'Moto' | 'Carro y moto' | 'Bicicleta'
  tipo_tarifa TEXT,   -- 'Mensual' | 'Quincenal' | 'Día'
  valor_tarifa REAL DEFAULT 0,
  fecha_inicio TEXT NOT NULL, -- Formato YYYY-MM-DD (define el día de corte mensual)
  contrasena TEXT NOT NULL,   -- SHA-256 hash
  rol TEXT DEFAULT 'usuario', -- 'admin' | 'usuario'
  activo INTEGER DEFAULT 1,   -- 1 = Activo, 0 = Inactivo
  fecha_creacion TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_usuarios_correo ON usuarios(correo);
CREATE INDEX IF NOT EXISTS idx_usuarios_cedula ON usuarios(cedula);
CREATE INDEX IF NOT EXISTS idx_usuarios_activo ON usuarios(activo);

-- 2. RECIBOS DE PAGO
CREATE TABLE IF NOT EXISTS recibos (
  id TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL,
  usuario_nombre TEXT,
  usuario_correo TEXT,
  fecha_subida TEXT NOT NULL, -- ISO timestamp exacto (base contable de caja)
  fecha_inicio TEXT,          -- YYYY-MM-DD (período cubierto)
  fecha_fin TEXT,             -- YYYY-MM-DD
  mes INTEGER,
  anio INTEGER,
  metodo_pago TEXT DEFAULT 'No especificado',
  url_imagen TEXT,            -- URL pública en Cloudflare R2
  r2_key TEXT,                -- Identificador del archivo en bucket R2
  estado TEXT DEFAULT 'en_revision', -- 'en_revision' | 'aprobado' | 'rechazado'
  fecha_revision TEXT,
  admin_nota TEXT,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_recibos_usuario ON recibos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_recibos_estado ON recibos(estado);
CREATE INDEX IF NOT EXISTS idx_recibos_fecha_subida ON recibos(fecha_subida);

-- 3. PUESTOS DE PARQUEADERO
CREATE TABLE IF NOT EXISTS puestos (
  id TEXT PRIMARY KEY,
  numero INTEGER NOT NULL,
  tipo TEXT NOT NULL, -- 'carro' | 'moto' | 'bici'
  estado TEXT DEFAULT 'libre', -- 'libre' | 'ocupado'
  usuario_id TEXT,
  usuario_nombre TEXT,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_puestos_tipo ON puestos(tipo);
CREATE INDEX IF NOT EXISTS idx_puestos_usuario ON puestos(usuario_id);

-- 4. CUENTAS DE PAGO Y CÓDIGOS QR
CREATE TABLE IF NOT EXISTS cuentas_pago (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,        -- Ej: 'Nequi Principal'
  entidad TEXT NOT NULL,       -- Ej: 'Nequi', 'Bancolombia', 'Daviplata'
  tipo_cuenta TEXT,           -- Ej: 'Billetera digital', 'Ahorros'
  numero TEXT NOT NULL,        -- Número de cuenta o celular
  titular TEXT,               -- Nombre del titular
  qr_url TEXT,                -- URL pública del QR en R2
  r2_key TEXT,
  instrucciones TEXT,
  activo INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- 5. GASTOS DEL PARQUEADERO
CREATE TABLE IF NOT EXISTS gastos (
  id TEXT PRIMARY KEY,
  descripcion TEXT NOT NULL,
  valor REAL NOT NULL,
  fecha TEXT NOT NULL,         -- YYYY-MM-DD
  fecha_registro TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_gastos_fecha ON gastos(fecha);

-- 6. CIERRES CONTABLES DEL PARQUEADERO
CREATE TABLE IF NOT EXISTS cierres (
  id TEXT PRIMARY KEY,
  fecha_inicio TEXT NOT NULL, -- YYYY-MM-DD (ej: 2026-09-12)
  fecha_fin TEXT NOT NULL,    -- YYYY-MM-DD (ej: 2026-10-11)
  fecha_cierre TEXT NOT NULL, -- ISO timestamp
  estado TEXT DEFAULT 'cerrado'
);

-- 7. SOLICITUDES / PQRS
CREATE TABLE IF NOT EXISTS solicitudes (
  id TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL,
  usuario_nombre TEXT,
  tipo TEXT NOT NULL,         -- 'puesto' | 'reclamo' | 'duda' | 'otro'
  asunto TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  fecha TEXT DEFAULT (datetime('now', 'localtime')),
  estado TEXT DEFAULT 'pendiente', -- 'pendiente' | 'respondida'
  respuesta TEXT,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_solicitudes_usuario ON solicitudes(usuario_id);

-- 8. CONFIGURACIÓN DEL SISTEMA
CREATE TABLE IF NOT EXISTS config (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);

-- 9. HISTORIAL DE NOTIFICACIONES WHATSAPP (Control anti-spam)
CREATE TABLE IF NOT EXISTS notificaciones_whatsapp (
  id TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL,
  celular TEXT NOT NULL,
  tipo_notificacion TEXT DEFAULT 'mora', -- 'mora' | 'recordatorio' | 'aprobacion'
  mensaje TEXT NOT NULL,
  estado_envio TEXT DEFAULT 'enviado',   -- 'enviado' | 'fallido'
  proveedor_id TEXT,
  fecha_envio TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_usuario ON notificaciones_whatsapp(usuario_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_fecha ON notificaciones_whatsapp(fecha_envio);
