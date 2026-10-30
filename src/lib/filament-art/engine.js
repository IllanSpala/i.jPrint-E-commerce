import { linearizar, lab, deltaE00 } from './colorSpaces.js';
import { virtualPalette, validatePlan, printManifest, zAt } from './opticalModel.js';
import { filterRaster, quantizeLab } from './photographic.js';

export const DEFAULT_ADJUSTMENTS = Object.freeze({ brightness: 0, contrast: 1, gamma: 1, saturation: 1, temperature: 0, invert: false, style: 'photo', background: false, tolerance: 25, dither: false, noise: 0, sharpness: 0, black: 0, white: 1, quantization: 0 });
export function validateRaster({ data, width, height }) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 2 || height < 2 || width * height > 16384 || !data || data.length !== width * height * 4 || Array.from(data).some(v => !Number.isInteger(v) || v < 0 || v > 255)) throw new Error('Raster inválido (limite 16.384 amostras).');
}
export function backgroundMask({ data, width, height }, tolerance) {
  const n = width * height, mask = new Uint8Array(n), queue = new Uint32Array(n), histogram = new Map();
  const edge = [];
  for (let x = 0; x < width; x++) edge.push(x, (height - 1) * width + x);
  for (let y = 1; y < height - 1; y++) edge.push(y * width, y * width + width - 1);
  for (const p of edge) {
    if (data[p * 4 + 3] < 128) continue;
    const key = [0,1,2].map(c => Math.round(data[p * 4 + c] / 16)).join(',');
    const value = histogram.get(key) || { n: 0, p }; value.n++; histogram.set(key, value);
  }
  const dominant = [...histogram.values()].sort((a,b) => b.n - a.n)[0]?.p ?? 0;
  const reference = lab([0,1,2].map(c => linearizar(data[dominant * 4 + c] / 255)));
  let head = 0, tail = 0;
  const visit = p => {
    if (mask[p]) return;
    if (data[p * 4 + 3] < 128 || deltaE00(reference, lab([0,1,2].map(c => linearizar(data[p * 4 + c] / 255)))) <= tolerance) { mask[p] = 1; queue[tail++] = p; }
  };
  edge.forEach(visit);
  while (head < tail) {
    const p = queue[head++], x = p % width;
    if (x) visit(p - 1); if (x + 1 < width) visit(p + 1);
    if (p >= width) visit(p - width); if (p + width < n) visit(p + width);
  }
  return mask;
}
function permutations(ids) { return ids.length <= 1 ? [ids] : ids.flatMap((id,i) => permutations(ids.filter((_,j) => j !== i)).map(rest => [id,...rest])); }
function nearest(color, palette) {
  let k = 0, error = Infinity;
  for (let i = 0; i < palette.length; i++) { const d = deltaE00(color, palette[i].lab); if (d < error) { error = d; k = i; } }
  return { k, error };
}
// Resolve diagonal voxel contacts to avoid non-manifold vertical edges.
export function repairDiagonals(map, width, height) {
  let changed = true, edits = 0;
  while (changed) {
    changed = false;
    for (let y = 0; y < height - 1; y++) for (let x = 0; x < width - 1; x++) {
      const a = y * width + x, b = a + 1, c = a + width, d = c + 1;
      const ad = Math.min(map[a],map[d]), bc = Math.max(map[b],map[c]);
      const cb = Math.min(map[b],map[c]), da = Math.max(map[a],map[d]);
      if (ad > bc) { map[b] = ad; changed = true; edits++; }
      else if (cb > da) { map[a] = cb; changed = true; edits++; }
    }
  }
  return edits;
}
export function processArt(input) {
  const { raster, plan, profiles, mask: manualMask, order, regionMap, regions } = input;
  validateRaster(raster); validatePlan(plan, profiles);
  const adjustments = { ...DEFAULT_ADJUSTMENTS, ...input.adjustments };
  for (const [key, low, high] of [['brightness',-.5,.5],['contrast',.5,2],['gamma',.5,2],['saturation',0,2],['temperature',-.3,.3],['tolerance',0,60],['noise',0,1],['sharpness',0,1],['black',0,.4],['white',.6,1]]) if (!Number.isFinite(adjustments[key]) || adjustments[key] < low || adjustments[key] > high) throw new Error('Ajuste fotográfico inválido.');
  if (!Number.isInteger(adjustments.quantization) || (adjustments.quantization!==0 && (adjustments.quantization<2 || adjustments.quantization>32))) throw new Error('Quantização inválida.');
  if (!['photo','portrait','contrast','illustration','mono','cartoon','advanced'].includes(adjustments.style)) throw new Error('Estilo inválido.');
  const { width, height } = raster, n = width * height;
  const data = adjustments.noise || adjustments.sharpness || adjustments.style==='portrait' ? filterRaster(raster,adjustments.style==='portrait'?Math.max(.3,adjustments.noise):adjustments.noise,adjustments.sharpness) : raster.data;
  if (plan.widthMm / width < plan.nozzleMm - 1e-6 || plan.heightMm / height < plan.nozzleMm - 1e-6) throw new Error('Amostras menores que o bico selecionado.');
  if (manualMask && (manualMask.length !== n || Array.from(manualMask).some(v => ![0,1,2].includes(v)))) throw new Error('Máscara inválida.');
  if(regionMap && (regionMap.length!==n || Array.from(regionMap).some(v=>![0,1,2].includes(v))))throw new Error('Regiões inválidas.');
  if(regions && (!Array.isArray(regions) || regions.length!==3 || regions.some(r=>!r || !Number.isFinite(r.weight) || r.weight<.1 || r.weight>5 || !Number.isFinite(r.contrast) || r.contrast<.5 || r.contrast>2 || !Number.isFinite(r.saturation) || r.saturation<0 || r.saturation>2)))throw new Error('Tratamento de região inválido.');
  const regionAt=p=>regions?.[regionMap?.[p] || 0] || {weight:1,contrast:1,saturation:1};
  const removed = adjustments.background ? backgroundMask(raster, adjustments.tolerance) : new Uint8Array(n);
  let targets = new Array(n);
  for (let p = 0; p < n; p++) {
    if (data[p * 4 + 3] === 0) removed[p] = 1;
    if (manualMask?.[p] === 1) removed[p] = 1;
    if (manualMask?.[p] === 2) removed[p] = 0;
    let rgb = [0,1,2].map(c => data[p * 4 + c] / 255);
    const l = .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
    const region = regionAt(p);
    const saturation = adjustments.style === 'mono' ? 0 : adjustments.saturation * region.saturation;
    rgb = rgb.map((v,c) => {
      v = l + (v - l) * saturation + (c === 0 ? adjustments.temperature : c === 2 ? -adjustments.temperature : 0);
      v = (v - adjustments.black) / (adjustments.white - adjustments.black);
      v = (v - .5) * adjustments.contrast * region.contrast * (adjustments.style === 'contrast' ? 1.4 : 1) + .5 + adjustments.brightness;
      v = Math.max(0, Math.min(1, v)) ** (1 / adjustments.gamma);
      if (adjustments.invert) v = 1 - v;
      return linearizar(v);
    });
    const alpha = data[p * 4 + 3] / 255;
    targets[p] = lab(rgb.map(v => v * alpha + 1 - alpha));
  }
  const quantization=adjustments.quantization || (adjustments.style==='cartoon'?6:adjustments.style==='illustration'?16:0);
  if(quantization)targets=quantizeLab(targets,quantization);
  // Bounded deterministic stratified sample; all candidate orders share it.
  const stride = Math.max(1, Math.ceil(n / 256));
  let best;
  for (const candidate of order ? [order] : permutations(profiles.map(p => p.id))) {
    const palette = virtualPalette(plan, profiles, candidate);
    let sum = 0, count = 0;
    for (let p = 0; p < n; p += stride) if (!removed[p]) { const weight=regionAt(p).weight; sum += nearest(targets[p],palette).error*weight; count+=weight; }
    const score = sum / Math.max(1,count);
    if (!best || score < best.score) best = { palette, score, order: candidate };
  }
  const map = new Uint8Array(n), errors = new Float32Array(n * 3);
  for (let p = 0; p < n; p++) {
    if (removed[p]) continue;
    const target = targets[p].map((v,c) => v + (adjustments.dither ? errors[p * 3 + c] : 0));
    const match = nearest(target,best.palette); map[p] = match.k;
    if (adjustments.dither) {
      const x = p % width;
      for (const [q, weight] of [[x + 1 < width ? p + 1 : -1,7/16],[x > 0 ? p + width - 1 : -1,3/16],[p + width,5/16],[x + 1 < width ? p + width + 1 : -1,1/16]]) {
        if (q < 0 || q >= n || removed[q] || deltaE00(targets[p],targets[q]) > 20) continue;
        for (let c = 0; c < 3; c++) errors[q * 3 + c] += (target[c] - best.palette[match.k].lab[c]) * weight;
      }
    }
  }
  const repairs = repairDiagonals(map,width,height);
  const preview = new Uint8ClampedArray(n * 4);
  let sum = 0, max = 0, count = 0;
  for (let p = 0; p < n; p++) {
    preview.set([...best.palette[map[p]].rgb,255],p * 4);
    if (!removed[p]) { const error = deltaE00(targets[p],best.palette[map[p]].lab); sum += error; max = Math.max(max,error); count++; }
  }
  const usedLayers = Math.max(...map), manifest = printManifest(plan,profiles,best.palette);
  manifest.totalMm = zAt(plan,usedLayers);
  manifest.totalLayers = plan.baseLayers + usedLayers;
  manifest.transitions = manifest.transitions.filter(t => t.layerNumber <= manifest.totalLayers);
  return { width, height, map, preview, removed, palette: best.palette, order: best.order, meanDeltaE00: sum / Math.max(1,count), maxDeltaE00: max, repairs, manifest };
}
