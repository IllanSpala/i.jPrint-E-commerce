import { BufferGeometry, Float32BufferAttribute } from 'three';

// Recorta os próprios triângulos do STL. Não projeta somente os vértices do SVG:
// uma arte maior que a peça deve terminar na borda real, sem polígonos flutuantes.
const EPS = 1e-10;
const LIMITES = { fonte: 350_000, svg: 40_000, candidatos: 5_000_000, saida: 500_000, indice: 2_000_000 };
const mensagemComplexidade = 'Esta arte é complexa demais para aplicar com segurança. Simplifique os traçados do SVG e tente novamente.';
const topologias = new WeakMap();

function componentesConectados(records, tolerancia) {
  const pais = new Int32Array(records.length).map((_, i) => i);
  const raiz = i => { while (pais[i] !== i) { pais[i] = pais[pais[i]]; i = pais[i]; } return i; };
  const vertices = new Map(), arestas = new Map();
  const vertexId = p => {
    const key = p.map(value => Math.round(value / tolerancia)).join(',');
    let id = vertices.get(key);
    if (id === undefined) { id = vertices.size; vertices.set(key, id); }
    return id;
  };
  records.forEach((record, i) => {
    const ids = record.original.map(vertexId);
    for (let j = 0; j < 3; j++) {
      const a = ids[j], b = ids[(j + 1) % 3];
      if (a === b) continue;
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      const vizinho = arestas.get(key);
      if (vizinho === undefined) arestas.set(key, i);
      else pais[raiz(i)] = raiz(vizinho);
    }
  });
  return pais.map((_, i) => raiz(i));
}

function contemPonto(original, point, tolerancia) {
  const p = [point.x, point.y, point.z];
  if (p.some((value, i) => value < Math.min(...original.map(v => v[i])) - tolerancia || value > Math.max(...original.map(v => v[i])) + tolerancia)) return false;
  const n = normalTriangulo(original);
  if (!n) return false;
  const a = original[0], d = p.map((value, i) => value - a[i]);
  if (Math.abs(n[0] * d[0] + n[1] * d[1] + n[2] * d[2]) > tolerancia) return false;
  const { ab, ac, d00, d01, d11, den } = prepararRaio(original);
  if (Math.abs(den) < 1e-20) return false;
  const d20 = d[0] * ab[0] + d[1] * ab[1] + d[2] * ab[2], d21 = d[0] * ac[0] + d[1] * ac[1] + d[2] * ac[2];
  const u = (d11 * d20 - d01 * d21) / den, v = (d00 * d21 - d01 * d20) / den;
  return u >= -1e-5 && v >= -1e-5 && u + v <= 1 + 1e-5;
}

function componenteDoModelo(geometry, baseArte, tolerancia) {
  let cached = topologias.get(geometry);
  if (!cached || cached.version !== geometry.attributes.position.version) {
    const count = geometry.index?.count ?? geometry.attributes.position.count;
    const records = [];
    for (let start = 0; start < count; start += 3) records.push({ original: verticesTriangulo(geometry, start) });
    cached = { roots: componentesConectados(records, tolerancia / 4), records, version: geometry.attributes.position.version };
    topologias.set(geometry, cached);
  }
  const seed = cached.records.findIndex(record => contemPonto(record.original, baseArte, tolerancia));
  if (seed < 0) throw new Error('Não foi possível localizar a parte do modelo que recebe o SVG.');
  return { root: cached.roots[seed], roots: cached.roots, records: cached.records };
}

function verticesTriangulo(geometry, start) {
  const position = geometry.attributes.position;
  return [0, 1, 2].map(offset => {
    const id = geometry.index ? geometry.index.getX(start + offset) : start + offset;
    return [position.getX(id), position.getY(id), position.getZ(id)];
  });
}

function normalTriangulo([a, b, c]) {
  const ab = b.map((value, i) => value - a[i]);
  const ac = c.map((value, i) => value - a[i]);
  const n = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
  const length = Math.hypot(...n);
  return length > EPS ? n.map(value => value / length) : null;
}

function interpolar(a, b, t) {
  return a.map((value, i) => value + (b[i] - value) * t);
}

// Os primeiros componentes são U/V; os demais preservam a posição no STL.
function recortarPoligono(poly, distancia) {
  const resultado = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const da = distancia(a), db = distancia(b);
    const dentroA = da >= -EPS, dentroB = db >= -EPS;
    if (dentroA) resultado.push(a);
    if (dentroA !== dentroB) resultado.push(interpolar(a, b, da / (da - db)));
  }
  return resultado;
}

function area2(a, b, c) {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function recortarTriangulo(poly, [a, b, c]) {
  const sinal = area2(a, b, c) >= 0 ? 1 : -1;
  for (const [p, q] of [[a, b], [b, c], [c, a]]) {
    poly = recortarPoligono(poly, v => sinal * area2(p, q, v));
    if (poly.length < 3) return [];
  }
  return poly;
}

function limites(poly) {
  const min = [Infinity, Infinity], max = [-Infinity, -Infinity];
  for (const p of poly) for (let i = 0; i < 2; i++) {
    min[i] = Math.min(min[i], p[i]); max[i] = Math.max(max[i], p[i]);
  }
  return { min, max };
}

function criarIndice(triangulos, bounds, divis = 64) {
  const bins = Array.from({ length: divis * divis }, () => []);
  let links = 0;
  const celula = (value, axis) => Math.max(0, Math.min(divis - 1, Math.floor((value - bounds.min[axis]) / (bounds.max[axis] - bounds.min[axis] || 1) * divis)));
  for (let id = 0; id < triangulos.length; id++) {
    const b = triangulos[id].bounds;
    if (b.max[0] < bounds.min[0] || b.min[0] > bounds.max[0] || b.max[1] < bounds.min[1] || b.min[1] > bounds.max[1]) continue;
    for (let u = celula(b.min[0], 0); u <= celula(b.max[0], 0); u++) {
      for (let v = celula(b.min[1], 1); v <= celula(b.max[1], 1); v++) {
        if (++links > LIMITES.indice) throw new Error(mensagemComplexidade);
        bins[u * divis + v].push(id);
      }
    }
  }
  const marks = new Uint32Array(triangulos.length);
  let generation = 0;
  return {
    consultar(boundsConsulta) {
      generation++;
      const resultado = [];
      for (let u = celula(boundsConsulta.min[0], 0); u <= celula(boundsConsulta.max[0], 0); u++) {
        for (let v = celula(boundsConsulta.min[1], 1); v <= celula(boundsConsulta.max[1], 1); v++) {
          for (const id of bins[u * divis + v]) {
            if (marks[id] === generation) continue;
            marks[id] = generation;
            const b = triangulos[id].bounds;
            if (b.max[0] >= boundsConsulta.min[0] && b.min[0] <= boundsConsulta.max[0] && b.max[1] >= boundsConsulta.min[1] && b.min[1] <= boundsConsulta.max[1]) resultado.push(id);
          }
        }
      }
      return resultado;
    },
  };
}

function prepararRaio([a, b, c]) {
  const ab = b.map((value, i) => value - a[i]), ac = c.map((value, i) => value - a[i]);
  const dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  const d00 = dot(ab, ab), d01 = dot(ab, ac), d11 = dot(ac, ac);
  return { ab, ac, d00, d01, d11, den: d00 * d11 - d01 * d01 };
}

function raioNoTriangulo(record, cos, sin, z, centroY) {
  const a = record.original[0];
  const n = record.normal;
  const divisor = n[0] * cos + n[1] * sin;
  if (divisor <= EPS) return -Infinity;
  const raio = (n[0] * a[0] + n[1] * (a[1] - centroY) + n[2] * (a[2] - z)) / divisor;
  if (raio < 0) return -Infinity;
  const px = raio * cos - a[0], py = centroY + raio * sin - a[1], pz = z - a[2];
  const { ab, ac, d00, d01, d11, den } = record.raio;
  const d20 = px * ab[0] + py * ab[1] + pz * ab[2], d21 = px * ac[0] + py * ac[1] + pz * ac[2];
  if (Math.abs(den) < 1e-20) return -Infinity;
  const u = (d11 * d20 - d01 * d21) / den, v = (d00 * d21 - d01 * d20) / den;
  return u >= -1e-6 && v >= -1e-6 && u + v <= 1 + 1e-6 ? raio : -Infinity;
}

/**
 * modelGeometry: STL centrado/normalizado, antes da translação Z do grupo.
 * svgGeometry: arte triangulada, centrada, Y para cima, maior dimensão = 1.
 * A geometria resultante está nas coordenadas locais do modelo, sem offset.
 * O corpo usa uma volta cilíndrica em Z; excessos além dessa volta são cortados.
 */
export function aplicarSvgSuperficie(modelGeometry, svgGeometry, { tipo = 'topo', baseArte, escala = 46, x = 0, y = 0, anguloSvg = 0 } = {}) {
  if (!['topo', 'fundo', 'corpo'].includes(tipo)) throw new Error('Superfície de aplicação não reconhecida.');
  if (!baseArte || ![baseArte.x, baseArte.y, baseArte.z, escala, x, y, anguloSvg].every(Number.isFinite) || escala <= 0) throw new Error('Informe um tamanho positivo e uma posição válida para o SVG.');
  const modelCount = (modelGeometry.index?.count ?? modelGeometry.attributes.position.count) / 3;
  const svgCount = (svgGeometry.index?.count ?? svgGeometry.attributes.position.count) / 3;
  if (modelCount > LIMITES.fonte || svgCount > LIMITES.svg) throw new Error(mensagemComplexidade);
  modelGeometry.computeBoundingBox();
  const modelBounds = modelGeometry.boundingBox;
  const extent = Math.max(modelBounds.max.x - modelBounds.min.x, modelBounds.max.y - modelBounds.min.y, modelBounds.max.z - modelBounds.min.z);
  const tolerancia = Math.max(1e-6, extent * 1e-5);
  const raioReferencia = tipo === 'corpo' ? Math.abs(baseArte.x) : null;
  if (tipo === 'corpo' && raioReferencia < tolerancia) throw new Error('Não foi possível identificar a curvatura da superfície.');
  const meiaVolta = Math.PI * raioReferencia;
  const volta = 2 * meiaVolta;
  let superficie = [];
  const componente = tipo === 'corpo' ? componenteDoModelo(modelGeometry, baseArte, tolerancia) : null;
  for (let start = 0; start < modelCount * 3; start += 3) {
    if (componente && componente.roots[start / 3] !== componente.root) continue;
    const original = componente ? componente.records[start / 3].original : verticesTriangulo(modelGeometry, start);
    if (!original.flat().every(Number.isFinite)) throw new Error('O modelo contém coordenadas inválidas.');
    const normal = normalTriangulo(original);
    if (!normal) continue;
    if (tipo !== 'corpo') {
      if (normal[2] < 0.999 || original.some(p => Math.abs(p[2] - baseArte.z) > tolerancia)) continue;
      const poly = original.map(p => [p[0] - baseArte.x, p[1] - baseArte.y, ...p]);
      superficie.push({ poly, original, normal, source: start, bounds: limites(poly) });
    } else {
      const centro = original[0].map((_, i) => (original[0][i] + original[1][i] + original[2][i]) / 3);
      const radial = [centro[0], centro[1] - baseArte.y];
      // Não pinta tampas, bases nem a parede voltada para dentro da cavidade.
      if (normal[0] * radial[0] + normal[1] * radial[1] <= EPS) continue;
      const angulos = original.map(p => Math.atan2(p[1] - baseArte.y, p[0]));
      const raio = prepararRaio(original);
      for (let i = 1; i < 3; i++) angulos[i] += Math.round((angulos[0] - angulos[i]) / (2 * Math.PI)) * 2 * Math.PI;
      for (const shift of [-volta, 0, volta]) {
        let poly = original.map((p, i) => [angulos[i] * raioReferencia + shift, p[2] - baseArte.z, ...p]);
        if (Math.min(...poly.map(p => p[0])) >= meiaVolta || Math.max(...poly.map(p => p[0])) <= -meiaVolta) continue;
        poly = recortarPoligono(poly, p => p[0] + meiaVolta);
        poly = recortarPoligono(poly, p => meiaVolta - p[0]);
        if (poly.length >= 3) superficie.push({ poly, original, normal, source: start, bounds: limites(poly), raio, apenasOclusao: Math.abs(normal[2]) > 0.95 });
      }
    }
  }
  if (tipo !== 'corpo' && superficie.length) {
    const seed = superficie.findIndex(record => contemPonto(record.original, baseArte, tolerancia));
    if (seed < 0) throw new Error('Não foi possível localizar a região plana que recebe o SVG.');
    const roots = componentesConectados(superficie, tolerancia / 4);
    superficie = superficie.filter((_, i) => roots[i] === roots[seed]);
  }
  if (!superficie.length) throw new Error('Não foi encontrada uma superfície adequada para aplicar a arte.');
  const surfaceBounds = { min: [Infinity, Infinity], max: [-Infinity, -Infinity] };
  for (const { bounds } of superficie) for (let i = 0; i < 2; i++) {
    surfaceBounds.min[i] = Math.min(surfaceBounds.min[i], bounds.min[i]);
    surfaceBounds.max[i] = Math.max(surfaceBounds.max[i], bounds.max[i]);
  }
  const tamanho = escala / (tipo === 'corpo' ? 48 : 24);
  const rad = -anguloSvg * Math.PI / 180, cos = Math.cos(rad), sin = Math.sin(rad);
  const svgTriangles = [];
  for (let start = 0; start < svgCount * 3; start += 3) {
    const poly = verticesTriangulo(svgGeometry, start).map(p => [tamanho * (p[0] * cos - p[1] * sin) + x / 85, tamanho * (p[0] * sin + p[1] * cos) - y / 85]);
    if (!poly.flat().every(Number.isFinite)) throw new Error('O tamanho ou os traçados do SVG contêm coordenadas inválidas.');
    const signedArea = area2(...poly);
    if (!Number.isFinite(signedArea)) throw new Error('O tamanho do SVG excede a precisão numérica disponível. Reduza o valor e tente novamente.');
    if (Math.abs(signedArea) > EPS) svgTriangles.push({ poly, bounds: limites(poly) });
  }
  const svgIndex = criarIndice(svgTriangles, surfaceBounds);
  const surfaceIndex = tipo === 'corpo' ? criarIndice(superficie, surfaceBounds, 96) : null;
  const positions = [], normals = [];
  let candidatos = 0, triangulosAplicados = 0;
  const consumirOperacao = () => { if (++candidatos > LIMITES.candidatos) throw new Error(mensagemComplexidade); };
  for (const record of superficie) {
    if (record.apenasOclusao) continue;
    const ids = svgIndex.consultar(record.bounds);
    for (const id of ids) {
      consumirOperacao();
      const poly = recortarTriangulo(record.poly, svgTriangles[id].poly);
      if (poly.length < 3) continue;
      if (surfaceIndex) {
        // Partes ocas/compartimentos podem se sobrepor em UV. Apenas a pele
        // exterior atingida pelo raio radial recebe tinta, nunca o interior.
        const uv = [0, 1].map(axis => poly.reduce((sum, p) => sum + p[axis], 0) / poly.length);
        const c = Math.cos(uv[0] / raioReferencia), s = Math.sin(uv[0] / raioReferencia), z = uv[1] + baseArte.z;
        const r = raioNoTriangulo(record, c, s, z, baseArte.y);
        let oculto = false;
        for (const other of surfaceIndex.consultar({ min: uv, max: uv })) {
          consumirOperacao();
          if (superficie[other].source !== record.source && raioNoTriangulo(superficie[other], c, s, z, baseArte.y) > r + tolerancia) { oculto = true; break; }
        }
        if (oculto) continue;
      }
      for (let i = 1; i < poly.length - 1; i++) {
        let tri = [poly[0], poly[i], poly[i + 1]];
        if (Math.abs(area2(...tri)) < EPS) continue;
        const n = normalTriangulo(tri.map(p => p.slice(2)));
        if (!n) continue;
        if (n[0] * record.normal[0] + n[1] * record.normal[1] + n[2] * record.normal[2] < 0) tri = [tri[0], tri[2], tri[1]];
        if (++triangulosAplicados > LIMITES.saida) throw new Error(mensagemComplexidade);
        for (const p of tri) { positions.push(p[2], p[3], p[4]); normals.push(...record.normal); }
      }
    }
  }
  if (!positions.length) throw new Error('O SVG está fora da superfície de aplicação. Mova a arte sobre a peça e tente novamente.');
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return {
    geometry,
    metadata: {
      versao: 1, algoritmo: 'recorte-triangulos-superficie', tipo,
      mapeamento: tipo === 'corpo' ? 'cilindrico-z-uma-volta' : 'plano-xy',
      baseArte: { x: baseArte.x, y: baseArte.y, z: baseArte.z },
      escala, x, y, anguloSvg, tamanhoNormalizado: tamanho,
      ...(tipo === 'corpo' ? { centroCilindrico: { x: 0, y: baseArte.y }, raioReferencia, circunferencia: volta } : {}),
      triangulosModelo: modelCount, triangulosSvg: svgCount, triangulosAplicados,
      superficieRecortada: true,
    },
  };
}
