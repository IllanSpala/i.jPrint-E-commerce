import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { produtos } from '../data/produtos.js';
import { aplicarSvgSuperficie } from './aplicarSvgSuperficie.js';

function area(geometry) {
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const position = geometry.attributes.position;
  let result = 0;
  for (let i = 0; i < (geometry.index?.count ?? position.count); i += 3) {
    [a, b, c].forEach((p, offset) => p.fromBufferAttribute(position, geometry.index ? geometry.index.getX(i + offset) : i + offset));
    result += b.sub(a).cross(c.sub(a)).length() / 2;
  }
  return result;
}

function lerProduto(produto) {
  const file = readFileSync(`public${produto.modelo3d}`);
  const geometry = new STLLoader().parse(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength));
  geometry.rotateZ(THREE.MathUtils.degToRad(produto.aplicacaoSvg?.rotacaoZ || 0));
  geometry.center();
  geometry.computeBoundingBox();
  const size = geometry.boundingBox.getSize(new THREE.Vector3());
  const fator = 3.4 / Math.max(size.x, size.y, size.z);
  geometry.scale(fator, fator, fator);
  geometry.computeBoundingBox();
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
  mesh.updateMatrixWorld(true);
  const ray = new THREE.Raycaster();
  if (produto.aplicacaoSvg?.tipo === 'corpo') ray.set(new THREE.Vector3(10, 13.35 * fator, 0), new THREE.Vector3(-1, 0, 0));
  else ray.set(new THREE.Vector3(0, 0, 10), new THREE.Vector3(0, 0, -1));
  const hit = ray.intersectObject(mesh)[0];
  assert.ok(hit, `${produto.nome}: ponto inicial encontrado`);
  return { geometry, mesh, baseArte: hit.point, tipo: produto.aplicacaoSvg?.tipo || 'topo' };
}

test('recorta excessos no topo, preserva buracos e não altera a geometria original', () => {
  const model = new THREE.BoxGeometry(2, 2, 1);
  const original = model.attributes.position.array.slice();
  const shape = new THREE.Shape().moveTo(-0.5, -0.5).lineTo(0.5, -0.5).lineTo(0.5, 0.5).lineTo(-0.5, 0.5).closePath();
  shape.holes.push(new THREE.Path().moveTo(-0.125, -0.125).lineTo(-0.125, 0.125).lineTo(0.125, 0.125).lineTo(0.125, -0.125).closePath());
  const svg = new THREE.ShapeGeometry(shape);
  const { geometry } = aplicarSvgSuperficie(model, svg, { baseArte: new THREE.Vector3(0, 0, 0.5), escala: 96 });
  assert.ok(Math.abs(area(geometry) - 3) < 1e-6, 'topo 2×2 menos buraco 1×1');
  const p = geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    assert.ok(Math.abs(p.getZ(i) - 0.5) < 1e-6);
    assert.ok(Math.abs(p.getX(i)) <= 1.000001 && Math.abs(p.getY(i)) <= 1.000001);
  }
  assert.deepEqual(model.attributes.position.array, original);
});

test('escala sem limite superior e translação/rotação com recorte', () => {
  const model = new THREE.BoxGeometry(2, 2, 1), svg = new THREE.PlaneGeometry(1, 1);
  for (const escala of [1000, 1e8]) {
    const { geometry } = aplicarSvgSuperficie(model, svg, { baseArte: new THREE.Vector3(0, 0, 0.5), escala, anguloSvg: 27 });
    assert.ok(Math.abs(area(geometry) - 4) < 1e-5, `escala ${escala}: área do topo`);
  }
  const result = aplicarSvgSuperficie(model, svg, { baseArte: new THREE.Vector3(0, 0, 0.5), escala: 24, x: 85, anguloSvg: 90 });
  assert.ok(Math.abs(area(result.geometry) - 0.5) < 1e-6);
  assert.equal(result.metadata.anguloSvg, 90);
  assert.throws(() => aplicarSvgSuperficie(model, svg, { baseArte: new THREE.Vector3(0, 0, 0.5), x: 1000 }), /fora da superfície/);
  assert.throws(() => aplicarSvgSuperficie(model, svg, { baseArte: new THREE.Vector3(), escala: Infinity }), /posição válida/);
});

test('corpo envolve cilindro completo, fecha a emenda e exclui tampas e cavidade', () => {
  const outer = new THREE.CylinderGeometry(1, 1, 2, 64, 1, true).rotateX(Math.PI / 2);
  const inner = new THREE.CylinderGeometry(0.7, 0.7, 2, 64, 1, true).rotateX(Math.PI / 2);
  for (let i = 0; i < inner.index.count; i += 3) {
    const a = inner.index.getX(i); inner.index.setX(i, inner.index.getX(i + 2)); inner.index.setX(i + 2, a);
  }
  const caps = new THREE.CylinderGeometry(1, 1, 2, 64).rotateX(Math.PI / 2);
  const model = mergeGeometries([caps, inner]);
  const { geometry, metadata } = aplicarSvgSuperficie(model, new THREE.PlaneGeometry(1, 1), { tipo: 'corpo', baseArte: new THREE.Vector3(1, 0, 0), escala: 1000 });
  assert.ok(Math.abs(area(geometry) - area(outer)) < 1e-5, `área exterior completa ${area(geometry)} vs ${area(outer)}`);
  assert.equal(metadata.mapeamento, 'cilindrico-z-uma-volta');
  const p = geometry.attributes.position;
  let frente = false, costas = false;
  for (let i = 0; i < p.count; i++) {
    assert.ok(Math.hypot(p.getX(i), p.getY(i)) > 0.99, 'apenas o casco exterior');
    assert.ok(Math.abs(geometry.attributes.normal.getZ(i)) < 1e-5, 'sem tampas');
    frente ||= p.getX(i) > 0.99; costas ||= p.getX(i) < -0.99;
  }
  assert.ok(frente && costas, 'arte cobre frente e costas');
});

test('recorte não pinta componentes soltos do mesmo STL', () => {
  const principal = new THREE.CylinderGeometry(1, 1, 2, 32).rotateX(Math.PI / 2);
  const solto = new THREE.CylinderGeometry(0.3, 0.3, 0.4, 32).rotateX(Math.PI / 2).translate(0, 3, -0.8);
  const model = mergeGeometries([principal, solto]);
  const arte = new THREE.PlaneGeometry(1, 1);
  const { geometry } = aplicarSvgSuperficie(model, arte, { tipo: 'corpo', baseArte: new THREE.Vector3(1, 0, 0), escala: 1000 });
  geometry.computeBoundingBox();
  assert.ok(geometry.boundingBox.max.y <= 1.00001, 'peça solta fora do corpo selecionado não recebe arte');
  const placa = new THREE.BoxGeometry(2, 2, 1);
  const outraPlaca = new THREE.BoxGeometry(2, 2, 1).translate(4, 0, 0);
  const duasPlacas = mergeGeometries([placa, outraPlaca]);
  const topo = aplicarSvgSuperficie(duasPlacas, arte, { baseArte: new THREE.Vector3(0, 0, 0.5), escala: 1000 }).geometry;
  topo.computeBoundingBox();
  assert.ok(topo.boundingBox.max.x <= 1.00001, 'apenas a região plana conectada selecionada recebe arte');
  for (const g of [principal, solto, model, arte, geometry, placa, outraPlaca, duasPlacas, topo]) g.dispose();
});

for (const produto of produtos.filter(p => p.personalizador3d)) {
  test(`STL real ${produto.id}: aplica arte excedente apenas na superfície`, () => {
    const { geometry: model, mesh, baseArte, tipo } = lerProduto(produto);
    const start = performance.now();
    const { geometry, metadata } = aplicarSvgSuperficie(model, new THREE.PlaneGeometry(1, 1), { tipo, baseArte, escala: 1000 });
    const ms = performance.now() - start;
    const p = geometry.attributes.position;
    assert.ok(p.count > 0);
    for (let i = 0; i < p.count; i++) {
      assert.ok(Number.isFinite(p.getX(i)) && Number.isFinite(p.getY(i)) && Number.isFinite(p.getZ(i)));
      assert.ok(p.getX(i) >= model.boundingBox.min.x - 1e-5 && p.getX(i) <= model.boundingBox.max.x + 1e-5);
      assert.ok(p.getY(i) >= model.boundingBox.min.y - 1e-5 && p.getY(i) <= model.boundingBox.max.y + 1e-5);
      if (tipo !== 'corpo') assert.ok(Math.abs(p.getZ(i) - baseArte.z) < 1e-5, 'somente o nível escolhido, sem borda/fundo externo');
    }
    if (tipo === 'corpo') {
      // Pontos das faces produzidas continuam sobre o STL: não existe uma
      // placa plana cruzando o modelo nem arte fora do contorno/altura.
      const ray = new THREE.Raycaster(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
      for (let i = 0; i < p.count; i += Math.max(3, Math.floor(p.count / 60 / 3) * 3)) {
        a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
        const centro = a.add(b).add(c).divideScalar(3);
        const radial = new THREE.Vector3(centro.x, centro.y - baseArte.y, 0).normalize();
        ray.set(centro.clone().addScaledVector(radial, 10), radial.negate());
        const hit = ray.intersectObject(mesh)[0];
        assert.ok(hit && hit.point.distanceTo(centro) < 1e-4, `arte adere à primeira superfície externa do BIC: ${centro.toArray()}, distância ${hit?.point.distanceTo(centro)}, normalHit ${hit?.face.normal.toArray()}, normalArte ${[geometry.attributes.normal.getX(i), geometry.attributes.normal.getY(i), geometry.attributes.normal.getZ(i)]}`);
      }
    }
    console.log({ produto: produto.id, triangulosModelo: metadata.triangulosModelo, triangulosAplicados: metadata.triangulosAplicados, ms: Math.round(ms) });
    geometry.dispose(); model.dispose(); mesh.material.dispose();
  });
}

test('arte excessivamente complexa falha explicitamente antes de processar', () => {
  const svg = new THREE.PlaneGeometry(1, 1, 150, 150);
  assert.throws(() => aplicarSvgSuperficie(new THREE.BoxGeometry(2, 2, 1), svg, { baseArte: new THREE.Vector3(0, 0, 0.5) }), /complexa demais/);
});
