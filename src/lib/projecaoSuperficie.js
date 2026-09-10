// Índice 2D da superfície vista de +X: evita testar todo o STL por vértice do SVG.
export function criarProjecaoX(geometry, divis = 64) {
  geometry.computeBoundingBox();
  const { min, max } = geometry.boundingBox;
  const pos = geometry.attributes.position;
  const index = geometry.index;
  const bins = Array.from({ length: divis * divis }, () => []);
  const triangles = [];
  const cellY = y => Math.max(0, Math.min(divis - 1, Math.floor((y - min.y) / (max.y - min.y || 1) * divis)));
  const cellZ = z => Math.max(0, Math.min(divis - 1, Math.floor((z - min.z) / (max.z - min.z || 1) * divis)));
  for (let i = 0; i < (index?.count ?? pos.count); i += 3) {
    const ids = [0, 1, 2].map(j => index ? index.getX(i + j) : i + j);
    const [a, b, c] = ids.map(j => [pos.getX(j), pos.getY(j), pos.getZ(j)]);
    const den = (b[2] - c[2]) * (a[1] - c[1]) + (c[1] - b[1]) * (a[2] - c[2]);
    if (Math.abs(den) < 1e-12) continue;
    const t = triangles.push({ a, b, c, den }) - 1;
    for (let y = cellY(Math.min(a[1], b[1], c[1])); y <= cellY(Math.max(a[1], b[1], c[1])); y++) {
      for (let z = cellZ(Math.min(a[2], b[2], c[2])); z <= cellZ(Math.max(a[2], b[2], c[2])); z++) bins[y * divis + z].push(t);
    }
  }
  return (y, z) => {
    if (y < min.y || y > max.y || z < min.z || z > max.z) return null;
    let hit = -Infinity;
    for (const id of bins[cellY(y) * divis + cellZ(z)]) {
      const { a, b, c, den } = triangles[id];
      const u = ((b[2] - c[2]) * (y - c[1]) + (c[1] - b[1]) * (z - c[2])) / den;
      const v = ((c[2] - a[2]) * (y - c[1]) + (a[1] - c[1]) * (z - c[2])) / den;
      if (u >= -1e-7 && v >= -1e-7 && u + v <= 1 + 1e-7) hit = Math.max(hit, u * a[0] + v * b[0] + (1 - u - v) * c[0]);
    }
    return Number.isFinite(hit) ? hit : null;
  };
}
