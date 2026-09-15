import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";

// Vetor triangulado uma única vez. Cópia plana canônica para reaplicar sem
// acumular a deformação do preview ou perder os furos do desenho original.
export function criarGeometriaSvg(svg) {
  const resultado = new SVGLoader().parse(svg.replaceAll("currentColor", "#ffffff"));
  const positions = [];
  function adicionar(geometry) {
    if (!geometry) return;
    try {
      const p = geometry.attributes.position, index = geometry.index;
      const count = index?.count ?? p.count;
      if (positions.length + count * 3 > 450_000) throw new Error("O SVG tem detalhes demais. Simplifique os caminhos antes de aplicar.");
      for (let i = 0; i < count; i++) {
        const j = index ? index.getX(i) : i;
        positions.push(p.getX(j), p.getY(j), 0);
      }
    } finally { geometry.dispose(); }
  }
  for (const path of resultado.paths) {
    const style = path.userData?.style || {};
    if (Number(style.opacity) === 0) continue;
    if (style.fill !== "none" && Number(style.fillOpacity) !== 0) {
      for (const shape of SVGLoader.createShapes(path)) adicionar(new THREE.ShapeGeometry(shape, 10));
    }
    if (style.stroke && style.stroke !== "none" && Number(style.strokeOpacity) !== 0) {
      for (const subPath of path.subPaths) adicionar(SVGLoader.pointsToStroke(subPath.getPoints(), style));
    }
  }
  if (!positions.length) throw new Error("O SVG não contém formas vetoriais visíveis para aplicar.");
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeBoundingBox();
  const center = geometry.boundingBox.getCenter(new THREE.Vector3());
  const size = geometry.boundingBox.getSize(new THREE.Vector3());
  const divisor = Math.max(size.x, size.y);
  if (!Number.isFinite(divisor) || divisor <= 0) { geometry.dispose(); throw new Error("O SVG contém dimensões inválidas."); }
  geometry.translate(-center.x, -center.y, 0);
  geometry.scale(1 / divisor, -1 / divisor, 1 / divisor);
  geometry.userData.normalizacaoSvg = { centro: center.toArray(), divisor, inverterY: true };
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}
