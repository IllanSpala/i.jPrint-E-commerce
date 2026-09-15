import { test } from 'node:test';
import assert from 'node:assert/strict';
import { vetorizarImagem } from './vetorizarImagem.js';

function imagem(width, height, pixel) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data.set(pixel(x, y), (y * width + x) * 4);
  return { width, height, data, ruido: 0 };
}
const preto = [0, 0, 0, 255], branco = [255, 255, 255, 255];

test('remove fundo uniforme e gera caminhos, não bitmap embutido', () => {
  const input = imagem(10, 10, (x, y) => x >= 2 && x < 8 && y >= 2 && y < 8 ? preto : branco);
  const r = vetorizarImagem(input);
  assert.equal(r.contornos, 1); assert.equal(r.pontos, 4);
  assert.match(r.svg, /<path/); assert.doesNotMatch(r.svg, /<image|base64/);
  assert.match(r.svg, /M2 2L8 2L8 8L2 8Z/);
});

test('preserva furo fechado por contraste e transparência', () => {
  for (const transparente of [false, true]) {
    const input = imagem(12, 12, (x, y) => x >= 2 && x < 10 && y >= 2 && y < 10 && !(x >= 4 && x < 8 && y >= 4 && y < 8) ? preto : transparente ? [0, 0, 0, 0] : branco);
    const r = vetorizarImagem({ ...input, modo: transparente ? 'silhueta' : 'contraste', removerFundo: !transparente });
    assert.equal(r.contornos, 2); assert.match(r.svg, /fill-rule="evenodd"/);
  }
});

test('permite logo branco sobre transparência ou fundo escuro', () => {
  const transparent = imagem(8, 8, (x, y) => x >= 2 && x < 6 && y >= 2 && y < 6 ? branco : [0, 0, 0, 0]);
  assert.equal(vetorizarImagem({ ...transparent, modo: 'silhueta', removerFundo: false }).contornos, 1);
  const dark = imagem(8, 8, (x, y) => x >= 2 && x < 6 && y >= 2 && y < 6 ? branco : preto);
  assert.equal(vetorizarImagem({ ...dark, inverter: true }).contornos, 1);
});

test('limpeza remove ilhas pequenas e mantém desenho principal', () => {
  const input = imagem(12, 12, (x, y) => (x >= 3 && x <= 8 && y >= 3 && y <= 8) || (x === 1 && y === 1) ? preto : branco);
  assert.equal(vetorizarImagem(input).contornos, 2);
  assert.equal(vetorizarImagem({ ...input, ruido: 4 }).contornos, 1);
});

test('ilhas diagonais têm contornos fechados separados', () => {
  const input = imagem(6, 6, (x, y) => (x === 2 && y === 2) || (x === 3 && y === 3) ? preto : branco);
  assert.equal(vetorizarImagem(input).contornos, 2);
});

test('remoção pode ser desativada e entrada vazia falha com orientação', () => {
  const input = imagem(6, 6, () => preto);
  assert.throws(() => vetorizarImagem(input), /Nenhum desenho/);
  assert.equal(vetorizarImagem({ ...input, removerFundo: false }).contornos, 1);
  assert.throws(() => vetorizarImagem({ data: new Uint8Array(0), width: 9999, height: 9999 }), /grande demais/);
});
