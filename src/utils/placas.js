// Utilidades de normalización, extracción (carros y motos) y preprocesamiento OCR para placas colombianas

const IGNORED_PLATE_WORDS = new Set([
  'COLOMBIA',
  'COL',
  'TRANSITO',
  'MOVILIDAD',
  'PARTICULAR',
  'PUBLICO',
  'SERVICIO',
  'GOPARKING',
  'REPUBLICA',
  'NACIONAL',
  'PARQUEADERO',
  'ENTRADA',
  'SALIDA',
  'HORAS',
  'HORA',
  'ZONA',
  'PISO',
  'MOTOS',
  'CARROS',
  'VELOCIDAD'
]);

const DIGIT_TO_LETTER = {
  '0': 'O',
  '1': 'I',
  '2': 'Z',
  '4': 'A',
  '5': 'S',
  '6': 'G',
  '7': 'T',
  '8': 'B'
};

const LETTER_TO_DIGIT = {
  O: '0',
  D: '0',
  Q: '0',
  I: '1',
  L: '1',
  J: '1',
  Z: '2',
  A: '4',
  S: '5',
  G: '6',
  T: '7',
  B: '8'
};

const OCR_CONFUSION_GROUPS = [
  '0ODQ',
  '1ILJT',
  '2Z',
  '4A',
  '5S',
  '6G',
  '8B3',
  'UV',
  'CG',
  'MN',
  'PR',
  'EF'
];

export function cleanPlate(text) {
  return String(text || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function isLetter(ch) {
  return ch >= 'A' && ch <= 'Z';
}

function isDigit(ch) {
  return ch >= '0' && ch <= '9';
}

function toLetter(ch) {
  if (isLetter(ch)) return { ch, edited: false };
  if (DIGIT_TO_LETTER[ch]) return { ch: DIGIT_TO_LETTER[ch], edited: true };
  return null;
}

function toDigit(ch) {
  if (isDigit(ch)) return { ch, edited: false };
  if (LETTER_TO_DIGIT[ch]) return { ch: LETTER_TO_DIGIT[ch], edited: true };
  return null;
}

function areOcrConfusable(a, b) {
  if (a === b) return true;
  return OCR_CONFUSION_GROUPS.some(group => group.includes(a) && group.includes(b));
}

function coerceByPattern(chunk, pattern) {
  if (chunk.length !== pattern.length) return null;
  let result = '';
  let edits = 0;

  for (let i = 0; i < pattern.length; i++) {
    const mapped = pattern[i] === 'L' ? toLetter(chunk[i]) : toDigit(chunk[i]);
    if (!mapped) return null;
    result += mapped.ch;
    if (mapped.edited) edits++;
  }

  return { plate: result, edits };
}

function countLettersAndDigits(str) {
  let letters = 0;
  let digits = 0;
  for (const ch of str) {
    if (isLetter(ch)) letters++;
    else if (isDigit(ch)) digits++;
  }
  return { letters, digits };
}

function extractCandidatesFromChunk(chunk, isExactToken) {
  const candidates = [];
  if (!chunk || chunk.length < 5 || chunk.length > 7) return candidates;

  const exactBonus = isExactToken && (chunk.length === 5 || chunk.length === 6) ? 1 : 0;

  // Coincidencias exactas sin corrección de caracteres (en tokens de 5 a 7 chars; máx 1 carácter ruido en borde)
  const patterns6 = [
    { regex: /([A-Z]{3}[0-9]{2}[A-Z])/g, kind: 'moto' },
    { regex: /([A-Z]{3}[0-9]{3})/g, kind: 'carro' },
    { regex: /([0-9]{3}[A-Z]{3})/g, kind: 'especial' }
  ];

  for (const { regex, kind } of patterns6) {
    let match;
    while ((match = regex.exec(chunk)) !== null) {
      candidates.push({
        plate: match[1],
        edits: 0,
        length: 6,
        exactBonus,
        kind
      });
      regex.lastIndex = match.index + 1;
    }
  }

  // Placas clásicas de moto de 5 caracteres (solo si el token no es parte de una placa de 6+)
  if (chunk.length === 5) {
    if (/^[A-Z]{3}[0-9]{2}$/.test(chunk) || /^[A-Z]{2}[0-9]{3}$/.test(chunk)) {
      candidates.push({
        plate: chunk,
        edits: 0,
        length: 5,
        exactBonus: 1,
        kind: 'moto_clasica'
      });
    }
  }

  // Corrección posicional inteligente (ej. O->0, I->1, B->8, S->5) en ventanas de 6 caracteres
  if (chunk.length >= 6 && chunk.length <= 7) {
    for (let start = 0; start <= chunk.length - 6; start++) {
      const sub = chunk.slice(start, start + 6);
      const { letters, digits } = countLettersAndDigits(sub);
      if (letters < 2 || digits < 2) continue;

      for (const [pattern, kind] of [
        ['LLLNNL', 'moto'],
        ['LLLNNN', 'carro'],
        ['NNNLLL', 'especial']
      ]) {
        const coerced = coerceByPattern(sub, pattern);
        if (coerced && coerced.edits > 0 && coerced.edits <= 2) {
          candidates.push({
            plate: coerced.plate,
            edits: coerced.edits,
            length: 6,
            exactBonus: isExactToken && chunk.length === 6 ? 1 : 0,
            kind
          });
        }
      }
    }
  }

  return candidates;
}

function findFuzzyRegisteredMatch(candidatePlate, registeredList) {
  let best = null;

  for (const reg of registeredList) {
    if (reg.length !== candidatePlate.length) continue;
    let diff = 0;
    let validConfusion = true;

    for (let i = 0; i < reg.length; i++) {
      if (reg[i] !== candidatePlate[i]) {
        if (!areOcrConfusable(reg[i], candidatePlate[i])) {
          validConfusion = false;
          break;
        }
        diff++;
        if (diff > 1) {
          validConfusion = false;
          break;
        }
      }
    }

    if (validConfusion && diff === 1) {
      if (best && best !== reg) {
        // Evitar ambigüedad si hay dos placas registradas igualmente cercanas
        return null;
      }
      best = reg;
    }
  }

  return best;
}

/**
 * Extrae la mejor placa colombiana (carro o moto, en 1 o 2 líneas) a partir del texto OCR.
 * Prioriza coincidencias exactas o por confusión OCR conocida contra placas registradas.
 */
export function extractPlateFromText(rawText, registeredPlates = []) {
  if (!rawText) return '';

  const registeredList = Array.from(
    new Set(registeredPlates.map(cleanPlate).filter(Boolean))
  );
  const registeredSet = new Set(registeredList);

  const lines = String(rawText)
    .toUpperCase()
    .split(/\r?\n/)
    .map(line => {
      const words = line
        .replace(/[^A-Z0-9]+/g, ' ')
        .trim()
        .split(/\s+/)
        .filter(w => w && !IGNORED_PLATE_WORDS.has(w));
      return {
        words,
        joined: words.join('')
      };
    })
    .filter(l => l.words.length > 0);

  if (lines.length === 0) return '';

  const chunkQueue = [];
  const seenChunks = new Set();

  const pushChunk = (chunk, isExactToken = false) => {
    if (!chunk || chunk.length < 5) return;
    const key = `${chunk}:${isExactToken ? 1 : 0}`;
    if (!seenChunks.has(key)) {
      seenChunks.add(key);
      chunkQueue.push({ chunk, isExactToken });
    }
  };

  // 1. Tokens y combinaciones dentro de cada línea (acotadas a tamaños reales de placa)
  for (const line of lines) {
    if (line.joined.length <= 8) {
      pushChunk(line.joined, line.words.length <= 2);
    }
    for (let i = 0; i < line.words.length; i++) {
      pushChunk(line.words[i], true);
      if (i + 1 < line.words.length) {
        const w1 = line.words[i];
        const w2 = line.words[i + 1];
        if (w1.length <= 4 && w2.length <= 4 && w1.length + w2.length <= 7) {
          pushChunk(w1 + w2, true);
        }
      }
      if (i + 2 < line.words.length) {
        const w1 = line.words[i];
        const w2 = line.words[i + 1];
        const w3 = line.words[i + 2];
        if (w1.length <= 4 && w2.length <= 3 && w3.length <= 2 && w1.length + w2.length + w3.length <= 7) {
          pushChunk(w1 + w2 + w3, true);
        }
      }
    }
  }

  // 2. Líneas consecutivas (crucial para placas de moto en 2 renglones: ej. QHH \n 36G)
  for (let i = 0; i < lines.length - 1; i++) {
    const a = lines[i];
    const b = lines[i + 1];
    if (a.joined.length <= 4 && b.joined.length <= 4) {
      pushChunk(a.joined + b.joined, true);
    }
    // Último token corto de línea superior + línea inferior corta (ej. "• QHH" / "36 G")
    const lastA = a.words[a.words.length - 1];
    const firstB = b.words[0];
    if (lastA && firstB && lastA.length >= 2 && lastA.length <= 4 && b.joined.length <= 4) {
      pushChunk(lastA + firstB, true);
      if (b.words[1] && b.words[1].length <= 2) {
        pushChunk(lastA + firstB + b.words[1], true);
      }
    }
    if (i + 2 < lines.length) {
      const c = lines[i + 2];
      if (a.joined.length <= 4 && b.joined.length <= 3 && c.joined.length <= 2) {
        pushChunk(a.joined + b.joined + c.joined, true);
      }
    }
  }

  // Coincidencia directa para placas especiales registradas (ej. personalizadas)
  if (registeredSet.size > 0) {
    for (const { chunk } of chunkQueue) {
      if (registeredSet.has(chunk)) return chunk;
    }
  }

  const allCandidates = [];
  for (const { chunk, isExactToken } of chunkQueue) {
    allCandidates.push(...extractCandidatesFromChunk(chunk, isExactToken));
  }

  if (allCandidates.length === 0) {
    return '';
  }

  // Ordenar candidatos por menor número de ediciones, longitud 6 sobre 5 y coincidencia exacta de token
  allCandidates.sort((a, b) => {
    if (a.edits !== b.edits) return a.edits - b.edits;
    if (a.length !== b.length) return b.length - a.length;
    return b.exactBonus - a.exactBonus;
  });

  // 1. Coincidencia exacta con vehículos registrados
  if (registeredSet.size > 0) {
    const exactReg = allCandidates.find(c => registeredSet.has(c.plate));
    if (exactReg) return exactReg.plate;

    // 2. Coincidencia por 1 carácter visualmente confuso en OCR (ej. ECB351 -> ECB35I, QVF920 -> QVF92D)
    for (const cand of allCandidates.filter(c => c.edits <= 1)) {
      const fuzzy = findFuzzyRegisteredMatch(cand.plate, registeredList);
      if (fuzzy) return fuzzy;
    }
  }

  // 3. Vehículo no registrado: devolver el mejor patrón válido sin ediciones si existe
  const cleanZero = allCandidates.find(c => c.edits === 0);
  if (cleanZero) return cleanZero.plate;

  // 4. Si no hubo patrón limpio, permitir máximo 1 corrección posicional
  const oneEdit = allCandidates.find(c => c.edits === 1);
  return oneEdit ? oneEdit.plate : '';
}

export function isNightTime(date = new Date()) {
  const hour = date.getHours();
  return hour >= 18 || hour < 6;
}

/**
 * Preprocesa un <video> o <img> sobre un canvas conservando todo el cuadro de cámara
 * (sin recortar a un cuadrito) y devuelve la luminosidad media para detección de baja luz/noche.
 *
 * mode:
 * - 'contrast': escala de grises con estiramiento de contraste (preserva placas amarillas y blancas)
 * - 'adaptive': umbral adaptativo local con tabla integral (rescata sombras fuertes y reflejos de flash)
 */
export function preprocessImageForOCR(source, targetCanvas, mode = 'contrast') {
  const srcWidth = source.videoWidth || source.naturalWidth || source.width || 1280;
  const srcHeight = source.videoHeight || source.naturalHeight || source.height || 720;

  const maxDim = 1024;
  const scale = Math.min(1, maxDim / Math.max(srcWidth, srcHeight));
  const width = Math.max(1, Math.round(srcWidth * scale));
  const height = Math.max(1, Math.round(srcHeight * scale));

  targetCanvas.width = width;
  targetCanvas.height = height;

  const ctx = targetCanvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(source, 0, 0, srcWidth, srcHeight, 0, 0, width, height);

  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  const totalPixels = width * height;
  const luma = new Uint8Array(totalPixels);
  const histogram = new Uint32Array(256);

  let sumLuma = 0;
  for (let i = 0, p = 0; p < totalPixels; i += 4, p++) {
    const g = Math.round(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
    luma[p] = g;
    histogram[g]++;
    sumLuma += g;
  }

  const meanLuma = sumLuma / totalPixels;

  if (mode === 'adaptive') {
    // Tabla integral para umbralizado adaptativo local rápido O(W*H)
    const integral = new Int32Array((width + 1) * (height + 1));
    const stride = width + 1;

    for (let y = 1; y <= height; y++) {
      let rowSum = 0;
      const rowOffset = (y - 1) * width;
      const intRow = y * stride;
      const prevIntRow = (y - 1) * stride;
      for (let x = 1; x <= width; x++) {
        rowSum += luma[rowOffset + x - 1];
        integral[intRow + x] = integral[prevIntRow + x] + rowSum;
      }
    }

    const radius = Math.max(12, Math.round(Math.min(width, height) / 28));
    for (let y = 0; y < height; y++) {
      const y1 = Math.max(0, y - radius);
      const y2 = Math.min(height - 1, y + radius);
      const rowOffset = y * width;

      for (let x = 0; x < width; x++) {
        const x1 = Math.max(0, x - radius);
        const x2 = Math.min(width - 1, x + radius);
        const area = (x2 - x1 + 1) * (y2 - y1 + 1);
        const sum =
          integral[(y2 + 1) * stride + (x2 + 1)] -
          integral[y1 * stride + (x2 + 1)] -
          integral[(y2 + 1) * stride + x1] +
          integral[y1 * stride + x1];

        const localMean = sum / area;
        const val = luma[rowOffset + x] < localMean - 10 ? 0 : 255;
        const idx = (rowOffset + x) * 4;
        data[idx] = val;
        data[idx + 1] = val;
        data[idx + 2] = val;
      }
    }
  } else {
    // Estiramiento de contraste por percentiles (2% - 98%) para no destruir letras ni fondos amarillos
    const lowTarget = totalPixels * 0.02;
    const highTarget = totalPixels * 0.98;
    let acc = 0;
    let pLow = 0;
    let pHigh = 255;

    for (let v = 0; v < 256; v++) {
      acc += histogram[v];
      if (acc >= lowTarget) {
        pLow = v;
        break;
      }
    }

    acc = 0;
    for (let v = 255; v >= 0; v--) {
      acc += histogram[v];
      if (totalPixels - acc <= highTarget) {
        pHigh = v;
        break;
      }
    }

    const range = Math.max(24, pHigh - pLow);
    for (let i = 0, p = 0; p < totalPixels; i += 4, p++) {
      const stretched = Math.max(0, Math.min(255, Math.round(((luma[p] - pLow) * 255) / range)));
      data[i] = stretched;
      data[i + 1] = stretched;
      data[i + 2] = stretched;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return { meanLuma, width, height };
}
