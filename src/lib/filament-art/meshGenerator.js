import { baseHeight, zAt, validatePlan } from './opticalModel.js';
// A solid column per sample, union boundary only. Vertical faces split at EVERY
// layer plane, including the base. Shared corner/edge vertices remain conforming.
export function generateMesh(result, plan) {
  validatePlan(plan, result.manifest.profiles);
  const { width, height, map } = result;
  if (width * height > 16384 || map.length !== width * height || Array.from(map).some(k => !Number.isInteger(k) || k < 0 || k > plan.artLayers)) throw new Error('Mapa de alturas inválido.');
  const positions = [], triangles = [], lookup = new Map();
  const levels = [0, plan.firstLayerMm];
  for (let k = 2; k <= plan.baseLayers + plan.artLayers; k++) levels.push(Number((plan.firstLayerMm + (k - 1) * plan.layerMm).toFixed(6)));
  const vertex = (x,y,k) => {
    const key = `${x},${y},${k}`;
    if (!lookup.has(key)) { lookup.set(key,positions.length / 3); positions.push(x * plan.widthMm / width, y * plan.heightMm / height, levels[k]); }
    return lookup.get(key);
  };
  const quad = (a,b,c,d) => {
    if (triangles.length > 3_000_000) throw new Error('Malha muito complexa. Reduza a resolução ou as camadas.');
    const ids = [a,b,c,d].map(p => vertex(...p)); triangles.push(ids[0],ids[1],ids[2],ids[0],ids[2],ids[3]);
  };
  const top = (x,y) => x < 0 || y < 0 || x >= width || y >= height ? 0 : plan.baseLayers + map[(height - 1 - y) * width + x];
  let volumeMm3 = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const h = top(x,y);
    quad([x,y,h],[x+1,y,h],[x+1,y+1,h],[x,y+1,h]);
    quad([x,y,0],[x,y+1,0],[x+1,y+1,0],[x+1,y,0]);
    for (let k = top(x,y-1); k < h; k++) quad([x,y,k],[x+1,y,k],[x+1,y,k+1],[x,y,k+1]);
    for (let k = top(x+1,y); k < h; k++) quad([x+1,y,k],[x+1,y+1,k],[x+1,y+1,k+1],[x+1,y,k+1]);
    for (let k = top(x,y+1); k < h; k++) quad([x+1,y+1,k],[x,y+1,k],[x,y+1,k+1],[x+1,y+1,k+1]);
    for (let k = top(x-1,y); k < h; k++) quad([x,y+1,k],[x,y,k],[x,y,k+1],[x,y+1,k+1]);
    volumeMm3 += levels[h] * plan.widthMm / width * plan.heightMm / height;
  }
  return { positions: new Float32Array(positions), indices: new Uint32Array(triangles), volumeMm3, baseMm: baseHeight(plan), maxMm: zAt(plan,Math.max(...map)) };
}
export function validateMesh({ positions, indices }) {
  const edges = new Map(); let volume = 0;
  if (!positions.length || positions.length % 3 || indices.length % 3 || positions.some(v => !Number.isFinite(v))) throw new Error('Geometria inválida.');
  for (let i = 0; i < indices.length; i += 3) {
    const ids = Array.from(indices.slice(i,i+3));
    if (ids.some(k => k * 3 >= positions.length)) throw new Error('Índice inválido.');
    const [a,b,c] = ids.map(k => Array.from(positions.slice(k*3,k*3+3)));
    const u = b.map((v,j) => v-a[j]), v = c.map((v,j) => v-a[j]);
    const normal = [u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    if (Math.hypot(...normal) < 1e-10) throw new Error('Triângulo degenerado.');
    volume += (a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6;
    for (let j = 0; j < 3; j++) {
      const from = ids[j], to = ids[(j+1)%3], key = `${Math.min(from,to)},${Math.max(from,to)}`;
      const edge = edges.get(key) || { count: 0, balance: 0 }; edge.count++; edge.balance += from < to ? 1 : -1; edges.set(key,edge);
    }
  }
  if ([...edges.values()].some(e => e.count !== 2 || e.balance !== 0) || volume <= 0) throw new Error('Malha aberta, não manifold ou com orientação inconsistente.');
  return { watertight: true, oriented: true, triangles: indices.length / 3, volumeMm3: volume };
}
