// Conversão monocromática local: limpeza do fundo conectado às bordas e
// traçado de contornos reais (inclusive furos), não uma imagem embutida em SVG.
export function vetorizarImagem({ data, width, height, removerFundo = true, tolerancia = 32, modo = 'contraste', limiar = 180, inverter = false, ruido = 4 }) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width * height > 1_048_576 || data.length !== width * height * 4) throw new Error('Imagem inválida ou grande demais para processar.');
  const n = width * height, removido = new Uint8Array(n), mask = new Uint8Array(n);
  const borda = [];
  for (let x = 0; x < width; x++) { borda.push(x, (height - 1) * width + x); }
  for (let y = 1; y < height - 1; y++) borda.push(y * width, y * width + width - 1);
  const frequencias = new Map();
  for (const p of borda) {
    if (data[p * 4 + 3] < 128) continue;
    const cor = [0, 1, 2].map(k => Math.round(data[p * 4 + k] / 16)).join(',');
    const entry = frequencias.get(cor) || { count: 0, p };
    entry.count++; frequencias.set(cor, entry);
  }
  const dominante = [...frequencias.values()].sort((a, b) => b.count - a.count)[0];
  const fundo = dominante ? Array.from(data.slice(dominante.p * 4, dominante.p * 4 + 3)) : [255, 255, 255];
  const combina = p => data[p * 4 + 3] < 128 || (removerFundo && Math.hypot(...fundo.map((c, k) => data[p * 4 + k] - c)) <= tolerancia * Math.sqrt(3));
  const fila = new Int32Array(n); let inicio = 0, fim = 0;
  const visitar = p => { if (!removido[p] && combina(p)) { removido[p] = 1; fila[fim++] = p; } };
  for (const p of borda) visitar(p);
  while (inicio < fim) {
    const p = fila[inicio++], x = p % width;
    if (x) visitar(p - 1);
    if (x + 1 < width) visitar(p + 1);
    if (p >= width) visitar(p - width);
    if (p + width < n) visitar(p + width);
  }
  for (let p = 0; p < n; p++) {
    if (removido[p] || data[p * 4 + 3] < 128) continue;
    const brilho = .2126 * data[p * 4] + .7152 * data[p * 4 + 1] + .0722 * data[p * 4 + 2];
    mask[p] = modo === 'silhueta' || (inverter ? brilho >= limiar : brilho <= limiar) ? 1 : 0;
  }
  // Cada bit representa uma aresta orientada no contorno dos pixels sólidos.
  const stride = width + 1, edges = new Uint8Array(stride * (height + 1));
  let edgeCount = 0;
  const adicionar = (x, y, dir) => { edges[y * stride + x] |= 1 << dir; if (++edgeCount > 180_000) throw new Error('A imagem tem detalhes demais. Reduza os detalhes ou use um desenho mais simples.'); };
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const p = y * width + x;
    if (!mask[p]) continue;
    if (!y || !mask[p - width]) adicionar(x, y, 0);
    if (x === width - 1 || !mask[p + 1]) adicionar(x + 1, y, 1);
    if (y === height - 1 || !mask[p + width]) adicionar(x + 1, y + 1, 2);
    if (!x || !mask[p - 1]) adicionar(x, y + 1, 3);
  }
  const delta = [1, stride, -1, -stride], paths = [];
  let pointsCount = 0;
  for (let start = 0; start < edges.length; start++) while (edges[start]) {
    let current = start, dir = [0, 1, 2, 3].find(d => edges[start] & (1 << d));
    const points = []; let passos = 0;
    do {
      points.push([current % stride, Math.floor(current / stride)]);
      edges[current] &= ~(1 << dir);
      current += delta[dir];
      if (++passos > edgeCount) throw new Error('Não foi possível fechar os contornos da imagem.');
      if (current !== start) {
        dir = [1, 0, 3, 2].map(turn => (dir + turn) % 4).find(d => edges[current] & (1 << d));
        if (dir === undefined) throw new Error('Contorno incompleto. Tente ajustar o contraste.');
      }
    } while (current !== start);
    const area = Math.abs(points.reduce((sum, p, i) => { const q = points[(i + 1) % points.length]; return sum + p[0] * q[1] - q[0] * p[1]; }, 0) / 2);
    if (area < ruido) continue;
    const corners = points.filter((p, i) => {
      const a = points[(i + points.length - 1) % points.length], b = points[(i + 1) % points.length];
      return (p[0] - a[0]) * (b[1] - p[1]) !== (p[1] - a[1]) * (b[0] - p[0]);
    });
    if (corners.length < 3) continue;
    pointsCount += corners.length;
    if (pointsCount > 25_000 || paths.length >= 2000) throw new Error('O vetor ficou complexo demais para o editor. Aumente a limpeza ou simplifique a imagem.');
    paths.push('M' + corners.map(p => p.join(' ')).join('L') + 'Z');
  }
  if (!paths.length) throw new Error('Nenhum desenho encontrado. Ajuste o contraste, inverta os tons ou desative a remoção de fundo.');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"><path fill="#111111" fill-rule="evenodd" d="${paths.join('')}"/></svg>`;
  return { svg, contornos: paths.length, pontos: pointsCount, fundo, width, height };
}
