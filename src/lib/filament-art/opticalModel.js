import { hexLinear, lab, codificar } from './colorSpaces.js';
export const ENGINE_VERSION = 'ijprint-filament-art/1.0.0';
export const A1 = Object.freeze({ printer: 'Bambu Lab A1 + AMS Lite', widthMm: 24, heightMm: 24, nozzleMm: .4, firstLayerMm: .2, layerMm: .08, baseLayers: 6, artLayers: 16, brim: false, supports: false });
// Demonstration estimates, NOT a statement of inventory or measured material properties.
export const ESTIMATED_PROFILES = [
  ['preto', '#181818', .4], ['vermelho', '#bb2934', .8], ['amarelo', '#edc54b', 1.2], ['branco', '#f4f1e8', .6],
].map(([id, hex, hidingDistanceMm]) => ({ id, name: id, hex, hidingDistanceMm, material: 'PLA', manufacturer: null, line: null, spoolId: null, transmissionDistanceMm: null, calibrationThicknessMm: null, calibration: null, confidence: 'estimated', inStock: null }));
export function validatePlan(plan, profiles) {
  if (!plan || !Array.isArray(profiles) || profiles.length < 1 || profiles.length > 4 || new Set(profiles.map(p => p.id)).size !== profiles.length) throw new Error('Selecione de 1 a 4 filamentos distintos.');
  for (const p of profiles) {
    hexLinear(p.hex);
    if (typeof p.id !== 'string' || !p.id || !Number.isFinite(p.hidingDistanceMm) || p.hidingDistanceMm <= 0 || p.hidingDistanceMm > 100 || p.material !== 'PLA') throw new Error('Perfil óptico inválido.');
    if (p.hidingDistanceRgbMm && (p.hidingDistanceRgbMm.length !== 3 || p.hidingDistanceRgbMm.some(d => !Number.isFinite(d) || d <= 0 || d > 100))) throw new Error('Calibração RGB inválida.');
  }
  for (const k of ['widthMm', 'heightMm']) if (!Number.isFinite(plan[k]) || plan[k] < 10 || plan[k] > 250) throw new Error('Dimensões permitidas: 10 a 250 mm.');
  if (![.2, .4].includes(plan.nozzleMm) || !Number.isFinite(plan.layerMm) || plan.layerMm < .06 || plan.layerMm > .16 || !Number.isFinite(plan.firstLayerMm) || plan.firstLayerMm < .1 || plan.firstLayerMm > .3) throw new Error('Altura de camada ou bico inválido.');
  if (!Number.isInteger(plan.baseLayers) || plan.baseLayers < 2 || plan.baseLayers > 20 || !Number.isInteger(plan.artLayers) || plan.artLayers < profiles.length || plan.artLayers > 48) throw new Error('Número de camadas inválido.');
  if (baseHeight(plan) < .5 || plan.brim !== false || plan.supports !== false) throw new Error('Use base de pelo menos 0,5 mm, sem brim e sem suportes.');
}
export const baseHeight = p => p.firstLayerMm + (p.baseLayers - 1) * p.layerMm;
export const zAt = (p, k) => Number((baseHeight(p) + k * p.layerMm).toFixed(6));
export function compose(lower, profile, thickness) {
  const rgb = hexLinear(profile.hex);
  return rgb.map((v, c) => {
    const transmission = 10 ** (-thickness / (profile.hidingDistanceRgbMm?.[c] ?? profile.hidingDistanceMm));
    return v * (1 - transmission) + lower[c] * transmission;
  });
}
export function virtualPalette(plan, profiles, order = profiles.map(p => p.id)) {
  validatePlan(plan, profiles);
  if (!Array.isArray(order) || order.length < profiles.length || order.length > 8 || order.length > plan.artLayers || new Set(order).size !== profiles.length || order.some(id => !profiles.some(p => p.id === id))) throw new Error('Sequência inválida: use todos os filamentos escolhidos em até 8 faixas.');
  if (plan.layerCounts && (!Array.isArray(plan.layerCounts) || plan.layerCounts.length !== order.length || plan.layerCounts.some(n => !Number.isInteger(n) || n < 1) || plan.layerCounts.reduce((a,b)=>a+b,0)!==plan.artLayers)) throw new Error('As faixas devem somar exatamente as camadas artísticas.');
  const sequence = order.map(id => profiles.find(p => p.id === id));
  let color = compose([1, 1, 1], sequence[0], baseHeight(plan));
  const entry = (k, profile) => ({ k, zMm: zAt(plan, k), filamentId: profile.id, linear: color.slice(), lab: lab(color), rgb: color.map(v => Math.round(codificar(v) * 255)) });
  const palette = [entry(0, sequence[0])];
  for (let k = 1; k <= plan.artLayers; k++) {
    let band = Math.min(sequence.length - 1, Math.floor((k - 1) * sequence.length / plan.artLayers));
    if (plan.layerCounts) { let end=0; band=plan.layerCounts.findIndex(n => {end+=n;return k<=end;}); }
    const profile = sequence[band];
    color = compose(color, profile, plan.layerMm);
    palette.push(entry(k, profile));
  }
  return palette;
}
export function printManifest(plan, profiles, palette) {
  const transitions = palette.filter((p, i) => i && p.filamentId !== palette[i - 1].filamentId).map(p => ({ filamentId: p.filamentId, layerNumber: plan.baseLayers + p.k, startZMm: zAt(plan, p.k - 1), endZMm: p.zMm }));
  return { version: ENGINE_VERSION, units: 'millimeter', ...plan, baseMm: baseHeight(plan), totalMm: zAt(plan, plan.artLayers), physicalFilaments: profiles.length, transitions, initialFilamentId: palette[0].filamentId, profiles, opticalModel: 'front-lit empirical linear RGB; T=10^(-t/D); white backing', validation: 'slicer_and_physical_validation_required' };
}
