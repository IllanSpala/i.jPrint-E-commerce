import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Worker as NodeWorker } from 'node:worker_threads';
import { BoxGeometry, PlaneGeometry } from 'three';
import { iniciarAplicacaoSuperficie } from './aplicacaoAssincrona.js';

// Executa o mesmo módulo de Web Worker em uma thread Node; apenas adapta a
// interface de mensagens, sem simular o algoritmo ou a transferência de buffers.
class WorkerAdapter {
  constructor(url) {
    this.worker = new NodeWorker(`
      const { parentPort } = require('node:worker_threads');
      globalThis.self = { postMessage: (data, transfer) => parentPort.postMessage(data, transfer) };
      import(${JSON.stringify(url.href)}).then(() => parentPort.on('message', data => self.onmessage({ data })));
    `, { eval: true });
    this.worker.on('message', data => this.onmessage?.({ data }));
    this.worker.on('error', error => this.onerror?.(error));
  }
  postMessage(data, transfer) { this.worker.postMessage(data, transfer); }
  terminate() { this.worker.terminate(); }
}

test('aplicação assíncrona transfere o resultado e permite cancelamento', async () => {
  const originalWorker = globalThis.Worker;
  globalThis.Worker = WorkerAdapter;
  const model = new BoxGeometry(2, 2, 1), svg = new PlaneGeometry(1, 1);
  try {
    const opcoes = { tipo: 'topo', baseArte: { x: 0, y: 0, z: 0.5 }, escala: 240 };
    const resultado = await iniciarAplicacaoSuperficie(model, svg, opcoes).promise;
    assert.ok(resultado.geometry.attributes.position.count > 0);
    assert.ok(model.attributes.position.array.byteLength > 0, 'a geometria exibida não perde seus buffers');
    assert.equal(resultado.metadata.superficieRecortada, true);
    resultado.geometry.dispose();
    const cancelado = iniciarAplicacaoSuperficie(model, svg, opcoes);
    cancelado.cancelar();
    await assert.rejects(cancelado.promise, /cancelada/);
    await assert.rejects(iniciarAplicacaoSuperficie(model, svg, { ...opcoes, escala: 0 }).promise, /tamanho positivo/);
  } finally {
    model.dispose(); svg.dispose();
    if (originalWorker === undefined) delete globalThis.Worker;
    else globalThis.Worker = originalWorker;
  }
});
