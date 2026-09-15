import { BufferGeometry, BufferAttribute } from "three";

export function iniciarAplicacaoSuperficie(modelo, svg, opcoes) {
  const worker = new Worker(new URL("./aplicarSvg.worker.js", import.meta.url), { type: "module" });
  const copiar = geometry => ({ positions: geometry.attributes.position.array.slice(), index: geometry.index?.array.slice() });
  let rejectPromise, timer;
  const promise = new Promise((resolve, reject) => {
    rejectPromise = reject;
    worker.onmessage = ({ data }) => {
      clearTimeout(timer);
      worker.terminate();
      if (data.error) { reject(new Error(data.error)); return; }
      const geometry = new BufferGeometry();
      geometry.setAttribute("position", new BufferAttribute(data.positions, 3));
      geometry.setAttribute("normal", new BufferAttribute(data.normals, 3));
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      resolve({ geometry, metadata: data.metadata });
    };
    worker.onerror = () => {
      clearTimeout(timer); worker.terminate();
      reject(new Error("Não foi possível processar a arte. Simplifique o SVG ou tente novamente."));
    };
    const payload = { modelo: copiar(modelo), svg: copiar(svg), opcoes };
    const buffers = [payload.modelo.positions.buffer, payload.svg.positions.buffer];
    if (payload.modelo.index) buffers.push(payload.modelo.index.buffer);
    if (payload.svg.index) buffers.push(payload.svg.index.buffer);
    worker.postMessage(payload, buffers);
    timer = setTimeout(() => {
      worker.terminate(); reject(new Error("Esta arte demorou demais para aplicar. Simplifique os traçados e tente novamente."));
    }, 30_000);
  });
  return { promise, cancelar() { clearTimeout(timer); worker.terminate(); rejectPromise(new Error("Aplicação cancelada.")); } };
}
