export function normalizeMediaUrl(value) {
  if (!value || typeof value !== 'string') return '';

  const url = value.trim();
  if (!url || url.startsWith('data:') || url.startsWith('blob:')) return url;

  const driveFile = url.match(/drive\.google\.com\/file\/d\/([^/]+)/i);
  if (driveFile) {
    return `https://drive.usercontent.google.com/download?id=${driveFile[1]}&export=view`;
  }

  const driveId = url.match(/[?&]id=([^&]+)/i);
  if (/drive\.google\.com/i.test(url) && driveId) {
    return `https://drive.usercontent.google.com/download?id=${driveId[1]}&export=view`;
  }

  return url;
}

export function getReceiptMediaUrl(receipt = {}) {
  const value = receipt.url_imagen || receipt.url || receipt.imagen || receipt.archivo_url || receipt.fileUrl;
  if (value) return normalizeMediaUrl(value);
  return receipt.file_id
    ? `https://drive.usercontent.google.com/download?id=${encodeURIComponent(receipt.file_id)}&export=view`
    : '';
}