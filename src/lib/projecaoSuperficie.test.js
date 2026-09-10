import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { criarProjecaoX } from './projecaoSuperficie.js';

test('projeção indexada coincide com raycaster no STL BIC', () => {
  const file = readFileSync('public/svg/CAPA_BIC_BASE01.stl');
  const geometry = new STLLoader().parse(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength));
  geometry.rotateZ(-Math.PI / 2);
  geometry.center();
  geometry.computeBoundingBox();
  const size = geometry.boundingBox.getSize(new THREE.Vector3());
  const scale = 3.4 / Math.max(size.x, size.y, size.z);
  geometry.scale(scale, scale, scale);
  const start = performance.now();
  const project = criarProjecaoX(geometry);
  const indexedMs = performance.now() - start;
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  mesh.updateMatrixWorld();
  const ray = new THREE.Raycaster();
  const points = Array.from({ length: 100 }, (_, i) => [(i % 10 - 4.5) * 0.18, (Math.floor(i / 10) - 4.5) * 0.28]);
  const rayStart = performance.now();
  const expected = points.map(([y, z]) => {
    ray.set(new THREE.Vector3(10, y, z), new THREE.Vector3(-1, 0, 0));
    return ray.intersectObject(mesh)[0]?.point.x ?? null;
  });
  const rayMs = performance.now() - rayStart;
  const fastStart = performance.now();
  const actual = points.map(([y, z]) => project(y, z));
  const fastMs = performance.now() - fastStart;
  actual.forEach((x, i) => expected[i] === null ? assert.equal(x, null) : assert.ok(Math.abs(x - expected[i]) < 1e-5));
  console.log({ triangles: geometry.attributes.position.count / 3, indexedMs, rayMs, fastMs });
  geometry.dispose(); mesh.material.dispose();
});
