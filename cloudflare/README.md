# 🚀 Guía de Despliegue y Migración a Cloudflare (Modelo 100% Gratis)

Esta guía te permite migrar toda la base de datos de GoParking desde Google Apps Script a **Cloudflare D1 (SQL)**, guardar todas las fotos en **Cloudflare R2** y activar el envío automático diario de WhatsApp a los morosos.

---

## 📋 Requisitos Previos

1. Tener una cuenta gratuita en [Cloudflare](https://dash.cloudflare.com/sign-up).
2. Tener Node.js instalado en tu computador (ya lo tienes instalado con GoParking).

---

## 🛠️ Paso 1: Iniciar sesión en Cloudflare desde tu terminal

Abre tu terminal en la carpeta del proyecto y ejecuta:

```bash
npx wrangler login
```
Se abrirá tu navegador para autorizar la conexión con un solo clic.

---

## 🗄️ Paso 2: Crear la Base de Datos D1 y el Bucket R2

Ejecuta estos dos comandos para crear tu base de datos SQL y tu almacén de imágenes gratuito:

```bash
# 1. Crear base de datos D1
npx wrangler d1 create goparking-db

# 2. Crear almacén de imágenes R2
npx wrangler r2 bucket create goparking-media
```

> 💡 **Nota:** El primer comando te mostrará un mensaje con tu `database_id` (un código como `a1b2c3d4-e5f6-...`).  
> Abre el archivo `cloudflare/wrangler.toml` y pega ese código en la línea `database_id = "..."`.

---

## 📐 Paso 3: Crear las Tablas en la Base de Datos

Ejecuta el archivo de esquema que hemos preparado:

```bash
npx wrangler d1 execute goparking-db --file=cloudflare/schema.sql
```

---

## 🔄 Paso 4: Extraer y Migrar Datos e Imágenes (Opción B)

Ejecuta nuestro script de migración automática:

```bash
node cloudflare/scripts/migrate-to-cloudflare.js
```

Este script hará todo por ti automáticamente:
1. Conectará con tu Google Sheets actual y descargará todos los usuarios, contraseñas, puestos, recibos y cuentas.
2. Descargará todas las fotos de recibos y códigos QR de Google Drive a tu disco local.
3. Creará el archivo `seed_data.sql` listo para insertar en Cloudflare.

Para cargar los datos migrados a Cloudflare D1, ejecuta:

```bash
npx wrangler d1 execute goparking-db --file=cloudflare/migrated_data/seed_data.sql
```

Y para subir las imágenes descargadas a Cloudflare R2:

```bash
cd cloudflare/migrated_data
subir-imagenes-a-r2.bat
cd ../..
```

---

## 📲 Paso 5: Configurar WhatsApp Automático

En `cloudflare/wrangler.toml` puedes configurar tu proveedor:

### Con Meta WhatsApp Cloud API (1.000 conversaciones gratis al mes):
1. Ingresa a [Meta for Developers](https://developers.facebook.com/).
2. Crea una App tipo **Empresa** y añade el producto **WhatsApp**.
3. Copia tu `Identificador de número de teléfono` y tu `Token de acceso`.
4. Pégalos en `cloudflare/wrangler.toml`:
   ```toml
   WHATSAPP_PROVIDER = "meta"
   WHATSAPP_PHONE_NUMBER_ID = "tu-phone-number-id"
   WHATSAPP_ACCESS_TOKEN = "tu-access-token"
   ```

El **Cron Trigger** configurado en `wrangler.toml` (`0 13 * * *`) ejecutará automáticamente el barrido todos los días a las **8:00 AM hora de Colombia** para enviar los recordatorios de pago a los morosos.

---

## 🚀 Estado Actual del Despliegue (¡Completado!)

- **API Worker Desplegada:** `https://goparking-api.daniram-parking.workers.dev`
- **Base de Datos D1:** `goparking-db` (ID: `bdbcdaa5-2c87-4e45-833a-312ca2fa6d6a`)
- **Bucket R2 de Medios:** `goparking-media` (todas las imágenes y QR sincronizados)
- **Datos Migrados:** 20 usuarios, 43 puestos, 22 recibos, 1 cuenta de pago
- **Cron de WhatsApp:** Programado diario a las 8:00 AM Colombia (`0 13 * * *`)

---

## 📲 Configurar Credenciales de WhatsApp

Para que el envío desatendido de WhatsApp comience a enviar los mensajes reales a los morosos, puedes ingresar tus credenciales en `wrangler.toml` o mediante secretos de Wrangler:

```bash
# Para Meta Cloud API:
npx wrangler secret put WHATSAPP_ACCESS_TOKEN
npx wrangler secret put WHATSAPP_PHONE_NUMBER_ID
```

O si usas Evolution API:
```bash
npx wrangler secret put WHATSAPP_EVOLUTION_URL
npx wrangler secret put WHATSAPP_EVOLUTION_APIKEY
```

---

## 🔗 Conexión de la Aplicación Web

La aplicación web ya está configurada en `.env` para apuntar directamente a:
```env
VITE_API_URL=https://goparking-api.daniram-parking.workers.dev
```
¡Tu sistema GoParking está ahora 100% operativo en la nube gratuita de Cloudflare!

