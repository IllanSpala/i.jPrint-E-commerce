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
  // Spend unused slots on tonal detail instead of flattening each hue to one
  // swatch. Split the region with the largest area-weighted approximation error.
  const distance = (a,b) => a.reduce((sum,v,i)=>sum+(v-b[i])**2,0);
  while (result.length < 4) {
    const centers = result.map(item=>rgb(item.color));
    if (!centers.length) break;
    const regions = centers.map(()=>({points:[],error:0}));
    for (const point of bins.values()) {
      const distances = centers.map(center=>distance(point.color,center));
      const index = distances.indexOf(Math.min(...distances));
      regions[index].points.push(point);
      regions[index].error += distances[index]*point.count;
    }
    const index = regions.reduce((best,region,i)=>region.error>regions[best].error?i:best,0);
    const points = regions[index].points;
    if (points.length<2) break;
    const farthest = points.reduce((best,p)=>distance(p.color,centers[index])*Math.sqrt(p.count)>distance(best.color,centers[index])*Math.sqrt(best.count)?p:best);
    let pair = [centers[index],farthest.color];
    let groups;
    for(let iteration=0;iteration<12;iteration++) {
      groups = [[],[]];
      for(const point of points) groups[distance(point.color,pair[0])<=distance(point.color,pair[1])?0:1].push(point);
      pair = groups.map((group,i)=>{
        const count=group.reduce((sum,p)=>sum+p.count,0);
        return count ? [0,1,2].map(c=>group.reduce((sum,p)=>sum+p.color[c]*p.count,0)/count) : pair[i];
      });
    }
    if(distance(pair[0],pair[1])<32**2 || groups.some(group=>group.reduce((sum,p)=>sum+p.count,0)<total*.005)) break;
    const replacements = groups.map((group,i)=>{
      const closest=group.reduce((best,p)=>distance(p.color,pair[i])<distance(best.color,pair[i])?p:best);
      return {color:hex(closest.color),count:group.reduce((sum,p)=>sum+p.count,0)};
    });
    result.splice(index,1,...replacements);
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

export function preparePreviewSource(source, sourcePalette, palette, backgroundIndex = 0) {
  const image = document.createElement('canvas');
  const scale = Math.min(1, 2048 / Math.max(source.width, source.height));
  image.width = Math.max(1, Math.round(source.width * scale));
  image.height = Math.max(1, Math.round(source.height * scale));
  const ctx = image.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(source, 0, 0, image.width, image.height);
  const pixels = ctx.getImageData(0, 0, image.width, image.height);
  pixels.data.set(recolorPixels(pixels.data, sourcePalette, palette, backgroundIndex));
  ctx.putImageData(pixels, 0, 0);
  return image;
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
  let image = options.preparedSource || source;
  if (!options.preparedSource && options.sourcePalette) {
    image = document.createElement('canvas'); image.width=source.width; image.height=source.height;
    const imageContext = image.getContext('2d');
    const original = source.getContext('2d').getImageData(0,0,source.width,source.height);
    original.data.set(recolorPixels(original.data,options.sourcePalette,palette,options.backgroundIndex ?? 0));
    imageContext.putImageData(original,0,0);
  }
  // A prepared source already contains only the selected colors. Nearest-neighbor
  // scaling preserves them without another CPU pass over millions of pixels.
  if (options.preparedSource) ctx.imageSmoothingEnabled = false;
  const rotation = options.imageRotation || 0;
  const position = options.position || {x:0,y:0};
  if (rotation || position.x || position.y) {
    ctx.save();
    ctx.translate(canvas.width/2 + position.x*canvas.width/320, canvas.height/2 + position.y*canvas.height/320);
    ctx.rotate(rotation*Math.PI/180);
    ctx.drawImage(image,-width/2,-height/2,width,height);
    ctx.restore();
  } else ctx.drawImage(image, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
  if (options.preparedSource) return canvas;
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
  if (input.imageScale !== undefined && (!Number.isFinite(input.imageScale) || input.imageScale <= 0)) throw new Error('Tamanho da imagem inválido.');
  if (input.imageRotation !== undefined && (!Number.isFinite(input.imageRotation) || Math.abs(input.imageRotation)>180)) throw new Error('Rotação inválida.');
  if (input.position !== undefined && (!Number.isFinite(input.position?.x) || !Number.isFinite(input.position?.y))) throw new Error('Posição inválida.');
  if (!['square', 'circle'].includes(input?.shape)) throw new Error('Formato inválido.');
  const palette = input.palette;
  if (!Array.isArray(palette) || !palette.length || palette.length > 4 || palette.some(c => typeof c !== 'string' || !/^#[0-9a-f]{6}$/i.test(c)) || !palette.includes(input.background)) throw new Error('A imagem deve usar de uma a quatro cores, incluindo o fundo.');
  const { width, height, indices } = input.raster || {};
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 256 || height > 256 || !Array.isArray(indices) || indices.length !== width * height || indices.some(i => !Number.isInteger(i) || i < 0 || i >= palette.length)) throw new Error('Prévia de imagem inválida.');
}
