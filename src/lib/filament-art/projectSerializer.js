import { ENGINE_VERSION } from './opticalModel.js';
export const BUCKET = 'filament-art-private';
export function stableJson(value) {
  if (ArrayBuffer.isView(value)) return stableJson(Array.from(value));
  if (Array.isArray(value)) return '[' + value.map(stableJson).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().filter(k => value[k] !== undefined).map(k => JSON.stringify(k) + ':' + stableJson(value[k])).join(',') + '}';
  return JSON.stringify(value);
}
export function projectSnapshot(input, result, originalSha256) {
  return JSON.parse(stableJson({ version: ENGINE_VERSION, originalSha256, input, map: result.map, order: result.order, manifest: result.manifest, metrics: { meanDeltaE00: result.meanDeltaE00, maxDeltaE00: result.maxDeltaE00, repairs: result.repairs } }));
}
export function fitsProduct(plan, product) {
  const dimensions = String(product?.dimensoes || '').split(/[x×]/i).map(Number);
  const total = plan.firstLayerMm + (plan.baseLayers - 1 + plan.artLayers) * plan.layerMm;
  return dimensions.length === 3 && Math.abs(dimensions[0] - plan.widthMm) < .001 && Math.abs(dimensions[1] - plan.heightMm) < .001 && total <= dimensions[2] + .001;
}
export function isFilamentProduct(product) { return !product?.prontaEntrega && String(product?.id) === '82'; }
export function validProjectRef(ref) { return !!ref && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(ref.id) && /^[0-9a-f]{64}$/.test(ref.hash); }
