// Quantização de cor apenas: cada pixel mantém sua posição, sem extração de contornos.
const hex = rgb => '#' + rgb.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
const rgb = value => [1, 3, 5].map(i => parseInt(value.slice(i, i + 2), 16));

// Keep small, saturated accents separate from the much larger neutral regions.
// Unconstrained RGB averages let textured grays swallow reds during clustering.
export function imagePalette(data) {
  const frequencies = new Map();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
    frequencies.set(key, (frequencies.get(key) || 0) + 1);
  }
  const unpack = key => [key >> 16, (key >> 8) & 255, key & 255];
  if (frequencies.size <= 4) return frequencies.size ? [...frequencies.keys()].map(key => hex(unpack(key))) : ['#ffffff'];
  const bins = new Map();
  for (const [key, count] of frequencies) {
    const color = unpack(key);
    const binKey = (color[0] >> 4) * 256 + (color[1] >> 4) * 16 + (color[2] >> 4);
    const bin = bins.get(binKey) || { count: 0, peak: 0, color };
    bin.count += count;
    if (count > bin.peak) { bin.peak = count; bin.color = color; }
    bins.set(binKey, bin);
  }
  const neutral = [], colored = [];
  for (const point of bins.values()) {
    const [r,g,b] = point.color, high = Math.max(r,g,b), low = Math.min(r,g,b);
    point.chroma = high - low;
    point.light = (high + low) / 2;
    if (point.chroma < 32 || point.chroma / Math.max(1,high) < .22) neutral.push(point);
    else {
      const hue = high === r ? (g-b)/point.chroma : high === g ? 2+(b-r)/point.chroma : 4+(r-g)/point.chroma;
      point.hue = (hue * 60 + 360) % 360;
      colored.push(point);
    }
  }
  // Group neighboring hues, including reds on both sides of the hue boundary.
  const hueDistance = (a,b) => Math.min(Math.abs(a-b),360-Math.abs(a-b));
  colored.sort((a,b) => b.count * b.chroma ** 2 - a.count * a.chroma ** 2);
  const families = [];
  for (const point of colored) {
    let family = families.find(group => hueDistance(group.hue,point.hue) <= 35);
    if (!family) { family = { hue: point.hue, points: [], count: 0 }; families.push(family); }
    family.points.push(point); family.count += point.count;
  }
  const total = [...bins.values()].reduce((sum,p) => sum+p.count,0);
  // Ignore isolated JPEG color noise, but retain accents occupying just 0.1%.
  const accents = families.filter(group => group.count >= Math.max(3,total*.001));
  accents.sort((a,b) => Math.sqrt(b.count)*b.points[0].chroma - Math.sqrt(a.count)*a.points[0].chroma);
  const neutralCount = neutral.reduce((sum,p)=>sum+p.count,0);
  const hasNeutrals = neutralCount >= total*.001;
  const dark = neutral.filter(p=>p.light<110).reduce((sum,p)=>sum+p.count,0);
  const light = neutral.filter(p=>p.light>=110).reduce((sum,p)=>sum+p.count,0);
  const neutralSlots = hasNeutrals ? (dark > total*.01 && light > total*.01 ? 2 : 1) : 0;
  const selectedAccents = accents.slice(0,4-neutralSlots);
  const result = [];
  if (hasNeutrals) {
    const groups = neutralSlots === 2 ? [neutral.filter(p=>p.light<110),neutral.filter(p=>p.light>=110)] : [neutral];
    for (const group of groups) {
      // Dominant tone, not the average of texture, shadows and antialiasing.
      group.sort((a,b)=>b.count-a.count);
      if(group.length) result.push({color:hex(group[0].color),count:group.reduce((sum,p)=>sum+p.count,0)});
    }
  }
  for (const family of selectedAccents) {
    // JPEG spreads a solid accent across nearby bins. Count those neighbors
    // together and favor saturation, rather than a washed-out exact RGB mode.
    let representative = family.points[0], best = -1;
    for (const point of family.points) {
      const support = family.points.reduce((sum,other)=>sum+(other.color.reduce((d,v,i)=>d+(v-point.color[i])**2,0)<=32**2 ? other.count : 0),0);
      const score = Math.sqrt(support) * point.chroma ** 2 / Math.max(...point.color);
      if(score>best) {best=score;representative=point;}
    }
    result.push({color:hex(representative.color),count:family.count});
  }
  // Most common region supplies the default background, independently of hue.
  result.sort((a,b)=>b.count-a.count);
  return result.length ? result.map(p=>p.color) : [hex([...bins.values()].sort((a,b)=>b.count-a.count)[0].color)];
}

export function quantizePixels(data, palette, background = palette[0]) {
  if (!palette.length || palette.length > 4 || palette.some(c => !/^#[0-9a-f]{6}$/i.test(c)) || !palette.includes(background)) throw new Error('Use de uma a quatro cores, incluindo o fundo.');
  const colors = palette.map(rgb), bg = rgb(background), output = new Uint8ClampedArray(data.length);
  const isNeutral = color => Math.max(...color)-Math.min(...color)<32 || (Math.max(...color)-Math.min(...color))/Math.max(1,...color)<.22;
  const neutrals = colors.filter(isNeutral);
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3] / 255;
    const pixel = [0, 1, 2].map(c => data[i + c] * alpha + bg[c] * (1 - alpha));
    let nearest = colors[0], best = Infinity;
    // Neutral shadows must never acquire red just because it is closer in RGB.
    const candidates = isNeutral(pixel) && neutrals.length ? neutrals : colors;
    for (const color of candidates) {
      const distance = color.reduce((sum, v, c) => sum + (v - pixel[c]) ** 2, 0);
      if (distance < best) { best = distance; nearest = color; }
    }
    output.set([...nearest, 255], i);
  }
  return output;
}

export function recolorPixels(data, sourcePalette, palette, backgroundIndex = 0) {
  const original = quantizePixels(data,sourcePalette,sourcePalette[backgroundIndex]);
  const lookup = new Map(sourcePalette.map((color,index) => [rgb(color).join(','),rgb(palette[index])]));
  for (let i=0;i<original.length;i+=4) original.set(lookup.get(`${original[i]},${original[i+1]},${original[i+2]}`),i);
  return original;
}

export function previewCanvas(source, palette, shape, background = palette[0], options = {}) {
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
  const scale = (options.imageScale ?? 100) / 100;
  const width = source.width * fit * scale, height = source.height * fit * scale;
  let image = source;
  if (options.sourcePalette) {
    image = document.createElement('canvas'); image.width=source.width; image.height=source.height;
    const imageContext = image.getContext('2d');
    const original = source.getContext('2d').getImageData(0,0,source.width,source.height);
    original.data.set(recolorPixels(original.data,options.sourcePalette,palette,options.backgroundIndex ?? 0));
    imageContext.putImageData(original,0,0);
  }
  ctx.drawImage(image, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  pixels.data.set(quantizePixels(pixels.data, palette, background));
  ctx.putImageData(pixels, 0, 0);
  return canvas;
}

export function serializePreviewRaster(image, palette, background = palette[0]) {
  const scale = Math.min(1, 256 / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const samples = new Uint8ClampedArray(width * height * 4);
  // Amostragem direta evita conversões extras de cor no redimensionamento do canvas.
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const sx = Math.min(image.width - 1, Math.floor((x + .5) * image.width / width));
    const sy = Math.min(image.height - 1, Math.floor((y + .5) * image.height / height));
    const offset = (sy * image.width + sx) * 4;
    samples.set(image.data.subarray(offset, offset + 4), (y * width + x) * 4);
  }
  // A leitura do canvas pode variar alguns níveis RGB conforme o navegador.
  // Reencaixa cada amostra na paleta antes de criar os índices enviados à API.
  const pixels = quantizePixels(samples, palette, background);
  const lookup = new Map(palette.map((color, index) => [rgb(color).join(','), index]));
  const indices = [];
  for (let i = 0; i < pixels.length; i += 4) indices.push(lookup.get(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]}`));
  return { width, height, indices };
}

export function validateImagePreview(input) {
  if (input.imageScale !== undefined && (!Number.isFinite(input.imageScale) || input.imageScale < 10 || input.imageScale > 200)) throw new Error('Tamanho da imagem inválido.');
  if (!['square', 'circle'].includes(input?.shape)) throw new Error('Formato inválido.');
  const palette = input.palette;
  if (!Array.isArray(palette) || !palette.length || palette.length > 4 || palette.some(c => typeof c !== 'string' || !/^#[0-9a-f]{6}$/i.test(c)) || !palette.includes(input.background)) throw new Error('A imagem deve usar de uma a quatro cores, incluindo o fundo.');
  const { width, height, indices } = input.raster || {};
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 256 || height > 256 || !Array.isArray(indices) || indices.length !== width * height || indices.some(i => !Number.isInteger(i) || i < 0 || i >= palette.length)) throw new Error('Prévia de imagem inválida.');
}
