export const MAX_FILE_BYTES = 8 * 1024 * 1024;
export function inspectImage(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 24 || bytes.length > MAX_FILE_BYTES) throw new Error('Use uma imagem válida de até 8 MB.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ascii = (i, n) => String.fromCharCode(...bytes.subarray(i, i + n));
  let width, height, type;
  if ([137,80,78,71,13,10,26,10].every((v,i) => bytes[i] === v) && ascii(12,4) === 'IHDR') {
    type = 'image/png'; width = view.getUint32(16); height = view.getUint32(20);
  } else if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) {
    type = 'image/jpeg';
    let i = 2;
    while (i + 4 < bytes.length) {
      if (bytes[i++] !== 255) break;
      while (bytes[i] === 255) i++;
      const marker = bytes[i++];
      if (marker === 0xda || marker === 0xd9) break;
      if (marker === 1 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (i + 2 > bytes.length) break;
      const length = view.getUint16(i);
      if (length < 2 || i + length > bytes.length) break;
      if ([0xc0,0xc1,0xc2].includes(marker) && length >= 8) { height = view.getUint16(i + 3); width = view.getUint16(i + 5); break; }
      i += length;
    }
  } else if (ascii(0,4) === 'RIFF' && ascii(8,4) === 'WEBP') {
    type = 'image/webp';
    if (view.getUint32(4,true) + 8 !== bytes.length) throw new Error('WebP incompleto.');
    const chunk = ascii(12,4);
    if (chunk === 'VP8X' && bytes.length >= 30) {
      if (bytes[20] & 2) throw new Error('Envie uma imagem estática.');
      width = 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16);
      height = 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16);
    } else if (chunk === 'VP8L' && bytes.length >= 25 && bytes[20] === 0x2f) {
      const bits = view.getUint32(21,true); width = 1 + (bits & 0x3fff); height = 1 + ((bits >>> 14) & 0x3fff);
    } else if (chunk === 'VP8 ' && bytes.length >= 30 && bytes[23] === 0x9d && bytes[24] === 1 && bytes[25] === 0x2a) {
      width = view.getUint16(26,true) & 0x3fff; height = view.getUint16(28,true) & 0x3fff;
    }
  }
  if (!width || !height || width * height > 20_000_000 || width > 16384 || height > 16384) throw new Error('Use PNG, JPEG ou WebP estático, até 20 megapixels e 16.384 px por lado.');
  return { type, width, height };
}
export async function loadImage(file) {
  if (!file || file.size > MAX_FILE_BYTES) throw new Error('Envie uma imagem PNG, JPEG ou WebP de até 8 MB.');
  const metadata = inspectImage(new Uint8Array(await file.arrayBuffer()));
  const objectUrl = URL.createObjectURL(new Blob([file], { type: metadata.type }));
  let bitmap;
  try {
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      bitmap = await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Não foi possível decodificar a imagem. Use PNG, JPEG ou WebP.'));
        image.src = objectUrl;
      });
    }
    const width = bitmap.naturalWidth || bitmap.width, height = bitmap.naturalHeight || bitmap.height;
    if (!width || !height || width * height > 20_000_000) throw new Error('Use uma imagem de até 20 megapixels.');
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    canvas.getContext('2d').drawImage(bitmap, 0, 0);
    return { file, metadata, canvas, url: canvas.toDataURL('image/png') };
  } finally {
    bitmap?.close?.();
    URL.revokeObjectURL(objectUrl);
  }
}
// Physical sampling uses cells at least one nozzle wide; hard cap bounds worker memory.
export function sampleImage(source, plan, crop = { zoom: 1, x: .5, y: .5 }) {
  const scale = Math.min(128 / Math.max(plan.widthMm, plan.heightMm), 1 / plan.nozzleMm);
  const width = Math.max(2, Math.floor(plan.widthMm * scale)), height = Math.max(2, Math.floor(plan.heightMm * scale));
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const aspect = plan.widthMm / plan.heightMm;
  let sw = Math.min(source.width, source.height * aspect) / crop.zoom, sh = sw / aspect;
  const sx = (source.width - sw) * crop.x, sy = (source.height - sh) * crop.y;
  const ctx = canvas.getContext('2d', { colorSpace: 'srgb', willReadFrequently: true });
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
}
