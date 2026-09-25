// ============================================================
// Media Utilities — Manejo y normalización de imágenes de recibos
// ============================================================

/**
 * Extrae de forma confiable el ID de archivo de Google Drive
 * a partir de cualquier URL o string de ID.
 */
export function getDriveFileId(value) {
  if (!value || typeof value !== 'string') return '';
  const trimmed = value.trim();

  // data URL o blob local
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return '';

  // Formato: /file/d/ID/view o /file/d/ID
  const fileMatch = trimmed.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i);
  if (fileMatch) return fileMatch[1];

  // Formato: ?id=ID o &id=ID (ej: drive.google.com/uc?id=... o drive.usercontent.google.com/download?id=...)
  const queryMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/i);
  if (queryMatch) return queryMatch[1];

  // Formato: googleusercontent.com/d/ID
  const lh3Match = trimmed.match(/googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/i);
  if (lh3Match) return lh3Match[1];

  // Si ya es un ID directo de Drive (típicamente 25 a 45 caracteres alfanuméricos)
  if (/^[a-zA-Z0-9_-]{25,50}$/.test(trimmed)) {
    return trimmed;
  }

  return '';
}

/**
 * Normaliza cualquier URL o ID para renderizado en <img> sin bloqueo de CORP.
 * Utiliza el CDN público de Google (lh3.googleusercontent.com) que permite
 * incrustación cross-origin directa con HTTP 200 sin 'Cross-Origin-Resource-Policy: same-site'.
 */
export function normalizeMediaUrl(value) {
  if (!value || typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return trimmed;

  const fileId = getDriveFileId(trimmed);
  if (fileId) {
    return `https://lh3.googleusercontent.com/d/${fileId}`;
  }

  return trimmed;
}

/**
 * Obtiene la URL óptima para mostrar la imagen de un recibo en una etiqueta <img>.
 * Si useThumbnailFallback es true, usa el endpoint de thumbnail de Google.
 */
export function getReceiptMediaUrl(receipt = {}, useThumbnailFallback = false) {
  const fileId = receipt.file_id || getDriveFileId(
    receipt.url_imagen || receipt.url || receipt.imagen || receipt.archivo_url || receipt.fileUrl
  );

  if (fileId) {
    if (useThumbnailFallback) {
      return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1200`;
    }
    return `https://lh3.googleusercontent.com/d/${fileId}`;
  }

  const value = receipt.url_imagen || receipt.url || receipt.imagen || receipt.archivo_url || receipt.fileUrl;
  return normalizeMediaUrl(value);
}

/**
 * Obtiene la URL para abrir el recibo en una pestaña nueva con el visor interactivo de Google Drive.
 */
export function getReceiptViewerUrl(receipt = {}) {
  const fileId = receipt.file_id || getDriveFileId(
    receipt.url_imagen || receipt.url || receipt.imagen || receipt.archivo_url || receipt.fileUrl
  );

  if (fileId) {
    return `https://drive.google.com/file/d/${fileId}/view`;
  }

  return receipt.url_imagen || receipt.url || receipt.imagen || '';
}