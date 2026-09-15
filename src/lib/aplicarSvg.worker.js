import { BufferGeometry, BufferAttribute } from "three";
import { aplicarSvgSuperficie } from "./aplicarSvgSuperficie.js";

function restaurar({ positions, index }) {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  if (index) geometry.setIndex(new BufferAttribute(index, 1));
  return geometry;
}

self.onmessage = ({ data }) => {
  try {
    const resultado = aplicarSvgSuperficie(restaurar(data.modelo), restaurar(data.svg), data.opcoes);
    const positions = resultado.geometry.attributes.position.array;
    const normals = resultado.geometry.attributes.normal.array;
    self.postMessage({ positions, normals, metadata: resultado.metadata }, [positions.buffer, normals.buffer]);
  } catch (error) {
    self.postMessage({ error: error.message || "Não foi possível recortar a arte na superfície." });
  }
};
