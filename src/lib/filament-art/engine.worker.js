import { processArt } from './engine.js';
import { generateMesh, validateMesh } from './meshGenerator.js';
import { binaryStl, geometricThreeMf } from './exporters.js';
self.onmessage = ({ data: { id, input, exportType, expectedMap } }) => {
  try {
    const result = processArt(input);
    if (expectedMap && (expectedMap.length !== result.map.length || expectedMap.some((k,i) => k !== result.map[i]))) throw new Error('O mapa reproduzido diverge do pedido. Exporte com a versão original do motor.');
    if (exportType) {
      const mesh = generateMesh(result,input.plan), validation = validateMesh(mesh);
      const file = exportType === 'stl' ? binaryStl(mesh) : geometricThreeMf(mesh);
      self.postMessage({ id, file, validation, manifest: result.manifest });
    } else {
      result.mesh = generateMesh(result,input.plan);
      self.postMessage({ id, result }, [result.map.buffer,result.preview.buffer,result.removed.buffer,result.mesh.positions.buffer,result.mesh.indices.buffer]);
    }
  } catch (error) { self.postMessage({ id, error: error.message }); }
};
