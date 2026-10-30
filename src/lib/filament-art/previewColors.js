// Quantização de cor apenas: cada pixel mantém sua posição, sem extração de contornos.
const hex = rgb => '#' + rgb.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
const rgb = value => [1, 3, 5].map(i => parseInt(value.slice(i, i + 2), 16));

export function imagePalette(data) {
  const exact = new Map(), bins = new Map();
  for (let i = 0; i < data.length; i += 4) {
    if (!data[i + 3]) continue;
    const color = [data[i], data[i + 1], data[i + 2]];
    if (exact.size <= 4) exact.set(hex(color), color);
    const key = (color[0] >> 3) * 1024 + (color[1] >> 3) * 32 + (color[2] >> 3);
    const bin = bins.get(key) || { sum: [0, 0, 0], count: 0 };
    color.forEach((v, c) => { bin.sum[c] += v; }); bin.count++; bins.set(key, bin);
  }
  if (exact.size <= 4) return exact.size ? [...exact.keys()] : ['#ffffff'];
  const points = [...bins.values()].map(b => ({ color: b.sum.map(v => v / b.count), count: b.count }));
  const distance = (a, b) => a.reduce((sum, v, c) => sum + (v - b[c]) ** 2, 0);
  // Inicialização por cores frequentes e distintas evita gastar a paleta em
  // vários cinzas do fundo e perder cores pequenas, como detalhes vermelhos.
  points.sort((a, b) => b.count - a.count);
  const centers = [points[0].color.slice()];
  while (centers.length < 4 && centers.length < points.length) {
    let best, score = -1;
    for (const point of points) {
      const value = Math.min(...centers.map(center => distance(point.color, center))) * Math.sqrt(point.count);
      if (value > score) { score = value; best = point.color; }
    }
    centers.push(best.slice());
  }
  for (let iteration = 0; iteration < 12; iteration++) {
    const sums = centers.map(() => ({ color: [0, 0, 0], count: 0 }));
    for (const point of points) {
      const distances = centers.map(center => distance(point.color, center));
      const sum = sums[distances.indexOf(Math.min(...distances))];
      point.color.forEach((v, c) => { sum.color[c] += v * point.count; }); sum.count += point.count;
    }
    sums.forEach((sum, i) => { if (sum.count) centers[i] = sum.color.map(v => v / sum.count); });
  }
  return [...new Set(centers.map(hex))];
}

export function quantizePixels(data, palette, background = palette[0]) {
  if (!palette.length || palette.length > 4 || palette.some(c => !/^#[0-9a-f]{6}$/i.test(c)) || !palette.includes(background)) throw new Error('Use de uma a quatro cores, incluindo o fundo.');
  const colors = palette.map(rgb), bg = rgb(background), output = new Uint8ClampedArray(data.length);
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3] / 255;
    const pixel = [0, 1, 2].map(c => data[i + c] * alpha + bg[c] * (1 - alpha));
    let nearest = colors[0], best = Infinity;
    for (const color of colors) {
      const distance = color.reduce((sum, v, c) => sum + (v - pixel[c]) ** 2, 0);
      if (distance < best) { best = distance; nearest = color; }
    }
    output.set([...nearest, 255], i);
  }
  return output;
}

export function previewCanvas(source, palette, shape, background = palette[0]) {
  const canvas = document.createElement('canvas');
  const ratio = shape === 'rectangle' ? 4 / 3 : 1;
  // Limita apenas a textura da visualização, mantendo o arquivo original intacto.
  // Evita alocar uma imagem quadrada gigantesca para fotos panorâmicas.
  canvas.width = Math.min(2048, Math.max(source.width, Math.ceil(source.height * ratio)));
  canvas.height = Math.ceil(canvas.width / ratio);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = background; ctx.fillRect(0, 0, canvas.width, canvas.height);
  // Encaixa a imagem inteira, sem deformar nem recortar o conteúdo no círculo.
  const fit = Math.min(canvas.width / source.width, canvas.height / source.height,
    shape === 'circle' ? canvas.width / Math.hypot(source.width, source.height) : Infinity);
  const width = source.width * fit, height = source.height * fit;
  ctx.drawImage(source, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  pixels.data.set(quantizePixels(pixels.data, palette, background));
  ctx.putImageData(pixels, 0, 0);
  return canvas;
}

export function validateImagePreview(input) {
  if (!['square', 'circle'].includes(input?.shape)) throw new Error('Formato inválido.');
  const palette = input.palette;
  if (!Array.isArray(palette) || !palette.length || palette.length > 4 || palette.some(c => typeof c !== 'string' || !/^#[0-9a-f]{6}$/i.test(c)) || !palette.includes(input.background)) throw new Error('A imagem deve usar de uma a quatro cores, incluindo o fundo.');
  const { width, height, indices } = input.raster || {};
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 256 || height > 256 || !Array.isArray(indices) || indices.length !== width * height || indices.some(i => !Number.isInteger(i) || i < 0 || i >= palette.length)) throw new Error('Prévia de imagem inválida.');
}
